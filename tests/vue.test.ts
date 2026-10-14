import assert from "node:assert/strict";
import test from "node:test";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { WalletManager } from "../packages/core/src/index";
import { createWalletKitPlugin, useWalletKit, WalletButton } from "../packages/vue/src/index";

test("Vue SSR uses neutral state, makes no availability calls and isolates applications", async () => {
  let calls = 0;
  const makeManager = () => new WalletManager({ adapters: [{ metadata: { id: "test", name: "Test", type: "extension" },
    capabilities: { connect: true }, isAvailable: async () => { calls++; return true; }, connect: async () => { throw Error("Unexpected prompt"); } }] });
  const states: unknown[] = [];
  const component = defineComponent({ setup() {
    const kit = useWalletKit(); states.push(kit);
    return () => h("div", [h(WalletButton), kit.status.value]);
  } });
  const managers = [makeManager(), makeManager()];
  for (const manager of managers) {
    const app = createSSRApp(component).use(createWalletKitPlugin({ manager, autoReconnect: true }));
    assert.equal(await renderToString(app), "<div><span></span>disconnected</div>");
  }
  assert.notEqual(states[0], states[1]);
  assert.equal(calls, 0);
  managers.forEach(manager => manager.destroy());
});
