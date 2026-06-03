import assert from "node:assert/strict";
import test from "node:test";
import { XrplSnapAdapter, type Eip1193Provider } from "../packages/adapters/xrpl-snap/src/index";
import { WalletKitErrorCode } from "../packages/core/src/index";

test("XRPL Snap signAndSubmit reports a short user-safe error for long snap failures", async () => {
  const provider: Eip1193Provider = {
    request: async () => {
      throw new Error(`Snap failed: ${JSON.stringify({ error: "unsupported", data: "x".repeat(900) })}`);
    }
  };

  await assert.rejects(
    () => new XrplSnapAdapter({ ethereum: provider }).signAndSubmit({
      methodHint: "payment",
      submit: true,
      txJson: { TransactionType: "Payment" }
    }),
    (error) => {
      assert.equal((error as { code?: string }).code, WalletKitErrorCode.UNSUPPORTED_METHOD);
      assert.ok(error.message.length < 120);
      assert.doesNotMatch(error.message, /x{80}/);
      return true;
    }
  );
});

test("XRPL Snap signMessage keeps aggregate snap errors out of the display message", async () => {
  const provider: Eip1193Provider = {
    request: async () => {
      throw new Error(`method failed ${"details ".repeat(100)}`);
    }
  };

  await assert.rejects(
    () => new XrplSnapAdapter({ ethereum: provider, signMessageMethods: ["xrpl_sign", "xrpl_signTransaction"] }).signMessage({
      message: "hello",
      account: { address: "rSnapAddress" }
    }),
    (error) => {
      assert.equal((error as { code?: string }).code, WalletKitErrorCode.SIGN_FAILED);
      assert.match(error.message, /XRPL Snap could not sign the message/);
      assert.ok(error.message.length < 100);
      assert.doesNotMatch(error.message, /xrpl_signTransaction/);
      return true;
    }
  );
});
