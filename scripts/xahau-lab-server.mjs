const methods = new Set(["server_info", "account_info", "fee", "submit", "tx"]);

// Local console only: two fixed upstreams, bounded bodies, no arbitrary RPC URL.
export function addXahauLabServer(server, fetcher = globalThis.fetch) {
  server.middlewares.use("/api/xahau/rpc", async (req, res) => {
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    if (req.method !== "POST") return send(405, { error: "POST required" });
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(403, { error: "Same-origin request required" });
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 65536) return send(413, { error: "RPC request too large" });
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!methods.has(body.method) || !Array.isArray(body.params) || body.params.length !== 1 ||
        !body.params[0] || typeof body.params[0] !== "object" || Array.isArray(body.params[0]) ||
        Object.keys(body).some(key => !["method", "params", "network"].includes(key))) return send(400, { error: "Unsupported console method or parameter object" });
      if (body.network !== undefined && !["xahau-mainnet", "xahau-testnet"].includes(body.network)) return send(400, { error: "Unsupported Xahau network" });
      if (body.method === "submit" && (typeof body.params[0].tx_blob !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(body.params[0].tx_blob))) return send(400, { error: "A signed transaction blob is required" });
      const upstream = await fetcher(body.network === "xahau-mainnet" ? "https://xahau.network" : "https://xahau-test.net", { method: "POST", redirect: "error",
        headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      if (!upstream.ok) return send(502, { error: `Upstream HTTP ${upstream.status}` });
      send(200, await upstream.json());
    } catch (error) {
      send(502, { error: error instanceof Error ? error.message : "RPC failed" });
    }
  });
}
