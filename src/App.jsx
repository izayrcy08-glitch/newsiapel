import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ref, get, onValue, set, update } from "firebase/database";
import { database } from "./firebase";
import pegawaiData from "./data/pegawai.json";
import orgData from "./data/organization.json";
import attendanceData from "./data/attendance.json";
import sanctionsData from "./data/sanctions.json";
import { REASON_OPTIONS } from "./constants/reasons";
import { PENGJUAN_STATUS_DATA } from "./constants/statusChanges";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import BackButton from "./shared/ui/BackButton";
import Card from "./shared/ui/Card";
import ProgressRing from "./shared/ui/ProgressRing";
import {
  calcAttendanceStats,
  getAttendanceStatItems,
  getDisciplineStatus,
  getStatusIcon,
  isApelDitiadakan,
  TANPA_KETERANGAN_BULAN_INI,
} from "./shared/utils/attendance";
import { getGreeting } from "./shared/utils/time";

const STATUS_OPTIONS = ["Dinas Dalam", "Dinas Luar", "Izin", "Sakit"];

// ─── UTILS ───────────────────────────────────────────────────────────────────
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

const STATUS_COLORS = {
  Hadir: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  "Tanpa Keterangan": { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-400" },
  "Belum Melakukan Absensi": { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30", dot: "bg-slate-400" },
  "Dinas Dalam": { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30", dot: "bg-blue-400" },
  "Dinas Luar": { bg: "bg-violet-500/20", text: "text-violet-400", border: "border-violet-500/30", dot: "bg-violet-400" },
  Izin: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30", dot: "bg-amber-400" },
  Sakit: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30", dot: "bg-orange-400" },
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
const DashboardPegawai = EmployeeDashboard;

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: DASHBOARD PIMPINAN
// ══════════════════════════════════════════════════════════════════════════════
const DashboardPimpinan = ExecutiveDashboard;

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
  const [currentQr, setCurrentQr] = useState(null); // QR current dari Firebase
  const [isQrReady, setIsQrReady] = useState(false); // QR readiness state

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

  // Firebase subscription untuk qr/current - QR readiness state
  useEffect(() => {
    const qrRef = ref(database, QR_PATH);
    const unsubscribe = onValue(qrRef, (snapshot) => {
      const val = snapshot.val();
      setCurrentQr(val);
      setIsQrReady(!!val);
    });
    return unsubscribe;
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
          validateQrToken={validateQrToken}
          PengajuanStatusForm={PengajuanStatusForm}
          TokenFeedback={TokenFeedback}
          currentQr={currentQr}
          isQrReady={isQrReady}
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
