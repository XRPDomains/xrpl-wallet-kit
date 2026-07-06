# Sign-In with Wallet — Legacy HTML / jQuery Example

Minh họa cách dùng `@xrpl-wallet-kit/auth` trong một ứng dụng HTML/jQuery thuần (không có bundler, không có React/Vue).

**Stack:** HTML + jQuery 3.x · Express.js backend · express-session

---

## Cấu trúc file

```
myapp/
  public/
    index.html              ← trang web
    js/
      xrpl-wallet-kit.iife.min.js   ← IIFE bundle (copy từ npm publish)
  server/
    index.js                ← Express server
    auth.js                 ← route handler nonce/verify/signout
  package.json
```

---

## 1. Frontend — `public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>MyApp — Sign In with Wallet</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 60px auto; padding: 0 20px; }
    .hidden { display: none; }
    .error  { color: #dc2626; margin-top: 8px; font-size: 14px; }
    .addr   { font-family: monospace; font-size: 13px; word-break: break-all; }
    button  { padding: 10px 20px; cursor: pointer; margin-top: 12px; }
    #connect-btn  { background: #1d4ed8; color: #fff; border: none; border-radius: 6px; }
    #signin-btn   { background: #059669; color: #fff; border: none; border-radius: 6px; }
    #signout-btn  { background: #6b7280; color: #fff; border: none; border-radius: 6px; }
  </style>
</head>
<body>

<!-- ── Bước 1: Kết nối ví ─────────────────────────────── -->
<section id="step-connect">
  <h2>Bước 1: Kết nối ví</h2>
  <button id="connect-btn">Kết nối ví</button>
  <p id="connect-error" class="error hidden"></p>
</section>

<!-- ── Bước 2: Đăng nhập ─────────────────────────────── -->
<section id="step-signin" class="hidden">
  <h2>Bước 2: Đăng nhập</h2>
  <p>Ví đang kết nối: <span id="wallet-addr" class="addr"></span></p>
  <button id="signin-btn">Đăng nhập bằng ví</button>
  <p id="signin-error" class="error hidden"></p>
</section>

<!-- ── Đã đăng nhập ──────────────────────────────────── -->
<section id="step-app" class="hidden">
  <h2>Chào mừng!</h2>
  <p>Đã đăng nhập với địa chỉ:</p>
  <p class="addr" id="auth-addr"></p>
  <button id="signout-btn">Đăng xuất</button>
</section>

<!-- ── Scripts ───────────────────────────────────────── -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="/js/xrpl-wallet-kit.iife.min.js"></script>
<script>
$(function () {
  // ─── Lấy API từ IIFE bundle ─────────────────────────────
  // Khi auth được đưa vào browser bundle, các hàm này sẽ có
  // sẵn trong window.XrplWalletKit
  var WalletKit = window.XrplWalletKit;
  var kit; // WalletManager
  var auth; // WalletAuth controller

  // ─── Khởi tạo WalletKit ─────────────────────────────────
  kit = WalletKit.createWalletKit({
    // Khai báo adapters muốn dùng — tương tự vanilla example
    adapters: [
      WalletKit.createGemWalletAdapter(),
      WalletKit.createCrossmarkAdapter(),
      WalletKit.createXamanAdapter({
        clientId: 'YOUR_XAMAN_CLIENT_ID'
      }),
      WalletKit.createWalletConnectAdapter({
        projectId: 'YOUR_WC_PROJECT_ID'
      })
    ]
  });

  // ─── WalletAuthAdapter ──────────────────────────────────
  // Đây là object implement interface WalletAuthAdapter
  // Giao tiếp với backend qua jQuery AJAX — không có gì đặc biệt,
  // đây chỉ là 4 hàm plain JavaScript
  var authAdapter = {

    // Lấy nonce từ server
    getNonce: function () {
      return $.get('/api/auth/nonce').then(function (data) {
        return data.nonce;
      });
    },

    // Tạo message text để ký
    // formatAuthMessage là helper của kit — hoặc tự format theo ý muốn
    createMessage: function (params) {
      return WalletKit.auth.formatAuthMessage(params);
      // Kết quả ví dụ:
      // "myapp.com wants you to sign in with your wallet:
      //  rN7n3473SaZBCG4dFL83w7PB5e4LKRMW3h
      //
      //  Sign in to access MyApp.
      //
      //  URI: https://myapp.com
      //  Version: 1
      //  Nonce: a3f8c2...
      //  Issued At: 2026-06-07T10:00:00.000Z"
    },

    // Gửi proof lên server để xác thực
    // params có: { message, signatureKind, signature?, txBlob?, address, publicKey? }
    // Server tự xử lý signatureKind — client không cần biết verify logic
    verify: function (params) {
      return $.ajax({
        url: '/api/auth/verify',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(params)
      }).then(function () {
        return true;
      }).catch(function () {
        return false;
      });
    },

    // Gọi server destroy session
    signOut: function () {
      return $.post('/api/auth/signout').then(function () {});
    }
  };

  // ─── Sự kiện Connect ────────────────────────────────────
  $('#connect-btn').on('click', function () {
    $('#connect-error').hide();

    // Mở modal kit — user chọn ví và approve
    kit.openModal();
  });

  // Sau khi ví kết nối xong, kit emit event 'connect'
  kit.on('connect', function (session) {
    var addr = session.account.address;

    // Hiện địa chỉ, chuyển sang bước sign-in
    $('#wallet-addr').text(addr);
    $('#step-connect').hide();
    $('#step-signin').show();

    // Tạo WalletAuth controller — chỉ sau khi đã có session
    auth = WalletKit.auth.createWalletAuth(kit, authAdapter, {
      chainId: 'xrpl:0',
      statement: 'Sign in to access MyApp.',
      expiresIn: 3600          // message hết hạn sau 1 tiếng
    });

    // Lắng nghe trạng thái auth
    auth.on('change', function (state) {
      if (state.status === 'authenticated') {
        $('#auth-addr').text(state.address);
        $('#step-signin').hide();
        $('#step-app').show();
        $('#signin-error').hide();
      }
      if (state.status === 'error') {
        $('#signin-error')
          .text(state.error ? state.error.message : 'Đăng nhập thất bại.')
          .show();
      }
    });
  });

  // Ví bị ngắt kết nối
  kit.on('disconnect', function () {
    if (auth) {
      auth.destroy();
      auth = null;
    }
    $('#step-app').hide();
    $('#step-signin').hide();
    $('#step-connect').show();
  });

  // ─── Sự kiện Sign In ────────────────────────────────────
  $('#signin-btn').on('click', function () {
    if (!auth) return;
    $('#signin-error').hide();
    $('#signin-btn').prop('disabled', true).text('Đang ký...');

    auth.signIn()
      .catch(function (err) {
        $('#signin-error').text(err.message || 'Lỗi đăng nhập.').show();
      })
      .always(function () {
        $('#signin-btn').prop('disabled', false).text('Đăng nhập bằng ví');
      });
  });

  // ─── Sự kiện Sign Out ───────────────────────────────────
  $('#signout-btn').on('click', function () {
    if (!auth) return;

    auth.signOut().then(function () {
      kit.disconnect();           // ngắt kết nối ví
      $('#step-app').hide();
      $('#step-connect').show();
    });
  });
});
</script>
</body>
</html>
```

---

## 2. Backend — `server/auth.js`

```js
// server/auth.js
// Chạy trên Node.js — KHÔNG phải browser
// Import theo CommonJS (require) hoặc ESM tùy setup server

const { generateNonce, parseAuthMessage, validateAuthMessage } =
  require('@xrpl-wallet-kit/auth');

// Server-only verifier — import từ subpath /verifiers
// Tự cài ripple-keypairs, verify-xrpl-signature, xrpl vào server dependencies
const { createXrplSignatureVerifier } =
  require('@xrpl-wallet-kit/auth/verifiers');

// Tạo verifier một lần khi server khởi động
const verifier = createXrplSignatureVerifier({
  nodeUrl: process.env.XRPL_NODE_URL || 'wss://xrplcluster.com'
});

// ── GET /api/auth/nonce ─────────────────────────────────────────────────────
// Tạo nonce mới, lưu vào session, trả về client
async function getNonce(req, res) {
  const nonce = generateNonce();     // 16 bytes hex, crypto-secure

  // Lưu vào server session (express-session + Redis/MemoryStore)
  req.session.pendingNonce = nonce;
  req.session.nonceIssuedAt = Date.now();

  // TTL: server nên expire session sau 5 phút nếu chưa verify
  res.json({ nonce });
}

// ── POST /api/auth/verify ───────────────────────────────────────────────────
// Nhận proof từ client, verify, tạo session đã xác thực
async function verifyAuth(req, res) {
  try {
    const {
      message,
      signatureKind,    // "signature" | "signedTx" — kit tự set, server xử lý
      signature,        // compact raw sig (GemWallet, Crossmark, DropFi, Otsu)
      txBlob,           // signed tx blob (Xaman, XRPL Snap, WalletConnect fallback)
      address,
      publicKey         // optional — kit gửi khi adapter có
    } = req.body;

    // 1. Kiểm tra nonce hợp lệ
    if (!req.session.pendingNonce) {
      return res.status(400).json({ error: 'No pending nonce. Request a nonce first.' });
    }

    // 2. Parse và validate message fields
    let parsed;
    try {
      parsed = parseAuthMessage(message);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid message format.' });
    }

    const { valid, reason } = validateAuthMessage(parsed, {
      expectedDomain: req.hostname,         // 'myapp.com'
      maxAge: 300,                           // message không cũ hơn 5 phút
      usedNonces: new Set([req.session.pendingNonce])
    });

    if (!valid) {
      return res.status(400).json({ error: reason });
    }

    // 3. Verify chữ ký — verifier tự branch theo signatureKind
    //    signatureKind === "signature"  → dùng ripple-keypairs
    //    signatureKind === "signedTx"   → dùng verify-xrpl-signature
    const ok = await verifier.verify({
      message,
      signatureKind,
      signature,
      txBlob,
      address,
      publicKey
    });

    if (!ok) {
      return res.status(401).json({ error: 'Signature verification failed.' });
    }

    // 4. Tạo session đã xác thực
    req.session.pendingNonce = null;      // invalidate nonce — không dùng lại được
    req.session.address = address;        // lưu địa chỉ đã xác thực
    req.session.authenticatedAt = Date.now();

    res.json({ ok: true, address });

  } catch (err) {
    console.error('[auth/verify]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// ── POST /api/auth/signout ──────────────────────────────────────────────────
async function signOut(req, res) {
  req.session.destroy(function (err) {
    if (err) console.error('[auth/signout]', err);
    res.json({ ok: true });
  });
}

// ── Middleware bảo vệ route đã đăng nhập ────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.address) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  next();
}

module.exports = { getNonce, verifyAuth, signOut, requireAuth };
```

---

## 3. Express server chính — `server/index.js`

```js
// server/index.js
const express = require('express');
const session = require('express-session');
const path = require('path');
const { getNonce, verifyAuth, signOut, requireAuth } = require('./auth');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Session setup — dùng Redis store trong production
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 60 * 1000    // 30 phút
  }
}));

// Auth routes
app.get('/api/auth/nonce',   getNonce);
app.post('/api/auth/verify', verifyAuth);
app.post('/api/auth/signout', signOut);

// Ví dụ route bảo vệ
app.get('/api/profile', requireAuth, function (req, res) {
  res.json({ address: req.session.address });
});

app.listen(3000, function () {
  console.log('Server: http://localhost:3000');
});
```

---

## 4. `server/package.json`

```json
{
  "name": "myapp-server",
  "version": "1.0.0",
  "dependencies": {
    "@xrpl-wallet-kit/auth": "^0.1.0-beta.1",
    "express": "^4.18.0",
    "express-session": "^1.18.0",
    "ripple-keypairs": "^2.0.0",
    "verify-xrpl-signature": "^9.2.0",
    "xrpl": "^4.0.0"
  }
}
```

> **Lưu ý:** `ripple-keypairs`, `verify-xrpl-signature`, `xrpl` là **optional peer dependencies** của `@xrpl-wallet-kit/auth` — chúng phải được cài rõ ràng vào **server** package. Client (browser) không cần và không nên import chúng.

---

## 5. Luồng hoạt động toàn bộ

```
USER                 BROWSER (jQuery)          SERVER (Express)         XRPL Node
─────                ────────────────          ────────────────         ─────────
Click kết nối   →   kit.openModal()
                     user chọn ví
                     ví approve connect   ←→  (ví extension/app)
                     kit.on('connect')
                     createWalletAuth()

Click đăng nhập →   auth.signIn()
                     │
                     ├─ GET /api/auth/nonce  →  generateNonce()
                     │                          session.pendingNonce = nonce
                     │                      ←── { nonce }
                     │
                     ├─ createMessage()
                     │   "myapp.com wants you to sign in..."
                     │
                     ├─ manager.signMessage()
                     │   user ký trong ví  ←→  (ví extension/app)
                     │   result: { signatureKind, signature/txBlob, publicKey }
                     │
                     ├─ POST /api/auth/verify  →  parseAuthMessage()
                     │   { message,               validateAuthMessage()
                     │     signatureKind,          verifier.verify()
                     │     signature?,              ├─ "signature": ripple-keypairs  →→→ (local)
                     │     txBlob?,                 └─ "signedTx":  verify-xrpl-sig →→→ (local)
                     │     address,              session.address = address
                     │     publicKey? }      ←── { ok: true }
                     │
                     auth.on('change')
                     status: 'authenticated'
                     Hiện UI đã đăng nhập
```

---

## 6. So sánh với modern bundled app

| | Legacy HTML/jQuery | Modern (Vite/React) |
|---|---|---|
| Load kit | `<script src="xrpl-wallet-kit.iife.min.js">` | `import { createWalletKit } from '@xrpl-wallet-kit/client'` |
| Auth adapter | Plain JS object với `$.ajax` | Plain JS object với `fetch` |
| `createWalletAuth()` | `WalletKit.auth.createWalletAuth()` | `import { createWalletAuth } from '@xrpl-wallet-kit/auth'` |
| State handling | jQuery DOM manipulation | React state / Vue reactive |
| Backend | Không đổi — Express routes giống nhau | Không đổi |
| Server verifier | Không đổi — `require('@xrpl-wallet-kit/auth/verifiers')` | Không đổi |

**Điểm quan trọng:** Backend và server verifier hoàn toàn giống nhau dù frontend là legacy hay modern. Chỉ có cách load bundle và cách update DOM là khác.

---

## 7. Caveats đặc thù legacy HTML

**jQuery Promise vs native Promise:**

`auth.signIn()` trả về native `Promise`. jQuery `$.ajax` cũng trả về Promise-compatible (Deferred). Hai cái tương thích nhau trong code trên. Nếu dự án dùng jQuery cũ (< 3.x) cần test thêm.

**IIFE bundle size:**

Bundle hiện tại ~528 KB gzip vì include tất cả adapters. Nếu chỉ cần 1–2 adapters, khuyến nghị chuyển sang bundler (Vite) thay vì IIFE. Legacy app không có lựa chọn khác nên phải chấp nhận trade-off này — ghi rõ trong README (PERF-1).

**signing-compat.md:**

Trên legacy app, nếu user dùng Xaman (signedTx path), server sẽ nhận `txBlob` và dùng `verify-xrpl-signature`. Nếu dùng GemWallet (signature path), server dùng `ripple-keypairs`. App không cần biết sự khác nhau — kit và verifier tự xử lý. Tuy nhiên behavior thực tế của từng wallet vẫn cần test trước khi đưa lên production — xem `docs/adapters/signing-compat.md`.

---

*Ref: Review/SIGN_IN_SPEC.md · Review/SIGNMESSAGE_SHAPE_SPEC.md*  
*Generated: 2026-06-07*
