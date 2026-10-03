# Adapter Conformance Tests

The runner-neutral harness is exported from `@xrpl-wallet-kit/core/testing`.
It has no Node, React, test-framework, DOM, or provider-SDK dependencies and is
not re-exported through the runtime root. Use it with node:test, Vitest, Jest,
or a browser consumer. Never point its fixtures at real accounts or live wallets.

```ts
import { runAdapterConformance, assertAdapterConformance } from "@xrpl-wallet-kit/core/testing";

test("My adapter contract", async () => {
  const report = await runAdapterConformance({
    createFixture: async scenario => {
      const provider = createMockProvider(scenario);
      return {
        adapter: new MyAdapter({ provider }),
        connectOptions: { network: testNetwork },
        expectedAddress: provider.address,
        transaction: { txJson: testPayment },
        message: { message: "Test proof" },
        remainingResources: () => provider.listenerCount + provider.timerCount,
        exerciseEvents: () => testProviderEventBridge(provider),
        dispose: () => provider.dispose(),
      };
    },
  });
  assertAdapterConformance(report);
  // Admission policy can also fail skipped cases that your adapter must cover.
  expect(report.results.filter(result => result.status === "skipped")).toEqual([]);
});
```

The provider factory and test values above belong to the adapter's test suite.
Create a new adapter and new provider state on **every** factory invocation.
For `rejection`, make connection approval reject with the provider's realistic
user-denial response. For `timeout`, make it reject with the provider's timeout
response. Other scenarios use a successful, normalized account and signing
fixtures. Fixtures should own their timers and abort pending work in `dispose`.

## Scenarios

Mandatory baseline: static shape/capabilities, connection account/network/session,
user rejection, and provider timeout error normalization at the core boundary.
Availability is checked when implemented. Passive restore and disconnect are
checked when implemented. Hardware restore can explicitly set
`restoreExpected: "unavailable"`; it must then return null, not pretend a device
has approved connection.

Message signing is tested only when advertised and must distinguish compact
signature proofs from signed-transaction proofs. Sign-only is tested when
advertised through signTransaction or transactionModes; fallback requests set
submit false and must return a blob, not only a submission hash. Submission
requests set submit true and require a hash. Requests are cloned between cases.
Result normalization is shared with WalletManager, not duplicated by the harness.

Cleanup calls disconnect repeatedly and checks `remainingResources` when supplied.
The event probe exercises the integration-specific bridge and must contain its
own assertions for account/network updates and subscription removal. There is
no universal provider event subscription API in WalletAdapter: an event probe
must test the actual bridge used by that integration, not claim an API that does
not exist. Missing resource/event probes are visibly skipped with an incomplete
coverage reason. A passing report means **no observed failures**, not complete
coverage or certification; inspect every skipped result.

`caseTimeoutMs` defaults to 2000 ms. The harness watchdog produces a failed case,
never a successful provider-timeout test. It does not add cancellation or a
timeout guarantee to an adapter. Factories must settle themselves; they are not
raced, because doing so can leak a late-created fixture. Cleanup is bounded and
dispose still runs when adapter cleanup throws or hangs. Cleanup failures fail
the case. No watchdog can forcibly terminate an SDK request: use cancellable
mock operations and release all resources in fixture disposal.

## First-Party Coverage

`tests/adapter-conformance.test.ts` runs all eight first-party adapter factories
in CI: GemWallet, Crossmark, DropFi, Otsu, Ledger, Xaman, XRPL Snap and
WalletConnect. Capability-based skips are printed. All have lifecycle, restore,
rejection, timeout mapping, resource counters and manager-facing account/network
event tests. The manager event tests inject normalized bridge updates; they do
not claim to validate every provider's event parsing. Existing provider-specific
tests remain necessary. Hardware/browser availability is mocked only for Ledger's
manager event admission; its standalone availability is still exercised.

These tests validate deterministic mocked contracts, not passkeys, hardware,
wallet UX, actual ledger submission, deeplink/reload recovery or cryptographic
signature validity. Keep provider-specific integration tests and perform a
testnet end-to-end check before publishing a new adapter.

The manager connection boundary preserves typed adapter errors and maps raw
provider timeout messages to REQUEST_TIMEOUT rather than CONNECTION_FAILED.

## Package And Browser Smoke

Run `npm run build`, then import the published `@xrpl-wallet-kit/core/testing`
entrypoint in a consumer. The CI suite verifies that export, and `npm pack
--workspace @xrpl-wallet-kit/core --dry-run` must include testing.js and its
declarations under dist. For a new third-party package, install its packed
tarball in an isolated consumer and run the same harness using provider mocks.
Do not rely only on TypeScript source-path aliases.

Run `npm run build:browser` for the first-party readable/minified IIFE bundles
and browser-consumer smoke. Bundle a selective adapter import separately when
checking tree shaking. Test browser-required SDKs in an actual browser; a Node
mock does not establish browser compatibility.
