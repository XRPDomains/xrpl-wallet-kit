import assert from "node:assert/strict";
import test from "node:test";
import { CrossmarkAdapter, type CrossmarkProvider } from "../packages/adapters/crossmark/src/index";
import { DropFiAdapter, type DropFiProvider } from "../packages/adapters/dropfi/src/index";
import { GemWalletAdapter, type GemWalletProvider } from "../packages/adapters/gemwallet/src/index";
import { MemoryWalletStorage, WalletManager, WALLET_STORAGE_VERSION } from "../packages/core/src/index";
import type { WalletAdapter, WalletSession } from "../packages/core/src/index";

const network = {
  id: "mainnet",
  name: "XRPL Mainnet",
  networkType: "MAINNET",
  rpcUrl: "wss://xrplcluster.com",
  walletConnectChainId: "xrpl:0"
} as const;

const session: WalletSession = {
  adapterId: "gemwallet",
  account: { address: "rRestoreAddress", network },
  connectedAt: 1
};

test("GemWallet restoreSession requires the current extension address to match the stored session", async () => {
  const provider: GemWalletProvider = {
    isInstalled: async () => ({ result: { isInstalled: true } }),
    getAddress: async () => ({ result: { address: "rRestoreAddress" } })
  };

  const restored = await new GemWalletAdapter({ provider }).restoreSession(session);

  assert.equal(restored?.account.address, "rRestoreAddress");
});

test("GemWallet restoreSession returns null when the extension cannot provide an address", async () => {
  const provider: GemWalletProvider = {
    isInstalled: async () => ({ result: true }),
    getAddress: async () => ({ result: {} })
  };

  const restored = await new GemWalletAdapter({ provider }).restoreSession(session);

  assert.equal(restored, null);
});

test("DropFi restoreSession accepts passive address state even when isConnected is false after reload", async () => {
  const provider: DropFiProvider = {
    isDropFi: true,
    selectedAddress: "rRestoreAddress",
    isConnected: () => false
  };

  const restored = await new DropFiAdapter({ provider }).restoreSession({
    ...session,
    adapterId: "dropfi"
  });

  assert.equal(restored?.account.address, "rRestoreAddress");
  assert.deepEqual(restored?.raw, { address: "rRestoreAddress", connected: false });
});

test("DropFi restoreSession returns null when passive address differs from stored session", async () => {
  const provider: DropFiProvider = {
    isDropFi: true,
    selectedAddress: "rOtherAddress",
    isConnected: () => true
  };

  const restored = await new DropFiAdapter({ provider }).restoreSession({
    ...session,
    adapterId: "dropfi"
  });

  assert.equal(restored, null);
});

test("DropFi restoreSession accepts address hydrated by initialize after reload", async () => {
  const provider: DropFiProvider = {
    initialize: async () => ({ selectedAddress: "rRestoreAddress" }),
    isConnected: () => false
  };

  const restored = await new DropFiAdapter({ provider }).restoreSession({
    ...session,
    adapterId: "dropfi"
  });

  assert.equal(restored?.account.address, "rRestoreAddress");
});

test("DropFi restoreSession falls back when getAddress throws during hydration", async () => {
  const provider: DropFiProvider = {
    isDropFi: true,
    selectedAddress: "rRestoreAddress",
    getAddress: async () => {
      throw new Error("provider not hydrated");
    }
  };

  const restored = await new DropFiAdapter({ provider }).restoreSession({
    ...session,
    adapterId: "dropfi"
  });

  assert.equal(restored?.account.address, "rRestoreAddress");
});

test("DropFi restoreSession supports object-shaped getAddress results", async () => {
  const provider: DropFiProvider = {
    getAddress: async () => ({ result: { address: "rRestoreAddress" } }),
    isConnected: () => false
  };

  const restored = await new DropFiAdapter({ provider }).restoreSession({
    ...session,
    adapterId: "dropfi"
  });

  assert.equal(restored?.account.address, "rRestoreAddress");
});

test("Crossmark restoreSession restores from passive SDK address without opening sign-in", async () => {
  let signInCalls = 0;
  const provider: CrossmarkProvider = {
    sync: {
      isInstalled: () => true,
      getAddress: () => "rRestoreAddress",
      getNetwork: () => ({ id: "mainnet" })
    },
    methods: {
      signInAndWait: async () => {
        signInCalls += 1;
        return { response: { data: { address: "rRestoreAddress" } } };
      }
    }
  };

  const restored = await new CrossmarkAdapter({ provider }).restoreSession({
    ...session,
    adapterId: "crossmark"
  });

  assert.equal(restored?.account.address, "rRestoreAddress");
  assert.equal(signInCalls, 0);
});

test("Crossmark restoreSession falls back to session snapshot address", async () => {
  const provider: CrossmarkProvider = {
    sync: {
      isInstalled: () => true,
      getAddress: () => undefined
    },
    session: { address: "rRestoreAddress" },
    methods: {
      signInAndWait: async () => ({ response: { data: { address: "rRestoreAddress" } } })
    }
  };

  const restored = await new CrossmarkAdapter({ provider }).restoreSession({
    ...session,
    adapterId: "crossmark"
  });

  assert.equal(restored?.account.address, "rRestoreAddress");
});

test("WalletManager autoReconnect emits connected for extension adapter restore", async () => {
  const adapter = new DropFiAdapter({
    provider: {
      isDropFi: true,
      selectedAddress: "rRestoreAddress",
      isConnected: () => false
    }
  });
  const storage = new MemoryWalletStorage();
  await storage.setItem("session", JSON.stringify({
    version: WALLET_STORAGE_VERSION,
    session: {
      adapterId: "dropfi",
      account: { address: "rRestoreAddress", network },
      connectedAt: 1
    },
    updatedAt: 1
  }));
  const manager = new WalletManager({
    appName: "Restore Test",
    adapters: [adapter as WalletAdapter],
    storage,
    autoReconnect: true,
    logger: { level: "silent" },
    accountStatus: { enabled: false }
  });
  const connectedAddresses: string[] = [];

  manager.on("connected", (event) => connectedAddresses.push(event.account.address));
  const restored = await manager.autoReconnect();

  assert.equal(restored?.account.address, "rRestoreAddress");
  assert.deepEqual(connectedAddresses, ["rRestoreAddress"]);
});

test("DropFi restoreSession waits briefly for delayed extension injection", async () => {
  const host = globalThis as typeof globalThis & { xrpl?: DropFiProvider };
  const previousProvider = host.xrpl;
  delete host.xrpl;
  const timer = setTimeout(() => {
    host.xrpl = {
      isDropFi: true,
      selectedAddress: "rRestoreAddress"
    };
  }, 30);

  try {
    const restored = await new DropFiAdapter().restoreSession({
      ...session,
      adapterId: "dropfi"
    });

    assert.equal(restored?.account.address, "rRestoreAddress");
  } finally {
    clearTimeout(timer);
    if (previousProvider) host.xrpl = previousProvider;
    else delete host.xrpl;
  }
});

test("DropFi prefers dedicated namespaces and ignores non-wallet window.xrpl", () => {
  const host = globalThis as typeof globalThis & {
    __xwk_dropfi?: DropFiProvider;
    dropfi?: DropFiProvider;
    xrpl?: DropFiProvider;
  };
  const previousPrivate = host.__xwk_dropfi;
  const previousDropFi = host.dropfi;
  const previousXrpl = host.xrpl;

  try {
    host.xrpl = { signMessage: async () => "library-only" };
    assert.equal(new DropFiAdapter().isAvailable(), false);

    host.dropfi = { isDropFi: true, selectedAddress: "rDropFiAddress" };
    assert.equal(new DropFiAdapter().isAvailable(), true);

    host.__xwk_dropfi = { isDropFi: true, selectedAddress: "rPrivateDropFiAddress" };
    assert.equal(new DropFiAdapter().isAvailable(), true);
  } finally {
    if (previousPrivate) host.__xwk_dropfi = previousPrivate;
    else delete host.__xwk_dropfi;
    if (previousDropFi) host.dropfi = previousDropFi;
    else delete host.dropfi;
    if (previousXrpl) host.xrpl = previousXrpl;
    else delete host.xrpl;
  }
});
