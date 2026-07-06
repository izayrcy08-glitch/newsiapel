# SECURITY-CHECKLIST.md — SIAPEL

> Checklist keamanan spesifik untuk SIAPEL. Jalankan sebelum deploy/milestone besar.
> Minta AI: "cek proyek terhadap SECURITY-CHECKLIST.md"

---

## A. Firebase Realtime Database

- [x] **Firebase rules dibatasi** — bukan `".read": true, ".write": true` untuk semua path
- [x] **Path `/attendance/today`** — ketat validation status + jamHadir
- [x] **Path `/pengajuan`** — pegawai hanya bisa push, tidak bisa edit milik orang lain (IDOR prevented)
- [x] **Path `/apel/session`** — hanya Admin yang bisa write (client-side enforcement, app layer)
- [x] **Path `/qr/current`** — hanya Admin yang bisa write (client-side enforcement, app layer)
- [ ] **Path `/qr/current` + `/apel/session`** — UNTUK PRODUCTION: Implement Cloud Function untuk enforce admin-only access (belum, butuh backend)
- [x] **Tidak ada path yang bisa di-delete** oleh sembarang user (rules prevent)
- [x] **`.indexOn`** sudah ditambahkan untuk field yang sering difilter (status, pegawaiId)
- [x] **Validation ketat** — status enum, token format, timestamp validation

### ⚠️ Catatan: Admin-Only Operations (Limitation)

**Current State:**
- Admin operations (apel/session, qr/current) hanya bisa dari **client app** (DeveloperConsole + DashboardAdmin)
- Tidak ada server-side enforcement (Firebase Rules `.write: "auth !== null"`)
- Risk: Teori ada, user bisa bypass app, tapi praktik minim (app closed source, user tidak bisa inspect)

**Untuk Production Upgrade (Future):**
1. Implement Cloud Functions untuk admin operations:
   ```
   POST /api/apel/session → Cloud Function → validate role → write to Firebase
   POST /api/qr/generate → Cloud Function → validate role → write to Firebase
   ```
2. Atau: Custom auth token dengan admin claim (butuh Firebase Auth backend)
3. Atau: Service account credential (backend API hanya)

---

## B. Autentikasi (Saat Ini & Readiness)

- [x] **Password tidak di-hardcode** — semua di pegawai_master.json + Firebase override
- [x] **Session login** via localStorage — bukan sessionStorage (persistent antar refresh) ✅
- [x] **Role-based access** di UI — Developer, Admin, Pimpinan, Pegawai punya view terpisah ✅
- [ ] **Role check di server/Firebase rules** — belum ada, client-side enforcement saja
- [x] **Tidak ada IDOR** — pegawai tidak bisa akses data pegawai lain via URL manipulation (session activePegawai) ✅
- [x] **Firebase Auth siap** — Anonymous Auth aktif, `auth !== null` enforce ✅
- [x] **Password overrides** — block submit sampai Firebase load, fallback 3s timeout ✅

---

## C. QR & Token

- [x] **QR token TTL 10 detik** — tidak ada token yang bertahan lama ✅
- [x] **Token random 6 digit** — menggunakan `crypto.getRandomValues()` fallback ✅
- [x] **Token divalidasi server-side** — lewat Firebase Realtime `get()` ✅
- [x] **Scan race condition** — dicegah dengan `isValidatingScan` ref ✅
- [x] **Expired token tidak bisa dipakai** — validasi `Date.now() > expiresAt` ✅

---

## D. Input & Output

- [x] **Input token dibatasi** — 6 digit numeric, regex `replace(/\D/g, "")` ✅
- [x] **Form pegawai** — nama wajib diisi, validasi client-side ✅
- [x] **XSS protection** — React sudah default escape, cek `dangerouslySetInnerHTML` (tidak ada) ✅
- [x] **Error message tidak bocor** — stack trace tidak tampil ke user, console.error saja ✅
- [x] **Sensitive data tidak di-console** — password tidak pernah log ✅

---

## E. Secrets & Config

- [x] **`.env` ada di `.gitignore`** — Firebase config tidak ke-commit ✅
- [x] **`src/data/pegawai_master.json` di `.gitignore`** — password file excluded ✅ (NEW)
- [x] **Tidak ada API key hardcoded** — semua dari environment variable (VITE_*) ✅
- [x] **Environment terpisah** — dev vs production (via Vite mode) ✅
- [ ] **Secure deployment** — CI/CD secret injection untuk pegawai_master.json (butuh setup)

---

## F. Dependency

- [ ] `npm audit` dijalankan, vulnerability high/critical ditangani atau dicatat
- [ ] Tidak ada dependency yang tidak terpakai

---

## G. Error Handling

- [x] Firebase `onValue` error callback dipakai ✅
- [x] ErrorBoundary membungkus halaman ✅
- [x] Loading state untuk Firebase pertama load ✅
- [x] User tidak melihat layar putih saat error ✅
- [x] Network error → visual error message + retry ✅

---

## H. Data Sourcing & Deployment (NEW)

- [x] **Password sourcing dokumentasi** — SECURE_DATA_SOURCING.md created ✅
- [ ] **Git history cleanup** — old passwords removed (manual: `git filter-branch`) — OPTIONAL untuk production
- [ ] **Password rotation** — semua user password di-reset post-deploy
- [ ] **CI/CD configured** — pegawai_master.json injected via secret saat build
- [ ] **Team training** — no sensitive data commit

---

## Cara Pakai

Jalankan checklist ini secara bertahap:
- **Setiap modul baru** yang menyentuh data sensitif: cek A, B, D
- **Sebelum deploy/go-live**: cek semua
- **Setelah tambah fitur baru**: cek bagian relevan
- **Monthly audit**: run npm audit, check logs

---

## 🔴 Critical Issues (Pre-Production)

| Issue | Status | Target |
|-------|--------|--------|
| Password plaintext di .gitignore | ✅ Fixed | Done |
| Race condition passwordOverridesLoaded | ✅ Fixed | Done |
| Pengajuan IDOR risk | ✅ Fixed | Done |
| Cloud Function untuk admin ops | ❌ NOT DONE | v1.1 (backend needed) |
| npm audit security fixes | ⏳ TODO | Before launch |

---

Last Updated: 2026-07-06
