import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const results = [];
for (const name of ['selective', 'defaults']) {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    build: {
      write: false,
      minify: 'esbuild',
      target: 'es2020',
      rollupOptions: {
        input: resolve(`tests/fixtures/bundle/${name}.js`),
        output: { format: 'es' }
      }
    }
  });
  const chunks = [result].flat().flatMap((item) => item.output).filter((item) => item.type === 'chunk');
  const modules = chunks.flatMap((chunk) => Object.keys(chunk.modules)).map((id) => id.replaceAll('\\', '/'));
  const adapters = [...new Set(modules.flatMap((id) => {
    const match = id.match(/packages\/adapters\/([^/]+)\//);
    return match ? [match[1]] : [];
  }))].sort();
  if (name === 'selective') {
    assert.deepEqual(adapters, ['gemwallet'], 'Selective output must contain only the selected adapter');
    assert.ok(!modules.some((id) => /node_modules\/(?:@walletconnect|@ledgerhq|xumm|xumm-oauth2-pkce)\//.test(id)),
      'Selective output must exclude unselected wallet SDKs');
  }
  const bytes = chunks.reduce((sum, chunk) => sum + Buffer.byteLength(chunk.code), 0);
  const gzipBytes = chunks.reduce((sum, chunk) => sum + gzipSync(chunk.code).length, 0);
  results.push({ name, chunks: chunks.length, bytes, gzipBytes, adapters });
}
assert.ok(results[0].gzipBytes < results[1].gzipBytes / 2, 'Selective bundle should remain less than half the defaults bundle');
console.log(JSON.stringify(results, null, 2));
