# CONTEXT — SIAPEL (Sistem Informasi Apel Pegawai)

Status proyek terkini. Update tiap selesai sesi.

---

## Status Terkini
- **Branch:** `refactor-phase-1`
- **Sesi terakhir:** 2026-06-15 — Hapus Preview Data, pindah pencarian ke atas View As, dropdown overlay, sorting prefix, fix SearchInput remount bug
- **Firebase:** Live — Realtime Database + Storage (upload file pengajuan)
- **Build:** `npm run build` ✅
- **Developer Console:** Search + dropdown hasil (prefix-first sort) — cari pegawai → langsung View As; View As (4 role) + Summary Cards — tanpa Preview Data/placeholder
- **Legacy:** pegawai_legacy.json & Data Source Toggle dihapus

## Riwayat Sesi

| Tanggal | Sesi | Isi |
|---|---|---|
| 2026-06-13 | `refactor-phase-1` | Restruktur Admin, Pengajuan end-to-end, Fix stat "Belum Hadir"/"Tanpa Keterangan", Code splitting, Dead code cleanup |
| 2026-06-15 | `refactor-phase-1` | Arsitektur baru: 6 custom hooks, SessionContext + FirebaseDataContext, App.jsx 438→120 baris, DashboardAdmin 961→130 baris (7 panel), ErrorBoundary, usePegawaiSearch di semua page |
| 2026-06-15 | `refactor-phase-1` | Final: CONTEXT.md sebagai status dinamis, CLAUDE.md fokus aturan, settings.json auto-baca CONTEXT tiap sesi |
| 2026-06-15 | `refactor-phase-1` | Feature audit: hapus 9 placeholder DeveloperConsole + Data Source Toggle + legacy JSON, implementasi Firebase Storage upload file, hapus DEMO_LAST_MONTH_DISCIPLINE |
| 2026-06-15 | `refactor-phase-1` | **Fix akar data placeholder:** hapus mergeAttendanceWithPeople (biarkan Firebase mentah), cabang data kosong di calcAttendanceStats return 0, guard PerhatianList, tombol Reset Attendance di DeveloperConsole, hapus state_absensi.js |
| 2026-06-15 | `refactor-phase-1` | **DeveloperConsole cleanup:** hapus Preview Data section, pindah search ke atas View As, dropdown overlay hasil pencarian, sorting prefix-first, fix SearchInput remount bug (pindah luar komponen biar tidak kehilangan fokus tiap render) |

## Prioritas

1. 🔴 **Autentikasi** — Firebase Auth + login password (SessionContext siap, ini paling gampang sekarang)
2. 🔴 **DashboardAdmin panel lazy loading** — PanelAbsensi dkk masih eager-loaded
3. 🟡 **TypeScript migrasi** — Struktur sudah siap, tinggal tambah tipe
4. 🟢 **ErrorBoundary integrasi penuh** — Sudah dibuat, perlu integrasi di App.jsx lebih dalam

## Arsitektur Inti
- **State:** SessionContext (routing + master data) + FirebaseDataContext (realtime) — pisah dari App.jsx
- **Hooks:** useClock, usePegawaiSearch, useShowMore, useAttendanceStats, useQrGenerator, useQrScanner
- **Panels:** PanelAbsensi, PanelKoreksi, PanelLaporan, PanelKelolaPegawai, PanelPengajuan, PanelApel, PanelQR
- **ErrorBoundary:** Ada di App.jsx

## Source of Truth
- **Data pegawai:** `src/data/pegawai_master.json` (302 org) — jangan pakai dummy
- **Firebase:** attendance, apel session, apel reason, pengajuan — realtime via FirebaseDataContext, data mentah (tanpa merge)
- **localStorage:** admin edits saja — initial load selalu dari JSON
- **sessionStorage:** sesi user (role, halaman, pegawai terpilih)

## Data Flow Ringkas
```
pegawai_master.json → SessionContext → semua page
Firebase /attendance/today → FirebaseDataContext → attendance{}
Firebase /apel/session    → FirebaseDataContext → apelSession
Firebase /apel/reason     → FirebaseDataContext → apelReason + apelReasonText
Firebase /pengajuan       → FirebaseDataContext → pengajuan[]
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
