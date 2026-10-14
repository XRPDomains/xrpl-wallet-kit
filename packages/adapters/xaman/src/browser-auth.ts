import { XummSdkJwt } from "xumm-sdk";
import { isValidClassicAddress } from "xrpl";
import { WalletKitError, WalletKitErrorCode } from "@xrpl-wallet-kit/core";
import type { XamanAuthResult, XamanPkceAuth, XamanSdkLike } from "./index";

const PREFIX = "xwk.xaman.oauth.";
const ORIGIN = "https://oauth2.xumm.app";
const TTL = 300000;
const CALLBACK_KEYS = ["access_token", "state", "token_type", "expires_in", "scope", "error", "error_description"];
interface Attempt { apiKey: string; redirect: string; expires: number; cancelled?: boolean }
interface Saved { jwt: string; state: string }

function read<T>(key: string): T | undefined {
  try { return JSON.parse(window.localStorage.getItem(key) ?? "null") ?? undefined; }
  catch { return undefined; }
}

/** Each browser authorization owns a state; only the issuer can authenticate its token. */
export class XamanBrowserAuth implements XamanPkceAuth {
  private controller = new AbortController();
  private state?: string;
  private session?: XamanAuthResult;
  private saved?: Saved;
  private pending?: Promise<XamanAuthResult | undefined>;
  private popup?: Window | null;
  private readonly sessionKey: string;

  constructor(private apiKey: string, private createSdk: (jwt: string) => XamanSdkLike = jwt => new XummSdkJwt(jwt) as unknown as XamanSdkLike) {
    this.sessionKey = `${PREFIX}session.${apiKey}`;
  }

  static supported(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined"
      && Boolean(window.location?.href) && !/xumm\/xapp|xAppBuilder/i.test(navigator.userAgent)
      && (!new URL(window.location.href).searchParams.has("access_token")
        || new URL(window.location.href).searchParams.get("state")?.startsWith("xwk-") === true)
      && !new URL(window.location.href).searchParams.has("authorization_code");
  }

  get isPending(): boolean { return Boolean(this.pending && !this.session); }

  canRecover(): boolean {
    const url = new URL(window.location.href);
    const state = url.searchParams.get("state");
    const attempt = state ? read<Attempt>(PREFIX + state) : undefined;
    return Boolean(state?.startsWith("xwk-") && attempt?.apiKey === this.apiKey
      && !attempt.cancelled && attempt.expires > Date.now());
  }

  async restore(): Promise<XamanAuthResult | undefined> {
    if (this.session) return this.session;
    const saved = read<Saved>(this.sessionKey);
    if (!saved || typeof saved.jwt !== "string" || typeof saved.state !== "string") return undefined;
    this.saved = saved;
    try {
      return await this.run(() => this.verify(saved.jwt, saved.state, false));
    } catch {
      // Never delete another tab's newer session.
      if (read<Saved>(this.sessionKey)?.jwt === saved.jwt) window.localStorage.removeItem(this.sessionKey);
      return undefined;
    }
  }

  authorize(): Promise<XamanAuthResult | undefined> {
    if (this.session) return Promise.resolve(this.session);
    if (this.pending) return this.pending;
    this.pending = this.run(async () => {
      const callback = new URL(window.location.href);
      if (callback.searchParams.get("state")?.startsWith("xwk-")) {
        this.state = callback.searchParams.get("state")!;
        return this.receive(callback);
      }
      const saved = read<Saved>(this.sessionKey);
      if (saved && typeof saved.jwt === "string" && typeof saved.state === "string") {
        try { this.saved = saved; return await this.verify(saved.jwt, saved.state, false); }
        catch { this.assertActive(); }
      }
      return this.start();
    });
    return this.pending;
  }

  private assertActive(): void {
    if (this.controller.signal.aborted) throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Xaman authorization cancelled.");
    if (!this.state) return;
    const attempt = read<Attempt>(PREFIX + this.state);
    if (!attempt || attempt.apiKey !== this.apiKey || attempt.cancelled || attempt.expires <= Date.now()) {
      throw new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Xaman authorization expired or was cancelled.");
    }
  }

  private async run(work: () => Promise<XamanAuthResult | undefined>): Promise<XamanAuthResult | undefined> {
    const deadline = Date.now() + TTL;
    let reject!: (error: Error) => void;
    const stopped = new Promise<never>((_, fail) => { reject = fail; });
    const abort = () => reject(new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Xaman authorization cancelled."));
    const checkDeadline = () => {
      if (Date.now() < deadline) return;
      reject(new WalletKitError(WalletKitErrorCode.REQUEST_TIMEOUT, "Xaman authorization timed out."));
      this.cancelAuthorization();
    };
    const timer = setTimeout(checkDeadline, TTL);
    this.controller.signal.addEventListener("abort", abort, { once: true });
    window.addEventListener("pageshow", checkDeadline);
    document.addEventListener("visibilitychange", checkDeadline);
    try {
      this.assertActive();
      const result = await Promise.race([work(), stopped]);
      this.assertActive();
      this.session = result;
      return result;
    } catch (error) {
      this.cancelAuthorization();
      throw error;
    } finally {
      clearTimeout(timer);
      this.controller.signal.removeEventListener("abort", abort);
      window.removeEventListener("pageshow", checkDeadline);
      document.removeEventListener("visibilitychange", checkDeadline);
    }
  }

  private start(): Promise<XamanAuthResult> {
    const bytes = window.crypto.getRandomValues(new Uint8Array(32));
    this.state = "xwk-" + Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    const redirect = new URL(window.location.href);
    CALLBACK_KEYS.forEach(key => redirect.searchParams.delete(key));
    this.prune();
    window.localStorage.setItem(PREFIX + this.state, JSON.stringify({ apiKey: this.apiKey,
      redirect: redirect.href, expires: Date.now() + TTL } satisfies Attempt));
    const url = new URL("/auth", ORIGIN);
    url.search = new URLSearchParams({ client_id: this.apiKey, redirect_uri: redirect.href,
      response_type: "token", scope: "XummPkce", state: this.state }).toString();
    return new Promise((resolve, reject) => {
      let resolving = false;
      const cleanup = () => {
        clearInterval(timer);
        window.removeEventListener("storage", check);
        window.removeEventListener("focus", check);
        window.removeEventListener("pageshow", check);
        window.removeEventListener("message", message);
        document.removeEventListener("visibilitychange", check);
        this.controller.signal.removeEventListener("abort", abort);
      };
      const finish = (work: () => Promise<XamanAuthResult>) => {
        if (resolving) return;
        resolving = true;
        Promise.resolve().then(work).then(resolve, reject).finally(cleanup);
      };
      const check = () => {
        try {
          this.assertActive();
          const result = read<{ jwt?: string; rejected?: boolean }>(`${PREFIX}${this.state}.result`);
          if (result?.rejected) throw new WalletKitError(WalletKitErrorCode.CONNECTION_REJECTED, "Xaman authorization rejected.");
          if (typeof result?.jwt === "string") finish(() => this.verify(result.jwt!, this.state!, true));
        } catch (error) { cleanup(); reject(error); }
      };
      const message = (event: MessageEvent) => {
        if (![ORIGIN, "https://xumm.app"].includes(event.origin) || !this.popup || event.source !== this.popup) return;
        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (data?.source === "xumm_sign_request_rejected") {
            cleanup();
            reject(new WalletKitError(WalletKitErrorCode.CONNECTION_REJECTED, "Xaman authorization rejected."));
            return;
          }
          if (data?.source !== "xumm_sign_request_resolved") return;
          const callback = new URL(data.options.full_redirect_uri);
          if (callback.searchParams.get("state") === this.state) finish(() => this.receive(callback));
        } catch { /* Ignore unrelated wallet messages. */ }
      };
      const abort = () => { cleanup(); reject(new WalletKitError(WalletKitErrorCode.REQUEST_CANCELLED, "Xaman authorization cancelled.")); };
      const timer = setInterval(check, 1000);
      window.addEventListener("storage", check);
      window.addEventListener("focus", check);
      window.addEventListener("pageshow", check);
      window.addEventListener("message", message);
      document.addEventListener("visibilitychange", check);
      this.controller.signal.addEventListener("abort", abort, { once: true });
      try {
        this.popup = window.open(url.href, `Xaman-${this.state}`, "popup=yes,width=600,height=790,resizable=yes,scrollbars=yes");
        if (!this.popup) throw new Error("Allow popups to connect Xaman.");
      } catch (error) { cleanup(); reject(error); }
    });
  }

  private async receive(callback: URL): Promise<XamanAuthResult> {
    this.assertActive();
    const attempt = read<Attempt>(PREFIX + this.state)!;
    const redirect = new URL(attempt.redirect);
    if (callback.origin !== redirect.origin || callback.pathname !== redirect.pathname
      || callback.searchParams.get("state") !== this.state) throw new Error("Unexpected Xaman callback.");
    if (callback.href === window.location.href) {
      const clean = new URL(callback.href);
      CALLBACK_KEYS.forEach(key => clean.searchParams.delete(key));
      window.history.replaceState(window.history.state, "", clean.href);
    }
    if (callback.searchParams.has("error")) {
      window.localStorage.setItem(`${PREFIX}${this.state}.result`, JSON.stringify({ rejected: true }));
      throw new WalletKitError(WalletKitErrorCode.CONNECTION_REJECTED, "Xaman authorization rejected.");
    }
    const jwt = callback.searchParams.get("access_token");
    if (!jwt) throw new Error("Xaman did not return an access token.");
    const session = await this.verify(jwt, this.state!, true);
    this.assertActive();
    window.localStorage.setItem(`${PREFIX}${this.state}.result`, JSON.stringify({ jwt }));
    return session;
  }

  private async verify(jwt: string, state: string, pending: boolean): Promise<XamanAuthResult> {
    this.assertActive();
    const claims = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    // Unverified claims only constrain scope; /userinfo authenticates the token below.
    const audience = claims.client_id ?? claims.app_uuidv4 ?? claims.aud;
    if (!(audience === this.apiKey || Array.isArray(audience) && audience.includes(this.apiKey))
      || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()
      || claims.state !== undefined && claims.state !== state) throw new Error("Invalid Xaman token scope or expiry.");
    const attempt = read<Attempt>(PREFIX + state);
    if (attempt?.cancelled || pending && (!attempt || attempt.expires <= Date.now())) throw new Error("Stale Xaman authorization.");
    const response = await fetch(`${ORIGIN}/userinfo`, { headers: { Authorization: `Bearer ${jwt}` }, signal: this.controller.signal });
    if (!response.ok) throw new Error("Unable to authenticate Xaman token with its issuer.");
    const me = await response.json() as NonNullable<XamanAuthResult["me"]>;
    this.assertActive();
    if (!me || typeof me.account !== "string" || !isValidClassicAddress(me.account)
      || typeof me.sub !== "string" || me.sub !== me.account) throw new Error("Invalid Xaman authorized account.");
    if (read<Attempt>(PREFIX + state)?.cancelled) throw new Error("Cancelled Xaman authorization.");
    const client = this.createSdk(jwt);
    const sdk: XamanSdkLike = {
      payload: client.payload,
      state: { signedIn: true, account: me.account },
      user: { account: me.account, networkType: me.networkType, networkEndpoint: me.networkEndpoint },
      environment: { openid: Promise.resolve(me) }
    };
    this.saved = { jwt, state };
    window.localStorage.setItem(this.sessionKey, JSON.stringify(this.saved));
    return { me, sdk };
  }

  private prune(): void {
    const storage = window.localStorage;
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (!key?.startsWith(PREFIX + "xwk-") || key.endsWith(".result")) continue;
      const attempt = read<Attempt>(key);
      if (!attempt || !Number.isFinite(attempt.expires) || attempt.expires + 86400000 < Date.now()) {
        storage.removeItem(key); storage.removeItem(key + ".result");
      }
    }
  }

  cancelAuthorization(): void {
    this.controller.abort();
    if (this.state && !this.session) {
      const attempt = read<Attempt>(PREFIX + this.state);
      try { if (attempt) window.localStorage.setItem(PREFIX + this.state, JSON.stringify({ ...attempt, cancelled: true })); }
      catch { /* Storage may be unavailable after browser suspension. */ }
    }
    try { this.popup?.close(); } catch { /* Best-effort popup cleanup. */ }
  }

  logout(): void {
    this.cancelAuthorization();
    if (this.saved) {
      const attempt = read<Attempt>(PREFIX + this.saved.state);
      if (attempt) window.localStorage.setItem(PREFIX + this.saved.state, JSON.stringify({ ...attempt, cancelled: true }));
    }
    if (this.saved && read<Saved>(this.sessionKey)?.jwt === this.saved.jwt) window.localStorage.removeItem(this.sessionKey);
    this.session = undefined;
  }
}
