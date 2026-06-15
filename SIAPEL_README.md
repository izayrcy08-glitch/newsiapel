# SIAPEL — Sistem Informasi Apel Pegawai

**Dinas PUPR Kab. Barito Utara** — Pilot project absensi apel pagi berbasis QR code.

---

## 📁 Struktur Proyek

```
siapel/
├── index.html                          # Entry HTML
├── package.json                        # React 18 + Firebase + Tailwind
├── vite.config.js                      # Vite + PWA plugin
├── firebase-rules.json                 # 🔐 Copy ke Firebase Console → Rules
├── SECURITY-CHECKLIST.md               # 🔐 Checklist sebelum deploy
├── CLAUDE.md                           # Panduan AI agent (aturan, arsitektur, data flow)
├── SIAPEL_README.md                    # ← file ini
├── src/
│   ├── main.jsx                        # React entry (StrictMode)
│   ├── App.jsx                         # Provider shell + routing (120 baris)
│   ├── index.css                       # Tailwind + scrollbar
│   ├── firebase.js                     # Firebase init dari .env
│   ├── contexts/                       # 🔥 BARU — React Context API
│   │   ├── SessionContext.jsx           # Routing, master data, session persistence
│   │   └── FirebaseDataContext.jsx      # Semua Firebase subscriptions + mutations
│   ├── hooks/                          # 🔥 BARU — Custom hooks
│   │   ├── useClock.js                 # Current time, greeting, formatters
│   │   ├── usePegawaiSearch.js         # Generic search+filter+group
│   │   ├── useShowMore.js              # Generic show-more/show-less toggle
│   │   ├── useAttendanceStats.js       # Attendance stats + stat items
│   │   ├── useQrGenerator.js           # QR token lifecycle (Admin)
│   │   └── useQrScanner.js             # Html5Qrcode lifecycle (Pegawai)
│   ├── panels/                         # 🔥 BARU — Sub-panel DashboardAdmin
│   │   ├── PanelAbsensi.jsx            # Daftar absensi + search
│   │   ├── PanelKoreksi.jsx            # Koreksi absensi + verifikasi pengajuan
│   │   ├── PanelApel.jsx               # Kontrol sesi apel (modal)
│   │   └── PanelQR.jsx                 # QR display card
│   ├── pages/                          # 7 halaman — 1 file per fitur
│   │   ├── RoleSelector.jsx            # Pilih role (80 baris)
│   │   ├── PegawaiLogin.jsx            # Cari & login pegawai (menggunakan usePegawaiSearch)
│   │   ├── PimpinanSelector.jsx        # Pilih pimpinan (91 baris)
│   │   ├── DashboardPegawai.jsx        # Absensi + statistik pribadi
│   │   ├── DashboardAdmin.jsx          # Menu grid + panel routing (130 baris)
│   │   ├── DashboardPimpinan.jsx       # Analitik eksekutif
│   │   └── DeveloperConsole.jsx        # Developer tools
│   ├── components/                     # 12 UI components
│   │   ├── Card.jsx                    # Glass card wrapper
│   │   ├── BackButton.jsx              # Navigasi kembali
│   │   ├── StatusBadge.jsx             # Badge warna status absen
│   │   ├── ProgressRing.jsx            # SVG progress ring
│   │   ├── Countdown.jsx               # Countdown timer apel
│   │   ├── QRDisplay.jsx               # QR Code render
│   │   ├── TokenFeedback.jsx           # Valid/invalid token message
│   │   ├── FullscreenQR.jsx            # Layar penuh QR display
│   │   ├── PengajuanStatusForm.jsx     # Form pengajuan perubahan status
│   │   ├── LoadingSpinner.jsx          # Loading state
│   │   ├── ErrorDisplay.jsx            # Error state
│   │   └── ErrorBoundary.jsx           # 🔥 BARU — Error boundary component
│   ├── bersama/                        # Utilities lintas fitur
│   │   ├── konstanta_aplikasi.js       # Firebase paths, session enums
│   │   ├── util_waktu_dan_apel.js      # Greeting, format time, getApelStatus
│   │   ├── util_status_dan_warna.js    # Status colors, icons, discipline
│   │   ├── util_unit_dan_scope.js      # Unit labels, scoping, access roles
│   │   └── util_dashboard_ringkasan.js # Bidang performance status
│   ├── fitur/
│   │   ├── absensi/
│   │   │   ├── logika_absensi.js       # calcAttendanceStats, stat items
│   │   │   └── state_absensi.js        # mergeAttendanceWithPeople
│   │   └── bersama/
│   │       └── profile_lines.jsx       # Nama/NIP/Jabatan display component
│   ├── utils/
│   │   └── qr-token.js                 # createQrToken + validateQrToken
│   └── scripts/
│       └── generate-pegawai-master.mjs # Generator dari text source
```

---

## 🔥 Firebase Real-time Database

### Firestore Rules
Lihat `firebase-rules.json` — copy paste ke Firebase Console → Realtime Database → Rules.

### Struktur Database
```
/attendance/today/{pegawaiId}
  → { status: "Hadir"|"Dinas Dalam"|"Dinas Luar"|"Izin"|"Sakit"|"Tanpa Keterangan",
       jamHadir: "07:15" }

/apel/session
  → "before" | "ongoing" | "ended" | "ditiadakan"

/apel/reason
  → "hujan" | "libur_nasional" | "cuti_bersama" | "apel_gabungan"
  → atau { id: "lainnya", text: "..." }

/qr/current
  → { token: "905371", issuedAt: timestamp, expiresAt: timestamp }

/pengajuan/{id}
  → { pegawaiId, nama, nip, statusLama, statusBaru, keterangan,
       dokumen, waktu, statusVerifikasi: "menunggu"|"disetujui"|"ditolak" }
```

### ⚠️ Aturan Penting

1. **Jangan tulis data ke Firebase kalau path null.** `handleReset` pakai `set(null)`.
2. **QR token TTL** 10 detik — regenerasi otomatis via `setInterval`.
3. **Session apel** dikendalikan manual oleh Admin. Default jam: `before` < 07:00, `ongoing` 07:00–08:00, `ended` > 08:00, `ditiadakan` via panel admin.
4. **Pengajuan** flow: Pegawai submit → Firebase → Admin lihat + Setujui/Tolak → Jika disetujui, attendance auto-update.

---

## 🧠 Arsitektur State (Context + Hooks)

State global tidak lagi di App.jsx — dipisah ke dua Context:

**SessionContext** — routing, auth, master data:
- `page`, `role`, `activePegawai`, `selectedPimpinan`, `masterPegawaiData`, `pimpinanAccessRoles`
- Actions: `handleRoleSelect`, `handlePegawaiLogin`, `handlePimpinanSelect`, `goBack`
- Persistence: sessionStorage untuk session, localStorage untuk master data

**FirebaseDataContext** — realtime data + mutations:
- `attendance`, `apelSession`, `apelReason`, `apelReasonText`, `apelStatus`, `pengajuan`, `firebaseReady`, `firebaseError`
- Actions: `handleScan`, `handleKoreksi`, `handleReset`, `handleApelSessionChange`, `handlePengajuanSubmit`, dll

### Flow Data Firebase → Dashboard
```
Firebase /attendance/today → FirebaseDataContext (onValue) → attendance state → context consumer
Firebase /apel/session → FirebaseDataContext (onValue) → apelSession → context consumer
Pages baca dari context (useFirebaseData()) — tidak ada props drilling
```

---

## 🚀 Alur Pilot

1. **Buka app** → Role Selector
2. **Admin login** → Panel Admin → Set fase apel ke "Saat Apel" jika perlu
3. **QR aktif** — Admin bisa fullscreen QR atau tampilkan token 6 digit
4. **Pegawai pilih role Pegawai** → cari nama → scan QR / input token
5. **Dashboard pegawai muncul** — status "Hadir" otomatis
6. **Pimpinan lihat** → Dashboard Pimpinan → ranking bidang realtime
7. **Admin atur sesi apel "Selesai"** → semua yang belum absen jadi "Tanpa Keterangan"
8. **Pegawai bisa ajukan perubahan status** via formulir pengajuan

---

## 🛠️ Perintah Development

```bash
npm run dev      # Dev server (Vite) — http://localhost:5173
npm run build    # Build produksi → dist/
npm run preview  # Preview build lokal
```

### Environment Variables (`.env`)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

## ✅ Yang Telah Dicapai

- ✅ **Refactor besar** — App.jsx dari 3450 → 438 baris
- ✅ **1 file = 1 fitur** — 7 page files, 11 component files
- ✅ **Demo mode dihapus** — semua data dari Firebase realtime
- ✅ **Session persistent** — refresh aman via sessionStorage
- ✅ **Data pegawai dibersihkan** — 439 → 302, petugas lapangan tanpa NIP dihapus
- ✅ **Pengajuan status** — end-to-end dari pegawai → Firebase → admin → auto-update attendance
- ✅ **Statistik dashboard** — "Belum Hadir" saat before/ongoing, "Tanpa Keterangan" setelah ended
- ✅ **Code splitting** — 4 dashboard lazy-loaded, main chunk 900 kB → 457 kB
- ✅ **Dead code cleanup** — hapus `calcStats()`, dead imports, file template kosong
- ✅ **Dokumentasi digabung** — `.cursorrules` + `SIAPEL_RULES.md` → `CLAUDE.md`
- ✅ **Arsitektur Context + Hooks** — App.jsx turun 438→120 baris, 6 custom hooks, SessionContext + FirebaseDataContext
- ✅ **DashboardAdmin 961→130 baris** — 7 panel terpisah di `src/panels/`
- ✅ **Duplikasi dihapus** — clock (3× → useClock), search (4× → usePegawaiSearch), show-more (5× → useShowMore)
- ✅ **ErrorBoundary** — Komponen siap pakai untuk error handling

## 📋 Yang Perlu Dikerjakan

1. **🔴 Autentikasi** — Firebase Auth + login password. Field password sudah ada di data pegawai. Struktur SessionContext sudah siap.
2. **🔴 DashboardAdmin panel lazy loading** — PanelAbsensi dkk masih eager-loaded, bisa di-lazy-load.
3. **🟡 TypeScript migrasi** — Struktur hooks dan contexts sudah siap untuk penambahan tipe.
4. **🟢 ErrorBoundary integrasi penuh** — Komponen sudah ada, perlu dipasang di App.jsx wrapper.

## 📝 Konvensi

- **Folder `pages/`** = 1 halaman penuh = 1 file
- **Folder `components/`** = UI murni, tidak punya side effect Firebase
- **Folder `utils/`** = pure functions
- **Nama file:** Bahasa Inggris (Card, StatusBadge, DashboardPegawai)
- **Nama variabel/komentar:** Bahasa Indonesia (sesuai domain project)
- **Build setelah setiap perubahan** untuk verifikasi
