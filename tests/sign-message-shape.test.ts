import assert from "node:assert/strict";
import test from "node:test";
import { CrossmarkAdapter } from "../packages/adapters/crossmark/src/index";
import { DropFiAdapter } from "../packages/adapters/dropfi/src/index";
import { GemWalletAdapter } from "../packages/adapters/gemwallet/src/index";
import { createWalletConnectAdapter, XRPLWalletConnectMethod } from "../packages/adapters/walletconnect/src/index";
import { WalletKitErrorCode } from "../packages/core/src/errors";
import { OtsuAdapter } from "../packages/adapters/otsu/src/index";
import { XamanAdapter } from "../packages/adapters/xaman/src/index";
import { XrplSnapAdapter, type Eip1193Provider } from "../packages/adapters/xrpl-snap/src/index";

const account = { address: "rShapeAddress", publicKey: "EDPUBLICKEY" };
const network = {
  id: "mainnet",
  name: "XRPL Mainnet",
  networkType: "MAINNET",
  rpcUrl: "wss://xrplcluster.com",
  walletConnectChainId: "xrpl:0"
} as const;

test("extension message signing adapters return compact signature proofs", async () => {
  const gem = await new GemWalletAdapter({
    provider: { signMessage: async () => ({ result: { signedMessage: "gem-signature" } }) }
  }).signMessage({ message: "hello", account });
  assert.equal(gem.signatureKind, "signature");
  assert.equal(gem.proof, "gem-signature");
  assert.equal(gem.signature, "gem-signature");
  assert.equal(gem.publicKey, account.publicKey);

  const crossmark = await new CrossmarkAdapter({
    provider: {
      sync: { isInstalled: () => true },
      methods: {
        signInAndWait: async () => ({ response: { data: { signature: "crossmark-signature", publicKey: "EDCROSSMARK" } } })
      }
    }
  }).signMessage({ message: "hello", account });
  assert.equal(crossmark.signatureKind, "signature");
  assert.equal(crossmark.proof, "crossmark-signature");
  assert.equal(crossmark.signature, "crossmark-signature");
  assert.equal(crossmark.publicKey, "EDCROSSMARK");

  const dropfi = await new DropFiAdapter({
    provider: { signMessage: async () => "dropfi-signature" }
  }).signMessage({ message: "hello", account });
  assert.equal(dropfi.signatureKind, "signature");
  assert.equal(dropfi.proof, "dropfi-signature");
  assert.equal(dropfi.signature, "dropfi-signature");
  assert.equal(dropfi.publicKey, account.publicKey);

  const otsu = await new OtsuAdapter({
    provider: {
      isOtsu: true,
      connect: async () => ({ address: account.address }),
      getAddress: async () => ({ address: account.address }),
      signMessage: async () => ({ signature: "otsu-signature" }),
      signTransaction: async () => ({ tx_blob: "BLOB", hash: "HASH" }),
      signAndSubmit: async () => ({ hash: "HASH" })
    }
  }).signMessage({ message: "hello", account });
  assert.equal(otsu.signatureKind, "signature");
  assert.equal(otsu.proof, "otsu-signature");
  assert.equal(otsu.signature, "otsu-signature");
  assert.equal(otsu.publicKey, account.publicKey);
});

test("message signing adapters accept wallet-specific wrapped proof shapes", async () => {
  let crossmarkMessage = "";
  const crossmark = await new CrossmarkAdapter({
    provider: {
      sync: { isInstalled: () => true },
      methods: {
        signInAndWait: async (message) => {
          crossmarkMessage = message ?? "";
          return { response: { data: { resp: { signature: "crossmark-wrapped-signature", publicKey: "EDWRAPPED" } } } };
        }
      }
    }
  }).signMessage({ message: "hello", account });
  assert.equal(crossmarkMessage, "68656C6C6F");
  assert.equal(crossmark.signatureKind, "signature");
  assert.equal(crossmark.proof, "crossmark-wrapped-signature");
  assert.equal(crossmark.signature, "crossmark-wrapped-signature");
  assert.equal(crossmark.publicKey, "EDWRAPPED");

  const dropfi = await new DropFiAdapter({
    provider: { signMessage: async () => ({ result: { signedMessage: "dropfi-wrapped-signature" } }) }
  }).signMessage({ message: "hello", account });
  assert.equal(dropfi.signatureKind, "signature");
  assert.equal(dropfi.proof, "dropfi-wrapped-signature");
  assert.equal(dropfi.signature, "dropfi-wrapped-signature");

  const dropfiWithPublicKey = await new DropFiAdapter({
    provider: {
      getPublicKey: async () => ({ result: { publicKey: "EDDROPFI" } }),
      signMessage: async () => ({ response: { data: { signature: "dropfi-public-key-signature" } } })
    }
  }).signMessage({ message: "hello", account: { address: account.address } });
  assert.equal(dropfiWithPublicKey.signatureKind, "signature");
  assert.equal(dropfiWithPublicKey.proof, "dropfi-public-key-signature");
  assert.equal(dropfiWithPublicKey.publicKey, "EDDROPFI");

  const otsuWithPublicKey = await new OtsuAdapter({
    provider: {
      isOtsu: true,
      connect: async () => ({ address: account.address }),
      getAddress: async () => ({ address: account.address }),
      signMessage: async () => ({ signature: "otsu-public-key-signature", publicKey: "EDOTSU" }),
      signTransaction: async () => ({ tx_blob: "BLOB", hash: "HASH" }),
      signAndSubmit: async () => ({ hash: "HASH" })
    }
  }).signMessage({ message: "hello", account: { address: account.address } });
  assert.equal(otsuWithPublicKey.signatureKind, "signature");
  assert.equal(otsuWithPublicKey.proof, "otsu-public-key-signature");
  assert.equal(otsuWithPublicKey.publicKey, "EDOTSU");
});

test("transaction-style message signing adapters return signedTx proofs", async () => {
  const xaman = await new XamanAdapter({
    sdk: {
      state: { account: account.address, signedIn: true },
      payload: {
        createAndSubscribe: async () => ({
          created: { uuid: "payload-id" },
          resolved: Promise.resolve({ signed: true })
        }),
        get: async () => ({ meta: { signed: true }, response: { hex: "SIGNED_SIGNIN_TX" } })
      }
    }
  }).signMessage({ message: "hello", account });
  assert.equal(xaman.signatureKind, "signedTx");
  assert.equal(xaman.proof, "SIGNED_SIGNIN_TX");
  assert.equal(xaman.txBlob, "SIGNED_SIGNIN_TX");
  assert.equal(xaman.signature, undefined);

  const provider: Eip1193Provider = {
    request: async () => ({ tx_blob: "SIGNED_SNAP_TX" })
  };
  const snap = await new XrplSnapAdapter({ ethereum: provider }).signMessage({ message: "hello", account });
  assert.equal(snap.signatureKind, "signedTx");
  assert.equal(snap.proof, "SIGNED_SNAP_TX");
  assert.equal(snap.txBlob, "SIGNED_SNAP_TX");
  assert.equal(snap.signature, undefined);
});

test("transaction-style message signing adapters accept wrapped tx blob proofs", async () => {
  const snapProvider: Eip1193Provider = {
    request: async () => ({ response: { data: { hex: "WRAPPED_SNAP_TX" } } })
  };
  const snap = await new XrplSnapAdapter({ ethereum: snapProvider }).signMessage({ message: "hello", account });
  assert.equal(snap.signatureKind, "signedTx");
  assert.equal(snap.proof, "WRAPPED_SNAP_TX");
  assert.equal(snap.txBlob, "WRAPPED_SNAP_TX");

  const walletConnect = createWalletConnectAdapter({
    projectId: "test-project",
    signClient: {
      request: async () => ({ response: { data: { tx_blob: "WRAPPED_WC_TX" } } })
    } as never
  }) as unknown as {
    client: unknown;
    session: unknown;
    activeNetwork: typeof network;
    signMessage(request: { message: string; account: typeof account }): Promise<{ signatureKind: string; proof?: string; txBlob?: string }>;
  };
  walletConnect.activeNetwork = network;
  walletConnect.session = {
    topic: "topic",
    namespaces: {
      xrpl: {
        methods: [XRPLWalletConnectMethod.SIGN_MESSAGE],
        accounts: [`${network.walletConnectChainId}:${account.address}`]
      }
    }
  };
  const wc = await walletConnect.signMessage({ message: "hello", account });
  assert.equal(wc.signatureKind, "signedTx");
  assert.equal(wc.proof, "WRAPPED_WC_TX");
  assert.equal(wc.txBlob, "WRAPPED_WC_TX");

  const signedTxJson = {
    TransactionType: "Payment",
    Account: "rG5Ro9e3uGEZVCh3zu5gB9ydKUskCs221W",
    Destination: "rawz2WQ8i9FdTHp4KSNpBdyxgFqNpKe8fM",
    Amount: "1",
    Fee: "12",
    Sequence: 4,
    SigningPubKey: "0267268EE0DDDEE6A862C9FF9DDAF898CF17060A673AF771B565AA2F4AE24E3FC574",
    TxnSignature: "304402202646962A21EC0516FCE62DC9280F79E7265778C571E9410D795E67BB72A2D8E402202FF4AF7B2E2160F5BCA93011CB548014626CAC7FCBEBDB81FE8193CEFF69C753"
  };
  const walletConnectTxJson = createWalletConnectAdapter({
    projectId: "test-project",
    signClient: {
      request: async () => ({ result: { tx_json: signedTxJson } })
    } as never
  }) as unknown as typeof walletConnect;
  walletConnectTxJson.activeNetwork = network;
  walletConnectTxJson.session = walletConnect.session;
  const wcTxJson = await walletConnectTxJson.signMessage({ message: "hello", account });
  assert.equal(wcTxJson.signatureKind, "signedTx");
  assert.equal(typeof wcTxJson.txBlob, "string");
  assert.ok(wcTxJson.txBlob?.startsWith("1200"));
});

test("WalletConnect request clears stale key state and asks user to reconnect", async () => {
  let disconnectedTopic: string | undefined;
  const disconnectedPairings: string[] = [];
  const walletConnect = createWalletConnectAdapter({
    projectId: "test-project",
    signClient: {
      request: async () => {
        throw new Error("No matching key. proposal id expired");
      },
      disconnect: async ({ topic }: { topic: string }) => {
        disconnectedTopic = topic;
      },
      core: {
        pairing: {
          getPairings: () => [{ topic: "pairing-a" }, { topic: "pairing-b" }],
          disconnect: async ({ topic }: { topic: string }) => {
            disconnectedPairings.push(topic);
          }
        }
      }
    } as never
  }) as unknown as {
    session: unknown;
    activeNetwork: typeof network;
    signAndSubmit(request: { txJson: Record<string, unknown>; submit?: boolean }): Promise<unknown>;
  };
  walletConnect.activeNetwork = network;
  walletConnect.session = {
    topic: "stale-topic",
    namespaces: {
      xrpl: {
        methods: [XRPLWalletConnectMethod.SIGN_TRANSACTION],
        accounts: [`${network.walletConnectChainId}:${account.address}`]
      }
    }
  };

  await assert.rejects(
    () => walletConnect.signAndSubmit({
      submit: true,
      txJson: {
        TransactionType: "Payment",
        Account: account.address,
        Destination: account.address,
        Amount: "1"
      }
    }),
    /WalletConnect session is stale\. Please reconnect your wallet/
  );
  assert.equal(disconnectedTopic, "stale-topic");
  assert.deepEqual(disconnectedPairings, ["pairing-a", "pairing-b"]);
  assert.equal(walletConnect.session, undefined);
});

test("extension message signing adapters reject cancel/null signature results", async () => {
  await assert.rejects(
    () => new GemWalletAdapter({
      provider: { signMessage: async () => ({ result: null }) }
    }).signMessage({ message: "hello", account }),
    { code: WalletKitErrorCode.SIGN_REJECTED }
  );

  await assert.rejects(
    () => new GemWalletAdapter({
      provider: { signMessage: async () => ({ result: {} }) }
    }).signMessage({ message: "hello", account }),
    { code: WalletKitErrorCode.SIGN_REJECTED }
  );

  await assert.rejects(
    () => new CrossmarkAdapter({
      provider: {
        sync: { isInstalled: () => true },
        methods: {
          signInAndWait: async () => ({ response: { data: {} } })
        }
      }
    }).signMessage({ message: "hello", account }),
    { code: WalletKitErrorCode.SIGN_REJECTED }
  );

  await assert.rejects(
    () => new DropFiAdapter({
      provider: { signMessage: async () => null }
    }).signMessage({ message: "hello", account }),
    { code: WalletKitErrorCode.SIGN_REJECTED }
  );
});
