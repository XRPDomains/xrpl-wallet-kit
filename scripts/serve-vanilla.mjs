import { createServer, loadEnv, normalizePath } from "vite";
import { randomBytes } from "node:crypto";

const env = loadEnv("development", process.cwd(), "VITE_");
const defineEnv = Object.fromEntries(
  Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
);
const issuedNonces = new Map();
const authIndexModuleId = `/@fs/${normalizePath(`${process.cwd()}/packages/auth/src/index.ts`)}`;
const authVerifierModuleId = `/@fs/${normalizePath(`${process.cwd()}/packages/auth/src/verifiers/index.ts`)}`;

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body, null, 2));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function addAuthTestServer(server) {
  server.middlewares.use("/api/auth/nonce", (req, res) => {
    if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" });
    const nonce = randomBytes(24).toString("hex");
    issuedNonces.set(nonce, { used: false, issuedAt: Date.now() });
    console.log("[auth:nonce]", { nonce });
    sendJson(res, 200, { ok: true, nonce });
  });

  server.middlewares.use("/api/auth/verify", async (req, res) => {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });
    const logs = [];
    const log = (stage, data) => {
      const entry = { stage, ...data };
      logs.push(entry);
      console.log("[auth:verify]", entry);
    };

    try {
      const body = await readJsonBody(req);
      log("request_received", {
        address: body.address,
        signatureKind: body.signatureKind,
        proofLength: typeof body.proof === "string" ? body.proof.length : 0,
        hasPublicKey: Boolean(body.publicKey)
      });

      const { parseAuthMessage, validateAuthMessage } = await server.ssrLoadModule(authIndexModuleId);
      const { createXrplSignatureVerifier } = await server.ssrLoadModule(authVerifierModuleId);
      const parsed = parseAuthMessage(body.message ?? "");
      log("message_parsed", parsed);

      const nonceState = issuedNonces.get(parsed.nonce);
      if (!nonceState) {
        return sendJson(res, 400, { ok: false, stage: "nonce", error: "Unknown nonce. Request a fresh nonce and try again.", logs });
      }
      if (nonceState.used) {
        return sendJson(res, 400, { ok: false, stage: "nonce", error: "Nonce has already been used.", logs });
      }

      const validation = await validateAuthMessage(body.message ?? "", {
        expectedDomain: req.headers.host,
        expectedUri: `http://${req.headers.host}`,
        expectedAddress: body.address,
        now: new Date(),
        maxAgeSeconds: 10 * 60
      });
      log("message_validated", { valid: validation.valid, errors: validation.errors });
      if (!validation.valid) {
        return sendJson(res, 400, { ok: false, stage: "message_validation", errors: validation.errors, logs });
      }

      const verifier = createXrplSignatureVerifier({
        nodeUrl: "wss://xrplcluster.com"
      });
      const verified = await verifier.verify({
        address: body.address,
        message: body.message,
        signatureKind: body.signatureKind,
        proof: body.proof,
        signature: body.signature,
        txBlob: body.txBlob,
        publicKey: body.publicKey,
        raw: body.raw
      });
      log("proof_verified", { verified });

      if (!verified) {
        return sendJson(res, 401, { ok: false, stage: "proof_verification", error: "Signature proof is not valid for this message/address.", logs });
      }

      nonceState.used = true;
      log("authenticated", { address: body.address, nonce: parsed.nonce });
      return sendJson(res, 200, { ok: true, address: body.address, nonce: parsed.nonce, logs });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("server_error", { message });
      return sendJson(res, 500, { ok: false, stage: "server_error", error: message, logs });
    }
  });
}

const server = await createServer({
  root: "examples/vanilla",
  envDir: process.cwd(),
  define: defineEnv,
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true
  },
  plugins: [{
    name: "xwk-auth-test-server",
    configureServer: addAuthTestServer
  }],
  clearScreen: false
});

await server.listen();
server.printUrls();

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

setInterval(() => {}, 1 << 30);
