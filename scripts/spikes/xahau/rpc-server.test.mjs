import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { addXahauLabServer } from "../../xahau-lab-server.mjs";

test("local RPC proxy accepts only bounded read-only requests to its fixed upstream", async t => {
  let handler;
  const upstream = [];
  addXahauLabServer({ middlewares: { use(path, callback) { assert.equal(path, "/api/xahau/rpc"); handler = callback; } } }, async (url, options) => {
    upstream.push({ url, options });
    return { ok: true, json: async () => ({ result: { info: { network_id: 21338 } } }) };
  });
  const server = createServer((request, response) => handler(request, response));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/xahau/rpc`;
  for (const body of [
    { method: "submit", params: [{}] }, { method: "sign", params: [{}] },
    { method: "server_info", params: [{}, {}] },
    { method: "server_info", params: [{}], url: "https://attacker.invalid" }
  ]) assert.equal((await fetch(url, { method: "POST", body: JSON.stringify(body) })).status, 400);
  assert.equal((await fetch(url)).status, 405);
  assert.equal((await fetch(url, { method: "POST", body: "{}", headers: { origin: "https://attacker.invalid" } })).status, 403);
  assert.equal((await fetch(url, { method: "POST", body: "A".repeat(65537) })).status, 413);
  assert.equal(upstream.length, 0);
  const response = await fetch(url, { method: "POST", body: JSON.stringify({ method: "server_info", params: [{}] }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.info.network_id, 21338);
  assert.equal(upstream.length, 1);
  assert.equal(upstream[0].url, "https://xahau-test.net");
  assert.equal(upstream[0].options.redirect, "error");
  assert.ok(upstream[0].options.signal instanceof AbortSignal);
});
