# SECURITY-CHECKLIST.md — SIAPEL

> Checklist keamanan spesifik untuk SIAPEL. Jalankan sebelum deploy/milestone besar.
> Minta AI: "cek proyek terhadap SECURITY-CHECKLIST.md"

---

## A. Firebase Realtime Database

- [ ] **Firebase rules dibatasi** — bukan `".read": true, ".write": true` untuk semua path
- [ ] **Path `/attendance/today`** — hanya bisa write oleh verified QR scan atau Admin
- [ ] **Path `/pengajuan`** — pegawai hanya bisa push, tidak bisa edit punya orang lain
- [ ] **Path `/apel/session`** — hanya Admin yang bisa write
- [ ] **Path `/qr/current`** — hanya Admin yang bisa write, TTL 10 detik
- [ ] **Tidak ada path yang bisa di-delete** oleh sembarang user
- [ ] **`.indexOn`** sudah ditambahkan untuk field yang sering difilter (status, pegawaiId)

## B. Autentikasi (Saat Ini & Readiness)

- [ ] **Password tidak di-hardcode** di source code (hanya ada di pegawai_master.json, belum dipakai)
- [ ] **Session login** via sessionStorage — bukan localStorage (sudah ✅)
- [ ] **Role-based access** di UI — Developer, Admin, Pimpinan, Pegawai punya view terpisah (sudah ✅)
- [ ] **Role check di server/Firebase rules** — belum ada, perlu auth
- [ ] **Tidak ada IDOR** — pegawai tidak bisa akses data pegawai lain via URL manipulation? (cek: session activePegawai)
- [ ] **Firebase Auth siap diintegrasikan** — SessionContext sudah terpisah (sudah ✅)

## C. QR & Token

- [ ] **QR token TTL 10 detik** — tidak ada token yang bertahan lama (sudah ✅)
- [ ] **Token random 6 digit** — menggunakan `crypto.getRandomValues()` (sudah ✅)
- [ ] **Token divalidasi server-side** — lewat Firebase Realtime `get()` (sudah ✅)
- [ ] **Scan race condition** — dicegah dengan `isValidatingScan` ref (sudah ✅)
- [ ] **Expired token tidak bisa dipakai** — validasi `Date.now() > expiresAt` (sudah ✅)

## D. Input & Output

- [ ] **Input token dibatasi** — 6 digit numeric, regex `replace(/\D/g, "")` (sudah ✅)
- [ ] **Form pegawai** — nama wajib diisi, validasi client-side (sudah ✅)
- [ ] **XSS protection** — React sudah default escape, cek `dangerouslySetInnerHTML` (tidak ada)
- [ ] **Error message tidak bocor** — stack trace tidak tampil ke user (cek: console.error vs UI)

## E. Secrets & Config

- [ ] **`.env` ada di `.gitignore`** — Firebase config tidak ke-commit (cek .gitignore)
- [ ] **Tidak ada API key hardcoded** — semua dari environment variable (sudah ✅ via VITE_*)
- [ ] **Environment terpisah** — dev vs production (via Vite mode)

## F. Dependency

- [ ] `npm audit` dijalankan, vulnerability high/critical ditangani atau dicatat
- [ ] Tidak ada dependency yang tidak terpakai

## G. Error Handling

- [ ] Firebase `onValue` error callback dipakai (sudah ✅ di FirebaseDataContext)
- [ ] ErrorBoundary membungkus halaman (belum — perlu integrasi di App.jsx)
- [ ] Loading state untuk Firebase pertama load (sudah ✅)
- [ ] User tidak melihat layar putih saat error (perlu ErrorBoundary)

---

## Cara Pakai

Jalankan checklist ini secara bertahap:
- **Setiap modul baru** yang menyentuh data sensitif: cek A, B, D
- **Sebelum deploy/go-live**: cek semua
- **Setelah tambah fitur baru**: cek bagian relevan
