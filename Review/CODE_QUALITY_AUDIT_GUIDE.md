# Code Quality Audit Guide

Tài liệu này là checklist/toolkit dùng lại cho các dự án JS/TS/React/SDK để kiểm tra chất lượng code, phát hiện trùng lặp, dependency xấu, bundle phình, dead code và rủi ro bảo mật.

## Mục tiêu

- Giữ codebase dễ bảo trì trước khi beta/release.
- Phát hiện sớm code trùng lặp, module coupling, dependency thừa.
- Kiểm tra type, test, lint, security và bundle size bằng lệnh tự động.
- Ưu tiên tool chạy được local/CI, không phụ thuộc cảm tính reviewer.
- Bật tool theo từng pha, không cài và ép toàn bộ ngay từ ngày đầu.

## Nguyên Tắc Bắt Đầu Nhẹ

Nếu dự án đang ở mức "chưa có gì", đừng bật toàn bộ tool một lượt. Các tool như `knip`, `jscpd`, `dependency-cruiser`, `semgrep` có thể tạo rất nhiều finding trên codebase chưa có baseline, làm team hoặc agent dễ bị nhiễu.

Thứ tự khuyến nghị:

1. Tuần 1: chỉ bật typecheck hoặc JS syntax check, lint cơ bản, Prettier, test runner tối thiểu và pre-commit hook.
2. Sau khi baseline sạch: thêm từng tool một theo thứ tự `knip` -> `jscpd` -> `dependency-cruiser` -> security scan.
3. Tool mới nên chạy `report-only` trước, sửa baseline dần, rồi mới cho fail CI.
4. Mỗi phase chỉ thêm một nhóm kiểm tra mới để dễ biết cảnh báo đến từ đâu.

Mục tiêu không phải có nhiều tool nhất, mà là có quality gate đủ nhẹ để mọi người thật sự chạy thường xuyên.

## Lộ Trình Bật Dần

| Pha | Khi nào | Tool/script nên bật | Cách chạy |
| --- | --- | --- | --- |
| Phase 0 | Ngày đầu | `prettier`, `eslint`, syntax/typecheck tối thiểu | Fail local/CI nếu lỗi rõ ràng |
| Phase 1 | Có vài hàm nghiệp vụ | `vitest` hoặc `node:test` | Test hàm thuần trước |
| Phase 2 | Có commit đều | `husky`, `lint-staged` | Chặn lỗi format/lint/test nhỏ trước commit |
| Phase 3 | Baseline ổn | `knip` | Report-only trước |
| Phase 4 | Code bắt đầu lặp | `jscpd` | Report-only trước, đặt threshold dễ thở |
| Phase 5 | Monorepo/module nhiều | `dependency-cruiser` | Report-only trước, sau đó fail circular deps |
| Phase 6 | Chuẩn bị beta/public | `npm audit`, `osv-scanner`, `semgrep`, license check | Fail high/critical có fix rõ |
| Phase 7 | Có browser/frontend | `playwright`, `lighthouse`, bundle analyzer | Smoke test vài luồng chính |

Script tổng nên có tên ngắn, ví dụ:

```json
{
  "scripts": {
    "check": "npm run format:check && npm run lint && npm run typecheck && npm test"
  }
}
```

Sau này có thể mở rộng `check` khi baseline đã ổn.

## Quy Ước Cho Agent / Coder

Trong file hướng dẫn dự án, nên ghi rõ:

```text
Before claiming a phase or task is complete, run npm run check and paste/summarize the result.
Do not mark work complete based only on visual inspection or confidence.
If a check cannot run, explain exactly why and what was verified instead.
```

Quy ước này quan trọng khi giao việc cho agent: "xong" phải dựa trên lệnh kiểm chứng, không dựa trên cảm giác.

## Chọn Theo Loại Dự Án

Không phải dự án nào cũng cần cài toàn bộ tool. Trước khi setup, xác định loại dự án chính rồi chọn bộ tối thiểu phù hợp.

| Loại dự án | Nên cài tối thiểu | Nên thêm khi lớn hơn | Ghi chú |
| --- | --- | --- | --- |
| HTML/CSS/JS legacy thuần | `eslint`, `prettier`, `html-validate`, `stylelint`, `jscpd`, `playwright` | `lighthouse`, `semgrep` | Không có typecheck, nên bù bằng `node --check`, lint globals và browser smoke test. |
| JavaScript app thuần | `eslint`, `prettier`, `vitest` hoặc `node:test`, `jscpd` | `knip`, `dependency-cruiser`, `playwright` | Phù hợp app không dùng TypeScript nhưng có module/build. |
| TypeScript library/SDK | `typescript`, `eslint`, `prettier`, `node:test` hoặc `vitest`, `knip`, `jscpd`, `dependency-cruiser` | `size-limit`, `license-checker-rseidelsohn`, `osv-scanner` | Ưu tiên API contract, declaration output, duplicate và dependency graph. |
| React/Vite app | `typescript`, `eslint`, `prettier`, `vitest`, `playwright`, `jscpd` | `lighthouse`, `vite-bundle-visualizer`, `knip` | Cần test browser vì lỗi UI/runtime không phải lúc nào typecheck bắt được. |
| Next.js app | `typescript`, `eslint`, `prettier`, `playwright`, `jscpd` | `@next/bundle-analyzer`, `lighthouse`, `knip` | Dùng script native của Next nếu có: `next lint`, `next build`. |
| Node.js API/service | `typescript` hoặc `eslint`, `prettier`, `node:test`/`vitest`/`jest`, `knip`, `dependency-cruiser` | `semgrep`, `osv-scanner`, integration test DB/API | Ưu tiên test service boundary, security và dependency risk. |
| Monorepo | `typescript`, `eslint`, `prettier`, `knip`, `jscpd`, `dependency-cruiser` | `changesets`, package boundary checks, bundle tools từng package | Cần config ignore kỹ cho `dist`, generated files, examples. |
| Browser SDK/IIFE | `typescript`, `eslint`, `prettier`, `node:test`, `playwright`, `size-limit`, `jscpd` | `rollup-plugin-visualizer`, browser smoke test riêng | Bắt buộc check bundle chạy thật trong browser, không chỉ Node. |

Khuyến nghị thực tế:

- Dự án nhỏ: bắt đầu với `eslint`, `prettier`, test runner, `jscpd`.
- Dự án TypeScript: thêm `typescript`, `knip`, `dependency-cruiser`.
- Dự án có UI: thêm `playwright`, `lighthouse`.
- Dự án public package/SDK: thêm bundle size, license và security scan.
- Dự án legacy: đừng cố ép TypeScript ngay; trước mắt thêm syntax check, lint, HTML/CSS validation và browser smoke test.

## Bộ Tool Khuyến Nghị

| Nhóm | Tool | Dùng để |
| --- | --- | --- |
| Typecheck | `typescript` | Bắt lỗi type, contract API, project references |
| Test | `node:test`, `vitest`, `jest` | Unit/integration tests |
| Lint | `eslint`, `typescript-eslint` | Code smell, bad pattern, unsafe APIs |
| Format | `prettier` | Format thống nhất, giảm diff nhiễu |
| Dead code | `knip` | File/export/dependency không dùng |
| Duplication | `jscpd` | Code copy-paste/trùng lặp |
| Dependency graph | `dependency-cruiser` | Circular deps, layer violation, coupling |
| Security | `npm audit`, `pnpm audit`, `osv-scanner` | CVE và dependency vulnerability |
| Static security | `semgrep` | Rule-based security/code smell scan |
| Bundle size | `rollup-plugin-visualizer`, `vite-bundle-visualizer`, `size-limit` | Bundle phình, dependency nặng |
| Browser smoke | `playwright` | Smoke test browser, console error, layout flow |
| Performance web | `lighthouse`, `@lhci/cli` | Web performance/accessibility/SEO |
| License | `license-checker-rseidelsohn` | Kiểm tra license dependency |
| HTML quality | `html-validate` | Bắt lỗi HTML legacy, a11y cơ bản, nesting sai |
| CSS quality | `stylelint` | Bắt lỗi CSS, duplicate selector, property sai |
| Pre-commit | `husky`, `lint-staged` | Chạy format/lint/test nhỏ trước khi commit |

## Cài Đặt Nhanh Cho Dự Án JS/TS

```bash
npm install -D typescript eslint prettier knip jscpd dependency-cruiser
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D semgrep rollup-plugin-visualizer size-limit @size-limit/preset-small-lib
npm install -D playwright @lhci/cli license-checker-rseidelsohn
npm install -D html-validate stylelint stylelint-config-standard
npm install -D husky lint-staged
```

Nếu dùng `pnpm`:

```bash
pnpm add -D typescript eslint prettier knip jscpd dependency-cruiser
pnpm add -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D semgrep rollup-plugin-visualizer size-limit @size-limit/preset-small-lib
pnpm add -D playwright @lhci/cli license-checker-rseidelsohn
pnpm add -D html-validate stylelint stylelint-config-standard
pnpm add -D husky lint-staged
```

`osv-scanner` nên cài theo OS/package manager riêng:

```bash
winget install Google.OSV-Scanner
```

## Scripts Mẫu Trong `package.json`

```json
{
  "scripts": {
    "typecheck": "tsc -b --pretty false",
    "lint": "eslint .",
    "format:check": "prettier . --check",
    "format": "prettier . --write",
    "test": "node --import tsx --test tests/*.test.ts",
    "check:unused": "knip --no-progress --reporter compact",
    "check:duplicates": "jscpd --config .jscpd.json src packages tests",
    "check:deps": "depcruise --config .dependency-cruiser.cjs src packages tests",
    "check:security": "npm audit --audit-level=moderate",
    "check:osv": "osv-scanner --lockfile package-lock.json",
    "check:semgrep": "semgrep scan --config auto",
    "check:license": "license-checker-rseidelsohn --summary",
    "check:html": "html-validate \"**/*.html\"",
    "check:css": "stylelint \"**/*.{css,scss}\"",
    "prepare": "husky",
    "check:quality": "npm run typecheck && npm run lint && npm run format:check && npm run test && npm run check:deps && npm run check:unused && npm run check:duplicates"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx,mjs,cjs}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,html,css,scss}": [
      "prettier --write"
    ]
  }
}
```

Tạo pre-commit hook:

```bash
npm run prepare
npx husky add .husky/pre-commit "npx lint-staged"
```

Với Husky v9 có thể tạo file thủ công:

```bash
mkdir -p .husky
printf "npx lint-staged\n" > .husky/pre-commit
```

Với monorepo, thay `src` bằng các thư mục thực tế như:

```bash
packages examples tests
```

## Config Mẫu Cho Trùng Lặp `.jscpd.json`

```json
{
  "threshold": 2,
  "reporters": ["console"],
  "ignore": [
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/node_modules/**",
    "**/*.d.ts",
    "**/*.min.js",
    "**/package-lock.json"
  ],
  "minTokens": 70,
  "minLines": 8
}
```

Gợi ý ngưỡng:

- SDK/library: `threshold` 1-3%.
- App frontend lớn: 3-5% có thể chấp nhận.
- Generated code, dist, snapshot, lockfile phải ignore.

## Config Mẫu Cho Dependency Cruiser

```js
// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true }
    },
    {
      name: "no-dist-import",
      severity: "error",
      from: {},
      to: { path: "/dist/" }
    },
    {
      name: "no-test-import-in-src",
      severity: "error",
      from: { path: "^(src|packages)" },
      to: { path: "(test|tests|__mocks__)" }
    }
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"]
    }
  }
};
```

## Quy Trình Audit Nên Chạy

1. Baseline nhanh:

```bash
npm run typecheck
npm test
npm run check:unused
npm run check:duplicates
npm run check:deps
```

2. Trước release:

```bash
npm run check:quality
npm audit --audit-level=moderate
osv-scanner --lockfile package-lock.json
license-checker-rseidelsohn --summary
```

3. Với frontend/browser SDK:

```bash
npm run build
npm run build:browser
npx playwright test
npx lhci autorun
```

4. Khi bundle bị phình:

```bash
npx vite-bundle-visualizer
npx size-limit
```

Nếu không dùng Vite, dùng `rollup-plugin-visualizer` trong build Rollup/Webpack tương ứng.

## Cách Đọc Kết Quả

### `knip`

Ưu tiên xử lý:

- Dependency runtime không dùng.
- Export public không còn ai import.
- File stale trong `src/packages`.

Cẩn thận với:

- Entry public API.
- Plugin files loaded by convention.
- Config files được tool tự đọc.

### `jscpd`

Không phải trùng lặp nào cũng cần refactor. Nên sửa khi:

- Logic nghiệp vụ lặp 3 lần trở lên.
- Bug fix phải sửa ở nhiều chỗ.
- Test fixture bị copy gây khó đọc.

Không nên ép refactor khi:

- Duplication là config nhỏ, rõ nghĩa.
- Tách abstraction làm code khó hiểu hơn.
- Code generated hoặc schema cố ý giống nhau.

### `dependency-cruiser`

Ưu tiên lỗi:

- Circular dependency.
- Layer thấp import ngược layer cao.
- Package core import UI/app.
- Source import từ `dist`.

### Security

Ưu tiên:

- Vulnerability reachable ở runtime.
- Dependency chạy trong browser.
- Transitive dependency có fix version rõ ràng.

Không nên auto-force fix nếu làm đổi major version mà chưa test.

## CI Gợi Ý

```yaml
name: quality

on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check:quality
      - run: npm audit --audit-level=moderate
```

Với project đang beta, có thể để `knip` và `jscpd` ở chế độ report-only trước:

```bash
knip --no-exit-code
jscpd --exitCode 0
```

Sau khi baseline sạch hơn thì bật fail CI.

## Checklist Trước Khi Merge

- [ ] `typecheck` pass.
- [ ] Unit/integration tests pass.
- [ ] Không tăng duplication quá baseline.
- [ ] Không thêm circular dependency.
- [ ] Không thêm dependency runtime nếu devDependency đủ.
- [ ] Browser bundle không tăng bất thường.
- [ ] Public API thay đổi có docs/test.
- [ ] Security audit không có high/critical chưa giải thích.
- [ ] Generated/dist files chỉ commit khi dự án thật sự yêu cầu.

## Bộ Lệnh Tối Thiểu Cho Dự Án Nhỏ

Nếu dự án nhỏ hoặc mới bắt đầu, chỉ cần Phase 0:

```bash
npm install -D typescript eslint prettier vitest husky lint-staged
```

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format:check": "prettier . --check",
    "test": "vitest run",
    "prepare": "husky",
    "check": "npm run format:check && npm run lint && npm run typecheck && npm test"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json,md,css,html}": [
      "prettier --write"
    ],
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix"
    ]
  }
}
```

Sau khi baseline sạch mới thêm:

```bash
npm install -D knip jscpd dependency-cruiser
```

Và ban đầu chạy dạng report-only, chưa fail CI:

```bash
npx knip --no-exit-code
npx jscpd --exitCode 0 src tests
```

Đây là mức đủ nhẹ để dự án mới không bị ngập cảnh báo, nhưng vẫn có hàng rào cơ bản trước khi commit.

## Áp Dụng Cho HTML/JS Legacy

Với dự án legacy không có TypeScript hoặc build pipeline rõ ràng, vẫn nên có quality gate tối thiểu. Mục tiêu là kiểm tra cú pháp, globals, DOM flow, duplicate script và lỗi browser trước khi chỉnh sửa sâu.

Cài đặt tối thiểu:

```bash
npm install -D eslint prettier jscpd html-validate stylelint stylelint-config-standard playwright husky lint-staged
```

Scripts mẫu:

```json
{
  "scripts": {
    "check:js": "node scripts/check-js-syntax.mjs",
    "lint": "eslint \"**/*.{js,mjs,cjs}\"",
    "format:check": "prettier . --check",
    "check:html": "html-validate \"**/*.html\"",
    "check:css": "stylelint \"**/*.{css,scss}\"",
    "check:duplicates": "jscpd --config .jscpd.json .",
    "test:browser": "playwright test",
    "prepare": "husky",
    "check:legacy": "npm run check:js && npm run lint && npm run check:html && npm run check:css && npm run check:duplicates && npm run test:browser"
  },
  "lint-staged": {
    "*.{js,mjs,cjs}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{html,css,json,md}": [
      "prettier --write"
    ]
  }
}
```

Script `scripts/check-js-syntax.mjs` nên chỉ kiểm tra cú pháp, không chạy code:

```js
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ignore = new Set(["node_modules", "dist", "build", "coverage"]);
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (ignore.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (/\.(mjs|cjs|js)$/.test(name) && !name.endsWith(".min.js")) files.push(path);
  }
}

walk(process.cwd());

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
```

ESLint legacy browser config nên khai báo rõ globals thay vì tắt rule lung tung:

```js
// eslint.config.js
export default [
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**", "dist/**", "build/**", "**/*.min.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        console: "readonly",
        $: "readonly",
        jQuery: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-redeclare": "error",
      "no-implied-eval": "error",
      "no-new-func": "warn",
      "eqeqeq": ["warn", "smart"]
    }
  }
];
```

Legacy HTML/JS thường cần thêm Playwright smoke test, vì lint không bắt được lỗi global script order:

```ts
import { test, expect } from "@playwright/test";

test("legacy page loads without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("http://127.0.0.1:5173/");
  await expect(page.locator("body")).toBeVisible();
  expect(errors).toEqual([]);
});
```
