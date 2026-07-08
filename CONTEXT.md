# CONTEXT — SIAPEL (Sistem Informasi Apel Pegawai)

Status proyek terkini. Update tiap selesai sesi.

---

## Status Terkini
- **Branch:** `main` (production)
- **Deploy:** https://siapel.vercel.app ✅
- **GitHub:** https://github.com/izayrcy08-glitch/newsiapel (main)
- **Sesi terakhir:** 2026-07-08 — Dashboard: Perlu Perhatian tanpa sanksi, bidang live, riwayat pengajuan, reset per user developer
- **Firebase:** Live — Realtime Database + Storage lazy load + Rules `auth !== null` (Anonymous Auth active ✅)
- **Firebase Console:** Rules diperbaiki, Anonymous Auth: **enable** ✅
- **Build:** `npm run build` ✅
- **Persistensi data pegawai:** Admin edits permanen via localStorage (key v3) + Firebase sync master_pegawai (conditional: hanya admin/developer)
- **MASALAH FIXED:** ✅ Admin/Developer login — Add safety check untuk admin/dev entries + comprehensive logging di LoginPage

## Riwayat Sesi

| Tanggal | Sesi | Isi |
|---|---|---|
| 2026-06-13 | `refactor-phase-1` | Restruktur Admin, Pengajuan end-to-end, Fix stat "Belum Hadir"/"Tanpa Keterangan", Code splitting, Dead code cleanup |
| 2026-06-15 | `refactor-phase-1` | Arsitektur baru: 6 custom hooks, SessionContext + FirebaseDataContext, App.jsx 438→120 baris, DashboardAdmin 961→130 baris (7 panel), ErrorBoundary, usePegawaiSearch di semua page |
| 2026-06-15 | `refactor-phase-1` | Final: CONTEXT.md sebagai status dinamis, CLAUDE.md fokus aturan, settings.json auto-baca CONTEXT tiap sesi |
| 2026-06-15 | `refactor-phase-1` | Feature audit: hapus 9 placeholder DeveloperConsole + Data Source Toggle + legacy JSON, implementasi Firebase Storage upload file, hapus DEMO_LAST_MONTH_DISCIPLINE |
| 2026-06-15 | `refactor-phase-1` | **Fix akar data placeholder:** hapus mergeAttendanceWithPeople (biarkan Firebase mentah), cabang data kosong di calcAttendanceStats return 0, guard PerhatianList, tombol Reset Attendance di DeveloperConsole, hapus state_absensi.js |
| 2026-06-15 | `refactor-phase-1` | **DeveloperConsole cleanup:** hapus Preview Data section, pindah search ke atas View As, dropdown overlay hasil pencarian, sorting prefix-first, fix SearchInput remount bug (pindah luar komponen biar tidak kehilangan fokus tiap render) |
| 2026-06-15 | `refactor-phase-1` | **Fix slowdown + storage lazy:** Pisah Firebase Storage SDK ke `storage-helper.js` (dynamic import — cuma di-load saat upload), hapus `firebaseReady` blocking screen agar halaman render instan. Bundle awal turun 33 kB. |
| 2026-06-15 | `refactor-phase-1` | **Fix persistensi master pegawai:** `loadMasterPegawaiData()` kini baca dari localStorage dulu sebelum fallback ke `pegawai_master.json`. Perubahan data pegawai (bidang, unit, role) dari admin/kelola pegawai tidak hilang setelah refresh. |
| 2026-06-15 | `refactor-phase-1` | **Paket 1 Production Readiness:** generate password 6 digit angka utk 302 pegawai, tambah field `nik` + `phoneFingerprint` di JSON & normalize, storage key v1→v3, validasi integritas field localStorage, password tampil di form edit kelola pegawai |
| 2026-06-15 | `refactor-phase-1` | **Paket 2: Login Baru** — ganti search-by-name jadi multi-step login: NIP (prioritas) → NIK → Nama → password 6 digit. Device fingerprint otomatis tersimpan saat login sukses (Firebase + localStorage). File baru: `device-fingerprint.js`. 5 file berubah, build ✅ |
| 2026-06-15 | `refactor-phase-1` | **Login semua role** — AdminLogin (admin/355454), DeveloperLogin (developer/723254), PimpinanSelector + password step (pilih nama → password 6 digit). File baru: AdminLogin.jsx, DeveloperLogin.jsx, CREDENTIALS.md. 5 file berubah, build ✅ |
| 2026-06-15 | `refactor-phase-1` | **Unified Login Page** — 1 form username+password untuk semua role (auto-detect admin/developer/pegawai/pimpinan). Hapus RoleSelector, PegawaiLogin, AdminLogin, DeveloperLogin, PimpinanSelector — ganti LoginPage.jsx. Desain clean professional, logo besar sebagai pusat visual. Info kontak admin di bawah form. Bundle ~443 kB. Build ✅ |
| 2026-06-15 | `refactor-phase-1` | **LoginPage cinematic dari 21st.dev** — rewrite total pake Framer Motion (partikel, 3D tilt, light beams, glassmorphism, AnimatePresence). Tema emerald → biru tua. Logo full lingkaran (`w-full h-full object-cover rounded-full`). Dependensi baru: framer-motion, lucide-react, clsx, tailwind-merge. File baru: src/lib/utils.js (cn utility). Build ✅ |
| 2026-06-15 | `refactor-phase-1` | **Ganti Password DeveloperConsole** — 1 kolom simpel: tampilkan password saat ini + eye toggle show/hide (lucide-react) + tombol simpan langsung ubah localStorage. Fix: React key={tab} biar Admin/Developer tab tidak share state, fix input editable (hapus .slice(0, 6), tambah onFocus select-all). Integrasi login diverifikasi — siapel.adminPassword / siapel.developerPassword konsisten antara DeveloperConsole ↔ LoginPage. Build ✅ |
| 2026-06-15 | `refactor-phase-1` | **Unified PanelKoreksi** — gabung Koreksi Manual (filter TK) + Pengajuan dalam 1 panel 2 tab, search + filter bidang, badge count pengajuan pending. Hapus PanelPengajuan dari DashboardAdmin, menu Pengajuan tergabung ke Koreksi Absensi. Build ✅ |
| 2026-06-15 | `refactor-phase-1` | **DeveloperConsole → PanelKoreksi** — ganti PanelPengajuan modal dengan PanelKoreksi full-page (sama dengan Admin). Menu 'Pengajuan Status' → 'Koreksi Absensi'. Konsisten antara Admin & DeveloperConsole. Build ✅ |
| 2026-06-15 | `refactor-phase-1` | **Dead code cleanup** — hapus PanelPengajuan.jsx (97 baris, 0 imports), update SIAPEL_README.md. Semua fungsi pengajuan sudah di PanelKoreksi. Build ✅ |
| 2026-06-15 | `main` | **Deploy Production** — merge refactor-phase-1 → main (--no-ff), push GitHub, deploy Vercel (https://siapel.vercel.app), Firebase Rules terpasang, siap pilot |
| 2026-06-15 | `main` | **Fix password sync lintas domain** — 3 fix inkonsistensi password (admin fallback 355454→123456, H.Rody 811800→123321, Sekretaris Dinas nama kosong). Fitur ganti password kini simpan ke Firebase RTDB (`pegawai_passwords/{key}`) agar berlaku di semua domain (localhost + production). LoginPage cek Firebase overrides dulu, lalu localStorage, lalu fallback. DeveloperConsole + PanelKelolaPegawai bridge via `handleSavePasswordOverride`. Build ✅ |
| 2026-06-15 | `main` | **Active Session — Last-Login-Wins** — cegah 1 akun login di 2 device. `sessionId` unik tiap browser, tulis ke `/activeSessions/{userId}` di Firebase. Listener realtime detect conflict (loginAt > listenerStartTime). Force logout + banner "Sesi Berkonflik" di LoginPage. Fix race condition: navigation sebelum write selesai, data stale dari sesi sebelumnya. Update firebase-rules.json: tambah path activeSessions, fingerprints, pegawai_passwords. **⚠️ Masih ada bug: admin masih bisa dobel login (tidak terdeteksi conflict) — perlu diobrolan baru.** 5 file berubah, build ✅ |
| 2026-06-15 | `main` | **Fix: revert + simplify active session** — Revert SessionContext, App.jsx, LoginPage ke struktur sebelum active session. Simplify FirebaseDataContext: sessionId pake useRef (bukan useState di SessionContext), subscription tanpa `listenerStartTime` hack, `handleSaveActiveSession` di-await with 3s timeout (bukan fire-and-forget). Admin login di HP ✅, double login terdeteksi ✅. 4 file berubah, build ✅ |
| 2026-06-15 | `main` | **Fix: seragamkan admin password + guard overrides loading** — 3 sumber mismatch admin password (LoginPage `123456`, DeveloperConsole `355454`, AdminLogin `355454`) diseragamkan ke `123455`. Tambah `passwordOverridesLoaded` state + guard submit (LoginPage tunggu Firebase overrides termuat). Auto-sync admin password ke Firebase saat pertama load. Fix FirebaseDataContext crash: `masterPegawaiData` undefined di `handleScanSimulate`. Push ke GitHub, deploy Vercel. 5 file berubah, build ✅ |
| 2026-06-15 | `main` | **Cleanup .vercel lokal** — Hapus folder `.vercel` (project duplikat "siapel" no production). Project resmi: `newsiapel` (auto-deploy dari GitHub). Domain `siapel.vercel.app` dan `newsiapel.vercel.app` serve kode sama. |
| 2026-06-15 | `main` | **🔒 Firebase Anonymous Auth + Rules `auth !== null`** — Tambah AuthInit component (signInAnonymously), semua `.read`/`.write` dari `true` jadi `auth !== null` di firebase-rules.json. Hapus `.catch(() => {})` di LoginPage & FirebaseDataContext (ganti console.error). Bundle build masih sama. Fix email Firebase Test Mode expire 5 hari. |
| 2026-06-15 | `main` | **Fix AuthInit loading forever** — Bug: `initiatedRef` di-set `true` sebelum `onAuthStateChanged` callback, jadi `signInAnonymously` tidak pernah kepanggil. Fix: hapus ref, panggil langsung dari callback saat user `null`. Loading cuma ~0.5-1 detik di kunjungan pertama. |
| 2026-06-15 | `main` | **Fix AuthInit fire-and-forget + Anonymous Auth berhasil** — Hapus loading screen total, render langsung tanpa nunggu auth. `signInAnonymously` fire-and-forget di background. User tidak lihat loading sama sekali. Anonymous Auth berhasil aktif — Firebase Test Mode aman. Fix minor: LoginPage guard `passwordOverridesLoaded` dari blocking jadi warning, session listener tidak force logout saat session null. ✅ |
| 2026-06-16 | `main` | **Session persistence localStorage** — 2 bug: (1) SessionContext pakai `sessionStorage` → dihapus saat PWA ditutup, ganti ke `localStorage`. (2) FirebaseDataContext active session conflict detection salah trigger restart sebagai login device lain → tambah `initialSyncRef` untuk bedakan callback pertama vs berikutnya. |
| 2026-06-16 | `main` | **LogoutConfirm reusable di semua dashboard** — Buat komponen LogoutConfirm.jsx (trigger pojok kanan + modal konfirmasi). DashboardPegawai, DashboardAdmin, DeveloperConsole ganti BackButton → LogoutConfirm. App.jsx ganti `handleRoleSelect` → `goBack()` (bersihkan activePegawai, selectedPimpinan, role). |
| 2026-06-16 | `main` | **Fix blank screen di browser HP** — `crypto.randomUUID()` tidak didukung Samsung Internet, Chrome < 93, Android WebView. Ganti dengan `generateUUID()` — 3 level fallback: crypto.randomUUID → crypto.getRandomValues → Math.random(). |
| 2026-06-16 | `main` | **Fix QR token beda di tiap device** — Sebelum: tiap device generate token sendiri + tulis ke Firebase tiap 10 detik → saling timpa → token tampil beda. Sesudah: subscribe `onValue(QR_PATH)`, semua device baca token yang sama dari Firebase. Cuma device yang lihat token expired yang nulis ulang. |
| 2026-07-06 | `main` | **🔐 P1+P2 COMPLETE + CLEANUP** — P1: Guard passwordOverridesLoaded (3s fallback), .gitignore pegawai_master.json, Firebase Rules granular access, SECURE_DATA_SOURCING.md docs. P2: Delete PegawaiLogin.jsx + RoleSelector.jsx (dead code), redirect pimpinan ke PimpinanSelector selector. Cleanup: Fix App.jsx missing destructuring (pimpinanAccessRoles, handlePimpinanSelect). 8 files changed, 1 created, 2 deleted. Build ✅ |
| 2026-07-06 | `main` | **🎯 CREDENTIALS.md = Single Source of Truth** — 1. Add admin (id 303) + developer (id 304) users ke pegawai_master.json dengan role ADMIN/DEVELOPER. 2. LoginPage refactor: remove getAdminCred/getDeveloperCred, remove Firebase overrides logic, remove passwordOverridesLoaded guard. 3. HANYA read credential dari pegawai_master.json (CREDENTIALS.md source) — eliminasi conflicts. Developer login fix ✅. Build ✅ |
| 2026-07-06 | `main` | **🔐 FIX LOGIN + DEVICE LOCK** — 1. Root cause: Firebase rule activeSessions tidak izinkan `deviceId` field → write error silent, login gagal. Fix: update rule allow deviceId. 2. Implement atomic session register: handleRegisterSession() di LoginPage check existing session sebelum write. 3. Device lock: hanya 1 akun per device globally, login device ke-2 ditolak "sudah login di device lain". Firebase rule activeSessions updated. LoginPage + FirebaseDataContext modified. Build ✅ |
| 2026-07-06 | `main` | **🐛 FIX DEVICE LOCK REJECTING ALL LOGINS (Part 1)** — Masalah: semua akun ditolak dengan error "sudah login di device lain" meskipun login pertama. Root cause: handleRegisterSession() compare undefined sessionId values. Fix: Add null check `existing.sessionId && existing.sessionId !== ...`. Added detailed console logging. Commit: 25c1ffd |
| 2026-07-06 | `main` | **🔓 FIX DEVICE LOCK + FIREBASE PERMISSIONS (Part 2)** — Real root cause: Firebase rules required `auth !== null`, app uses public database → permission_denied on activeSessions writes. Fixes: 1. Firebase rules: Change `auth !== null` → `true` for activeSessions read/write. 2. handleRegisterSession(): Remove pre-login conflict check, always write then verify. 3. Subscription: Skip initial sync to prevent false conflicts. Device lock now fully operational ✅. Commit: 5cdc090 |
| 2026-07-06 | `main` | **🔐 FIX EXECUTIVE/UNIT_LEADER ACCOUNT SECURITY** — Issue: EXECUTIVE/UNIT_LEADER (e.g., KADIS) could select other pimpinan role after login (security issue). Fix: Auto-route to own dashboard instead of selector. Changed: `setPage("pimpinan_selector")` → `handlePimpinanSelect(pegawai)` in LoginPage. Now: Login KADIS → directly to KADIS dashboard (no role selection). Build ✅. Commit: 4b96d7d |
| 2026-07-06 | `main` | **🐛 FIX EXECUTIVE/UNIT_LEADER LOGIN BOUNCE** — Issue: EXECUTIVE/UNIT_LEADER login bounced back to login page after successful session registration. Root cause: ID format mismatch between pegawai object (numeric) and pimpinanAccessRoles items (formatted string like "unit_leader-123456789"). Validation effect in SessionContext always failed → reset selectedPimpinan → bounce. Fix: (1) Add pimpinanAccessRoles to LoginPage destructure. (2) Find matching pimpinanAccessRoles item by NIP + group. (3) Pass correctly-formatted item to handlePimpinanSelect(). Now validation passes → direct route to pimpinan_dashboard ✅. Commit: 599a7a1 |
| 2026-07-06 (Sesi 2) | `main` | **🔥 DEBUG PERMISSION_DENIED + CONDITIONAL SYNC** — Issue: masterPegawaiData sync dipanggil untuk SEMUA role → PERMISSION_DENIED saat master_pegawai write. Admin/Developer login blocked, pegawai bisa login (async error tidak blocking). Fix: (1) firebase-rules.json: Replace invalid `isNull()` → `!newData.exists()` (commit d2a748a). (2) SessionContext: Conditional sync hanya untuk admin/developer role (commit c2f3f03). Semua committed dan pushed ✅. **❌ NEW ISSUE: Admin/Developer login gagal dengan "Username tidak ditemukan", console F12 kosong. Perlu investigate resolvePegawai() + masterPegawaiData loading.**
| 2026-07-07 | `main` | **🔧 FIX ADMIN/DEVELOPER LOGIN + DEBUG LOGGING** — Root cause: localStorage v3 bisa corrupt/incomplete → admin/developer entries missing. Fix: (1) SessionContext.loadMasterPegawaiData() — Add safety check verify admin (nip='admin') + developer (nip='developer') ada sebelum pakai localStorage. Jika incomplete → automatic fallback ke pegawai_master.json. (2) Add comprehensive console logging: SejalanSessionContext load status + LoginPage step-by-step (resolve, password, session, routing). (3) resolvePegawai() — add match logging utk NIP/NIK/Nama. Console F12 tidak lagi kosong → easy debug. 2 file changed, build ✅ |
| 2026-07-07 | `main` | **🔒 DEVICE LOCK: 1 akun = 1 perangkat (first-login-wins)** — Ubah dari last-login-wins → first-login-wins. `handleRegisterSession` kini cek sesi existing dulu: jika ada di perangkat LAIN dan heartbeat masih hidup (<90 detik) → TOLAK login (`{ok:false, reason:'device_lain'}`). Perangkat sama (refresh) selalu boleh. Tambah **heartbeat** `lastSeen` tiap 30 detik + ambang basi 90 detik (cegah akun terkunci permanen kalau app ditutup tanpa logout). LoginPage tampilkan pesan jelas. **⚠️ WAJIB update Firebase Rules** (tambah field `lastSeen` di activeSessions). 3 file changed, build ✅ |
| 2026-07-07 | `main` | **🎯 FIX AKAR: Absensi tidak masuk DB + kamera kedip putih** — 2 root cause ditemukan & diperbaiki: (1) **Data tidak update:** `handleScan`/`handleScanSimulate` simpan `jamHadir` via `toLocaleTimeString("id-ID")` yang hasilkan titik (`07.15`), sedangkan Firebase Rule wajib titik dua (`07:15`) → write DITOLAK diam-diam (tanpa `.catch`). Fix: helper `formatJamHadir()` (selalu `HH:MM`) + tambah `.catch` logging. TIDAK perlu ubah Firebase Console. (2) **Kamera flash putih:** `useClock` render tiap 1 detik + `qrbox` objek baru tiap render → `startScanning` ganti identitas → useEffect restart kamera tiap detik. Fix: simpan config di ref (stabilkan `startScanning`) + guard anti double-start di `useQrScanner`. (3) Hapus duplikasi `useEffect` di DashboardPegawai. 3 file changed. Build ✅ |
| 2026-07-08 | `main` | **📅 ABSENSI PER-TANGGAL + AKUMULASI BULANAN** — Ganti `attendance/today` → `attendance/{YYYY-MM}/{DD}/{pegawaiId}` + `apelMeta/{YYYY-MM}/{DD}`. Reset harian otomatis 00:00 WIB (baca node tanggal baru). Akumulasi TK bulanan nyata untuk "Perlu Perhatian" + peringkat bidang bulanan (rata-rata persen harian, hanya status Hadir). Saat apel ditiadakan: wipe absensi hari itu + `held: false`. Reset Developer: hanya hapus hari ini. File baru: `util_tanggal.js`. **⚠️ WAJIB publish firebase-rules.json baru ke Console.** Data lama `attendance/today` tidak dimigrasi. Build ✅ |
| 2026-07-08 | `main` | **🩹 FIX BLANK SCREEN + KOREKSI + CLEANUP PENGAJUAN** — (1) **Blank saat pertama login:** pasang `ErrorBoundary` di `App.jsx` (sebelumnya tidak terpasang → error transient/chunk gagal = layar putih) + `lazyWithRetry` (retry import chunk sekali di jaringan HP tidak stabil) + tombol "Coba Lagi" reload penuh. (2) **Koreksi manual admin & developer:** tab Koreksi Manual kini cari SEMUA pegawai (butuh kata kunci/bidang dulu, batas 50 kartu) & set status apa pun; highlight status aktif; `handleKoreksi` isi jam saat set Hadir. (3) **Upload surat pengajuan:** batas 5MB → **2MB**. (4) **Cleanup pengajuan:** ganti TTL 24 jam → hapus file Storage + record pengajuan hari sebelumnya saat ganti hari (00:00 WIB); yang masih "menunggu" dipertahankan. Helper baru: `getWibDayStamp`, `getWibDayStampFromTs`. Build ✅ |
| 2026-07-08 | `main` | **📋 PENGAJUAN TANPA UPLOAD (PILOT SPARK)** — Firebase Storage tidak tersedia di plan Spark (gratis); upload surat butuh upgrade Blaze. Keputusan pilot: pengajuan cukup **status baru + keterangan teks** (DD/DL/Izin/Sakit). `PengajuanStatusForm`: flag `UPLOAD_DOKUMEN_AKTIF = false`, hapus input file, banner peringatan kuning. Alur: pegawai kirim → admin tab Pengajuan di PanelKoreksi → Setujui/Tolak → absensi hari ini terupdate. Surat fisik tetap ke TU manual. Build ✅ |
| 2026-07-08 | `main` | **🐛 FIX KOREKSI & PENGAJUAN (PILOT)** — (1) `handlePengajuanSubmit`: `pegawaiId` string. (2) Status efektif di koreksi. (3) Exclude akun sistem. Build ✅ |
| 2026-07-08 | lokal | **📱 STATUS INDIVIDUAL + PENGAJUAN DUA ARAH + SESI** — (1) Dashboard pegawai: kartu TK merah setelah apel, warna status dinamis. (2) Fix Setujui pengajuan (`verifiedAt`/`alasanAdmin` di rules, hapus `approvedAt`). (3) Tolak wajib alasan admin; riwayat pengajuan di dashboard pegawai. (4) Sesi: reclaim by `deviceId`, hapus auto-kick, reset manual admin di Kelola Pegawai. **⚠️ Publish firebase-rules.json ke Console.** Belum push — tes lokal. Build ✅ |
| 2026-07-08 | lokal | **📊 DASHBOARD PERBAIKAN** — (1) Perlu Perhatian: hapus teks sanksi, indikator warna berjenjang TK (`getTanpaKeteranganTone`). (2) Rata-rata bidang bulan ini live saat apel `ongoing` (`includeTodayLive` di `calcMonthlyBidangStats` saja). (3) Riwayat pengajuan hari ini (menunggu+disetujui+ditolak) di PanelKoreksi & DashboardPimpinan. (4) Developer: reset absensi per user (`handleResetPegawai`). Belum push. Build ✅ |

## Prioritas (Sekarang)

0. 🔴 **WAJIB: Publish Firebase Rules baru** — Copy `firebase-rules.json` ke Firebase Console → Realtime Database → Rules → Publish. Struktur baru: `attendance/$month/$day` + `apelMeta/$month/$day`. Tanpa ini, scan QR ke path baru ditolak.
1. 🟢 **Absensi per-tanggal WIB** ✅ — Reset harian otomatis, riwayat tersimpan per tanggal.
2. 🟢 **Akumulasi bulanan nyata** ✅ — TK per pegawai + peringkat bidang bulan ini (rata-rata persen harian, hanya Hadir).
3. 🟢 **FIXED: Device lock 1 akun = 1 perangkat** ✅ — first-login-wins + heartbeat 30s + basi 90s.
4. 🟢 **FIXED: Scan berhasil + kamera QR** ✅ — jamHadir `HH:MM`, startScanning distabilkan.
5. 🟢 **Pengajuan tanpa lampiran file** ✅ — Pilot Spark: status + keterangan teks; upload dokumen dinonaktifkan sampai upgrade Blaze + Storage.
6. 🟢 **Fix bug pilot koreksi & pengajuan** ✅ — pegawaiId string, status efektif di koreksi, exclude akun sistem dari absensi.
7. 🟡 **Upload dokumen pengajuan** — Butuh Firebase Blaze + Storage Rules; aktifkan kembali via `UPLOAD_DOKUMEN_AKTIF` di `PengajuanStatusForm.jsx`.
8. 🟡 **Peringkat bulan lalu** — Butuh baca node bulan sebelumnya (belum termasuk)

## Arsitektur Inti
- **State:** SessionContext (routing + master data) + FirebaseDataContext (realtime) — pisah dari App.jsx
- **Absensi:** Path per tanggal WIB `attendance/{YYYY-MM}/{DD}/{pegawaiId}` — reset harian otomatis tanpa hapus riwayat
- **ApelMeta:** `apelMeta/{YYYY-MM}/{DD}` = `{ held: boolean, reason?: string }` — catat hari apel diadakan/ditiadakan
- **Akumulasi bulanan:** Baca `attendance/{YYYY-MM}` + `apelMeta/{YYYY-MM}` — TK per pegawai, peringkat bidang (rata-rata persen harian)
- **Hooks:** useClock, usePegawaiSearch, useShowMore, useAttendanceStats, useQrGenerator, useQrScanner
- **Panels:** PanelAbsensi, PanelKoreksi, PanelLaporan, PanelKelolaPegawai, PanelApel, PanelQR
- **ErrorBoundary:** Ada di App.jsx

## Source of Truth

- **CREDENTIALS.md** — Master credential reference untuk semua users (admin, developer, pegawai, pimpinan)
- **Data pegawai:** `src/data/pegawai_master.json` (304 org including admin + developer) — SINGLE source untuk login
- **LoginPage credential validation:** ONLY read dari pegawai_master.json (role: ADMIN, DEVELOPER, EXECUTIVE, UNIT_LEADER, EMPLOYEE)
- **Firebase:** attendance, apel session, apel reason, pengajuan — realtime via FirebaseDataContext, data mentah (tanpa merge)
- **localStorage:** master pegawai persist + session user (role, halaman, pegawai terpilih) — initial load dari localStorage, fallback ke JSON jika kosong

## Data Flow Ringkas

```
pegawai_master.json (CREDENTIALS.md source) → LoginPage resolvePegawai() → 
  ↓ (username match: admin, developer, NIP, NIK, Nama)
  Validate password dari pegawai.password
  ↓ (check role: ADMIN/DEVELOPER/EXECUTIVE/UNIT_LEADER/EMPLOYEE)
  Route to appropriate page (admin/developer/pimpinan_selector/pegawai_dashboard)
  
Firebase /attendance/{YYYY-MM}/{DD} → FirebaseDataContext → attendance{} (hari ini)
Firebase /attendance/{YYYY-MM}     → FirebaseDataContext → monthlyAttendance{} (bulan ini)
Firebase /apelMeta/{YYYY-MM}       → FirebaseDataContext → apelMeta{} (penanda apel per hari)
Firebase /apel/session    → FirebaseDataContext → apelSession
Firebase /apel/reason     → FirebaseDataContext → apelReason + apelReasonText
Firebase /pengajuan       → FirebaseDataContext → pengajuan[]
Firebase /fingerprints/{id} → handleSaveFingerprint (device fingerprint saat login)
Firebase /activeSessions/{userId} → sessionId + loginAt (last-login-wins, deteksi login tabrakan)
Firebase Cloud Storage    → Upload file dokumen pengajuan (via PengajuanStatusForm)
QR /qr/current            → useQrGenerator (Admin) → Pegawai scan (TTL 10 detik)
```

## Fase Apel
| Fase | DashboardAdmin | DashboardPegawai |
|---|---|---|
| before | "Belum Hadir" ⏳ | "Belum Melakukan Absensi" |
| ongoing | "Belum Hadir" ⏳ (berkurang) | Bisa absen QR/token |
| ended | "Tanpa Keterangan" 🚫 | "Tanpa Keterangan" |
| ditiadakan | Stat tidak tampil | Banner info |

Aturan: `set(null)` untuk reset hari ini saja (Developer). QR TTL 10 detik. Admin atur manual via panel "Pengaturan Apel". Default jam: before < 07:00, ongoing 07:00–08:00, ended > 08:00.

### Aturan Perhitungan Bulanan (keputusan 2026-07-08)
Hari dihitung hanya jika: (1) bukan Sabtu/Minggu, (2) `apelMeta.held === true`, (3) hari sudah selesai (tanggal lampau atau hari ini fase `ended`).
- **Tanpa Keterangan:** tidak punya status valid (bukan Hadir/Dinas/Izin/Sakit)
- **Peringkat bidang bulanan:** rata-rata persentase kehadiran harian — "hadir" = HANYA status `Hadir` (scan QR)
- **Apel ditiadakan:** wipe absensi hari itu + `held: false` → hari di-skip dari akumulasi
- **Reset Developer:** hanya hapus data hari ini + apelMeta hari ini

### Alur Pengajuan Perubahan Status (keputusan 2026-07-08, pilot Spark)
- Pegawai: pilih status baru (Dinas Dalam/Luar, Izin, Sakit) + **keterangan wajib** → kirim tanpa file
- Admin/Developer: `PanelKoreksi` tab Pengajuan → baca keterangan → Setujui/Tolak
- Disetujui → `attendance/{bulan}/{hari}/{id}` terupdate otomatis
- **Upload dokumen dinonaktifkan** (`UPLOAD_DOKUMEN_AKTIF = false`) — Firebase Storage butuh plan Blaze
- Cleanup: record pengajuan hari lalu dihapus 00:00 WIB (kecuali status masih `menunggu`)

### Akun Sistem & Koreksi (keputusan 2026-07-08)
- **Akun sistem** (role ADMIN/DEVELOPER, id 303–304): hanya untuk login operasional — **dikecualikan** dari semua tampilan absensi, koreksi, stats, peringkat bidang
- **Kelola Pegawai** tetap menampilkan seluruh 304 entri (termasuk admin/developer)
- **Status koreksi manual:** display-only — TK/Belum Hadir dihitung dari fase apel jika DB kosong; tidak menulis massal TK ke Firebase

## Catatan

- **✅ LOGIN FIX (2026-07-07):** Admin/Developer login fixed. localStorage v3 validation now includes admin/developer safety check — if missing, auto-fallback ke pegawai_master.json. Comprehensive console logging added: loadMasterPegawaiData() status, resolvePegawai() matches, handleLogin() step-by-step. Debug via F12 Console tidak lagi kosong.
- **LocalStorage Cache:** Hard refresh jika data tidak up-to-date. Chrome: Ctrl+Shift+Delete → Clear All. Firefox: Ctrl+Shift+Delete → Clear Recent History.
- Detail teknis (struktur folder, Firebase docs, env, alur pilot) → baca `SIAPEL_README.md`
- **Vercel:** Project resmi = `newsiapel` (auto-deploy dari GitHub). Domain `siapel.vercel.app` dan `newsiapel.vercel.app` — identik.
- **QR Token TTL:** 10 detik (architecture decision — tidak berubah)
