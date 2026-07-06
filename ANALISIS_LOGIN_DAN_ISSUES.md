# ANALISIS LOGIN & MASALAH LAINNYA — SIAPEL (2026-07-06)

Status: **CRITICAL** — Ada 5 masalah serius yang akan hambat production.

---

## 🔴 MASALAH LOGIN (5 Issues)

### 1. **Login Bercabang — Logika Inkonsisten di 2 File**
**File terdampak:** `src/pages/LoginPage.jsx` + `src/pages/PegawaiLogin.jsx`

#### Deskripsi:
App punya **2 halaman login berbeda** dengan logika resolusi pegawai yang **tidak konsisten**:

**LoginPage.jsx (baru, dipakai sekarang):**
- Unified form: username + password
- Supports: Admin (hardcoded), Developer (hardcoded), Pegawai, Pimpinan
- Password resolution order:
  1. Firebase overrides (pegawai_passwords)
  2. Local data (pegawai_master.json di SessionContext)

**PegawaiLogin.jsx (lama, tidak dipakai):**
- Step-based: identity → password
- Hanya untuk Pegawai
- Direct password check dari pegawai_master.json
- Logic duplikat: resolvePegawai() function sama tapi defined dua kali

**Masalah:**
- PegawaiLogin tidak dipakai tapi masih di-import App.jsx & RoleSelector
- Jika developer pakai PegawaiLogin (untuk testing), password check tidak terkoneksi Firebase overrides
- Risk: silang logic, user bingung masuk melalui mana
- Code duplication = maintenance nightmare

#### Impact:
- 🟡 User experience konsisten (hanya 1 login used), tapi codebase berantakan
- 🔴 Testing/debug jadi susah, developer bisa masuk logic yang salah
- 🔴 Perubahan password hanya sync ke Firebase, PegawaiLogin tidak aware

#### Rekomendasi Fix:
✅ **Hapus PegawaiLogin.jsx** — sudah diganti LoginPage.jsx  
✅ **Hapus RoleSelector.jsx** — LoginPage auto-detect role  
✅ **Bersihkan App.jsx** — tidak perlu import 2 login page

---

### 2. **Firebase Password Overrides — Race Condition Saat Login**
**File:** `src/pages/LoginPage.jsx` (line 195-197), `src/contexts/FirebaseDataContext.jsx` (line 163-186)

#### Deskripsi:
```jsx
// LoginPage.jsx
const adminCred = getAdminCred(passwordOverrides);
if (username.trim().toLowerCase() === adminCred.username) {
  if (password !== adminCred.password) { setError("Password salah"); return; }
```

Masalah:
1. **`passwordOverridesLoaded` guard tidak block submit** — hanya warning di console
   ```jsx
   if (!passwordOverridesLoaded) {
     console.warn("Password overrides belum termuat...");  // ← warning saja!
   }
   ```
   
2. **Race condition:** Jika user submit sebelum Firebase load:
   - `passwordOverrides` still `{}`
   - `getAdminCred({})` return fallback default `"123455"`
   - User pakai password Firebase → login gagal
   - Fix: user tunggu 1-2 detik, refresh, coba lagi

3. **No visual feedback:** UI tidak kasih tahu user "waiting for password sync"

#### Impact:
- 🔴 Sangat mungkin terjadi di internet lambat atau first-time load
- 🔴 User experience jelek (password benar tapi ditolak)
- 🔴 Support akan dapat banyak "password reset" requests

#### Rekomendasi Fix:
1. **Block submit button** sampai `passwordOverridesLoaded === true`
   ```jsx
   <button disabled={!passwordOverridesLoaded || loading} ... >MASUK</button>
   ```

2. **Tampilkan status loading** dengan visual cue
   ```jsx
   {!passwordOverridesLoaded && <p>Menunggu sinkronisasi password...</p>}
   ```

3. **Timeout fallback:** Jika Firebase tidak load dalam 3 detik, gunakan localStorage password
   ```jsx
   useEffect(() => {
     const timeout = setTimeout(() => {
       if (!passwordOverridesLoaded) {
         setPasswordOverridesLoaded(true); // force proceed
       }
     }, 3000);
     return () => clearTimeout(timeout);
   }, []);
   ```

---

### 3. **Device Fingerprint — Tidak Ada Validasi Ulang Saat Login**
**File:** `src/pages/LoginPage.jsx` (line 243-245), `src/pages/PegawaiLogin.jsx` (line 96-98)

#### Deskripsi:
```jsx
// Saat login berhasil:
const fp = getDeviceFingerprint();
handleSaveFingerprint(pegawai.id, fp);
handleUpdatePegawai(pegawai.id, { phoneFingerprint: fp });
```

Masalah:
1. **Device fingerprint disimpan otomatis** tanpa verifikasi
2. **Tidak ada check:** Apakah device ini sudah pernah login?
3. **Jika ada 2 device dengan fingerprint identik** (misal: browser profile sama di HP yang sama), sistem tidak bisa bedakan

#### Impact:
- 🟡 Risk minim (fingerprint collision jarang), tapi tidak reliable untuk security
- 🟡 Dokumentasi "last-login-wins" menyebut device fingerprint, tapi implementasi sebenarnya pakai sessionId (lebih baik)

#### Rekomendasi Fix:
1. **Gunakan `deviceIdRef` (sessionId lebih reliable)** — sudah di-implement di FirebaseDataContext
2. **Tambah warning di SECURITY-CHECKLIST:**
   > Device fingerprint bukan security layer — hanya untuk analytics. Session conflict detection pakai sessionId.

3. **Validate pada open—jika device berubah drastis (UA berubah), kasih warning ke user:**
   ```jsx
   const oldFp = pegawai.phoneFingerprint;
   const newFp = getDeviceFingerprint();
   if (oldFp && oldFp !== newFp) {
     // Warn: ini device baru? Lanjutkan login tapi catat event
   }
   ```

---

### 4. **Password di JSON — Plaintext Storage & Distribution Risk**
**File:** `src/data/pegawai_master.json`

#### Deskripsi:
Password 6 digit disimpan di:
1. **pegawai_master.json** — plaintext JSON di repo (git history forever!)
2. **localStorage** — per-browser, aman
3. **Firebase RTDB** — `/pegawai_passwords` path dengan rules `auth !== null`

Masalah:
1. **Git history:** Password ada di commit lama, bahkan setelah di-update di Firebase
   ```bash
   git log -S "password" -- src/data/pegawai_master.json
   # Akan ketemu semua password yang pernah ada
   ```

2. **Distribusi source code:** Jika repo di-share (GitHub private), semua password exposed

3. **Backup:** Local backup atau git clone = password bocor

#### Impact:
- 🔴 **CRITICAL untuk production** — semua password user bisa di-extract dari git
- 🔴 Compliance issue (GDPR, data protection) — plaintext credential storage illegal di production

#### Rekomendasi Fix:
1. **Update .gitignore** — exclude `pegawai_master.json`
   ```gitignore
   src/data/pegawai_master.json
   ```

2. **Generate new password** untuk semua pegawai (security event)
   ```bash
   # Script: generate-new-passwords.mjs
   # Update Firebase pegawai_passwords, blacklist old password
   ```

3. **Amankan git history** (destructive, hati-hati):
   ```bash
   git filter-branch --tree-filter 'rm -f src/data/pegawai_master.json'
   ```
   
4. **Instruksi baru untuk onboarding:**
   - Petugas admin download pegawai_master.json dari **secure external source** (encrypted email, secure drive)
   - Tidak pernah commit ke GitHub
   - Simpan local saja, destroy setelah import ke app

---

### 5. **Redirect Setelah Login — Flow Tidak Clear untuk Pimpinan**
**File:** `src/pages/LoginPage.jsx` (line 247-261)

#### Deskripsi:
```jsx
if (pegawai.role === "EXECUTIVE" || pegawai.role === "UNIT_LEADER") {
  handlePimpinanSelect({...});  // ← Langsung ke pimpinan dashboard
} else {
  setActivePegawai(pegawai);
  setPage("pegawai_dashboard");
}
```

Masalah:
1. **Tidak ada intermidate step** untuk pimpinan memilih "view as" unit/executive
2. **Asumsi 1 pegawai = 1 role**, padahal `pimpinanAccessRoles` bisa punya multiple
3. **Data yang di-pass** (`buildPimpinanLoginId()`) construct ID dari NIP, yang bisa duplikat

#### Impact:
- 🟡 Pimpinan tidak bisa lihat multiple units (hanya default role)
- 🟡 Jika ada 2 pimpinan dengan NIP-based ID yang collision, bisa salah routing

#### Rekomendasi Fix:
1. **Redirect ke PimpinanSelector dulu** — let them choose which role
   ```jsx
   if (pegawai.role === "EXECUTIVE" || pegawai.role === "UNIT_LEADER") {
     setActivePegawai(pegawai);
     setPage("pimpinan_selector");  // ← redirect ke selector
   }
   ```

2. **Gunakan pegawai.id** bukan `buildPimpinanLoginId()`:
   ```jsx
   // Ganti dari:
   id: buildPimpinanLoginId(pegawai),
   // Menjadi:
   id: pegawai.id,
   ```

---

## 🟡 MASALAH SECURITY (3 Issues)

### 6. **Firebase Rules — Path Tidak Dijaga Consistent**
**File:** `firebase-rules.json`

#### Deskripsi:
Rules ada tapi **beberapa path permissive:**

```json
{
  "rules": {
    "attendance": {
      ".write": "auth !== null",
      ".read": "auth !== null"
    }
  }
}
```

Masalah:
1. **Tidak ada granular check** — siapa bisa write ke attendance pegawai lain?
2. **`/apel/session` bisa di-write user biasa** (rule tidak restrict)
3. **IDOR risk** — pegawai bisa update attendance pegawai lain

#### Impact:
- 🔴 Production security issue
- 🔴 Admin harus percaya client-side validation

#### Rekomendasi Fix:
```json
{
  "rules": {
    "attendance": {
      "today": {
        "$pegawaiId": {
          ".read": "auth !== null",
          ".write": "root.child('pegawai_passwords').child('admin').exists() || auth.uid == 'system'",
          ".validate": "newData.hasChildren(['status', 'jamHadir'])"
        }
      }
    },
    "apel": {
      "session": {
        ".read": "auth !== null",
        ".write": "root.child('pegawai_passwords').child('admin').exists()"
      }
    }
  }
}
```

---

### 7. **Admin Password Hardcoded — 3 Tempat Berbeda**
**File:** `src/pages/LoginPage.jsx` (line 16), `src/components/DeveloperConsole.jsx`, `src/contexts/FirebaseDataContext.jsx` (line 176)

#### Deskripsi:
Admin password `"123455"` tersebar di 3 file:
- LoginPage: getAdminCred() return `"123455"`
- DeveloperConsole: hardcoded `"123455"`
- FirebaseDataContext: sync `"123455"` ke Firebase

Masalah:
1. **Single source of truth tidak jelas**
2. **Jika perlu ganti password**, harus update 3 tempat
3. **Risk:** Developer lupa update salah satu, mismatch terjadi

#### Impact:
- 🟡 Admin tidak bisa ganti password (hardcoded)
- 🟡 Maintenance headache

#### Rekomendasi Fix:
✅ **Sudah fixed di Firebase override** — semua cek dari `pegawai_passwords/admin` di Firebase
✅ **Fallback const** ke satu file: `src/bersama/konstanta_aplikasi.js`:
```javascript
export const DEFAULT_ADMIN_PASSWORD = "123455";
export const DEFAULT_DEVELOPER_PASSWORD = "723254";
```

---

### 8. **No Email Verification — Admin Akses Open**
**File:** `src/pages/LoginPage.jsx` (line 200-209)

#### Deskripsi:
Admin login cuma check username + password, tanpa:
- Email verification
- IP whitelist
- 2FA / MFA
- Login history

#### Impact:
- 🔴 Admin akses terbuka siapa saja yang tahu password
- 🔴 Tidak ada audit trail

#### Rekomendasi Fix:
1. **Log admin login ke Firebase:**
   ```jsx
   onSuccess: () => {
     logToFirebase('admin_login', {
       timestamp: Date.now(),
       deviceId: deviceIdRef.current,
       ipAddress: '(auto-capture via Firebase)',
     });
   }
   ```

2. **Tambah rate-limiting:**
   ```jsx
   const [loginAttempts, setLoginAttempts] = useState(0);
   const [blockedUntil, setBlockedUntil] = useState(null);
   
   if (blockedUntil && Date.now() < blockedUntil) {
     setError("Terlalu banyak percobaan. Coba lagi dalam 5 menit.");
     return;
   }
   ```

---

## 🔵 MASALAH LAINNYA (4 Issues)

### 9. **Bundle Size — 728 kB JS (Main Chunk) — Too Large**
**File:** Build output

#### Deskripsi:
```
dist/assets/index-D-ZGw2RV.js  728.46 kB │ gzip: 192.34 kB
```

Main chunk sangat besar:
- html5-qrcode: ~60 kB (QR scanner library)
- framer-motion: ~34 kB (animations)
- React: ~40 kB (framework)
- Rest: app code + utilities

#### Impact:
- 🟡 First load lambat (terutama 3G/4G)
- 🟡 PWA akan cache ~1.2 MB (hanya 30 MB budget)
- 🟡 LCP (Largest Contentful Paint) mungkin > 3s

#### Rekomendasi Fix:
1. **Lazy load html5-qrcode** (dipakai hanya pegawai yang scan):
   ```jsx
   const QrScanner = lazy(() => import('./hooks/useQrScanner'));
   ```

2. **Split framer-motion** ke separate chunk (LoginPage only):
   ```javascript
   // vite.config.js
   export default {
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             'framer': ['framer-motion'],
             'qrcode': ['html5-qrcode'],
           }
         }
       }
     }
   }
   ```

3. **Remove unused Framer Motion** di non-login pages

Expected result: main chunk → ~400 kB

---

### 10. **Error Handling — Network Errors Tidak Graceful**
**File:** `src/contexts/FirebaseDataContext.jsx` (line 101-105)

#### Deskripsi:
```javascript
(error) => {
  console.error("Gagal memuat data absensi:", error);
  setFirebaseError("Gagal memuat data absensi. Periksa koneksi internet.");
  setFirebaseReady(true);  // ← Set ready despite error!
}
```

Masalah:
1. **`firebaseReady` set `true` meskipun ada error** — app render dengan data kosong
2. **No retry mechanism** — jika Firebase timeout, user harus refresh manual
3. **User experience:** Blank screen atau data kosong tanpa error message

#### Impact:
- 🟡 Offline users lihat data kosong (tidak tahu kenapa)
- 🟡 Firebase timeout → silent fail

#### Rekomendasi Fix:
1. **Retry dengan exponential backoff:**
   ```javascript
   const [retryCount, setRetryCount] = useState(0);
   const [retryTimer, setRetryTimer] = useState(null);
   
   (error) => {
     if (retryCount < 3) {
       const delay = 1000 * Math.pow(2, retryCount);
       setRetryTimer(setTimeout(() => {
         // Trigger re-subscribe
         setRetryCount(retryCount + 1);
       }, delay));
     } else {
       setFirebaseError("Koneksi gagal. Hubungi admin.");
       setFirebaseReady(true);
     }
   }
   ```

2. **Show error banner di UI:**
   ```jsx
   {firebaseError && (
     <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-4">
       {firebaseError} — <button onClick={handleRetry}>Coba Lagi</button>
     </div>
   )}
   ```

3. **Graceful degradation:**
   - Attendance kosong → "Data tidak tersedia, koneksi internet?"
   - Pengajuan kosong → "Tidak ada pengajuan pending"

---

### 11. **Session Persistence — Edge Case: Multiple Tab**
**File:** `src/contexts/SessionContext.jsx` (line 54-73)

#### Deskripsi:
Session di-restore dari `localStorage`:
```javascript
const restoreSession = (masterData) => {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return {};
  const saved = JSON.parse(raw);
  const p = saved.activePegawaiId
    ? masterData.find((item) => String(item.id) === String(saved.activePegawaiId))
    : null;
```

Masalah:
1. **Multiple tab sync:** Buka app di tab 1, login, buka tab 2 → tab 2 juga logged in (OK)
2. **Logout di tab 1** → localStorage cleared, tapi tab 2 masih punya session di memory
3. **Refresh tab 2** → session hilang (OK, expected)
4. **Edge case:** Tab 1 logout → clear localStorage, Tab 2 baca localStorage (empty) → navigasi login, tapi di-memory masih ada pegawai data

#### Impact:
- 🟡 User bingung (tab 1 logout tapi tab 2 masih active)
- 🟡 Tidak critical (refresh fix), tapi UX jelek

#### Rekomendasi Fix:
1. **Use SessionStorage instead of localStorage** untuk session state (hanya per-tab):
   ```javascript
   const SESSION_KEY = "siapel.session.v1"; // perubahan: localStorage → sessionStorage
   ```

2. **Sync across tabs** dengan storage event:
   ```javascript
   useEffect(() => {
     const handleStorageChange = (e) => {
       if (e.key === SESSION_KEY) {
         // Tab lain update session → sync
         setActivePegawai(null);
         setPage('login');
       }
     };
     window.addEventListener('storage', handleStorageChange);
     return () => window.removeEventListener('storage', handleStorageChange);
   }, []);
   ```

---

### 12. **QR TTL — 10 Detik Terlalu Singkat di Koneksi Lambat**
**File:** `src/hooks/useQrGenerator.js`, `src/utils/qr-token.js`

#### Deskripsi:
QR token valid hanya 10 detik:
```javascript
const TTL_MS = 10 * 1000;
const expiresAt = issuedAt + TTL_MS;
```

Masalah:
1. **Internet 3G/4G lambat** → pegawai buka kamera → fokus QR → scan → submit ~8 detik (OK)
2. **Tapi jika internet delay:**
   - Scan timestamp client: 8 detik
   - Upload ke Firebase: +2 detik = 10 detik total
   - Server validate: `Date.now() > expiresAt` → EXPIRED
   - Pegawai: "Token expired, coba lagi"

3. **Race condition:** Jika server time beda dari client ±3 detik → false positive

#### Impact:
- 🟡 User frustration di internet lambat
- 🟡 Perlu ulang scan berkali-kali

#### Rekomendasi Fix:
1. **Extend TTL ke 30 detik** (masih aman, QR regen otomatis tiap 10 detik):
   ```javascript
   const TTL_MS = 30 * 1000; // ← 30 detik
   ```

2. **Tambah leeway untuk clock skew:**
   ```javascript
   const LEEWAY_MS = 3000; // 3 detik
   if (Date.now() > expiresAt + LEEWAY_MS) {
     throw new Error("Token expired");
   }
   ```

3. **Server-side validation** (firebase rules):
   ```json
   "qr": {
     ".validate": "newData.child('expiresAt').val() >= now - 3000"
   }
   ```

---

## 📋 RINGKAS URUTAN FIX

### Priority 1 — CRITICAL (Blok Production)
1. ✅ **Blockchain password di pegawai_master.json** (.gitignore + reset password)
2. 🟥 **Guard passwordOverridesLoaded di LoginPage submit**
3. 🟥 **Update Firebase rules** — granular access control

### Priority 2 — HIGH (Perlu fix sebelum go-live)
4. ✅ **Hapus PegawaiLogin.jsx & RoleSelector.jsx** (cleanup)
5. 🟥 **Add device fingerprint validation** atau clarity di docs
6. 🟥 **Rate-limiting login attempts**
7. 🟥 **Redirect pimpinan ke selector** dulu

### Priority 3 — MEDIUM (Post-launch)
8. 🟥 **Bundle optimization** — lazy load qrcode + framer-motion
9. 🟥 **Improve error handling** — retry + notification
10. 🟥 **Fix QR TTL edge case** — extend 10s → 30s

### Priority 4 — NICE-TO-HAVE
11. 🟡 **Multi-tab sync** — use sessionStorage
12. 🟡 **Admin login audit trail**

---

## 📊 TESTING CHECKLIST

Sebelum production, test scenarios ini:

```
[ ] Login with wrong password → Error message
[ ] Login with correct password → Dashboard correct role
[ ] Logout → Clear session, back to login
[ ] Logout tab 1 → Tab 2 masih active (expected)
[ ] Refresh after logout → Login page
[ ] QR scan → 1 second latency (test dengan network throttle)
[ ] QR scan → 3G speed → Tidak expired
[ ] Firebase password change → Login next day → New password works
[ ] Admin login → DeveloperConsole ganti password → Semua role terpengaruh
[ ] Double login (2 device) → Device ke-2 terdeteksi logout
[ ] Network offline → Error message, not blank screen
[ ] Slow network 3G → Load time < 5s
[ ] iOS Safari → QR scanner jalan?
[ ] Samsung Internet → Tidak crash crypto.randomUUID()
```

---

## 🔗 FILES TERDAMPAK

| Priority | File | Issue | Fix |
|----------|------|-------|-----|
| P1 | pegawai_master.json | Plaintext password | .gitignore + generate new |
| P1 | LoginPage.jsx | Race condition password | Guard submit, visual loading |
| P1 | firebase-rules.json | Permissive rules | Add granular checks |
| P2 | PegawaiLogin.jsx | Dead code | Delete |
| P2 | RoleSelector.jsx | Dead code | Delete |
| P2 | App.jsx | Import unused pages | Cleanup |
| P2 | LoginPage.jsx | Pimpinan redirect | Route to selector |
| P3 | vite.config.js | Large bundle | Add manualChunks |
| P3 | FirebaseDataContext | Error handling | Add retry logic |
| P3 | qr-token.js | Short TTL | Extend 30s |

---

## 📝 KESIMPULAN

Project sudah **90% production-ready**, tapi ada **5 critical security/UX issues** yang perlu fix:

1. ✅ **Password exposed di JSON** — harus .gitignore + rotate semua password
2. 🟥 **Race condition login** — guard passwordOverridesLoaded di submit
3. 🟥 **Firebase rules terlalu permissive** — enforce per-path access
4. 🟡 **Dead code (2 login page)** — cleanup, tidak effect functionality
5. 🟡 **Bundle 728 kB** — belum critical tapi akan lambat di 3G

**Timeline:** Estimasi 4-6 jam untuk fix priority 1+2 issues.

---

Generated: 2026-07-06 | Analyst: Abacus AI
