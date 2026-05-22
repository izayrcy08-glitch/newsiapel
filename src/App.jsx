import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import { ref, get, onValue, set, update } from "firebase/database";
import { database } from "./firebase";
import pegawaiData from "./data/pegawai.json";
import orgData from "./data/organization.json";
import attendanceData from "./data/attendance.json";
import sanctionsData from "./data/sanctions.json";

// ─── UTILS ───────────────────────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 11) return "Selamat Pagi";
  if (h < 15) return "Selamat Siang";
  if (h < 18) return "Selamat Sore";
  return "Selamat Malam";
};

const getApelStatus = (now) => {
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
const QR_PATH = "qr/current";
const QR_TOKEN_TTL_MS = 15000;

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

// ─── QR CODE GENERATOR ───────────────────────────────────────────────────────
const QRDisplay = ({ token }) => {
  return (
    <QRCodeSVG
      value={token || "SIAPEL-QR-INACTIVE"}
      size={200}
      bgColor="#ffffff"
      fgColor="#0f172a"
      level="M"
      includeMargin
      className="rounded-xl"
    />
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
const Countdown = ({ targetHour }) => {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(targetHour, 0, 0, 0);
      setSecs(Math.max(0, Math.floor((target - now) / 1000)));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetHour]);
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/30 to-indigo-600/30 border border-blue-500/30 mb-4 shadow-lg shadow-blue-500/10">
            <span className="text-3xl">🏛️</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">SIAPEL</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium tracking-wide">Sistem Informasi Apel Pegawai</p>
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
const DashboardPegawai = ({ pegawai, attendance, onScan, onBack }) => {
  const [now, setNow] = useState(new Date());
  const [showScanner, setShowScanner] = useState(false);
  const [showManualCode, setShowManualCode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);
  const isValidatingScan = useRef(false);
  const apelStatus = "ongoing";
  const myAttendance = attendance[pegawai.id] || { status: null, jamHadir: null };
  const stats = calcStats(attendance);
  const sudahAbsen = myAttendance.status === "Hadir";

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
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
    if (!manualCode.trim()) return;
    try {
      handleValidationSuccess(await validateQrToken(manualCode));
    } catch (error) {
      console.error("Failed to validate manual QR code:", error);
      setScanResult({ type: "invalid", label: "INVALID TOKEN" });
    }
  };

  const statItems = [
    { label: "Hadir", value: stats.hadir, color: "text-emerald-400", icon: "✅" },
    { label: "Tanpa Ket.", value: stats.tanpaKet, color: "text-red-400", icon: "🚫" },
    { label: "Dinas Dalam", value: stats.dinasD, color: "text-blue-400", icon: "🏢" },
    { label: "Dinas Luar", value: stats.dinasL, color: "text-violet-400", icon: "🚗" },
    { label: "Izin", value: stats.izin, color: "text-amber-400", icon: "📄" },
    { label: "Sakit", value: stats.sakit, color: "text-orange-400", icon: "🤒" },
  ];
/*
    { label: "Hadir", value: stats.hadir, color: "text-emerald-400", icon: "✅" },
    { label: "Tanpa Ket.", value: stats.tanpaKet, color: "text-red-400", icon: "🚫" },
    { label: "Dinas Dalam", value: stats.dinasD, color: "text-blue-400", icon: "🏢" },
    { label: "Dinas Luar", value: stats.dinasL, color: "text-violet-400", icon: "🚗" },
    { label: "Izin", value: stats.izin, color: "text-amber-400", icon: "📄" },
    { label: "Sakit", value: stats.sakit, color: "text-orange-400", icon: "🤒" },
*/

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

        {/* Status Card */}
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Status Hari Ini</span>
            <span className="text-slate-500 text-xs">{now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>

          {myAttendance.status ? (
            <div className="flex items-center justify-between">
              <StatusBadge status={myAttendance.status} />
              {myAttendance.jamHadir && (
                <div className="text-right">
                  <div className="text-white font-bold">{myAttendance.jamHadir} WIB</div>
                  <div className="text-slate-500 text-xs">Jam Hadir</div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
              <span className="text-slate-500 text-sm">Belum Hadir</span>
            </div>
          )}
        </Card>

        {/* Apel Status */}
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

        {attendanceSuccess && (
          <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-center font-black tracking-wide text-emerald-300">
            ✓ Kehadiran berhasil dicatat
          </div>
        )}

        {/* Scan QR Button */}
        {!sudahAbsen ? (
          <>
          <button
  onClick={() => apelStatus === "ongoing" && setShowScanner(true)}
            disabled={apelStatus !== "ongoing"}
            className={`w-full py-4 rounded-2xl font-black text-lg tracking-tight transition-all duration-200 active:scale-[0.98] mb-6 ${apelStatus === "ongoing"
              ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              : "bg-slate-800/60 border border-slate-700/50 text-slate-600 cursor-not-allowed"}`}>
            {apelStatus === "before" ? "🔒 Apel Belum Dimulai" :
              apelStatus === "ended" ? "🔒 Sesi Telah Berakhir" : "📱 SCAN QR ABSENSI"}
          </button>
          <Card className="p-4 mb-6">
            <button
              onClick={() => {
                setScanResult(null);
                setAttendanceSuccess(false);
                setShowManualCode(prev => !prev);
              }}
              className="w-full py-3 rounded-xl bg-slate-800 text-white text-sm font-bold border border-slate-700 active:scale-[0.98]"
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
                  <div className="text-slate-600 text-[10px] leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
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
const DashboardPimpinan = ({ attendance, onBack }) => {
  const [showPerhatian, setShowPerhatian] = useState(false);
  const [selectedBidang, setSelectedBidang] = useState(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const stats = calcStats(attendance);

const denganKeterangan =
  stats.dinasD +
  stats.dinasL +
  stats.izin +
  stats.sakit;

const getBidangStats = (bidangNama) => {
    const members = pegawaiData.filter(p => p.bidang === bidangNama);
    let hadir = 0;
    for (const p of members) {
      if (attendance[p.id]?.status === "Hadir") hadir++;
    }
    const persen = members.length > 0 ? Math.round((hadir / members.length) * 100) : 0;
    return { total: members.length, hadir, persen };
  };

  const perhatianList = sanctionsData.records
    .filter(r => r.kategori === "Oranye" || r.kategori === "Merah")
    .map(r => ({ ...r, pegawai: pegawaiData.find(p => p.id === r.pegawaiId) }))
    .filter(r => r.pegawai);

  const bidangList = orgData.bidang.filter(b => b.id !== "pimpinan");

  if (showPerhatian) {
    return (
      <div className="min-h-screen bg-[#080c14] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => setShowPerhatian(false)} />
          <h2 className="text-xl font-black text-white mb-1">Pegawai Perlu Perhatian</h2>
          <p className="text-slate-500 text-xs mb-5">Kategori Oranye & Merah — bulan ini</p>
          <div className="space-y-3">
            {perhatianList.map(r => {
              const c = SANKSI_COLORS[r.kategori];
              return (
                <Card key={r.pegawaiId} className={`p-4 border ${c.border}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-semibold truncate">{r.pegawai.nama}</div>
                      <div className="text-slate-500 text-xs truncate mt-0.5">{r.pegawai.jabatan}</div>
                      <div className="text-slate-400 text-xs mt-1">{r.keterangan}</div>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border ${c.bg} ${c.text} ${c.border}`}>
                      {r.kategori}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-3 pt-3 border-t border-slate-700/50">
                    <div className="flex-1 text-center">
                      <div className="text-red-400 font-bold">{r.totalTanpaKeterangan}x</div>
                      <div className="text-slate-600 text-[10px]">Tanpa Ket.</div>
                    </div>
                    <div className="w-px bg-slate-700" />
                    <div className="flex-1 text-center">
                      <div className="text-amber-400 font-bold">{r.totalTerlambat}x</div>
                      <div className="text-slate-600 text-[10px]">Terlambat</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (selectedBidang) {
    const b = selectedBidang;
    const bStats = getBidangStats(b.nama);
    const members = pegawaiData.filter(p => p.bidang === b.nama);
    return (
      <div className="min-h-screen bg-[#080c14] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => setSelectedBidang(null)} />
          <h2 className="text-xl font-black text-white mb-0.5">Bidang {b.nama}</h2>
          <p className="text-slate-500 text-xs mb-5">{b.kepala}</p>
          <Card className="p-4 mb-4 flex items-center gap-4">
            <ProgressRing pct={bStats.persen} size={80} stroke={7} />
            <div>
              <div className="text-white text-xl font-black">{bStats.persen}%</div>
              <div className="text-slate-400 text-xs">{bStats.hadir}/{bStats.total} hadir</div>
            </div>
          </Card>
          <div className="space-y-2">
            {members.map(p => {
              const att = attendance[p.id];
              return (
                <Card key={p.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-white text-xs font-semibold truncate">{p.nama}</div>
                      <div className="text-slate-600 text-[10px] truncate">{p.jabatan}</div>
                    </div>
                    {att?.status ? <StatusBadge status={att.status} /> : <StatusBadge status="Belum" />}
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
        <div className="absolute top-0 left-0 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />

        {/* Header */}
        <div className="mb-6">
          <p className="text-slate-400 text-sm">{getGreeting()},</p>
          <h1 className="text-xl font-black text-white leading-tight">{orgData.kepala_dinas.nama}</h1>
          <p className="text-slate-500 text-xs mt-0.5">{orgData.kepala_dinas.jabatan} · {orgData.dinas}</p>
          <p className="text-slate-600 text-xs">{now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>

        {/* Main Stats + Ring */}
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-5">
            <ProgressRing pct={stats.persen} size={100} stroke={9} color="#f59e0b" label="Kehadiran" />
            <div className="flex-1 space-y-2">
              {[
  { label: "Total Pegawai", val: stats.total, color: "text-white" },
  { label: "Hadir", val: stats.hadir, color: "text-emerald-400" },
  { label: "Tanpa Ket.", val: stats.tanpaKet, color: "text-red-400" },
  { label: "Dengan Keterangan", val: denganKeterangan, color: "text-blue-400" },
].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs">{s.label}</span>
                  <span className={`font-bold text-sm ${s.color}`}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Status breakdown */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Dinas Dalam", val: stats.dinasD, icon: "🏢", color: "text-blue-400" },
            { label: "Dinas Luar", val: stats.dinasL, icon: "🚗", color: "text-violet-400" },
            { label: "Izin", val: stats.izin, icon: "📄", color: "text-amber-400" },
            { label: "Sakit", val: stats.sakit, icon: "🤒", color: "text-orange-400" },
            { label: "Hadir", val: stats.hadir, icon: "✅", color: "text-emerald-400" },
            { label: "Tanpa Ket.", val: stats.tanpaKet, icon: "🚫", color: "text-red-400" },
          ].map(s => (
            <Card key={s.label} className="p-3 text-center">
              <div className="text-xl mb-1">{s.icon}</div>
              <div className={`text-lg font-black ${s.color}`}>{s.val}</div>
              <div className="text-slate-600 text-[10px] leading-tight">{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Perlu Perhatian */}
        <Card className="p-4 mb-4" onClick={() => setShowPerhatian(true)}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-sm">Pegawai Perlu Perhatian</div>
              <div className="text-slate-500 text-xs mt-0.5">Oranye & Merah bulan ini</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-red-400">{perhatianList.length}</span>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            </div>
          </div>
          <button className="mt-3 text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
            Lihat Detail <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </Card>

        {/* Kehadiran per Bidang */}
        <div className="mb-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Kehadiran per Bidang</p>
          <div className="space-y-2">
            {bidangList.map(b => {
              const bs = getBidangStats(b.nama);
              if (bs.total === 0) return null;
              return (
                <Card key={b.id} className="p-3.5" onClick={() => setSelectedBidang(b)}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-semibold">{b.nama}</div>
                      <div className="text-slate-500 text-xs truncate">{b.kepala}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className={`text-base font-black ${bs.persen >= 80 ? "text-emerald-400" : bs.persen >= 60 ? "text-amber-400" : "text-red-400"}`}>{bs.persen}%</div>
                        <div className="text-slate-600 text-[10px]">{bs.hadir}/{bs.total}</div>
                      </div>
                      <div className="w-12 bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full transition-all ${bs.persen >= 80 ? "bg-emerald-500" : bs.persen >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${bs.persen}%` }} />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: DASHBOARD ADMIN
// ══════════════════════════════════════════════════════════════════════════════
const DashboardAdmin = ({ attendance, onScanSimulate, onReset, onBack, onKoreksi }) => {
  const [now, setNow] = useState(new Date());
  const [currentQr, setCurrentQr] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [demoStatus, setDemoStatus] = useState("ongoing");
  console.log("demoStatus:", demoStatus);
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const stats = calcStats(attendance);

const DEV_MODE = true;

const apelStatus = DEV_MODE
  ? demoStatus
  : getApelStatus(now);

const qrActive = apelStatus === "ongoing";

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

const secsLeft = qrActive && currentQr ? Math.max(0, Math.ceil((currentQr.expiresAt - now.getTime()) / 1000)) : 0;

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
      onClick={() => setDemoStatus("before")}
      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
        demoStatus === "before"
          ? "bg-slate-600 text-white"
          : "bg-slate-800 text-slate-400"
      }`}
    >
      Sebelum
    </button>

    <button
      onClick={() => setDemoStatus("ongoing")}
      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
        demoStatus === "ongoing"
          ? "bg-emerald-600 text-white"
          : "bg-slate-800 text-slate-400"
      }`}
    >
      Saat Apel
    </button>

    <button
      onClick={() => setDemoStatus("ended")}
      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
        demoStatus === "ended"
          ? "bg-red-600 text-white"
          : "bg-slate-800 text-slate-400"
      }`}
    >
      Setelah
    </button>
  </div>
)}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-white">Admin Panel</h1>
            <p className="text-slate-500 text-xs">{formatTime(now)}</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${qrActive ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${qrActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            {qrActive ? "Apel Aktif" : apelStatus === "before" ? "Menunggu" : "Selesai"}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
  { label: "Hadir", val: stats.hadir, color: "text-emerald-400" },
  { label: "Tanpa Ket.", val: stats.tanpaKet, color: "text-red-400" },
  { label: "Kehadiran", val: `${stats.persen}%`, color: "text-amber-400" },
].map(s => (
            <Card key={s.label} className="p-3 text-center">
              <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
              <div className="text-slate-600 text-[10px]">{s.label}</div>
            </Card>
          ))}
        </div>
{/* QR BESAR */}
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
      Berganti setiap 15 detik · Aktif hingga 08:00
    </p>
  ) : (
    <p className="text-slate-600 text-xs mt-3 text-center">
      {apelStatus === "before"
        ? "QR aktif otomatis pada pukul 07:00"
        : "Sesi apel telah berakhir pukul 08:00"}
    </p>
  )}
</Card>
        

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { id: "kelola", label: "Kelola Pegawai", icon: "👥", color: "from-blue-500/20 to-indigo-500/10", border: "hover:border-blue-500/50" },
            { id: "koreksi", label: "Koreksi Absensi", icon: "✏️", color: "from-amber-500/20 to-yellow-500/10", border: "hover:border-amber-500/50" },
            { id: "laporan", label: "Laporan Harian", icon: "📊", color: "from-emerald-500/20 to-teal-500/10", border: "hover:border-emerald-500/50" },
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
    const belum = Object.entries(attendance).filter(([, v]) => !v.status).map(([id]) => parseInt(id));
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
        <DashboardPegawai pegawai={activePegawai} attendance={attendance} onScan={handleScan}
          onBack={() => setPage("pegawai_login")} />
      )}
      {page === "pimpinan" && (
        <DashboardPimpinan attendance={attendance} onBack={() => setPage("role")} />
      )}
      {page === "admin" && (
        <DashboardAdmin attendance={attendance} onScanSimulate={handleScanSimulate}
          onReset={handleReset} onBack={() => setPage("role")} onKoreksi={handleKoreksi} />
      )}
    </div>
  );
}
