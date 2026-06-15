# AUDIT PRODUCTION READINESS — SIAPEL

> **Audit date:** 2026-06-15
> **Branch:** `refactor-phase-1`
> **Commit terakhir:** `cbe0b26`
> **Tujuan:** Mengidentifikasi semua masalah yang menghalangi SIAPEL masuk tahap produksi (go-live).
> **Keputusan: ⛔ BELUM SIAP PRODUKSI — 19+ blocking issues ditemukan.**

---

## 🔴 PRIORITAS 1 — KRITIKAL (Harus diperbaiki SEBELUM produksi)

### 1.1 Tidak Ada Autentikasi Sama Sekali

**Lokasi:** `src/pages/PegawaiLogin.jsx`, `src/pages/PimpinanSelector.jsx`, `src/contexts/SessionContext.jsx:147`

**Masalah:** Login pegawai hanya mencari nama dari JSON lalu klik "Masuk Sebagai Pegawai". Tidak ada:
- Password/PIN/biometric check
- Firebase Auth integration
- Session token server-side
- Verifikasi identitas apapun

Siapapun bisa login sebagai pegawai/pimpinan/admin manapun hanya dengan klik nama. Password field di `pegawai_master.json` (302 baris) semuanya `""` — tidak pernah dipakai.

**Severity: BLOCKING**

---

### 1.2 Firebase Rules: Public Read/Write

**Lokasi:** `firebase-rules.json`

**Masalah:** Setiap path menggunakan:
```json
".read": true,
".write": true,
```
Tidak ada satupun referensi `auth` di rules. Siapapun yang tahu Firebase project URL (yang sudah terekspos di `.env.local`) bisa read/write langsung via REST API, bypass app sama sekali.

Validasi struktur data memang ada (status enum, format jam, dll), tapi tanpa auth check itu hanya form validation — tidak menggantikan security.

**Severity: BLOCKING**

---

### 1.3 Tidak Ada Access Control — Admin & Developer Gratis

**Lokasi:** `src/pages/RoleSelector.jsx`, `src/pages/DeveloperConsole.jsx`, `src/contexts/FirebaseDataContext.jsx`

**Masalah:**
- Role selector membiarkan siapapun klik "Admin" atau "Developer"
- DeveloperConsole mengekspos SEMUA operasi: reset attendance, CRUD pegawai, approve/reject pengajuan, ganti apel session, scan simulasi
- Firebase mutations di `FirebaseDataContext.jsx` (`handleReset`, `handleKoreksi`, `handlePengajuanVerifikasi`, dll) tidak ada auth check sama sekali

**Severity: BLOCKING**

---

### 1.4 IDOR (Insecure Direct Object Reference) di Semua Operasi

**Lokasi:** `FirebaseDataContext.jsx:166-261`

**Masalah:** Semua mutation function menerima `pegawaiId` dari client dan langsung write ke Firebase. Tidak ada pengecekan:
- Apakah user yang login berhak mengubah data pegawai X?
- Apakah role user mencukupi untuk operasi ini?
- Apakah user mencoba mengubah punya orang lain?

**Contoh konkret:** `handleKoreksi(pegawaiId, newStatus)` — siapapun bisa mengubah status kehadiran pegawai manapun.

**Severity: BLOCKING**

---

### 1.5 Session Management Client-Side Tanpa Integritas

**Lokasi:** `SessionContext.jsx:47-66, 99-113`

**Masalah:**
- Session disimpan di `sessionStorage` sebagai JSON plain
- Tidak ada signature/HMAC/JWT
- Tidak ada expiry
- Restore session percaya penuh apa yang ada di storage
- Siapapun bisa edit `sessionStorage` via DevTools dan jadi pegawai/admin manapun

**Severity: BLOCKING**

---

### 1.6 QR Token Tidak Terikat ke User

**Lokasi:** `src/utils/qr-token.js`, `useQrScanner.js`, `DashboardPegawai.jsx:91-108`

**Masalah:**
- QR token 6 digit tidak binding ke identitas scanner — token valid, siapapun bisa absen
- Manual code bypass — cukup ketik 6 digit yang muncul di QR Admin (via antrean admin atau nebak 1:1M)
- `onScan(pegawai.id)` dipanggil dengan ID dari session, bukan dari token → token memvalidasi dirinya sendiri, bukan penggunanya

**Severity: BLOCKING**

---

### 1.7 Missing .catch() pada Semua Firebase Write Operations

**Lokasi:** `FirebaseDataContext.jsx:147, 159, 173, 195, 201, 211, 241, 253`

**Masalah:** Fungsi `set()` dan `update()` dipanggil tanpa `.catch()` error handler. Jika Firebase write gagal (offline, quota, permissions):
- UI state sudah keubah optimistically (via useState)
- Database tidak berubah
- User tidak dapat feedback error
- Diam-diam desync antara UI dan database

**Severity: BLOCKING**

---

### 1.8 ErrorBoundary Tidak Terintegrasi di Render Tree

**Lokasi:** `src/components/ErrorBoundary.jsx`, `src/App.jsx`

**Masalah:** `ErrorBoundary` class component sudah dibuat tapi **tidak pernah di-import atau dipakai** di `App.jsx` atau `main.jsx`. Jika ada komponen throw saat render, user lihat white screen tanpa recovery.

**Severity: BLOCKING**

---

## 🟠 PRIORITAS 2 — HIGH (Harus diperbaiki SEBELUM atau SEGERA setelah produksi)

### 2.1 Rate Limiting Tidak Ada

**Deskripsi:** Tidak ada rate limiting pada endpoint sensitif:
- QR token validation — 6 digit numeric bisa dibruteforce tanpa throttle
- Firebase Realtime Database write unlimited dari client
- Login attempt (tapi tidak ada login)

**Severity: HIGH**

---

### 2.2 Race Condition pada QR Validation (TOCTOU)

**Lokasi:** `src/utils/qr-token.js`

**Masalah:** `validateQrToken()` baca token dari Firebase, lalu cek `Date.now() > expiresAt` secara lokal. Antara get() dan evaluasi, token bisa expired di server. Juga tidak ada atomic consume — token valid bisa dipakai berkali-kali dalam 10s window.

**Severity: HIGH**

---

### 2.3 Tidak Ada Audit Trail

**Lokasi:** `FirebaseDataContext.jsx:238-261`

**Masalah:**
- `handleKoreksi` — tidak tercatat Siapa yang mengoreksi, kapan, kenapa
- `handlePengajuanVerifikasi` — hanya catat `approvedAt`, tanpa siapa yang approve
- `handleReset` — tidak ada log siapa yang reset attendance
- Tidak ada history perubahan status

**Severity: HIGH**

---

### 2.4 One-Click Reset Attendance (Tanpa Recovery)

**Lokasi:** `FirebaseDataContext.jsx:200-202`

**Masalah:** `handleReset` panggil `set(ref(database, ATTENDANCE_PATH), null)` — nuke semua data attendance hari itu dalam satu operasi. Tidak ada konfirmasi (di Firestore context), tidak ada backup, tidak ada soft-delete atau recovery mechanism.

**Severity: HIGH**

---

### 2.5 `dist/index.html` Ter-track di Git

**Lokasi:** Root (git tracked files)

**Masalah:** `dist/index.html` terdaftar di git (`git ls-files` menunjukkan file ini di-track). Ini menyebabkan:
- Build output jadi noise di git status
- Potensi conflict di dist file
- 1.3 MB build output dalam history git

**Severity: HIGH**

---

### 2.6 Vulnerable Dependencies (esbuild RCE)

**Lokasi:** `package.json`

**Masalah:** `npm audit` melaporkan:
- **1 high:** esbuild → "any website can send requests to dev server and read response" (GHSA-67mh-4wv8-2f99)
- **1 moderate:** esbuild → "Missing binary integrity verification in Deno enables RCE" (GHSA-gv7w-rqvm-qjhr)
- Fix requires `vite@8.0.16` (breaking change, Vite 5→8)

**Severity: HIGH** (dev server vulnerability bisa ekspos file di internal network)

---

### 2.7 Tidak Ada Unit Test

**Deskripsi:** Nol test coverage — tidak ada `*.test.*`, tidak ada `vitest`/`jest`, tidak ada test script di `package.json`. Fungsi pure seperti `validateQrToken`, `calcAttendanceStats`, utility di `bersama/` tidak punya test.

**Severity: HIGH**

---

### 2.8 Tidak Ada CI/CD

**Deskripsi:** Tidak ada `.github/`, `.gitlab-ci.yml`, Dockerfile, atau deployment config apapun. Setiap deploy harus manual.

**Severity: HIGH**

---

### 2.9 Tidak Ada .env.example

**Deskripsi:** Hanya ada `.env.local` (live credentials). Tidak ada `.env.example` untuk onboarding developer baru. README memang dokumentasi env vars, tapi tidak bisa dicopy langsung.

**Severity: HIGH**

---

### 2.10 Auto-Cleanup Effect Memory Leak

**Lokasi:** `FirebaseDataContext.jsx:106-138`

**Masalah:** Effect untuk hapus file storage 24j setelah disetujui:
- Fire ulang setiap kali `pengajuan` reference berubah (setiap subscription callback)
- Tidak ada guard untuk item yang sudah diproses → cleanup mencoba hapus path yang sudah dihapus, menghasilkan `storage/object-not-found`
- Tidak ada cleanup function di return effect

**Severity: HIGH**

---

## 🟡 PRIORITAS 3 — MEDIUM

### 3.1 `console.error` di Production Code (12 instances)

**Lokasi:** Tersebar di hooks, contexts, pages

**Masalah:** 12 `console.error` di production code paths. Tidak ada guard `import.meta.env.PROD` atau logging service.

### 3.2 Tidak Ada Linting / Formatting

**Deskripsi:** Tidak ada ESLint, Prettier, Husky, atau lint-staged. Kode tidak ada standar format otomatis.

### 3.3 Tidak Ada TypeScript — Zero Type Safety

**Deskripsi:** 100% JavaScript. Tidak ada `tsconfig.json`. Environment variables tanpa type checking — jika `VITE_*` undefined, jadi `undefined` tanpa peringatan.

### 3.4 Dependencies Usang (Versi Tertinggal Jauh)

| Package | Current | Latest | Gap |
|---|---|---|---|
| react/react-dom | 18.3.1 | 19.2.7 | 1 major |
| vite | 5.4.21 | 8.0.16 | 3 majors |
| tailwindcss | 3.4.19 | 4.3.1 | 1 major (breaking) |
| @vitejs/plugin-react | 4.7.0 | 6.0.2 | 2 majors |
| firebase | 12.13.0 | 12.14.0 | minor |

### 3.5 Tidak Ada Environment Separation

**Deskripsi:** Hanya ada `.env.local`. Tidak ada `.env.production`, `.env.staging`, atau mode-specific env. Tidak ada import.meta.env.PROD guard di code.

### 3.6 PWA Manifest `lang: "en"` untuk App Bahasa Indonesia

**Lokasi:** `vite.config.js`

**Masalah:** PWA manifest `lang` default `"en"` tapi app full Bahasa Indonesia. `siapel-pwa.png` (138 KB) dipakai untuk 192x192 dan 512x512 — seharusnya icon berbeda ukuran.

### 3.7 Employee Data + Passwords in Git

**Lokasi:** `src/data/pegawai_master.json`

**Masalah:** 302 record pegawai dengan NIP, nama, jabatan, unit, role — dan field `password` (walaupun masih kosong). Jika repo publik, ini data PII (Personally Identifiable Information).

### 3.8 Prop Drilling 20+ Props via AppRouter

**Lokasi:** `src/App.jsx`

**Masalah:** Banyak komponen panel terima 15-20 props dari parent padahal bisa langsung akses context (`useSession()`, `useFirebaseData()`) langsung.

### 3.9 `firebaseReady` dan `firebaseError` Tidak Pernah Dipakai

**Lokasi:** `FirebaseDataContext.jsx:25-26`

**Masalah:** Context mengekspose `firebaseReady` dan `firebaseError` tapi tidak ada satupun komponen yang menggunakannya. Jika Firebase gagal connect, app tetap render tanpa feedback ke user.

### 3.10 Tidak Ada Loading State di PanelKoreksi

**Lokasi:** `src/panels/PanelKoreksi.jsx`

**Masalah:** Saat user klik koreksi, Firebase write langsung fire tanpa ada loading spinner atau feedback — user tidak tahu apakah operasi berhasil atau gagal.

### 3.11 Duplikasi useEffect di DashboardPegawai

**Lokasi:** `DashboardPegawai.jsx:61-66` dan `84-89`

**Masalah:** Dua useEffect identik (tutup scanner/manual code saat `canSubmitAttendance` berubah) — copy-paste duplicate.

---

## 🟢 PRIORITAS 4 — LOW (Perbaikan setelah stabil)

| # | Issue | Detail |
|---|---|---|
| 4.1 | Magic numbers | `useShowMore(filtered, 7)` di panel, threshold jam `07:00`/`08:00` hardcoded di beberapa tempat |
| 4.2 | Tidak ada pagination di pengajuan query | `onValue(PENGAJUAN_PATH)` subscribe ALL data tanpa limit — grows unbounded |
| 4.3 | Weak ID generation | `SessionContext.jsx:168` generate ID incrementally — konflik dengan ID dari Firebase |
| 4.4 | Array reference instability | `pengajuan` di-map tiap subscription → array baru tiap kali → effect deps trigger ulang |
| 4.5 | `window.confirm` untuk delete | `PanelKelolaPegawai.jsx:85` — blocking, tidak bisa di-style, tidak konsisten dengan UI |
| 4.6 | No Node.js version pinned | Tidak ada `.nvmrc` atau `engines` di `package.json` |
| 4.7 | PWA tidak ada maskable icon | Android splash screen butuh `purpose: maskable` |
| 4.8 | Null-safety attendance lookup | `attendance[pegawai.id]` diakses tanpa guard di beberapa panel |

---

## ⚠️ RINGKASAN

| Kategori | Jumlah | Blocking |
|---|---|---|
| 🔴 KRITIKAL (P1) | 8 | ✅ Semua blocking |
| 🟠 HIGH (P2) | 10 | ✅ Semua blocking |
| 🟡 MEDIUM (P3) | 11 | ❌ Non-blocking, perlu roadmap |
| 🟢 LOW (P4) | 8 | ❌ Housekeeping |

### Kesimpulan

**SIAPEL masih prototype murni — bukan production-ready.** Root cause dari hampir semua blocking issue adalah:
1. **Belum ada autentikasi** (Firebase Auth tidak dipakai, password field cuma placeholder)
2. **Tidak ada access control** (di Firebase Rules maupun di app code)
3. **Error handling tidak konsisten** (Firebase .catch() hilang, ErrorBoundary tidak terpasang)

Data di CONTEXT.md sudah menyadari masalah ini — prioritas #1 adalah 🔴 **Autentikasi**. Tapi setelah audit selesai, saya perlu sampaikan bahwa autentikasi saja tidak cukup: harus dibarengi dengan **Firebase Rules rewrite + access control architecture** agar benar-benar aman.

> **Rekomendasi:** Sebelum lanjut ke fitur login, prioritaskan dulu audit hardening: Firebase Rules strict (dengan auth check, validasi ownership) + Service layer untuk access control. Login tanpa access control hanyalah "tirai" — tidak mengamankan data.
