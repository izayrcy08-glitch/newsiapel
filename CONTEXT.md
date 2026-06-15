# CONTEXT — SIAPEL (Sistem Informasi Apel Pegawai)

Status proyek terkini. Update tiap selesai sesi.

---

## Status Terkini
- **Branch:** `refactor-phase-1`
- **Sesi terakhir:** 2026-06-15 — Finalisasi CONTEXT.md + CLAUDE.md ramping + settings.json auto-baca konteks
- **Firebase:** Live — realtime via `onValue`
- **Build:** `npm run build` ✅
- **Role:** /pimpinan, /admin, /pegawai?nip=xxx (static di URL, Auth belum ada)

## Riwayat Sesi

| Tanggal | Sesi | Isi |
|---|---|---|
| 2026-06-13 | `refactor-phase-1` | Restruktur Admin, Pengajuan end-to-end, Fix stat "Belum Hadir"/"Tanpa Keterangan", Code splitting, Dead code cleanup |
| 2026-06-15 | `refactor-phase-1` | Arsitektur baru: 6 custom hooks, SessionContext + FirebaseDataContext, App.jsx 438→120 baris, DashboardAdmin 961→130 baris (7 panel), ErrorBoundary, usePegawaiSearch di semua page |
| 2026-06-15 | `refactor-phase-1` | Final: CONTEXT.md sebagai status dinamis, CLAUDE.md fokus aturan, settings.json auto-baca CONTEXT tiap sesi |

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
- **Firebase:** attendance, apel session, apel reason, pengajuan — realtime via FirebaseDataContext
- **localStorage:** admin edits saja — initial load selalu dari JSON
- **sessionStorage:** sesi user (role, halaman, pegawai terpilih)

## Data Flow Ringkas
```
pegawai_master.json → SessionContext → semua page
Firebase /attendance/today → FirebaseDataContext → attendance{}
Firebase /apel/session    → FirebaseDataContext → apelSession
Firebase /apel/reason     → FirebaseDataContext → apelReason + apelReasonText
Firebase /pengajuan       → FirebaseDataContext → pengajuan[]
QR /qr/current            → useQrGenerator (Admin) → Pegawai scan (TTL 10 detik)
```

## Fase Apel
| Fase | DashboardAdmin | DashboardPegawai |
|---|---|---|
| before | "Belum Hadir" ⏳ | "Belum Melakukan Absensi" |
| ongoing | "Belum Hadir" ⏳ (berkurang) | Bisa absen QR/token |
| ended | "Tanpa Keterangan" 🚫 | "Tanpa Keterangan" |
| ditiadakan | Stat tidak tampil | Banner info |

Aturan: `set(null)` untuk reset, jangan tulis 302 record. QR TTL 10 detik. Admin atur manual via panel "Pengaturan Apel". Default jam: before < 07:00, ongoing 07:00–08:00, ended > 08:00.

## Catatan
- Hard refresh jika angka pegawai masih 439 (localStorage cache lama)
- Detail teknis (struktur folder, Firebase docs, env, alur pilot) → baca `SIAPEL_README.md`
