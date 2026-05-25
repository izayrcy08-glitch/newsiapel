import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import { ref, get, onValue, set, update } from "firebase/database";
import { database } from "./firebase";
import pegawaiData from "./data/pegawai.json";
import orgData from "./data/organization.json";
import attendanceData from "./data/attendance.json";
import sanctionsData from "./data/sanctions.json";

// ─── DUMMY DATA: PENGJUAN PERUBAHAN STATUS ────────────────────────────────────
const DUMMY_PENGJUAN = [
  {
    id: 1,
    pegawaiId: 15,
    nama: "Rasyid",
    statusLama: "Tanpa Keterangan",
    statusBaru: "Dinas Luar",
    dokumen: "surat_tugas.pdf",
    tanggal: "25 Mei 2026 09:15",
    statusVerifikasi: "menunggu",
    analisisAI: null,
  },
  {
    id: 2,
    pegawaiId: 22,
    nama: "Ahmad Fauzi",
    statusLama: "Tanpa Keterangan",
    statusBaru: "Sakit",
    dokumen: "surat_dokter.pdf",
    tanggal: "25 Mei 2026 08:45",
    statusVerifikasi: "menunggu",
    analisisAI: null,
  },
  {
    id: 3,
    pegawaiId: 33,
    nama: "Siti Rahma",
    statusLama: "Tanpa Keterangan",
    statusBaru: "Izin",
    dokumen: "surat_izin.pdf",
    tanggal: "25 Mei 2026 07:30",
    statusVerifikasi: "disetujui",
    analisisAI: null,
  },
];

const STATUS_VERIFIKASI_COLORS = {
  menunggu: { bg: "bg-amber-500/20", text: "text-amber-400", icon: "🟡", label: "Menunggu Verifikasi" },
  disetujui: { bg: "bg-emerald-500/20", text: "text-emerald-400", icon: "🟢", label: "Disetujui" },
  ditolak: { bg: "bg-red-500/20", text: "text-red-400", icon: "🔴", label: "Ditolak" },
};

const STATUS_OPTIONS = ["Dinas Dalam", "Dinas Luar", "Izin", "Sakit"];

// ─── UTILS ───────────────────────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 11) return "Selamat Pagi";
  if (h < 15) return "Selamat Siang";
  if (h < 18) return "Selamat Sore";
  return "Selamat Malam";
};

const getApelStatus = (now, apelSession) => {
  // Jika apel ditiadakan, langsung return "ditiadakan"
  if (apelSession === "ditiadakan") return "ditiadakan";

  // Gunakan apelSession sebagai source of truth (dari tombol admin)
  // Hanya fallback ke waktu jika apelSession adalah nilai default atau invalid
  if (apelSession && ["before", "ongoing", "ended"].includes(apelSession)) {
    return apelSession;
  }

  // Fallback ke waktu (untuk backward compatibility / initial state)
  const h = now.getHours(), m = now.getMinutes();
  const total = h * 60 + m;
  if (total < 7 * 60) return "before";
  if (total < 8 * 60) return "ongoing";
  return "ended";
};

const formatTime = (date) =>
  date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const formatTimeShort = (date) =>
  date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

const STATUS_COLORS = {
  Hadir: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  "Tanpa Keterangan": { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-400" },
  "Belum Melakukan Absensi": { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30", dot: "bg-slate-400" },
  "Dinas Dalam": { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30", dot: "bg-blue-400" },
  "Dinas Luar": { bg: "bg-violet-500/20", text: "text-violet-400", border: "border-violet-500/30", dot: "bg-violet-400" },
  Izin: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30", dot: "bg-amber-400" },
  Sakit: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30", dot: "bg-orange-400" },
};

const SANKSI_COLORS = {
  Hijau: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/40" },
  Kuning: { bg: "bg-yellow-500/20", text: "text-yellow-300", border: "border-yellow-500/40" },
  Oranye: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/40" },
  Merah: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/40" },
};

// ─── INITIAL ATTENDANCE STATE ────────────────────────────────────────────────
const buildInitialAttendance = () => {
  const map = {};
  for (const p of pegawaiData) {
    map[p.id] = { status: null, jamHadir: null };
  }
  for (const r of attendanceData.records) {
    map[r.pegawaiId] = { status: r.status, jamHadir: r.jamHadir };
  }
  return map;
};

const ATTENDANCE_PATH = "attendance/today";
const APEL_SESSION_PATH = "apel/session";
const APEL_REASON_PATH = "apel/reason";
const QR_PATH = "qr/current";
const QR_TOKEN_TTL_MS = 10000;

// ─── APEL SESSION TYPES ────────────────────────────────────────────────────────
const APEL_SESSIONS = {
  BEFORE: "before",
  ONGOING: "ongoing",
  ENDED: "ended",
  DITIADAKAN: "ditiadakan",
};

const APEL_SESSION_LABELS = {
  [APEL_SESSIONS.BEFORE]: "Sebelum Apel",
  [APEL_SESSIONS.ONGOING]: "Saat Apel",
  [APEL_SESSIONS.ENDED]: "Setelah Apel",
  [APEL_SESSIONS.DITIADAKAN]: "Ditiadakan",
};

// ─── STATUS ICONS ─────────────────────────────────────────────────────────────
const STATUS_ICONS = {
  "Dinas Luar": { icon: "🚗", label: "Dinas Luar" },
  "Dinas Dalam": { icon: "🏢", label: "Dinas Dalam" },
  "Izin": { icon: "📝", label: "Izin" },
  "Sakit": { icon: "🤒", label: "Sakit" },
  "Hadir": { icon: "✅", label: "Hadir" },
  "Tanpa Keterangan": { icon: "❌", label: "Tanpa Keterangan" },
};

const getStatusIcon = (status) => {
  return STATUS_ICONS[status] || { icon: "❓", label: status };
};

// ─── DISCIPLINE STATUS HELPER ────────────────────────────────────────────────
const tanpaKeteranganBulanIni = 2;

const getDisciplineStatus = (count) => {
  if (count === 0) return { icon: "🟢", label: "Sangat Baik" };
  if (count <= 2) return { icon: "🟡", label: "Perlu Perhatian" };
  if (count <= 4) return { icon: "🟠", label: "Pembinaan" };
  return { icon: "🔴", label: "Tindak Lanjut" };
};

// ─── DUMMY DATA PENGJUAN STATUS ──────────────────────────────────────────────
const PENGJUAN_STATUS_DATA = [
  {
    id: "1",
    pegawaiId: "peg-001",
    nip: "198901010001",
    nama: "Rasyid",
    statusLama: "Tanpa Keterangan",
    statusBaru: "Dinas Luar",
    dokumen: "surat_tugas.pdf",
    tanggal: "25 Mei 2026 09:15",
    waktu: "09:15",
    statusVerifikasi: "menunggu",
    analisisAI: null,
  },
  {
    id: "2",
    pegawaiId: "peg-002",
    nip: "199205050002",
    nama: "Ahmad Fauzi",
    statusLama: "Tanpa Keterangan",
    statusBaru: "Sakit",
    dokumen: "surat_dokter.pdf",
    tanggal: "25 Mei 2026 08:45",
    waktu: "08:45",
    statusVerifikasi: "menunggu",
    analisisAI: null,
  },
  {
    id: "3",
    pegawaiId: "peg-003",
    nip: "199508120003",
    nama: "Siti Rahma",
    statusLama: "Tanpa Keterangan",
    statusBaru: "Izin",
    dokumen: "surat_izin.pdf",
    tanggal: "25 Mei 2026 07:30",
    waktu: "07:30",
    statusVerifikasi: "disetujui",
    analisisAI: null,
  },
];

const REASON_OPTIONS = [
  { id: "hujan", label: "Hujan Deras", icon: "🌧️" },
  { id: "libur_nasional", label: "Libur Nasional", icon: "🇮🇩" },
  { id: "cuti_bersama", label: "Cuti Bersama", icon: "📅" },
  { id: "apel_gabungan", label: "Apel Gabungan", icon: "🤝" },
  { id: "lainnya", label: "Lainnya", icon: "✏️" },
];

const createQrToken = () => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1000000).padStart(6, "0");
};

const validateQrToken = async (token) => {
  const submittedToken = token.trim();
  const snapshot = await get(ref(database, QR_PATH));
  const currentQr = snapshot.val();

  if (!currentQr?.token || submittedToken !== currentQr.token) {
    return { type: "invalid", label: "INVALID TOKEN" };
  }

  if (Date.now() > currentQr.expiresAt) {
    return { type: "expired", label: "EXPIRED TOKEN" };
  }

  return { type: "valid", label: "VALID TOKEN" };
};

const calcStats = (attendance) => {
  let hadir = 0, tanpaKet = 0, dinasD = 0, dinasL = 0, izin = 0, sakit = 0;

  for (const v of Object.values(attendance)) {
    if (!v.status) {
      tanpaKet++;
      continue;
    }

    if (v.status === "Hadir") hadir++;
    else if (v.status === "Tanpa Keterangan") tanpaKet++;
    else if (v.status === "Dinas Dalam") dinasD++;
    else if (v.status === "Dinas Luar") dinasL++;
    else if (v.status === "Izin") izin++;
    else if (v.status === "Sakit") sakit++;
  }

  const total = pegawaiData.length;
  const persen = total > 0 ? Math.round((hadir / total) * 100) : 0;

  return { total, hadir, tanpaKet, dinasD, dinasL, izin, sakit, persen };
};

const ATTENDANCE_STAT_ITEMS = [
  { key: "hadir", status: "Hadir", label: "Hadir", icon: "✅", color: "text-emerald-400" },
  { key: "unaccounted", status: "Tanpa Keterangan", label: "Tanpa Keterangan", icon: "🚫", color: "text-red-400" },
  { key: "dinasD", status: "Dinas Dalam", label: "Dinas Dalam", icon: "🏢", color: "text-blue-400" },
  { key: "dinasL", status: "Dinas Luar", label: "Dinas Luar", icon: "🚗", color: "text-violet-400" },
  { key: "izin", status: "Izin", label: "Izin", icon: "📄", color: "text-amber-400" },
  { key: "sakit", status: "Sakit", label: "Sakit", icon: "🤒", color: "text-orange-400" },
];

const getAttendanceStatItems = (apelStatus) => {
  // Jika ditiadakan, tampilkan pesan khusus
  if (apelStatus === "ditiadakan") {
    return [
      { key: "info", status: "info", label: "Apel Ditiadakan", icon: "⚠️", color: "text-amber-400" },
    ];
  }
  return ATTENDANCE_STAT_ITEMS.map((item, index) => {
    if (index !== 1 || apelStatus === "ended") return item;
    return { ...item, status: "Belum Absen", label: "Belum Absen", icon: "⏳", color: "text-slate-400" };
  });
};

const isApelDitiadakan = (apelStatus) => apelStatus === "ditiadakan";

const calcAttendanceStats = (attendance, apelStatus, people = pegawaiData) => {
  let hadir = 0, unaccounted = 0, dinasD = 0, dinasL = 0, izin = 0, sakit = 0;

  for (const p of people) {
    const status = attendance[p.id]?.status;

    if (status === "Hadir") hadir++;
    else if (status === "Dinas Dalam") dinasD++;
    else if (status === "Dinas Luar") dinasL++;
    else if (status === "Izin") izin++;
    else if (status === "Sakit") sakit++;
    else unaccounted++;
  }

  const total = people.length;
  const persen = total > 0 ? Math.round((hadir / total) * 100) : 0;
  const tanpaKet = apelStatus === "ended" ? unaccounted : 0;
  const belumAbsen = apelStatus === "ended" ? 0 : unaccounted;

  return { total, hadir, unaccounted, tanpaKet, belumAbsen, dinasD, dinasL, izin, sakit, persen };
};

const getBidangPerformanceStatus = (persen) => {
  if (persen >= 90) return { label: "Sangat Baik", color: "text-emerald-300", bg: "bg-emerald-500/15", border: "border-emerald-500/30" };
  if (persen >= 80) return { label: "Baik", color: "text-blue-300", bg: "bg-blue-500/15", border: "border-blue-500/30" };
  if (persen >= 70) return { label: "Perlu Perhatian", color: "text-amber-300", bg: "bg-amber-500/15", border: "border-amber-500/30" };
  return { label: "Perlu Tindak Lanjut", color: "text-red-300", bg: "bg-red-500/15", border: "border-red-500/30" };
};

const LAST_MONTH_DISCIPLINE = {
  sekretariat: 96,
  tata_kota: 94,
  tata_ruang: 92,
  cipta_karya: 89,
  bina_marga: 86,
  sumber_daya_air: 84,
  jasa_konstruksi: 81,
};

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

// ─── PENGJUAN PERUBAHAN STATUS ────────────────────────────────────────────────
const PengajuanStatusForm = ({ myStatus }) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [keterangan, setKeterangan] = useState("");
  const [toast, setToast] = useState(null);
  const [fileName, setFileName] = useState("");

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = () => {
    if (!selectedStatus) {
      showToast("Pilih status baru terlebih dahulu");
      return;
    }
    if (!keterangan.trim()) {
      showToast("Keterangan tidak boleh kosong");
      return;
    }
    // Demo: hanya tampilkan toast
    showToast("Pengajuan berhasil dikirim (Demo)");
    setSelectedStatus(null);
    setKeterangan("");
    setFileName("");
    setShowForm(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
    }
  };

  if (!showForm) {
    return (
      <Card className="p-4 mb-4" onClick={() => setShowForm(true)}>
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-xl">📄</div>
          <div className="flex-1">
            <div className="text-white text-sm font-semibold">Pengajuan Perubahan Status</div>
            <div className="text-slate-400 text-xs">Ajukan perubahan status absensi</div>
          </div>
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-4 border-blue-500/30">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 border border-emerald-400/40 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg backdrop-blur-xl">
          ✓ {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-sm font-bold">📄 Pengajuan Perubahan Status</h3>
        <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status Saat Ini */}
      <div className="mb-4">
        <div className="text-slate-500 text-xs mb-1">Status Saat Ini</div>
        <div className="flex items-center gap-2">
          <StatusBadge status={myStatus || "Tanpa Keterangan"} />
        </div>
      </div>

      {/* Status Baru */}
      <div className="mb-4">
        <div className="text-slate-500 text-xs mb-2">Ajukan Status Baru:</div>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map(status => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`p-3 rounded-xl border text-xs font-semibold transition-all active:scale-[0.97] ${
                selectedStatus === status
                  ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                  : "bg-slate-800 border-slate-700/50 text-slate-300 hover:border-slate-600"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Dokumen Pendukung */}
      <div className="mb-4">
        <div className="text-slate-500 text-xs mb-2">Dokumen Pendukung</div>
        <label className="block">
          <div className={`flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 bg-slate-800 cursor-pointer hover:border-slate-600 transition-colors ${
            fileName ? "border-emerald-500/30" : ""
          }`}>
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-sm">📎</div>
            <div className="flex-1 min-w-0">
              <div className="text-slate-400 text-xs truncate">{fileName || "Pilih File"}</div>
            </div>
          </div>
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
        </label>
      </div>

      {/* Keterangan */}
      <div className="mb-4">
        <div className="text-slate-500 text-xs mb-2">Keterangan</div>
        <textarea
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          placeholder="Tuliskan alasan pengajuan..."
          rows={3}
          className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50 resize-none"
        />
      </div>

      {/* Tombol Kirim */}
      <button
        onClick={handleSubmit}
        disabled={!selectedStatus || !keterangan.trim()}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
          selectedStatus && keterangan.trim()
            ? "bg-blue-600 hover:bg-blue-500 text-white"
            : "bg-slate-800 text-slate-600 cursor-not-allowed"
        }`}
      >
        Kirim Pengajuan
      </button>
    </Card>
  );
};

// ─── QR CODE GENERATOR ────────────────────────────────────────────────
const QRDisplay = ({ token, size = 200, className = "rounded-xl", style }) => {
  return (
    <QRCodeSVG
      value={token || "SIAPEL-QR-INACTIVE"}
      size={size}
      bgColor="#ffffff"
      fgColor="#0f172a"
      level="M"
      includeMargin
      className={className}
      style={style}
    />
  );
};

const FullscreenQR = ({ currentQr, qrActive, secsLeft, onExit }) => {
  return (
    <div className="fixed inset-0 z-[100] min-h-screen overflow-hidden bg-[#080c14] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#080c14] via-[#101827] to-[#06111f]" />
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[460px] w-[460px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <button
        onClick={onExit}
        className="fixed right-4 top-4 z-20 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white shadow-lg backdrop-blur-xl transition-all hover:bg-white/15 active:scale-[0.98] md:right-6 md:top-6"
      >
        Keluar
      </button>

      <div className="relative z-10 grid h-screen w-full grid-rows-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-4 py-3 text-center sm:px-8 sm:py-4 lg:px-12">
        <header className="flex min-h-0 flex-col items-center justify-center">
          <h1 className="text-[clamp(1.65rem,4.6vw,4.75rem)] font-black leading-none tracking-normal text-white">
            APEL PAGI
          </h1>
          <p className="mt-1 text-[clamp(0.95rem,2.1vw,2.15rem)] font-black leading-tight tracking-normal text-blue-100/90 sm:mt-2">
            DINAS PUPR KAB. BARITO UTARA
          </p>
        </header>

        <main className="flex min-h-0 w-full items-center justify-center overflow-hidden py-1">
          <div className={`relative flex items-center justify-center rounded-[2rem] border border-white/15 bg-white/10 p-[clamp(0.75rem,1.5vw,1.5rem)] shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl ${!qrActive && "opacity-30 grayscale"}`}>
            <QRDisplay
              token={currentQr?.token}
              size={1024}
              className="rounded-[1.5rem] shadow-2xl"
              style={{
                width: "min(86vw, 56dvh, 820px)",
                height: "min(86vw, 56dvh, 820px)",
              }}
            />
            {qrActive && (
              <div className="absolute right-2 top-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                {secsLeft}s
              </div>
            )}
          </div>
        </main>

        <section className="flex min-h-0 w-full flex-col items-center justify-center">
          <div className="min-w-[min(92vw,520px)] rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-2 shadow-[0_18px_50px_rgba(16,185,129,0.14)] backdrop-blur-xl sm:px-9 sm:py-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200/80 sm:text-sm">
              KODE ABSENSI
            </p>
            <div className="mt-1 font-mono text-[clamp(1.95rem,5.4vw,4.5rem)] font-black leading-none tracking-normal text-white">
              {qrActive && currentQr?.token ? currentQr.token : "------"}
            </div>
          </div>
          <footer className="mt-2 flex flex-col items-center justify-center text-[clamp(0.72rem,1.25vw,1rem)] font-semibold leading-tight text-slate-400 sm:mt-3">
            <p>Berganti setiap 10 detik</p>
            <p>Aktif hingga 08:00</p>
          </footer>
        </section>
      </div>
    </div>
  );
};

const TokenFeedback = ({ result }) => {
  if (!result) return null;

  return (
    <div className={`mt-4 rounded-xl border px-4 py-3 text-center font-black tracking-wide ${
      result.type === "valid"
        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
        : result.type === "expired"
          ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
          : "border-red-500/40 bg-red-500/15 text-red-300"
    }`}>
      {result.label}
    </div>
  );
};

// ─── PROGRESS RING ────────────────────────────────────────────────────────────
const ProgressRing = ({ pct, size = 120, stroke = 8, color = "#10b981", label, sublabel }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-white leading-none">{pct}%</span>
        {label && <span className="text-[10px] text-slate-400 mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const c = STATUS_COLORS[status] || { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
};

// ─── COUNTDOWN ───────────────────────────────────────────────────────────────
const Countdown = ({ targetHour, targetMinute = 0 }) => {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(targetHour, targetMinute, 0, 0);
      setSecs(Math.max(0, Math.ceil((target - now) / 1000)));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetHour, targetMinute]);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <div className="flex items-center gap-2 justify-center">
      {[h, m, s].map((v, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-2xl font-mono font-bold text-white min-w-[3rem] text-center">
            {String(v).padStart(2, "0")}
          </span>
          {i < 2 && <span className="text-slate-500 text-xl font-bold">:</span>}
        </span>
      ))}
    </div>
  );
};

// ─── GLASS CARD ───────────────────────────────────────────────────────────────
const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick}
    className={`bg-slate-900/60 border border-slate-700/50 rounded-2xl backdrop-blur-sm ${onClick ? "cursor-pointer hover:border-slate-600/70 hover:bg-slate-800/60 active:scale-[0.98]" : ""} transition-all duration-200 ${className}`}>
    {children}
  </div>
);

// ─── BACK BUTTON ─────────────────────────────────────────────────────────────
const BackButton = ({ onClick }) => (
  <button onClick={onClick}
    className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors mb-4">
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
    Kembali
  </button>
);

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: ROLE SELECTOR
// ══════════════════════════════════════════════════════════════════════════════
const RoleSelector = ({ onSelect }) => {
  const roles = [
    { id: "pegawai", label: "Pegawai", desc: "Absensi & lihat status pribadi", icon: "👤", color: "from-emerald-500/20 to-teal-500/10", border: "hover:border-emerald-500/50" },
    { id: "pimpinan", label: "Pimpinan", desc: "Dashboard eksekutif & rekap", icon: "⭐", color: "from-amber-500/20 to-yellow-500/10", border: "hover:border-amber-500/50" },
    { id: "admin", label: "Admin", desc: "Pusat operasional & QR apel", icon: "🛡️", color: "from-blue-500/20 to-indigo-500/10", border: "hover:border-blue-500/50" },
  ];
  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center px-4 py-12">
      {/* BG decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <img
  src="/logo-siapel.png"
  alt="SIAPEL"
  className="w-40 h-40 mx-auto mb-4 drop-shadow-2xl"
/>
          <h1 className="text-5xl font-black text-white tracking-tight">SIAPEL</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium tracking-wider">Sistem Informasi Apel Pegawai</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-xs text-slate-600">Dinas PUPR</span>
            <span className="text-slate-700">·</span>
            <span className="text-xs text-slate-600">Barito Utara</span>
          </div>
        </div>

        <p className="text-slate-500 text-xs text-center mb-5 tracking-widest uppercase font-semibold">Masuk sebagai</p>

        <div className="flex flex-col gap-3">
          {roles.map((r) => (
            <button key={r.id} onClick={() => onSelect(r.id)}
              className={`group relative text-left p-4 rounded-2xl bg-gradient-to-br ${r.color} border border-slate-700/60 ${r.border} transition-all duration-200 active:scale-[0.98] hover:shadow-lg`}>
              <div className="flex items-center gap-4">
                <span className="text-3xl">{r.icon}</span>
                <div>
                  <div className="text-white font-bold text-base">{r.label}</div>
                  <div className="text-slate-400 text-xs mt-0.5">{r.desc}</div>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-400 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-slate-700 text-xs mt-8">Prototype v1.0 · Hanya untuk demonstrasi</p>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: PEGAWAI LOGIN
// ══════════════════════════════════════════════════════════════════════════════
const PegawaiLogin = ({ onBack, onLogin }) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = pegawaiData.filter(p =>
  p.nama.toLowerCase().startsWith(search.toLowerCase()) ||
  p.jabatan.toLowerCase().startsWith(search.toLowerCase()) ||
  p.bidang.toLowerCase().startsWith(search.toLowerCase())
).slice(0, 20);

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }}
            placeholder="Cari nama pegawai..."
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800" />
        </div>

        {/* List */}
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1 scrollbar-thin">
          {search.trim() !== '' && filtered.map(p => (
            <button key={p.id} onClick={() => setSelected(p)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 active:scale-[0.98] ${selected?.id === p.id
                ? "bg-emerald-500/20 border-emerald-500/50"
                : "bg-slate-900/60 border-slate-700/50 hover:border-slate-600/70 hover:bg-slate-800/60"}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {p.nama.split(" ").slice(0, 2).map(n => n[0]).join("")}
                </div>
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold truncate">{p.nama}</div>
                  <div className="text-slate-500 text-xs truncate">{p.jabatan}</div>
                </div>
                {selected?.id === p.id && (
                  <svg className="w-5 h-5 text-emerald-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-slate-600 py-8 text-sm">Pegawai tidak ditemukan</div>
          )}
        </div>

        {selected && (
          <div className="mt-4 sticky bottom-0 pb-2">
            <Card className="p-3 mb-3 border-emerald-500/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center text-white text-sm font-bold">
                  {selected.nama.split(" ").slice(0, 2).map(n => n[0]).join("")}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">{selected.nama}</div>
                  <div className="text-slate-400 text-xs">{selected.bidang} · {selected.jabatan.split(" ").slice(0, 3).join(" ")}</div>
                </div>
              </div>
            </Card>
            <button onClick={() => onLogin(selected)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl transition-all duration-150 shadow-lg shadow-emerald-500/20">
              Masuk Sebagai Pegawai
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: DASHBOARD PEGAWAI
// ══════════════════════════════════════════════════════════════════════════════
const DashboardPegawai = ({ pegawai, attendance, apelStatus, apelReason, apelReasonText, onScan, onBack }) => {
  const [now, setNow] = useState(new Date());
  const [showScanner, setShowScanner] = useState(false);
  const [showManualCode, setShowManualCode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);
  const [showAturanModal, setShowAturanModal] = useState(false);
  const isValidatingScan = useRef(false);
  const myAttendance = attendance[pegawai.id] || { status: null, jamHadir: null };
  const stats = calcAttendanceStats(attendance, apelStatus);
  const sudahAbsen = myAttendance.status === "Hadir";
  const canSubmitAttendance = apelStatus === "ongoing";
  const isDitiadakan = isApelDitiadakan(apelStatus);
  const getReasonDisplay = () => {
    if (apelReason === "lainnya") return apelReasonText || "Lainnya";
    const reason = REASON_OPTIONS.find(r => r.id === apelReason);
    return reason ? reason.label : "Ditiadakan";
  };
  const isUnrecordedStatus = !myAttendance.status || myAttendance.status === "Tanpa Keterangan";
  const displayStatus = isUnrecordedStatus
    ? (apelStatus === "ended" ? "Tanpa Keterangan" : "Belum Melakukan Absensi")
    : myAttendance.status;
  const showAttendanceTime = !isUnrecordedStatus && myAttendance.jamHadir;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!canSubmitAttendance) {
      setShowManualCode(false);
      setShowScanner(false);
    }
  }, [canSubmitAttendance]);

  useEffect(() => {
  if (!showScanner) return;

  setScanResult(null);
  isValidatingScan.current = false;

  let scanner;
  let scannerStarted = false;
  let cancelled = false;
  try {
    scanner = new Html5Qrcode("qr-reader");
  } catch (error) {
    console.error("Html5Qrcode constructor error:", error);
    return;
  }

  const stopScanner = async () => {
    if (!scanner || !scannerStarted) return;
    try {
      await scanner.stop();
      scannerStarted = false;
    } catch (error) {
      console.error("Html5Qrcode stop error:", error);
    }
    try {
      await scanner.clear();
    } catch (error) {
      console.error("Html5Qrcode clear error:", error);
    }
  };

  const startScanner = async () => {
    try {
      const cameras = await Html5Qrcode.getCameras();
      const rearCamera = cameras.find(camera => /back|rear|environment/i.test(camera.label));
      const selectedCamera = rearCamera || cameras[0];

      if (!selectedCamera) {
        console.error("No camera available for Html5Qrcode.start");
        return;
      }

      if (cancelled) return;

      const onScanSuccess = async (decodedText) => {
        if (isValidatingScan.current) return;
        isValidatingScan.current = true;

        try {
          const result = await validateQrToken(decodedText);
          handleValidationSuccess(result);
          await stopScanner();
          if (result.type === "valid") {
            setShowScanner(false);
          }
        } catch (error) {
          console.error("Failed to validate QR token:", error);
          setScanResult({ type: "invalid", label: "INVALID TOKEN" });
          await stopScanner();
        }
      };

      const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 } };
      const preferredCameraConfig = rearCamera ? rearCamera.id : { facingMode: "environment" };
      try {
        await scanner.start(preferredCameraConfig, scanConfig, onScanSuccess);
      } catch (error) {
        if (cancelled || rearCamera) throw error;
        await scanner.start(selectedCamera.id, scanConfig, onScanSuccess);
      }
      scannerStarted = true;
    } catch (error) {
      console.error("Html5Qrcode start error:", error);
    }
  };

  startScanner();

  return () => {
    cancelled = true;
    isValidatingScan.current = false;
    stopScanner();
  };
}, [showScanner]);

  const handleValidationSuccess = (result) => {
    if (!canSubmitAttendance) return;

    if (result.type === "valid") {
      setScanResult(null);
      setAttendanceSuccess(true);
      if (!sudahAbsen) {
        onScan(pegawai.id);
      }
      return;
    }

    setAttendanceSuccess(false);
    setScanResult(result);
  };

  const handleManualCodeSubmit = async () => {
    if (!canSubmitAttendance) return;
    if (!manualCode.trim()) return;
    try {
      handleValidationSuccess(await validateQrToken(manualCode));
    } catch (error) {
      console.error("Failed to validate manual QR code:", error);
      setScanResult({ type: "invalid", label: "INVALID TOKEN" });
    }
  };

  const statItems = getAttendanceStatItems(apelStatus).map(item => ({ ...item, value: stats[item.key] }));

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />

        {/* Header */}
        <div className="mb-6">
          <p className="text-slate-400 text-sm">{getGreeting()},</p>
          <h1 className="text-2xl font-black text-white leading-tight">{pegawai.nama.split(",")[0]}</h1>
          <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{pegawai.jabatan}</p>
        </div>

        {isDitiadakan ? (
          <Card className="p-4 border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-xl">⚠️</div>
              <div>
                <div className="text-amber-400 font-bold text-sm">Apel Hari Ini Ditiadakan</div>
                <div className="text-amber-300/70 text-xs">{getReasonDisplay()}</div>
              </div>
            </div>
            <div className="text-slate-400 text-xs leading-relaxed">
              Apel hari ini tidak dilaksanakan.<br />
              Absensi dan statistik kehadiran tidak tersedia.
            </div>
          </Card>
        ) : (
        <>
        {/* Status Card - Two Column Layout */}
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Status Hari Ini</span>
            <span className="text-slate-500 text-xs">{now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Left Column: Hadir / Status */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col items-center text-center">
              {/* Icon + Status */}
              <div className="flex flex-col items-center mb-2">
                <span className="text-lg mb-1">🟢</span>
                <span className="text-emerald-400 text-xs font-semibold">
                  {displayStatus === "Hadir" ? "Hadir" : displayStatus}
                </span>
              </div>

              {/* Tanggal */}
              <div className="text-white text-sm font-bold mb-2">
                {now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
              </div>

              {/* Jam Hadir / Belum Absen */}
              {showAttendanceTime ? (
                <div>
                  <div className="text-slate-500 text-xs">Jam Hadir</div>
                  <div className="text-white text-xl font-black">{myAttendance.jamHadir} WIB</div>
                </div>
              ) : (
                <div className="text-slate-500 text-xs">Belum Absen</div>
              )}
            </div>

            {/* Right Column: Tanpa Keterangan Bulan Ini */}
            {(() => {
              const discipline = getDisciplineStatus(tanpaKeteranganBulanIni);
              return (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col items-center text-center">
                  {/* Icon + Bulan Ini */}
                  <div className="flex flex-col items-center mb-2">
                    <span className="text-lg mb-1">{discipline.icon}</span>
                    <span className="text-amber-400 text-xs font-semibold">Bulan Ini</span>
                  </div>

                  {/* Jumlah - Fokus Utama */}
                  <div className="text-white text-xl font-black leading-tight">
                    {tanpaKeteranganBulanIni} Kali
                  </div>

                  {/* Subtitle */}
                  <div className="text-slate-400 text-xs mt-1">
                    Tanpa Keterangan
                  </div>

                  {/* Label Status */}
                  <div className={`text-xs font-semibold mt-2 ${
                    tanpaKeteranganBulanIni === 0 ? "text-emerald-400" :
                    tanpaKeteranganBulanIni <= 2 ? "text-amber-400" :
                    tanpaKeteranganBulanIni <= 4 ? "text-orange-400" :
                    "text-red-400"
                  }`}>
                    {discipline.label}
                  </div>

                  {/* Tombol */}
                  <button
                    onClick={() => setShowAturanModal(true)}
                    className="mt-3 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/50 transition-all active:scale-[0.98]"
                  >
                    Lihat Aturan
                  </button>
                </div>
              );
            })()}
          </div>
        </Card>

        {/* Apel Status - Sembunyikan setelah absen */}
        {!sudahAbsen && (
        <Card className="p-4 mb-4">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Sesi Apel</div>
          {apelStatus === "before" && (
            <>
              <p className="text-slate-300 text-sm mb-3">Apel Dimulai Dalam</p>
              <Countdown targetHour={7} />
            </>
          )}
          {apelStatus === "ongoing" && (
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-emerald-400 font-semibold">Apel Sedang Berlangsung</span>
            </div>
          )}
          {apelStatus === "ended" && (
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-slate-600" />
              <span className="text-slate-400 font-medium">Sesi Apel Telah Berakhir</span>
            </div>
          )}
        </Card>
        )}

        {attendanceSuccess && (
          <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-center font-black tracking-wide text-emerald-300">
            ✓ Kehadiran berhasil dicatat
          </div>
        )}

        {/* Scan QR Button */}
        {!sudahAbsen ? (
          <>
          <button
  onClick={() => canSubmitAttendance && setShowScanner(true)}
            disabled={!canSubmitAttendance}
            className={`w-full py-4 rounded-2xl font-black text-lg tracking-tight transition-all duration-200 active:scale-[0.98] mb-6 ${canSubmitAttendance
              ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              : "bg-slate-800/60 border border-slate-700/50 text-slate-600 cursor-not-allowed"}`}>
            {apelStatus === "before" ? "🔒 Apel Belum Dimulai" :
              apelStatus === "ended" ? "🔒 Sesi Telah Berakhir" : "📱 SCAN QR ABSENSI"}
          </button>
          <Card className="p-4 mb-6">
            <button
              onClick={() => {
                if (!canSubmitAttendance) return;
                setScanResult(null);
                setAttendanceSuccess(false);
                setShowManualCode(prev => !prev);
              }}
              disabled={!canSubmitAttendance}
              className={`w-full py-3 rounded-xl text-sm font-bold border active:scale-[0.98] ${
                canSubmitAttendance
                  ? "bg-slate-800 text-white border-slate-700"
                  : "bg-slate-800/60 text-slate-600 border-slate-700/50 cursor-not-allowed"
              }`}
            >
              Enter Code
            </button>
            {showManualCode && (
              <div className="mt-3">
                <div className="flex gap-2">
                  <input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6 digit code"
                    inputMode="numeric"
                    maxLength={6}
                    className="min-w-0 flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    onClick={handleManualCodeSubmit}
                    className="px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold active:scale-[0.98]"
                  >
                    Validate
                  </button>
                </div>
                <TokenFeedback result={scanResult} />
              </div>
            )}
          </Card>
          </>
        ) : (
          <Card className="p-4 mb-6 border-emerald-500/30 bg-emerald-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-xl">✅</div>
              <div>
                <div className="text-emerald-400 font-bold text-sm">Absensi Tercatat</div>
                <div className="text-slate-400 text-xs">Anda sudah melakukan absensi hari ini</div>
              </div>
            </div>
          </Card>
        )}

        {/* Org Stats */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Statistik Organisasi</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 text-xs">Realtime</span>
            </div>
          </div>
          <Card className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <ProgressRing pct={stats.persen} size={80} stroke={7} label="Kehadiran" />
              <div>
                <div className="text-white text-xl font-black">{stats.persen}%</div>
                <div className="text-slate-400 text-xs">Tingkat Kehadiran</div>
                <div className="text-slate-500 text-xs mt-1">{stats.hadir} dari {stats.total} pegawai</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {statItems.map(s => (
                <div key={s.label} className="bg-slate-800/60 rounded-xl p-2.5 text-center">
                  <div className="text-base mb-0.5">{s.icon}</div>
                  <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-slate-400 text-xs leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ─── PENGAJUAN PERUBAHAN STATUS ─── */}
        <PengajuanStatusForm myStatus={displayStatus} />

        {/* ATURAN MODAL */}
        {showAturanModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">📖 Aturan Ketidakhadiran Bulan Berjalan</h3>
                <button onClick={() => setShowAturanModal(false)} className="text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Posisi Saat Ini */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 text-center">
                <div className="text-slate-400 text-xs mb-1">Posisi Anda Saat Ini</div>
                <div className="text-2xl font-black text-amber-400">
                  {tanpaKeteranganBulanIni} Kali
                </div>
              </div>

              <div className="border-t border-slate-700/50 my-3" />

              {/* Aturan Table */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-xl">🟢</span>
                  <div className="flex-1">
                    <span className="text-white text-sm font-semibold">0 Kali</span>
                  </div>
                  <span className="text-emerald-400 text-sm font-bold">Sangat Baik</span>
                </div>

                <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <span className="text-xl">🟡</span>
                  <div className="flex-1">
                    <span className="text-white text-sm font-semibold">1 - 2 Kali</span>
                  </div>
                  <span className="text-yellow-400 text-sm font-bold">Perlu Perhatian</span>
                </div>

                <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                  <span className="text-xl">🟠</span>
                  <div className="flex-1">
                    <span className="text-white text-sm font-semibold">3 - 4 Kali</span>
                  </div>
                  <span className="text-orange-400 text-sm font-bold">Pembinaan</span>
                </div>

                <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <span className="text-xl">🔴</span>
                  <div className="flex-1">
                    <span className="text-white text-sm font-semibold">≥ 5 Kali</span>
                  </div>
                  <span className="text-red-400 text-sm font-bold">Tindak Lanjut</span>
                </div>
              </div>

              <button
                onClick={() => setShowAturanModal(false)}
                className="w-full mt-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors border border-slate-700/50"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        </>
        )}
      </div>
      {showScanner && (
  <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto overscroll-contain px-4 pt-4 [padding-bottom:calc(1rem+env(safe-area-inset-bottom))]">
    <div className="flex min-h-full items-start justify-center sm:items-center">
    <div className="relative z-10 bg-slate-900 border border-slate-700 rounded-2xl p-4 [padding-bottom:calc(1rem+env(safe-area-inset-bottom))] w-full max-w-sm max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-bottom))] overflow-y-auto">
      <h3 className="text-white font-bold mb-3">
        Scan QR Absensi
      </h3>

     <div
  id="qr-reader"
  className="relative z-0 bg-white rounded-xl w-full h-[48vh] min-h-[240px] max-h-[420px] overflow-hidden [&_*]:!max-w-full [&_video]:!relative [&_video]:!z-0 [&_video]:!h-full [&_video]:!max-h-full [&_video]:!object-cover"
/>

      <div className="relative z-10">
        <TokenFeedback result={scanResult} />
      </div>

      <button
        onClick={() => setShowScanner(false)}
        className="relative z-10 w-full mt-4 py-3 rounded-xl bg-slate-800 text-white"
      >
        Tutup
      </button>
    </div>
    </div>
  </div>
)}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: DASHBOARD PIMPINAN
// ══════════════════════════════════════════════════════════════════════════════
const DashboardPimpinan = ({ attendance, apelStatus, apelSession, apelReason, apelReasonText, onBack }) => {
  const [showAllPerhatian, setShowAllPerhatian] = useState(false);
  const [showAllBidangToday, setShowAllBidangToday] = useState(false);
  const [showAllLastMonth, setShowAllLastMonth] = useState(false);
  const [showDetailPengajuan, setShowDetailPengajuan] = useState(false);
  const [selectedBidang, setSelectedBidang] = useState(null);
  const [now, setNow] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  // Check if apel is ditiadakan
  const isDitiadakan = isApelDitiadakan(apelStatus);

  // Get reason label for display
  const getReasonDisplay = () => {
    if (apelReason === "lainnya") return apelReasonText || "Lainnya";
    const reason = REASON_OPTIONS.find(r => r.id === apelReason);
    return reason ? reason.label : "Ditiadakan";
  };

  // Update greeting every 30 seconds
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  // Update clock every second with proper cleanup
  useEffect(() => {
    const tick = () => setCurrentTime(new Date());
    tick(); // Initial update
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format date: "Senin, 25 Mei 2026"
  const formatDateIndonesia = (date) => {
    const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${hari[date.getDay()]}, ${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Format time: "07:28:43"
  const formatTimeWIB = (date) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const stats = calcAttendanceStats(attendance, apelStatus);
  const unaccountedItem = getAttendanceStatItems(apelStatus)[1];

const getBidangStats = (bidangNama) => {
    const members = pegawaiData.filter(p => p.bidang === bidangNama);
    return calcAttendanceStats(attendance, apelStatus, members);
  };

  const perhatianList = [
    {
      pegawaiId: "demo-1",
      totalTanpaKeterangan: 5,
      pegawai: { nama: "Bon Bendi", nip: "197903122008011001", bidang: "Sekretariat" },
    },
    {
      pegawaiId: "demo-2",
      totalTanpaKeterangan: 4,
      pegawai: { nama: "Abdul Rohman", nip: "197903122008011002", bidang: "Sumber Daya Air" },
    },
    {
      pegawaiId: "demo-3",
      totalTanpaKeterangan: 3,
      pegawai: { nama: "Roby Cahyadi, S.T.", nip: "197903122008011003", bidang: "Bina Marga" },
    },
    {
      pegawaiId: "demo-4",
      totalTanpaKeterangan: 2,
      pegawai: { nama: "Ahmad Fauzi", nip: "197903122008011004", bidang: "Bidang Umum" },
    },
    {
      pegawaiId: "demo-5",
      totalTanpaKeterangan: 1,
      pegawai: { nama: "Eko Prasetyo", nip: "197903122008011005", bidang: "UPT Pelayanan A" },
    },
    {
      pegawaiId: "demo-6",
      totalTanpaKeterangan: 1,
      pegawai: { nama: "Siti Nurhayati", nip: "197903122008011006", bidang: "Sekretariat" },
    },
    {
      pegawaiId: "demo-7",
      totalTanpaKeterangan: 1,
      pegawai: { nama: "Dedi Kurniawan", nip: "197903122008011007", bidang: "Sumber Daya Air" },
    },
    {
      pegawaiId: "demo-8",
      totalTanpaKeterangan: 1,
      pegawai: { nama: "Maya Lestari", nip: "197903122008011008", bidang: "Bina Marga" },
    },
    {
      pegawaiId: "demo-9",
      totalTanpaKeterangan: 1,
      pegawai: { nama: "Rizal Maulana", nip: "197903122008011009", bidang: "Cipta Karya" },
    },
    {
      pegawaiId: "demo-10",
      totalTanpaKeterangan: 1,
      pegawai: { nama: "Dian Puspita", nip: "197903122008011010", bidang: "UPT Pelayanan B" },
    },
    {
      pegawaiId: "demo-11",
      totalTanpaKeterangan: 1,
      pegawai: { nama: "Fajar Nugroho", nip: "197903122008011011", bidang: "Tata Ruang" },
    },
    {
      pegawaiId: "demo-12",
      totalTanpaKeterangan: 1,
      pegawai: { nama: "Rina Marlina", nip: "197903122008011012", bidang: "UPT Pelayanan A" },
    },
  ];
  const visiblePerhatianList = showAllPerhatian ? perhatianList : perhatianList.slice(0, 3);

  const bidangList = orgData.bidang.filter(b => b.id !== "pimpinan");
  const bidangAnalytics = bidangList
    .map(b => ({ ...b, stats: getBidangStats(b.nama) }))
    .filter(b => b.stats.total > 0);
  const todayRanking = [...bidangAnalytics].sort((a, b) => b.stats.persen - a.stats.persen || b.stats.hadir - a.stats.hadir || a.nama.localeCompare(b.nama));
  const visibleTodayRanking = showAllBidangToday ? todayRanking : todayRanking.slice(0, 3);
  const lastMonthRanking = bidangList
    .map(b => ({ ...b, persen: LAST_MONTH_DISCIPLINE[b.id] ?? 80 }))
    .sort((a, b) => b.persen - a.persen || a.nama.localeCompare(b.nama));
  const visibleLastMonthRanking = showAllLastMonth ? lastMonthRanking : lastMonthRanking.slice(0, 3);

  if (selectedBidang) {
    const b = selectedBidang;
    const bStats = getBidangStats(b.nama);
    const unaccountedLabel = unaccountedItem.label;
    const bidangStatus = getBidangPerformanceStatus(bStats.persen);
    const detailRows = [
      { label: "Hadir", value: bStats.hadir, color: "text-emerald-400" },
      { label: unaccountedLabel, value: bStats[unaccountedItem.key], color: unaccountedItem.color },
      { label: "Dinas Dalam", value: bStats.dinasD, color: "text-blue-400" },
      { label: "Dinas Luar", value: bStats.dinasL, color: "text-violet-400" },
      { label: "Izin", value: bStats.izin, color: "text-amber-400" },
      { label: "Sakit", value: bStats.sakit, color: "text-orange-400" },
    ];
    return (
      <div className="min-h-screen bg-[#070b13] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => setSelectedBidang(null)} />

          <Card className="p-5 mb-4 border-slate-600/40 bg-slate-950/70 shadow-[0_18px_60px_rgba(0,0,0,0.32)]">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-black text-slate-50 uppercase leading-tight">{b.nama}</h2>
                <p className="text-slate-400 text-xs mt-1">{b.kepala}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-black text-amber-200">{bStats.persen}%</div>
                <div className="text-slate-500 text-[10px] uppercase tracking-wider">Hadir</div>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-amber-200/10 pb-3 mb-3">
              <span className="text-slate-400 text-sm">Total Pegawai</span>
              <span className="text-white text-lg font-black">{bStats.total}</span>
            </div>

            <div className="space-y-2">
              {detailRows.map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{row.label}</span>
                  <span className={`text-sm font-black ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-amber-200/10 pt-4">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-[0.18em] mb-2">Status Bidang</div>
              <div className={`inline-flex items-center rounded-xl border px-3 py-2 text-sm font-black ${bidangStatus.bg} ${bidangStatus.border} ${bidangStatus.color}`}>
                {bStats.persen < 80 ? "⚠ " : ""}{bidangStatus.label}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b13] px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.08),transparent_32%)]" />
        <div className="absolute top-0 left-0 w-80 h-80 bg-amber-500/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-slate-300/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />

        {/* Header */}
        <div className="mb-6 border-b border-amber-200/10 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-amber-200/80 text-sm font-medium">{getGreeting()},</p>
              <h1 className="text-xl font-black text-slate-50 leading-tight">{orgData.kepala_dinas.nama}</h1>
              <p className="text-slate-400 text-xs mt-0.5">{orgData.kepala_dinas.jabatan} · {orgData.dinas}</p>
            </div>
            {/* Date & Time Display */}
            <div className="text-right shrink-0 hidden sm:block">
              <div className="text-amber-200/90 text-xs font-medium leading-tight">{formatDateIndonesia(currentTime)}</div>
              <div className="text-white text-lg font-bold font-mono tracking-wide mt-1">{formatTimeWIB(currentTime)} <span className="text-amber-200/60 text-xs font-normal">WIB</span></div>
            </div>
          </div>
          {/* Mobile Date/Time (below title) */}
          <div className="sm:hidden mt-3 pt-3 border-t border-amber-200/10 flex items-center justify-between">
            <span className="text-amber-200/80 text-xs">{formatDateIndonesia(currentTime)}</span>
            <span className="text-white text-sm font-bold font-mono">{formatTimeWIB(currentTime)} <span className="text-amber-200/60 text-xs font-normal">WIB</span></span>
          </div>
        </div>

        {/* Banner Apel Ditiadakan */}
        {isDitiadakan && (
          <Card className="p-4 mb-4 border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-xl">⚠️</div>
              <div>
                <div className="text-amber-400 font-bold text-sm">Apel Hari Ini Ditiadakan</div>
                <div className="text-amber-300/70 text-xs">{getReasonDisplay()}</div>
              </div>
            </div>
            <div className="text-slate-400 text-xs">
              Statistik kehadiran normal tidak ditampilkan karena apel ditiadakan.
            </div>
          </Card>
        )}

        {/* Main Stats + Ring - Jika ditiadakan, sembunyikan */}
        {!isDitiadakan && (
        <Card className="p-5 mb-4 border-amber-200/15 bg-slate-950/70 shadow-[0_18px_55px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-5">
            <ProgressRing pct={stats.persen} size={100} stroke={9} color="#f59e0b" label="Kehadiran" />
            <div className="flex-1 space-y-2">
              {[
  { label: "Total Pegawai", val: stats.total, color: "text-white" },
  { label: "Hadir", val: stats.hadir, color: "text-emerald-400" },
  { label: unaccountedItem.label, val: stats[unaccountedItem.key], color: unaccountedItem.color },
].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs">{s.label}</span>
                  <span className={`font-bold text-sm ${s.color}`}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        )}

        {/* Status breakdown - Jika ditiadakan, sembunyikan */}
        {!isDitiadakan && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {getAttendanceStatItems(apelStatus).map(item => ({ label: item.label, val: stats[item.key], icon: item.icon, color: item.color })).map(s => (
            <Card key={s.label} className="p-3 text-center border-slate-600/35 bg-slate-950/55 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
              <div className="text-xl mb-1">{s.icon}</div>
              <div className={`text-lg font-black ${s.color}`}>{s.val}</div>
              <div className="text-slate-400 text-xs leading-tight">{s.label}</div>
            </Card>
          ))}
        </div>
        )}

        {/* Perlu Perhatian */}
        <Card className="p-4 mb-4 border-slate-600/40 bg-slate-950/65 shadow-[0_14px_42px_rgba(0,0,0,0.24)]">
          <div className="mb-3 border-b border-slate-700/50 pb-3">
            <div className="text-slate-50 font-bold text-sm">Pegawai Perlu Perhatian</div>
            <div className="text-slate-500 text-xs mt-0.5">Top 3 berdasarkan sanksi bulan ini</div>
          </div>
          <div className="space-y-2">
            {visiblePerhatianList.map(r => {
              const tanpaKeterangan = r.totalTanpaKeterangan;
              const sanctionText =
                tanpaKeterangan >= 5 ? "Pemotongan TPP 10%" :
                  tanpaKeterangan === 4 ? "SP2" :
                    tanpaKeterangan === 3 ? "SP1" :
                      "Belum Ada Sanksi";
              const indicatorClass =
                tanpaKeterangan >= 5 ? "bg-red-500" :
                  tanpaKeterangan === 4 ? "bg-orange-500" :
                    tanpaKeterangan >= 2 ? "bg-yellow-400" :
                      "bg-slate-200";
              return (
                <div key={r.pegawaiId} className="rounded-xl border border-slate-700/50 bg-slate-900/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${indicatorClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-white text-sm font-semibold truncate">{r.pegawai.nama}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5 truncate">NIP {r.pegawai.nip}</div>
                      <div className="text-slate-400 text-xs mt-1 truncate">Bidang/UPT: {r.pegawai.bidang}</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-amber-200/10">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs">Tanpa Keterangan</span>
                      <span className="text-red-400 text-sm font-black">{tanpaKeterangan}x</span>
                    </div>
                    <div className="mt-1 text-sm font-black text-white">{sanctionText}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setShowAllPerhatian(prev => !prev)}
            className="mt-3 w-full py-2.5 rounded-xl bg-slate-900/80 text-slate-300 text-xs font-bold border border-slate-700/70 hover:border-amber-200/25 hover:text-amber-100 active:scale-[0.98] transition-all"
          >
            {showAllPerhatian ? "Tutup Detail" : "Lihat Semua"}
          </button>
        </Card>

        {/* Kehadiran per Bidang */}
        <div className="mb-2">
          <Card className="p-4 border-amber-200/15 bg-slate-950/65 shadow-[0_18px_55px_rgba(0,0,0,0.26)]">
            <div className="mb-4 border-b border-amber-200/10 pb-3">
              <div className="text-amber-100/90 text-xs font-semibold uppercase tracking-[0.18em]">Kehadiran Per Bidang</div>
              <div className="text-slate-600 text-[11px] mt-0.5">Analitik performa bidang hari ini dan bulan lalu</div>
            </div>

            {!isDitiadakan && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/55 p-3.5 mb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-slate-50 text-sm font-black">🏆 Peringkat Hari Ini</div>
                  <div className="text-slate-500 text-[11px]">Berdasarkan data absensi realtime</div>
                </div>
                <button
                  onClick={() => setShowAllBidangToday(prev => !prev)}
                  className="text-xs text-slate-300 font-bold rounded-lg bg-slate-950/80 border border-slate-700/70 px-2.5 py-1.5 hover:border-amber-200/25 hover:text-amber-100 active:scale-[0.98] transition-all"
                >
                  {showAllBidangToday ? "Tutup" : "Lihat Semua"}
                </button>
              </div>

              <div className="space-y-2">
                {visibleTodayRanking.map((b, index) => {
                  const status = getBidangPerformanceStatus(b.stats.persen);
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBidang(b)}
                      className="w-full rounded-xl border border-slate-700/55 bg-slate-950/55 p-3 text-left transition-all active:scale-[0.98] hover:border-amber-200/25 hover:bg-slate-900/70"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 text-xl text-center drop-shadow-[0_0_8px_rgba(245,158,11,0.18)]">{RANK_MEDALS[index] || `#${index + 1}`}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-white text-sm font-bold truncate">{b.nama}</div>
                          <div className={`text-[11px] font-semibold ${status.color}`}>{status.label}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-lg font-black ${b.stats.persen >= 80 ? "text-emerald-400" : b.stats.persen >= 60 ? "text-amber-400" : "text-red-400"}`}>{b.stats.persen}%</div>
                          <div className="text-slate-600 text-[10px]">{b.stats.hadir}/{b.stats.total}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            <div className="rounded-xl border border-slate-700/50 bg-slate-900/55 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-slate-50 text-sm font-black">🏅 Disiplin Bulan Lalu</div>
                  <div className="text-slate-500 text-[11px]">Data dummy untuk tahap prototipe</div>
                </div>
                <button
                  onClick={() => setShowAllLastMonth(prev => !prev)}
                  className="text-xs text-slate-300 font-bold rounded-lg bg-slate-950/80 border border-slate-700/70 px-2.5 py-1.5 hover:border-amber-200/25 hover:text-amber-100 active:scale-[0.98] transition-all"
                >
                  {showAllLastMonth ? "Tutup" : "Lihat Semua"}
                </button>
              </div>

              <div className="space-y-2">
                {visibleLastMonthRanking.map((b, index) => {
                  const status = getBidangPerformanceStatus(b.persen);
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBidang(b)}
                      className="w-full rounded-xl border border-slate-700/55 bg-slate-950/55 p-3 text-left transition-all active:scale-[0.98] hover:border-amber-200/25 hover:bg-slate-900/70"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 text-xl text-center drop-shadow-[0_0_8px_rgba(245,158,11,0.18)]">{RANK_MEDALS[index] || `#${index + 1}`}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-white text-sm font-bold truncate">{b.nama}</div>
                          <div className={`text-[11px] font-semibold ${status.color}`}>{status.label}</div>
                        </div>
                        <div className="text-lg font-black text-blue-300 shrink-0">{b.persen}%</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* ─── PERUBAHAN STATUS HARI INI - PIMPINAN (RINGKASAN) ─── */}
          {!isDitiadakan && (
          <Card className="p-4 mb-4 border-slate-600/40 bg-slate-950/65">
            <div className="mb-3 border-b border-slate-700/50 pb-3">
              <div className="text-slate-50 font-bold text-sm">📋 Perubahan Status Hari Ini</div>
              <div className="text-slate-500 text-xs mt-0.5">Monitoring perubahan absensi pegawai</div>
            </div>

            {PENGJUAN_STATUS_DATA.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-4">
                Belum ada perubahan status hari ini
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="text-center mb-4">
                  <div className="text-2xl font-black text-white mb-1">{PENGJUAN_STATUS_DATA.length}</div>
                  <div className="text-slate-500 text-xs">Perubahan Status</div>
                </div>

                {/* Status Breakdown */}
                <div className="flex justify-center gap-6 mb-4">
                  {[
                    { status: "Dinas Luar", icon: "🚗" },
                    { status: "Izin", icon: "📝" },
                    { status: "Sakit", icon: "🤒" },
                  ].map(item => {
                    const count = PENGJUAN_STATUS_DATA.filter(p => p.statusBaru === item.status).length;
                    if (count === 0) return null;
                    return (
                      <div key={item.status} className="text-center">
                        <div className="text-xl mb-0.5">{item.icon}</div>
                        <div className="text-white text-sm font-bold">{count}</div>
                        <div className="text-slate-600 text-[10px]">{item.status}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Button */}
                <button
                  onClick={() => setShowDetailPengajuan(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors border border-slate-700/50"
                >
                  Lihat Detail
                </button>
              </>
            )}
          </Card>
          )}

          {/* DETAIL PENGJUAN MODAL - PIMPINAN */}
          {showDetailPengajuan && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold">📋 Perubahan Status Hari Ini</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Monitoring perubahan absensi pegawai</p>
                  </div>
                  <button onClick={() => setShowDetailPengajuan(false)} className="text-slate-400 hover:text-white">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="space-y-3">
                  {PENGJUAN_STATUS_DATA.map((p, i) => (
                    <div key={p.id} className="border-t border-slate-800/60 pt-3 first:border-t-0 first:pt-0">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-slate-400">🔄</span>
                        <span className="text-white text-sm font-semibold">{p.nama}</span>
                      </div>
                      <div className="text-slate-600 text-[10px] mb-2 ml-6">NIP: {p.nip}</div>

                      {/* Status Change */}
                      <div className="bg-slate-800/60 rounded-xl p-3 mb-2 ml-6">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs">{p.statusLama}</span>
                          <span className="text-slate-600">↓</span>
                          <span className="text-sm">{getStatusIcon(p.statusBaru).icon}</span>
                          <span className="text-blue-300 text-xs">{getStatusIcon(p.statusBaru).label}</span>
                        </div>
                      </div>

                      {/* Document & Time */}
                      <div className="flex items-center gap-4 text-slate-500 text-xs ml-6 mb-2">
                        <span>📄 {p.dokumen}</span>
                        <span>🕘 {p.waktu} WIB</span>
                      </div>

                      {/* Status Badge */}
                      <div className="ml-6">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          p.statusVerifikasi === "disetujui"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}>
                          {p.statusVerifikasi === "disetujui" ? "🟢 Disetujui" : "🟡 Menunggu Verifikasi"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowDetailPengajuan(false)}
                  className="w-full mt-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors border border-slate-700/50"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: DASHBOARD ADMIN
// ══════════════════════════════════════════════════════════════════════════════
const DashboardAdmin = ({ attendance, apelStatus, apelSession, apelReason, apelReasonText, onAppealPhaseChange, onApelReasonChange, onScanSimulate, onReset, onBack, onKoreksi }) => {
  const [now, setNow] = useState(new Date());
  const [currentQr, setCurrentQr] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [showFullscreenQr, setShowFullscreenQr] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [customReasonText, setCustomReasonText] = useState("");
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const stats = calcAttendanceStats(attendance, apelStatus);

const DEV_MODE = true;

const qrActive = apelStatus === "ongoing";

  const exitFullscreenQr = useCallback(() => {
    setShowFullscreenQr(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((error) => {
        console.error("Failed to exit fullscreen QR mode:", error);
      });
    }
  }, []);

  const enterFullscreenQr = useCallback(() => {
    setShowFullscreenQr(true);
    document.documentElement.requestFullscreen?.().catch((error) => {
      console.error("Failed to enter fullscreen QR mode:", error);
    });
  }, []);

  useEffect(() => {
    if (!qrActive) return;

    const generateAndStoreToken = () => {
      const issuedAt = Date.now();
      const qrData = {
        token: createQrToken(),
        issuedAt,
        expiresAt: issuedAt + QR_TOKEN_TTL_MS,
      };
      setCurrentQr(qrData);
      set(ref(database, QR_PATH), qrData).catch((error) => {
        console.error("Failed to store QR token:", error);
      });
    };

    generateAndStoreToken();
    const tokenTimer = setInterval(generateAndStoreToken, QR_TOKEN_TTL_MS);
    return () => clearInterval(tokenTimer);
  }, [qrActive]);

  useEffect(() => {
    if (!showFullscreenQr) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowFullscreenQr(false);
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setShowFullscreenQr(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [showFullscreenQr]);

const secsLeft = qrActive && currentQr ? Math.max(0, Math.ceil((currentQr.expiresAt - now.getTime()) / 1000)) : 0;

  if (showFullscreenQr) {
    return <FullscreenQR currentQr={currentQr} qrActive={qrActive} secsLeft={secsLeft} onExit={exitFullscreenQr} />;
  }

  if (activeMenu === "absensi") {
    const q = attendanceSearch.trim().toLowerCase();
    const filteredPegawai = pegawaiData.filter(p => {
      const searchable = `${p.nama} ${p.nip} ${p.bidang} ${p.jabatan}`.toLowerCase();
      return !q || searchable.includes(q);
    });

    return (
      <div className="min-h-screen bg-[#080c14] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => setActiveMenu(null)} />
          <h2 className="text-xl font-black text-white mb-1">Absensi Hari Ini</h2>
          <p className="text-slate-500 text-xs mb-5">{now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>

          <div className="relative mb-4">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={attendanceSearch}
              onChange={e => setAttendanceSearch(e.target.value)}
              placeholder="Cari nama, NIP, bidang atau UPT..."
              className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            {filteredPegawai.map(p => {
              const att = attendance[p.id];
              return (
                <Card key={p.id} className="p-3.5">
                  <div className="mb-3">
                    <div className="text-white text-sm font-semibold leading-snug">{p.nama}</div>
                    <div className="text-slate-500 text-xs mt-1">NIP: {p.nip}</div>
                    <div className="text-slate-500 text-xs">Bidang / UPT: {p.bidang}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px] uppercase font-semibold tracking-wider mb-1">Status Saat Ini</div>
                    {att?.status ? <StatusBadge status={att.status} /> : <StatusBadge status="Belum" />}
                  </div>
                </Card>
              );
            })}
            {filteredPegawai.length === 0 && (
              <Card className="p-6 text-center">
                <div className="text-slate-400 text-sm">Pegawai tidak ditemukan</div>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (activeMenu === "koreksi") {
    const tks = Object.entries(attendance)
      .filter(([, v]) => v.status === "Tanpa Keterangan")
      .map(([id]) => pegawaiData.find(p => p.id === parseInt(id)))
      .filter(Boolean);
    return (
      <div className="min-h-screen bg-[#080c14] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => setActiveMenu(null)} />
          <h2 className="text-xl font-black text-white mb-1">Koreksi Absensi</h2>
          <p className="text-slate-500 text-xs mb-5">Ubah status Tanpa Keterangan</p>
          {tks.length === 0 ? (
            <Card className="p-6 text-center">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-slate-400">Tidak ada yang perlu dikoreksi</div>
            </Card>
          ) : (
            <div className="space-y-3">
              {tks.map(p => (
                <Card key={p.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="text-white text-sm font-semibold truncate">{p.nama}</div>
                      <div className="text-slate-500 text-xs">{p.bidang}</div>
                    </div>
                    <StatusBadge status="Tanpa Keterangan" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["Izin", "Sakit", "Dinas Dalam", "Dinas Luar"].map(s => (
                      <button key={s} onClick={() => onKoreksi(p.id, s)}
                        className="text-xs py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 transition-all active:scale-[0.97]">
                        → {s}
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeMenu === "laporan") {
    const bidangStats = orgData.bidang.filter(b => b.id !== "pimpinan").map(b => {
      const members = pegawaiData.filter(p => p.bidang === b.nama);
      let hadir = 0, tanpaKet = 0, izin = 0, sakit = 0, dinasD = 0, dinasL = 0;
      for (const p of members) {
        const att = attendance[p.id];
        if (!att?.status) continue;
        if (att.status === "Hadir") hadir++;
        else if (att.status === "Tanpa Keterangan") tanpaKet++;
        else if (att.status === "Izin") izin++;
        else if (att.status === "Sakit") sakit++;
        else if (att.status === "Dinas Dalam") dinasD++;
        else if (att.status === "Dinas Luar") dinasL++;
      }
      return { ...b, total: members.length, hadir, tanpaKet, izin, sakit, dinasD, dinasL };
    }).filter(b => b.total > 0);

    return (
      <div className="min-h-screen bg-[#080c14] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => setActiveMenu(null)} />
          <h2 className="text-xl font-black text-white mb-1">Laporan Harian</h2>
          <p className="text-slate-500 text-xs mb-5">{now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>

          <Card className="p-4 mb-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-2xl font-black text-white">{stats.total}</div><div className="text-slate-500 text-xs">Total</div></div>
              <div><div className="text-2xl font-black text-emerald-400">{stats.hadir}</div><div className="text-slate-500 text-xs">Hadir</div></div>
              <div><div className="text-2xl font-black text-amber-400">{stats.persen}%</div><div className="text-slate-500 text-xs">Persentase</div></div>
            </div>
          </Card>

          <div className="space-y-2">
            {bidangStats.map(b => (
              <Card key={b.id} className="p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white text-sm font-semibold">{b.nama}</div>
                  <div className="text-emerald-400 font-bold text-sm">{b.total > 0 ? Math.round((b.hadir / b.total) * 100) : 0}%</div>
                </div>
                <div className="flex gap-3 text-xs text-slate-400 flex-wrap gap-y-1">
                  <span>✅ {b.hadir}</span>
                  <span>🚫 {b.tanpaKet}</span>
                  <span>🏢 {b.dinasD}</span>
                  <span>🚗 {b.dinasL}</span>
                  <span>📄 {b.izin}</span>
                  <span>🤒 {b.sakit}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeMenu === "kelola") {
    return (
      <div className="min-h-screen bg-[#080c14] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => setActiveMenu(null)} />
          <h2 className="text-xl font-black text-white mb-1">Kelola Pegawai</h2>
          <p className="text-slate-500 text-xs mb-5">{pegawaiData.length} pegawai terdaftar</p>
          <div className="space-y-2">
            {orgData.bidang.filter(b => b.id !== "pimpinan").map(b => {
              const count = pegawaiData.filter(p => p.bidang === b.nama).length;
              if (!count) return null;
              return (
                <Card key={b.id} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm font-semibold">{b.nama}</div>
                      <div className="text-slate-500 text-xs">{b.kepala}</div>
                    </div>
                    <span className="text-slate-400 text-sm font-bold">{count}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />
        {DEV_MODE && (
  <div className="flex gap-2 mb-4">
    <button
      onClick={() => onAppealPhaseChange(APEL_SESSIONS.BEFORE)}
      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
        apelStatus === "before"
          ? "bg-slate-600 text-white"
          : "bg-slate-800 text-slate-400"
      }`}
    >
      Sebelum
    </button>

    <button
      onClick={() => onAppealPhaseChange(APEL_SESSIONS.ONGOING)}
      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
        apelStatus === "ongoing"
          ? "bg-emerald-600 text-white"
          : "bg-slate-800 text-slate-400"
      }`}
    >
      Saat Apel
    </button>

    <button
      onClick={() => onAppealPhaseChange(APEL_SESSIONS.ENDED)}
      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
        apelStatus === "ended"
          ? "bg-red-600 text-white"
          : "bg-slate-800 text-slate-400"
      }`}
    >
      Setelah
    </button>

    <button
      onClick={() => {
        onAppealPhaseChange(APEL_SESSIONS.DITIADAKAN);
        setShowReasonModal(true);
      }}
      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
        apelStatus === "ditiadakan"
          ? "bg-amber-600 text-white"
          : "bg-slate-800 text-slate-400"
      }`}
    >
      Ditiadakan
    </button>
  </div>
)}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-white">Admin Panel</h1>
            <p className="text-slate-500 text-xs">{formatTime(now)}</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            apelStatus === "ditiadakan"
              ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
              : qrActive
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-slate-800 border-slate-700 text-slate-500"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              apelStatus === "ditiadakan"
                ? "bg-amber-400"
                : qrActive
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-slate-600"
            }`} />
            {apelStatus === "ditiadakan" ? "Ditiadakan" : qrActive ? "Apel Aktif" : apelStatus === "before" ? "Menunggu" : "Selesai"}
          </div>
        </div>

        {/* Stats Bar - Jika Ditiadakan, tampilkan alasan */}
        {apelStatus === "ditiadakan" ? (
          <Card className="p-4 mb-5 border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-xl">⚠️</div>
              <div>
                <div className="text-amber-400 font-bold text-sm">Apel Hari Ini Ditiadakan</div>
                <div className="text-amber-300/70 text-xs">{apelReason === "lainnya" ? apelReasonText : REASON_OPTIONS.find(r => r.id === apelReason)?.label || "Ditiadakan"}</div>
              </div>
            </div>
            <div className="text-slate-400 text-xs">
              Status dan alasan ditiadakan berhasil disimpan.
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-2 mb-5">
            {getAttendanceStatItems(apelStatus).map(item => ({ label: item.label, val: stats[item.key], icon: item.icon, color: item.color })).map(s => (
              <Card key={s.label} className="p-3 text-center">
                <div className="text-lg mb-0.5">{s.icon}</div>
                <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
                <div className="text-slate-400 text-xs">{s.label}</div>
              </Card>
            ))}
          </div>
        )}
{/* QR BESAR - Jika ditiadakan, sembunyikan */}
        {apelStatus !== "ditiadakan" && (
        <Card className={`p-5 mb-5 flex flex-col items-center ${qrActive ? "border-emerald-500/30" : "border-slate-700/50"}`}>
  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
    {qrActive ? "QR Apel Aktif" : "QR Apel Nonaktif"}
  </p>

  <div className={`relative ${!qrActive && "opacity-30 grayscale"}`}>
    <QRDisplay token={currentQr?.token} />

    {qrActive && (
      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
        {secsLeft}
      </div>
    )}
  </div>

  {qrActive && currentQr?.token && (
    <div className="mt-3 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-2xl font-black font-mono">
      {currentQr.token}
    </div>
  )}

  {qrActive ? (
    <p className="text-slate-500 text-xs mt-3 text-center">
      Berganti setiap 10 detik · Aktif hingga 08:00
    </p>
  ) : (
    <p className="text-slate-600 text-xs mt-3 text-center">
      {apelStatus === "before"
        ? "QR aktif otomatis pada pukul 07:00"
        : "Sesi apel telah berakhir pukul 08:00"}
    </p>
  )}
  <button
    onClick={enterFullscreenQr}
    disabled={!qrActive}
    className={`mt-4 w-full rounded-xl py-3 text-sm font-black transition-all active:scale-[0.98] ${
      qrActive
        ? "bg-white text-slate-950 hover:bg-slate-200"
        : "cursor-not-allowed bg-slate-800 text-slate-600"
    }`}
  >
    Fullscreen QR
  </button>
</Card>
        )}


        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { id: "absensi", label: "Absensi Hari Ini", icon: "📋", color: "from-cyan-500/20 to-sky-500/10", border: "hover:border-cyan-500/50" },
            { id: "kelola", label: "Kelola Pegawai", icon: "👥", color: "from-blue-500/20 to-indigo-500/10", border: "hover:border-blue-500/50" },
            { id: "koreksi", label: "Koreksi Absensi", icon: "✏️", color: "from-amber-500/20 to-yellow-500/10", border: "hover:border-amber-500/50" },
            { id: "laporan", label: "Laporan Harian", icon: "📊", color: "from-emerald-500/20 to-teal-500/10", border: "hover:border-emerald-500/50" },
            { id: "pengajuan", label: "Pengajuan Status", icon: "📥", color: "from-orange-500/20 to-red-500/10", border: "hover:border-orange-500/50" },
            { id: "demo", label: "Demo Tools", icon: "🧪", color: "from-violet-500/20 to-purple-500/10", border: "hover:border-violet-500/50" },
          ].map(m => (
            <button key={m.id} onClick={() => setActiveMenu(m.id)}
              className={`text-left p-4 rounded-xl bg-gradient-to-br ${m.color} border border-slate-700/60 ${m.border} transition-all duration-150 active:scale-[0.97]`}>
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className="text-white text-sm font-semibold">{m.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* REASON MODAL - Untuk memilih alasan ditiadakan */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">⚠️ Alasan Apel Ditiadakan</h3>
              <button onClick={() => {
                setShowReasonModal(false);
                // Jika tidak ada alasan dipilih, revert ke ongoing
                if (!apelReason) {
                  onAppealPhaseChange(APEL_SESSIONS.ONGOING);
                }
              }} className="text-slate-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-slate-500 text-xs mb-4">Pilih alasan mengapa apel ditiadakan</p>

            <div className="space-y-2 mb-4">
              {REASON_OPTIONS.map(reason => (
                <button
                  key={reason.id}
                  onClick={() => {
                    if (reason.id === "lainnya") {
                      setCustomReasonText(apelReasonText);
                      // Show custom text input inline
                    } else {
                      onApelReasonChange(reason.id);
                      setShowReasonModal(false);
                    }
                  }}
                  className={`w-full text-left p-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${
                    apelReason === reason.id
                      ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50"
                  }`}
                >
                  <span className="mr-2">{reason.icon}</span>
                  {reason.label}
                </button>
              ))}
            </div>

            {/* Custom text input for "Lainnya" */}
            {apelReason === "lainnya" && (
              <div className="mb-4">
                <label className="text-slate-400 text-xs mb-2 block">Ketik alasan:</label>
                <textarea
                  value={customReasonText}
                  onChange={(e) => setCustomReasonText(e.target.value)}
                  placeholder="Masukkan alasan lainnya..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none"
                  rows={3}
                />
                <button
                  onClick={() => {
                    if (customReasonText.trim()) {
                      onApelReasonChange("lainnya", customReasonText);
                      setShowReasonModal(false);
                    }
                  }}
                  disabled={!customReasonText.trim()}
                  className={`mt-2 w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
                    customReasonText.trim()
                      ? "bg-amber-600 hover:bg-amber-500 text-white"
                      : "bg-slate-800 text-slate-600 cursor-not-allowed"
                  }`}
                >
                  Simpan Alasan
                </button>
              </div>
            )}

            <button
              onClick={() => {
                onAppealPhaseChange(APEL_SESSIONS.ONGOING);
                setShowReasonModal(false);
              }}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all active:scale-[0.98]"
            >
              Batalkan Ditiadakan
            </button>
          </div>
        </div>
      )}

      {/* PENGJUAN STATUS MODAL - Admin */}
      {activeMenu === "pengajuan" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">📥 Pengajuan Perubahan Status</h3>
              <button onClick={() => setActiveMenu(null)} className="text-slate-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-slate-500 text-xs mb-4">Verifikasi pengajuan perubahan status pegawai</p>

            {/* List pengajuan using dummy data */}
            {PENGJUAN_STATUS_DATA.map((p, i) => (
              <div key={p.id}>
                {i > 0 && <div className="border-t border-slate-800 my-4" />}
                {/* Pegawai Info */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-slate-400">👤</span>
                  <span className="text-white text-sm font-semibold">{p.nama}</span>
                </div>
                <div className="text-slate-600 text-[10px] mb-3 ml-6">NIP: {p.nip}</div>

                {/* Status Saat Ini */}
                <div className="text-slate-500 text-[10px] mb-1 ml-6">Status Saat Ini:</div>
                <div className="bg-slate-800/60 rounded-xl p-2 mb-2 ml-6">
                  <span className="text-slate-400 text-xs">{p.statusLama}</span>
                </div>

                {/* Pengajuan */}
                <div className="text-slate-500 text-[10px] mb-1 ml-6">Pengajuan:</div>
                <div className="bg-slate-800/60 rounded-xl p-2 mb-2 ml-6">
                  <span className="text-sm">{getStatusIcon(p.statusBaru).icon}</span>
                  <span className="text-blue-300 text-xs ml-1">{getStatusIcon(p.statusBaru).label}</span>
                </div>

                {/* Dokumen */}
                <div className="flex items-center gap-2 text-slate-500 text-xs mb-2 ml-6">
                  <span>📄</span>
                  <span>{p.dokumen}</span>
                </div>

                {/* Waktu & Status */}
                <div className="flex items-center gap-3 text-slate-500 text-xs mb-3 ml-6">
                  <span>🕘 {p.waktu} WIB</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.statusVerifikasi === "disetujui"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}>
                    {p.statusVerifikasi === "disetujui" ? "🟢 Disetujui" : "🟡 Menunggu"}
                  </span>
                </div>

                {/* Action Buttons */}
                {p.statusVerifikasi === "menunggu" && (
                  <div className="flex gap-2 ml-6">
                    <button className="flex-1 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors">
                      Lihat
                    </button>
                    <button className="flex-1 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors border border-emerald-500/30">
                      Setujui
                    </button>
                    <button className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors border border-red-500/30">
                      Tolak
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEMO TOOLS MODAL */}
      {activeMenu === "demo" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">🧪 Demo Tools</h3>
              <button onClick={() => setActiveMenu(null)} className="text-slate-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-slate-500 text-xs mb-4">Simulasi massal untuk demonstrasi</p>
            <div className="space-y-2">
              {[
                { label: "Tambah 1 Hadir", count: 1, color: "bg-slate-800 hover:bg-slate-700 text-slate-300" },
                { label: "Tambah 5 Hadir", count: 5, color: "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30" },
                { label: "Tambah 10 Hadir", count: 10, color: "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30" },
              ].map(item => (
                <button key={item.count} onClick={() => { onScanSimulate(item.count); }}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${item.color}`}>
                  {item.label}
                </button>
              ))}
              <div className="border-t border-slate-700/50 pt-2 mt-2">
                <button onClick={() => { onReset(); setActiveMenu(null); }}
                  className="w-full py-3 rounded-xl font-semibold text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all active:scale-[0.98]">
                  🔄 Reset Simulasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("role");
  const [role, setRole] = useState(null);
  const [activePegawai, setActivePegawai] = useState(null);
  const [attendance, setAttendance] = useState(buildInitialAttendance);
  const [apelSession, setApelSession] = useState(APEL_SESSIONS.ONGOING); // sebelum/saat/sesudah/ditiadakan
  const [apelReason, setApelReason] = useState(null); // alasan penaltiadakan
  const [apelReasonText, setApelReasonText] = useState(""); // teks alasan custom (jika lainnya)

  // Calculate apelStatus based on session and time
  const apelStatus = getApelStatus(new Date(), apelSession);

  useEffect(() => {
    const attendanceRef = ref(database, ATTENDANCE_PATH);
    return onValue(attendanceRef, (snapshot) => {
      if (snapshot.val() === null) {
        const initialAttendance = buildInitialAttendance();
        setAttendance(initialAttendance);
        set(attendanceRef, initialAttendance);
        return;
      }

      setAttendance(snapshot.val());
    }, (error) => {
      console.error("Failed to load realtime attendance:", error);
    });
  }, []);

  // Firebase subscription untuk session dan alasan apel
  useEffect(() => {
    const sessionRef = ref(database, APEL_SESSION_PATH);
    const reasonRef = ref(database, APEL_REASON_PATH);

    const unsubSession = onValue(sessionRef, (snapshot) => {
      const val = snapshot.val();
      if (val) setApelSession(val);
    });

    const unsubReason = onValue(reasonRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        if (typeof val === "object") {
          setApelReason(val.id || "lainnya");
          setApelReasonText(val.text || "");
        } else {
          setApelReason(val);
          setApelReasonText("");
        }
      }
    });

    return () => {
      unsubSession();
      unsubReason();
    };
  }, []);

  const handleApelSessionChange = (session) => {
    setApelSession(session);
    set(ref(database, APEL_SESSION_PATH), session);
    // Jika bukan ditiadakan, hapus reason
    if (session !== APEL_SESSIONS.DITIADAKAN) {
      setApelReason(null);
      setApelReasonText("");
      set(ref(database, APEL_REASON_PATH), null);
    }
  };

  const handleApelReasonChange = (reasonId, customText = "") => {
    setApelReason(reasonId);
    if (reasonId === "lainnya") {
      setApelReasonText(customText);
      set(ref(database, APEL_REASON_PATH), { id: "lainnya", text: customText });
    } else {
      setApelReasonText("");
      set(ref(database, APEL_REASON_PATH), reasonId);
    }
  };

  const handleRoleSelect = (r) => {
    setRole(r);
    if (r === "pimpinan") setPage("pimpinan");
    else if (r === "admin") setPage("admin");
    else setPage("pegawai_login");
  };

  const handlePegawaiLogin = (p) => {
    setActivePegawai(p);
    setPage("pegawai_dashboard");
  };

  const handleScan = (pegawaiId) => {
    if (attendance[pegawaiId]?.status === "Hadir") return;

    const jamNow = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    set(ref(database, `${ATTENDANCE_PATH}/${pegawaiId}`), { status: "Hadir", jamHadir: jamNow });
  };

  const handleScanSimulate = (count) => {
    const finalStatuses = new Set(["Hadir", "Dinas Dalam", "Dinas Luar", "Izin", "Sakit"]);
    const belum = pegawaiData
      .filter(p => !finalStatuses.has(attendance[p.id]?.status))
      .map(p => p.id);
    const toScan = belum.slice(0, count);
    if (toScan.length === 0) return;
    const jamNow = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const updates = {};
    for (const id of toScan) updates[id] = { status: "Hadir", jamHadir: jamNow };
    update(ref(database, ATTENDANCE_PATH), updates);
  };

  const handleReset = () => set(ref(database, ATTENDANCE_PATH), buildInitialAttendance());

  const handleKoreksi = (pegawaiId, newStatus) => {
    const currentAttendance = attendance[pegawaiId] || { status: null, jamHadir: null };
    set(ref(database, `${ATTENDANCE_PATH}/${pegawaiId}`), { ...currentAttendance, status: newStatus });
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>
      {page === "role" && <RoleSelector onSelect={handleRoleSelect} />}
      {page === "pegawai_login" && <PegawaiLogin onBack={() => setPage("role")} onLogin={handlePegawaiLogin} />}
      {page === "pegawai_dashboard" && activePegawai && (
        <DashboardPegawai
          pegawai={activePegawai}
          attendance={attendance}
          apelStatus={apelStatus}
          apelSession={apelSession}
          apelReason={apelReason}
          apelReasonText={apelReasonText}
          onScan={handleScan}
          onBack={() => setPage("pegawai_login")}
        />
      )}
      {page === "pimpinan" && (
        <DashboardPimpinan
          attendance={attendance}
          apelStatus={apelStatus}
          apelSession={apelSession}
          apelReason={apelReason}
          apelReasonText={apelReasonText}
          onBack={() => setPage("role")}
        />
      )}
      {page === "admin" && (
        <DashboardAdmin
          attendance={attendance}
          apelStatus={apelStatus}
          apelSession={apelSession}
          apelReason={apelReason}
          apelReasonText={apelReasonText}
          onAppealPhaseChange={handleApelSessionChange}
          onApelReasonChange={handleApelReasonChange}
          onScanSimulate={handleScanSimulate}
          onReset={handleReset}
          onBack={() => setPage("role")}
          onKoreksi={handleKoreksi}
        />
      )}
    </div>
  );
}
