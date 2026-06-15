# CONTEXT — SIAPEL (Sistem Informasi Apel Pegawai)

Status proyek terkini. Update tiap selesai sesi.

---

## Status Terkini
- **Branch:** `refactor-phase-1`
- **Sesi terakhir:** 2026-06-15 — Login semua role: Admin (username/password), Developer (username/password), Pimpinan (pilih nama + password 6 digit)
- **Firebase:** Live — Realtime Database + Storage lazy load
- **Build:** `npm run build` ✅
- **Persistensi data pegawai:** Admin edits permanen via localStorage (key v3) — init load validasi integritas field (password, nik, phoneFingerprint), fallback ke JSON jika tidak lolos
- **Catatan:** Data masih di localStorage tiap browser — belum sync ke Firebase Realtime Database

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

## Prioritas

1. 🔴 **Paket 3 — Ubah Password (Dashboard Pegawai)** — form ganti password 6 digit di dashboard pegawai, sync ke localStorage + Firebase
2. 🔴 **Paket 4 — Reset Device Binding & Password (Admin/DeveloperConsole)** — tombol reset device fingerprint + reset password di PanelKelolaPegawai dan DeveloperConsole
3. 🔴 **DashboardAdmin panel lazy loading** — PanelAbsensi dkk masih eager-loaded
4. 🟡 **Paket 5 — Device Binding** — Firebase `/config/deviceBindingEnabled` toggle, kode siap tapi OFF sampai produksi masal
5. 🟡 **Autentikasi Firebase** — Firebase Auth + role-based access (setelah login pilot stabil)
6. 🟢 **Semua role sudah punya login** ✅ — Admin, Developer, Pimpinan, Pegawai — masing-masing dengan verifikasi
7. 🟢 **ErrorBoundary integrasi penuh** — Sudah dibuat, perlu integrasi di App.jsx lebih dalam

## Arsitektur Inti
- **State:** SessionContext (routing + master data) + FirebaseDataContext (realtime) — pisah dari App.jsx
- **Hooks:** useClock, usePegawaiSearch, useShowMore, useAttendanceStats, useQrGenerator, useQrScanner
- **Panels:** PanelAbsensi, PanelKoreksi, PanelLaporan, PanelKelolaPegawai, PanelPengajuan, PanelApel, PanelQR
- **ErrorBoundary:** Ada di App.jsx

## Source of Truth
- **Data pegawai:** `src/data/pegawai_master.json` (302 org) — jangan pakai dummy
- **Firebase:** attendance, apel session, apel reason, pengajuan — realtime via FirebaseDataContext, data mentah (tanpa merge)
- **localStorage:** master pegawai persist — initial load prioritas dari localStorage, fallback ke JSON jika kosong
- **sessionStorage:** sesi user (role, halaman, pegawai terpilih)

## Data Flow Ringkas
```
pegawai_master.json → SessionContext → semua page
  (field: id, nama, nip, nik, jabatan, bidang, unit, role, password, phoneFingerprint, isActive)
Firebase /attendance/today → FirebaseDataContext → attendance{}
Firebase /apel/session    → FirebaseDataContext → apelSession
Firebase /apel/reason     → FirebaseDataContext → apelReason + apelReasonText
Firebase /pengajuan       → FirebaseDataContext → pengajuan[]
Firebase /fingerprints/{id} → handleSaveFingerprint (device fingerprint saat login)
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

Aturan: `set(null)` untuk reset. QR TTL 10 detik. Admin atur manual via panel "Pengaturan Apel". Default jam: before < 07:00, ongoing 07:00–08:00, ended > 08:00. Data Firebase mentah (tanpa mergeAttendanceWithPeople) — stat 0 saat kosong.

## Catatan
- Hard refresh jika angka pegawai masih 439 (localStorage cache lama)
- Detail teknis (struktur folder, Firebase docs, env, alur pilot) → baca `SIAPEL_README.md`
