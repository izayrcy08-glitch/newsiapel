import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import { useMemo } from "react";
import { ref, get, onValue, set, update } from "firebase/database";
import { database } from "./firebase";
import pegawaiData from "./data/pegawai_master.json";
import legacyPegawaiData from "./data/pegawai_legacy.json";
import orgData from "./data/organization.json";

const MASTER_PEGAWAI_STORAGE_KEY = "siapel.masterPegawaiData.v1";

const loadMasterPegawaiData = () => {
  if (typeof window === "undefined") return normalizePegawaiData(pegawaiData);

  try {
    const stored = window.localStorage.getItem(MASTER_PEGAWAI_STORAGE_KEY);
    if (!stored) return normalizePegawaiData(pegawaiData);

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return normalizePegawaiData(pegawaiData);
    return normalizePegawaiData(parsed);
  } catch (error) {
    console.warn("Failed to load stored master pegawai data:", error);
    return normalizePegawaiData(pegawaiData);
  }
};

const normalizePegawaiRecord = (pegawai, fallbackId) => {
  const unit = pegawai.unit || pegawai.bidang || "";
  const bidang = pegawai.bidang || pegawai.unit || "";
  return {
    ...pegawai,
    id: pegawai.id ?? fallbackId,
    nama: pegawai.nama || "",
    nip: pegawai.nip || "",
    jabatan: pegawai.jabatan || "",
    unit,
    bidang,
    role: pegawai.role || "EMPLOYEE",
    password: pegawai.password || "",
    isActive: pegawai.isActive !== false,
  };
};

const normalizePegawaiData = (people = []) => people.map((pegawai, index) => normalizePegawaiRecord(pegawai, index + 1));

const mergeAttendanceWithPeople = (attendance = {}, people = []) => {
  const merged = {};
  for (const person of people) {
    merged[person.id] = attendance?.[person.id] || { status: null, jamHadir: null };
  }
  return merged;
};

const STATUS_VERIFIKASI_COLORS = {
  menunggu: { bg: "bg-amber-500/20", text: "text-amber-400", icon: "🟡", label: "Menunggu Verifikasi" },
  disetujui: { bg: "bg-emerald-500/20", text: "text-emerald-400", icon: "🟢", label: "Disetujui" },
  ditolak: { bg: "bg-red-500/20", text: "text-red-400", icon: "🔴", label: "Ditolak" },
};

const STATUS_OPTIONS = ["Dinas Dalam", "Dinas Luar", "Izin", "Sakit"];

const UNIT_LABELS = {
  PIMPINAN: "Pimpinan",
  DINAS: "Dinas",
  SEKRETARIAT: "Sekretariat",
  ALKAL: "UPT ALKAL",
  BINA_MARGA: "Bina Marga",
  SDA: "Sumber Daya Air",
  CIPTA_KARYA: "Cipta Karya",
  TATA_RUANG: "Tata Ruang",
  TATA_KOTA: "Tata Kota",
  JASA_KONSTRUKSI: "Jasa Konstruksi",
};

const getUnitLabel = (unitCode) => UNIT_LABELS[unitCode] || unitCode || "";

const PEGAWAI_GROUP_ORDER = [
  "PIMPINAN",
  "DINAS",
  "SEKRETARIAT",
  "ALKAL",
  "BINA_MARGA",
  "SDA",
  "CIPTA_KARYA",
  "TATA_KOTA",
  "TATA_RUANG",
  "JASA_KONSTRUKSI",
];

const getPegawaiGroupKey = (pegawai) => pegawai.unit || pegawai.bidang || "LAINNYA";

const getPegawaiGroupLabel = (groupKey) => getUnitLabel(groupKey);
const getScopedPeople = (people, sourcePerson, scope = "ALL") => {
  if (scope === "ALL" || !sourcePerson) return people;
  const scopeKey = getPegawaiGroupKey(sourcePerson);
  if (!scopeKey) return people;
  return people.filter((person) => getPegawaiGroupKey(person) === scopeKey);
};
const normalizeIdentity = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const buildPimpinanAccessRoles = (people) => {
  const seen = new Set();
  const items = [];

  const rolePriority = { EXECUTIVE: 0, UNIT_LEADER: 1 };
  const unitPriority = {
    DINAS: 0,
    SEKRETARIAT: 1,
    ALKAL: 2,
    SDA: 3,
    BINA_MARGA: 4,
    CIPTA_KARYA: 5,
    TATA_KOTA: 6,
    TATA_RUANG: 7,
    JASA_KONSTRUKSI: 8,
  };

  for (const person of people) {
    if (person.role !== "EXECUTIVE" && person.role !== "UNIT_LEADER") continue;

    const dedupeKey = `${person.role}|${normalizeIdentity(person.nip)}|${normalizeIdentity(person.nama)}|${normalizeIdentity(person.jabatan)}|${person.unit}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    items.push({
      id: `${person.role.toLowerCase()}-${person.nip || normalizeIdentity(person.nama) || normalizeIdentity(person.jabatan) || normalizeIdentity(person.unit)}`,
      group: person.role,
      name: person.nama || person.jabatan || "Sekretaris Dinas",
      nip: person.nip || "",
      jabatan: person.jabatan || "",
      unit: person.unit || "",
      scope: person.role === "EXECUTIVE" ? "ALL" : "UNIT",
      description: person.role === "EXECUTIVE"
        ? (person.nama ? "Kepala Dinas" : "Belum diisi")
        : getUnitLabel(person.unit),
    });
  }

  return items.sort((a, b) => {
    const roleDiff = (rolePriority[a.group] ?? 99) - (rolePriority[b.group] ?? 99);
    if (roleDiff !== 0) return roleDiff;
    const unitDiff = (unitPriority[a.unit] ?? 99) - (unitPriority[b.unit] ?? 99);
    if (unitDiff !== 0) return unitDiff;
    return a.name.localeCompare(b.name);
  });
};

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
const buildInitialAttendance = (people = pegawaiData) => {
  const map = {};
  for (const p of people) {
    map[p.id] = { status: null, jamHadir: null };
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


const getDisciplineStatus = (count) => {
  if (count === 0) return { icon: "🟢", label: "Sangat Baik" };
  if (count <= 2) return { icon: "🟡", label: "Perlu Perhatian" };
  if (count <= 4) return { icon: "🟠", label: "Pembinaan" };
  return { icon: "🔴", label: "Tindak Lanjut" };
};

// ─── PENGAJUAN STATUS OPERASIONAL ─────────────────────────────────────────────
// Jalur operasional membaca data nyata. Saat ini sumber pengajuan belum terhubung,
// sehingga fallback default tetap kosong sampai integrasi backend pengajuan aktif.
const PENGJUAN_STATUS_DATA = [];

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

const getAttendanceStatItems = (apelStatus, { demoMode = false } = {}) => {
  // Jika ditiadakan, tampilkan pesan khusus
  if (apelStatus === "ditiadakan") {
    return [
      { key: "info", status: "info", label: "Apel Ditiadakan", icon: "⚠️", color: "text-amber-400" },
    ];
  }
  return ATTENDANCE_STAT_ITEMS.map((item, index) => {
    if (!demoMode || index !== 1 || apelStatus === "ended") return item;
    return { ...item, status: "Belum Absen", label: "Belum Absen", icon: "⏳", color: "text-slate-400" };
  });
};

const isApelDitiadakan = (apelStatus) => apelStatus === "ditiadakan";

const calcAttendanceStats = (attendance, apelStatus, people = pegawaiData, { includeMissingAsUnrecorded = true } = {}) => {
  let hadir = 0, unaccounted = 0, dinasD = 0, dinasL = 0, izin = 0, sakit = 0, recorded = 0;

  for (const p of people) {
    const status = attendance[p.id]?.status;

    if (!status) {
      if (includeMissingAsUnrecorded) unaccounted++;
      continue;
    }

    recorded++;

    if (status === "Hadir") hadir++;
    else if (status === "Dinas Dalam") dinasD++;
    else if (status === "Dinas Luar") dinasL++;
    else if (status === "Izin") izin++;
    else if (status === "Sakit") sakit++;
    else if (status === "Tanpa Keterangan") unaccounted++;
  }

  const total = includeMissingAsUnrecorded ? people.length : recorded;
  const persen = total > 0 ? Math.round((hadir / total) * 100) : 0;
  const tanpaKet = includeMissingAsUnrecorded ? (apelStatus === "ended" ? unaccounted : 0) : unaccounted;
  const belumAbsen = includeMissingAsUnrecorded ? (apelStatus === "ended" ? 0 : unaccounted) : 0;

  return { total, recorded, hadir, unaccounted, tanpaKet, belumAbsen, dinasD, dinasL, izin, sakit, persen };
};

const getBidangPerformanceStatus = (persen) => {
  if (persen >= 90) return { label: "Sangat Baik", color: "text-emerald-300", bg: "bg-emerald-500/15", border: "border-emerald-500/30" };
  if (persen >= 80) return { label: "Baik", color: "text-blue-300", bg: "bg-blue-500/15", border: "border-blue-500/30" };
  if (persen >= 70) return { label: "Perlu Perhatian", color: "text-amber-300", bg: "bg-amber-500/15", border: "border-amber-500/30" };
  return { label: "Perlu Tindak Lanjut", color: "text-red-300", bg: "bg-red-500/15", border: "border-red-500/30" };
};

const DEMO_LAST_MONTH_DISCIPLINE = {
  sekretariat: 96,
  tata_kota: 94,
  tata_ruang: 92,
  cipta_karya: 89,
  bina_marga: 86,
  sumber_daya_air: 84,
  jasa_konstruksi: 81,
};


const RANK_MEDALS = ["🥇", "🥈", "🥉"];

const ProfileLines = ({ name, nip, jabatan, nameClassName = "text-white font-semibold text-sm", metaClassName = "text-slate-500 text-xs", containerClassName = "" }) => {
  return (
    <div className={`min-w-0 ${containerClassName}`}>
      <div className={`${nameClassName} break-words`}>{name}</div>
      {nip ? <div className={`${metaClassName} mt-0.5 break-words`}>NIP: {nip}</div> : null}
      {jabatan ? <div className={`${metaClassName} mt-0.5 break-words`}>{jabatan}</div> : null}
    </div>
  );
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

        <div className="mt-4 border-t border-slate-800/70 pt-4">
          <button
            onClick={() => onSelect("developer")}
            className="group relative w-full text-left rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900/95 to-slate-800/80 p-4 transition-all duration-200 hover:border-slate-500/70 hover:shadow-lg active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-2xl">🔧</span>
              <div className="min-w-0">
                <div className="text-white font-bold text-base">Developer</div>
                <div className="text-slate-400 text-xs mt-0.5">Teknis internal, demo, recovery, dan audit</div>
              </div>
              <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-400 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        <p className="text-center text-slate-700 text-xs mt-8">Prototype v1.0 · Hanya untuk demonstrasi</p>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: PEGAWAI LOGIN
// ══════════════════════════════════════════════════════════════════════════════
const PegawaiLogin = ({ people = pegawaiData, onBack, onLogin }) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = people.filter((p) => {
    const searchable = `${p.nama} ${p.nip || ""} ${p.jabatan || ""} ${p.bidang || ""} ${p.unit || ""}`.toLowerCase();
    return !normalizedSearch || searchable.includes(normalizedSearch);
  });

  const groupedFiltered = filtered.reduce((acc, pegawai) => {
    const key = getPegawaiGroupKey(pegawai);
    if (!acc[key]) acc[key] = [];
    acc[key].push(pegawai);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedFiltered).sort((a, b) => {
    const indexA = PEGAWAI_GROUP_ORDER.indexOf(a[0]);
    const indexB = PEGAWAI_GROUP_ORDER.indexOf(b[0]);
    if (indexA !== -1 || indexB !== -1) {
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    }
    return getPegawaiGroupLabel(a[0]).localeCompare(getPegawaiGroupLabel(b[0]));
  });

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
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 scrollbar-thin">
          {search.trim() !== '' && groupedEntries.map(([groupKey, items]) => (
            <div key={groupKey} className="space-y-2">
              <div className="flex items-center gap-3 px-1">
                <div>
                  <div className="text-slate-300 text-[11px] font-semibold uppercase tracking-[0.18em]">
                    {getPegawaiGroupLabel(groupKey)}
                  </div>
                  <div className="text-slate-500 text-[10px] mt-0.5">{items.length} pegawai</div>
                </div>
                <div className="h-px flex-1 bg-slate-800/70" />
              </div>
              <div className="space-y-2">
                {items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 active:scale-[0.98] ${selected?.id === p.id
                      ? "bg-emerald-500/20 border-emerald-500/50"
                      : "bg-slate-900/60 border-slate-700/50 hover:border-slate-600/70 hover:bg-slate-800/60"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {p.nama.split(" ").slice(0, 2).map(n => n[0]).join("")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <ProfileLines
                          name={p.nama}
                          nip={p.nip}
                          jabatan={p.jabatan}
                          nameClassName="text-white text-sm font-semibold"
                          metaClassName="text-slate-500 text-xs"
                        />
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                            {getUnitLabel(p.unit) || "Tanpa Unit"}
                          </span>
                          {p.bidang && p.bidang !== getUnitLabel(p.unit) ? (
                            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {p.bidang}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {selected?.id === p.id && (
                        <svg className="w-5 h-5 text-emerald-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
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
                <div className="min-w-0 flex-1">
                  <div className="text-white text-sm font-semibold">{selected.nama}</div>
                  {selected.nip ? <div className="text-slate-400 text-xs mt-0.5">NIP: {selected.nip}</div> : null}
                  <div className="text-slate-400 text-xs mt-0.5">
                    {getUnitLabel(selected.unit) || selected.bidang || ""}
                    {selected.bidang && getUnitLabel(selected.unit) && selected.bidang !== getUnitLabel(selected.unit) ? ` · ${selected.bidang}` : ""}
                  </div>
                  {selected.jabatan ? <div className="text-slate-400 text-xs mt-0.5">{selected.jabatan}</div> : null}
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
// PAGE: PIMPINAN SELECTOR
// ══════════════════════════════════════════════════════════════════════════════
const PimpinanSelector = ({ pimpinanAccessRoles = [], onBack, onSelect }) => {
  const executive = pimpinanAccessRoles.filter((item) => item.group === "EXECUTIVE");
  const unitLeaders = pimpinanAccessRoles.filter((item) => item.group === "UNIT_LEADER");

  const renderCard = (item) => (
    <button
      key={item.id}
      onClick={() => onSelect(item)}
      className="group w-full text-left rounded-2xl border border-slate-700/60 bg-slate-900/75 p-4 transition-all duration-200 hover:border-amber-500/40 hover:bg-slate-900 active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${
          item.group === "EXECUTIVE" ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/20 text-blue-300"
        }`}>
          {item.group === "EXECUTIVE" ? "E" : "U"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <ProfileLines
              name={item.name}
              nip={item.nip}
              jabatan={item.jabatan}
              nameClassName="text-white text-sm font-semibold"
              metaClassName="text-slate-400 text-[11px]"
              containerClassName="flex-1"
            />
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-slate-600 group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${
              item.group === "EXECUTIVE" ? "bg-amber-500/15 text-amber-300" : "bg-blue-500/15 text-blue-300"
            }`}>
              {item.group}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-300">
              {item.scope}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-300">
              {getUnitLabel(item.unit)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />

        <div className="mb-5">
          <h2 className="text-xl font-black text-white">Pilih Role Pimpinan</h2>
          <p className="mt-1 text-slate-500 text-xs">Executive dan Unit Leader memakai dashboard yang sama, scope datanya yang berbeda.</p>
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">Executive</div>
            <div className="space-y-3">
              {executive.map(renderCard)}
            </div>
          </div>

          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200/70">Unit Leader</div>
            <div className="space-y-3">
              {unitLeaders.map(renderCard)}
            </div>
          </div>
        </div>
      </div>
      </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: DEVELOPER CONSOLE
// ══════════════════════════════════════════════════════════════════════════════
const DeveloperConsole = ({
  onBack,
  masterPegawaiData,
  legacyPegawaiData,
  attendance,
  apelStatus,
  apelSession,
  apelReason,
  apelReasonText,
  onScan,
  onReset,
  onKoreksi,
  onApelSessionChange,
  onApelReasonChange,
  onScanSimulate,
  onAddPegawai,
  onUpdatePegawai,
  onDeletePegawai,
}) => {
  const [dataMode, setDataMode] = useState("master");
  const [search, setSearch] = useState("");
  const [viewAsRole, setViewAsRole] = useState(null);
  const [viewAsPersonId, setViewAsPersonId] = useState("");

  const sections = [
    {
      title: "Simulation",
      items: ["Attendance Simulation", "Employee Simulation", "QR Simulation"],
    },
    {
      title: "Recovery",
      items: ["Reset Device", "Reset Session", "Emergency Access"],
    },
    {
      title: "Audit",
      items: ["Role Inspector", "Scope Inspector", "Data Inspector"],
    },
  ];

  const activeData = dataMode === "legacy" ? legacyPegawaiData : masterPegawaiData;
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = activeData.filter((pegawai) => {
    const searchable = `${pegawai.nama} ${pegawai.nip || ""} ${pegawai.jabatan || ""} ${pegawai.bidang || ""} ${pegawai.unit || ""} ${pegawai.role || ""}`.toLowerCase();
    return !normalizedSearch || searchable.includes(normalizedSearch);
  });

  const groupedFiltered = filtered.reduce((acc, pegawai) => {
    const key = getPegawaiGroupKey(pegawai);
    if (!acc[key]) acc[key] = [];
    acc[key].push(pegawai);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedFiltered).sort((a, b) => {
    const indexA = PEGAWAI_GROUP_ORDER.indexOf(a[0]);
    const indexB = PEGAWAI_GROUP_ORDER.indexOf(b[0]);
    if (indexA !== -1 || indexB !== -1) {
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    }
    return getPegawaiGroupLabel(a[0]).localeCompare(getPegawaiGroupLabel(b[0]));
  });

  const summaryCards = [
    { label: "Total Data", value: activeData.length, tone: "text-white" },
    { label: "Executive", value: activeData.filter((p) => p.role === "EXECUTIVE").length, tone: "text-amber-200" },
    { label: "Unit Leader", value: activeData.filter((p) => p.role === "UNIT_LEADER").length, tone: "text-sky-200" },
    { label: "Employee", value: activeData.filter((p) => p.role === "EMPLOYEE").length, tone: "text-emerald-200" },
  ];

  const sourceMeta = dataMode === "legacy"
    ? {
        label: "Legacy Demo",
        description: "Hanya untuk demo, audit, dan recovery. Tidak dipakai operasional.",
        badgeClass: "bg-amber-500/15 text-amber-200 border-amber-500/25",
        panelClass: "border-amber-500/20 bg-amber-500/5",
      }
    : {
        label: "Master Operasional",
        description: "Sumber data aktif untuk pilot project dan jalur operasional.",
        badgeClass: "bg-emerald-500/15 text-emerald-200 border-emerald-500/25",
        panelClass: "border-emerald-500/20 bg-emerald-500/5",
      };

  const roleOptions = [
    { id: "employee", label: "Pegawai", desc: "View as employee", icon: "👤" },
    { id: "unit_leader", label: "Unit Leader", desc: "View as unit/bidang", icon: "⭐" },
    { id: "executive", label: "Executive", desc: "View as all org", icon: "🏛️" },
    { id: "admin", label: "Admin", desc: "View as operasional", icon: "🛡️" },
  ];

  const previewAttendance = dataMode === "legacy"
    ? Object.fromEntries(activeData.map((p) => [p.id, { status: null, jamHadir: null }]))
    : attendance;

  const roleCandidates = viewAsRole === "admin"
    ? []
    : activeData.filter((p) => {
        if (viewAsRole === "employee") return p.role === "EMPLOYEE";
        if (viewAsRole === "unit_leader") return p.role === "UNIT_LEADER";
        if (viewAsRole === "executive") return p.role === "EXECUTIVE";
        return false;
      });

  const selectedViewPerson = roleCandidates.find((p) => String(p.id) === String(viewAsPersonId)) || roleCandidates[0] || null;
  const selectedPimpinanView = selectedViewPerson
    ? {
        name: selectedViewPerson.nama,
        nip: selectedViewPerson.nip || "",
        jabatan: selectedViewPerson.jabatan || "",
        unit: selectedViewPerson.unit || "",
        scope: selectedViewPerson.role === "EXECUTIVE" ? "ALL" : "UNIT",
        group: selectedViewPerson.role === "EXECUTIVE" ? "EXECUTIVE" : "UNIT_LEADER",
        description: selectedViewPerson.role === "EXECUTIVE" ? "Kepala Dinas" : getUnitLabel(selectedViewPerson.unit),
      }
    : null;

  const isLegacyView = dataMode === "legacy";
  const safeOnScan = isLegacyView ? () => {} : onScan;
  const safeOnReset = isLegacyView ? () => {} : onReset;
  const safeOnKoreksi = isLegacyView ? () => {} : onKoreksi;
  const safeOnAppealPhaseChange = isLegacyView ? () => {} : onApelSessionChange;
  const safeOnApelReasonChange = isLegacyView ? () => {} : onApelReasonChange;
  const safeOnScanSimulate = isLegacyView ? () => {} : onScanSimulate;

  if (viewAsRole) {
    return (
      <div className="min-h-screen bg-[#080c14] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => setViewAsRole(null)} />

          <div className="mb-4">
            <h2 className="text-xl font-black text-white">View As</h2>
            <p className="mt-1 text-slate-500 text-xs">
              {isLegacyView ? "Legacy mode read-only." : "Master mode can use operational callbacks."}
            </p>
          </div>

          <Card className={`p-4 mb-3 border ${sourceMeta.panelClass}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white">{roleOptions.find((r) => r.id === viewAsRole)?.label || "Role"}</div>
                <div className="mt-1 text-xs text-slate-400">{roleOptions.find((r) => r.id === viewAsRole)?.desc}</div>
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${sourceMeta.badgeClass}`}>
                {sourceMeta.label}
              </span>
            </div>
          </Card>

          {viewAsRole !== "admin" && roleCandidates.length > 1 && (
            <Card className="p-4 mb-3 border-slate-700/60 bg-slate-900/80">
              <div className="mb-3 text-sm font-bold text-white">Pilih Akun</div>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                {roleCandidates.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => setViewAsPersonId(String(person.id))}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-all duration-150 ${
                      String(viewAsPersonId) === String(person.id)
                        ? "border-emerald-500/50 bg-emerald-500/15"
                        : "border-slate-700/60 bg-slate-800/60 hover:border-slate-600/70 hover:bg-slate-800"
                    }`}
                  >
                    <ProfileLines
                      name={person.nama}
                      nip={person.nip}
                      jabatan={person.jabatan}
                      nameClassName="text-white text-sm font-semibold"
                      metaClassName="text-slate-500 text-xs"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                        {getUnitLabel(person.unit) || "Tanpa Unit"}
                      </span>
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {person.role}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {viewAsRole === "employee" && selectedViewPerson && (
            <DashboardPegawai
              pegawai={selectedViewPerson}
              people={activeData}
              attendance={previewAttendance}
              apelStatus={apelStatus}
              apelSession={apelSession}
              apelReason={apelReason}
              apelReasonText={apelReasonText}
              onScan={safeOnScan}
              onBack={() => setViewAsRole(null)}
              demoMode={isLegacyView}
            />
          )}

          {viewAsRole === "unit_leader" && selectedPimpinanView && (
            <DashboardPimpinan
              people={activeData}
              attendance={previewAttendance}
              apelStatus={apelStatus}
              apelSession={apelSession}
              apelReason={apelReason}
              apelReasonText={apelReasonText}
              selectedPimpinan={selectedPimpinanView}
              onBack={() => setViewAsRole(null)}
              demoMode={isLegacyView}
            />
          )}

          {viewAsRole === "executive" && selectedPimpinanView && (
            <DashboardPimpinan
              people={activeData}
              attendance={previewAttendance}
              apelStatus={apelStatus}
              apelSession={apelSession}
              apelReason={apelReason}
              apelReasonText={apelReasonText}
              selectedPimpinan={selectedPimpinanView}
              onBack={() => setViewAsRole(null)}
              demoMode={isLegacyView}
            />
          )}

          {viewAsRole === "admin" && (
            <DashboardAdmin
              people={activeData}
              attendance={previewAttendance}
              apelStatus={apelStatus}
              apelSession={apelSession}
              apelReason={apelReason}
              apelReasonText={apelReasonText}
              onAppealPhaseChange={safeOnAppealPhaseChange}
              onApelReasonChange={safeOnApelReasonChange}
              onScanSimulate={safeOnScanSimulate}
              onReset={safeOnReset}
              onBack={() => setViewAsRole(null)}
              onKoreksi={safeOnKoreksi}
              onAddPegawai={isLegacyView ? undefined : onAddPegawai}
              onUpdatePegawai={isLegacyView ? undefined : onUpdatePegawai}
              onDeletePegawai={isLegacyView ? undefined : onDeletePegawai}
              readOnly={isLegacyView}
              demoMode={isLegacyView}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />
        <div className="mb-5">
          <h2 className="text-xl font-black text-white">Developer Console</h2>
          <p className="mt-1 text-slate-500 text-xs">Akun teknis internal untuk demo, audit, recovery, dan simulasi.</p>
        </div>

        <Card className={`p-4 mb-3 border ${sourceMeta.panelClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-white">Data Source</div>
              <div className="mt-1 text-xs text-slate-400">Pilih sumber data untuk preview dan demo.</div>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${sourceMeta.badgeClass}`}>
              {sourceMeta.label}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setDataMode("master")}
              className={`rounded-xl border px-3 py-3 text-left transition-all duration-150 ${
                dataMode === "master"
                  ? "border-emerald-500/50 bg-emerald-500/15"
                  : "border-slate-700/60 bg-slate-800/60 hover:border-slate-600/70 hover:bg-slate-800"
              }`}
            >
              <div className="text-xs font-bold text-white">Master Operasional</div>
              <div className="mt-1 text-[10px] text-slate-400">Aktif untuk pilot</div>
            </button>
            <button
              onClick={() => setDataMode("legacy")}
              className={`rounded-xl border px-3 py-3 text-left transition-all duration-150 ${
                dataMode === "legacy"
                  ? "border-amber-500/50 bg-amber-500/15"
                  : "border-slate-700/60 bg-slate-800/60 hover:border-slate-600/70 hover:bg-slate-800"
              }`}
            >
              <div className="text-xs font-bold text-white">Legacy Demo</div>
              <div className="mt-1 text-[10px] text-slate-400">Hanya Developer</div>
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
            {sourceMeta.description}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {summaryCards.map((item) => (
            <Card key={item.label} className="p-3 text-center border-slate-700/60 bg-slate-900/80">
              <div className={`text-lg font-black ${item.tone}`}>{item.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
            </Card>
          ))}
        </div>

        <Card className="p-4 mb-3 border-slate-700/60 bg-slate-900/80">
          <div className="mb-3 text-sm font-bold text-white">View As</div>
          <div className="grid grid-cols-2 gap-2">
            {roleOptions.map((roleItem) => (
              <button
                key={roleItem.id}
                onClick={() => {
                  setViewAsRole(roleItem.id);
                  const defaultPerson = roleItem.id === "admin"
                    ? null
                    : activeData.find((p) => {
                        if (roleItem.id === "employee") return p.role === "EMPLOYEE";
                        if (roleItem.id === "unit_leader") return p.role === "UNIT_LEADER";
                        if (roleItem.id === "executive") return p.role === "EXECUTIVE";
                        return false;
                      });
                  setViewAsPersonId(defaultPerson ? String(defaultPerson.id) : "");
                }}
                className="rounded-xl border border-slate-700/50 bg-slate-800/70 px-3 py-3 text-left transition-all duration-150 hover:border-slate-600/70 hover:bg-slate-800 active:scale-[0.98]"
              >
                <div className="text-lg">{roleItem.icon}</div>
                <div className="mt-2 text-xs font-bold text-white">{roleItem.label}</div>
                <div className="mt-1 text-[10px] text-slate-500">{roleItem.desc}</div>
              </button>
            ))}
          </div>
        </Card>

        <div className="relative mb-3">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, unit, jabatan, role..."
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800"
          />
        </div>

        <div className="space-y-3">
          <Card className="p-4 border-slate-700/60 bg-slate-900/80">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-bold text-white">Preview Data</div>
                <div className="mt-1 text-xs text-slate-500">
                  {filtered.length} hasil dari {activeData.length} data
                </div>
              </div>
              <div className="rounded-full bg-slate-800/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                {dataMode === "legacy" ? "Demo Only" : "Operational"}
              </div>
            </div>

            {groupedEntries.length > 0 ? (
              <div className="max-h-[42vh] space-y-4 overflow-y-auto pr-1 scrollbar-thin">
                {groupedEntries.map(([groupKey, items]) => (
                  <div key={groupKey} className="space-y-2">
                    <div className="flex items-center gap-3 px-1">
                      <div>
                        <div className="text-slate-300 text-[11px] font-semibold uppercase tracking-[0.18em]">
                          {getPegawaiGroupLabel(groupKey)}
                        </div>
                        <div className="text-slate-500 text-[10px] mt-0.5">{items.length} pegawai</div>
                      </div>
                      <div className="h-px flex-1 bg-slate-800/70" />
                    </div>

                    <div className="space-y-2">
                      {items.slice(0, 8).map((pegawai) => (
                        <div key={pegawai.id} className="rounded-xl border border-slate-700/50 bg-slate-950/35 px-3 py-3">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                              {pegawai.nama.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                            </div>
                            <div className="min-w-0 flex-1">
                              <ProfileLines
                                name={pegawai.nama}
                                nip={pegawai.nip}
                                jabatan={pegawai.jabatan}
                                nameClassName="text-white text-sm font-semibold"
                                metaClassName="text-slate-500 text-xs"
                              />
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                                  {getUnitLabel(pegawai.unit) || "Tanpa Unit"}
                                </span>
                                <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {pegawai.role || "UNKNOWN"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {items.length > 8 ? (
                        <div className="px-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                          +{items.length - 8} data lain
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/35 px-4 py-6 text-center text-sm text-slate-500">
                Tidak ada data yang cocok dengan pencarian.
              </div>
            )}
          </Card>

          {sections.map((section) => (
            <Card key={section.title} className="p-4 border-slate-700/60 bg-slate-900/80">
              <div className="mb-3 text-sm font-bold text-white">{section.title}</div>
              <div className="grid grid-cols-2 gap-2">
                {section.items.map((item) => (
                  <div key={item} className="rounded-xl border border-slate-700/50 bg-slate-800/70 px-3 py-2 text-xs font-semibold text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
      </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: DASHBOARD PEGAWAI
// ══════════════════════════════════════════════════════════════════════════════
const DashboardPegawai = ({ pegawai, people = pegawaiData, attendance, apelStatus, apelReason, apelReasonText, onScan, onBack, demoMode = false }) => {
  const [now, setNow] = useState(new Date());
  const [showScanner, setShowScanner] = useState(false);
  const [showManualCode, setShowManualCode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);
  const [showAturanModal, setShowAturanModal] = useState(false);
  const isValidatingScan = useRef(false);
  const myAttendance = attendance[pegawai.id] || { status: null, jamHadir: null };
  const scopePeople = getScopedPeople(people, pegawai, "UNIT");
  const stats = calcAttendanceStats(attendance, apelStatus, scopePeople, { includeMissingAsUnrecorded: true });
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
  const showOperationalStats = true;
  const monthlyDisciplineCount = demoMode ? 2 : null;
  const monthlyDisciplineStatus = monthlyDisciplineCount !== null ? getDisciplineStatus(monthlyDisciplineCount) : null;
  const statItems = getAttendanceStatItems(apelStatus, { demoMode }).map(item => ({
    ...item,
    value: stats[item.key],
  }));
  const statusLabel = displayStatus === "Hadir" ? "Hadir" : displayStatus;

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
          <ProfileLines
            name={pegawai.nama}
            nip={pegawai.nip}
            jabatan={pegawai.jabatan}
            nameClassName="text-2xl font-black text-white leading-tight"
            metaClassName="text-slate-500 text-xs mt-0.5"
          />
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
                <span className={`text-xs font-semibold ${showOperationalStats ? "text-emerald-400" : "text-slate-400"}`}>
                  {statusLabel}
                </span>
              </div>

              {/* Tanggal */}
              <div className={`text-sm font-bold mb-2 ${showOperationalStats ? "text-white" : "text-slate-500"}`}>
                {showOperationalStats ? now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }) : "—"}
              </div>

              {/* Jam Hadir / Belum Absen */}
              {showOperationalStats && showAttendanceTime ? (
                <div>
                  <div className="text-slate-500 text-xs">Jam Hadir</div>
                  <div className="text-white text-xl font-black">{myAttendance.jamHadir} WIB</div>
                </div>
              ) : (
                <div className="text-slate-500 text-xs">
                  {showOperationalStats ? "Belum Absen" : "Menunggu data pilot"}
                </div>
              )}
            </div>

            {/* Right Column: Tanpa Keterangan Bulan Ini */}
            {(() => {
              const discipline = monthlyDisciplineStatus;
              return (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col items-center text-center">
                  {/* Icon + Bulan Ini */}
                  <div className="flex flex-col items-center mb-2">
                    <span className={`text-lg mb-1 ${showOperationalStats ? "" : "opacity-70"}`}>{discipline ? discipline.icon : "⏳"}</span>
                    <span className={`text-xs font-semibold ${showOperationalStats ? "text-amber-400" : "text-slate-400"}`}>Bulan Ini</span>
                  </div>

                  {/* Jumlah - Fokus Utama */}
                  <div className={`text-xl font-black leading-tight ${showOperationalStats ? "text-white" : "text-slate-500"}`}>
                    {monthlyDisciplineCount !== null ? `${monthlyDisciplineCount} Kali` : "—"}
                  </div>

                  {/* Subtitle */}
                  <div className="text-slate-400 text-xs mt-1">
                    Tanpa Keterangan
                  </div>

                  {/* Label Status */}
                  <div className={`text-xs font-semibold mt-2 ${
                    monthlyDisciplineCount === null ? "text-slate-500" :
                    monthlyDisciplineCount === 0 ? "text-emerald-400" :
                    monthlyDisciplineCount <= 2 ? "text-amber-400" :
                    monthlyDisciplineCount <= 4 ? "text-orange-400" :
                    "text-red-400"
                  }`}>
                    {discipline ? discipline.label : "Menunggu data pilot"}
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
              {showOperationalStats ? (
                <ProgressRing pct={stats.persen} size={80} stroke={7} label="Kehadiran" />
              ) : (
                <div className="relative flex h-[80px] w-[80px] items-center justify-center rounded-full border border-dashed border-slate-700/60 text-xl font-black text-slate-500">
                  —
                </div>
              )}
              <div>
                <div className="text-white text-xl font-black">{showOperationalStats ? `${stats.persen}%` : "—"}</div>
                <div className="text-slate-400 text-xs">Tingkat Kehadiran</div>
                <div className="text-slate-500 text-xs mt-1">
                  {showOperationalStats ? `${stats.hadir} dari ${stats.total} pegawai` : "Menunggu data pilot"}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {statItems.map(s => (
                <div key={s.label} className="bg-slate-800/60 rounded-xl p-2.5 text-center">
                  <div className="text-base mb-0.5">{s.icon}</div>
                  <div className={`text-base font-bold ${s.color}`}>{s.value ?? "—"}</div>
                  <div className="text-slate-400 text-xs leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ─── PENGAJUAN PERUBAHAN STATUS ─── */}
        <PengajuanStatusForm myStatus={showOperationalStats ? displayStatus : "Menunggu data pilot"} />

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
                  {monthlyDisciplineCount !== null ? `${monthlyDisciplineCount} Kali` : "Menunggu data pilot"}
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
const DashboardPimpinan = ({ people = pegawaiData, attendance, apelStatus, apelSession, apelReason, apelReasonText, selectedPimpinan, onBack, demoMode = false }) => {
  const [showAllPerhatian, setShowAllPerhatian] = useState(false);
  const [showAllBidangToday, setShowAllBidangToday] = useState(false);
  const [showAllLastMonth, setShowAllLastMonth] = useState(false);
  const [showDetailPengajuan, setShowDetailPengajuan] = useState(false);
  const [selectedBidang, setSelectedBidang] = useState(null);
  const [now, setNow] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  // Check if apel is ditiadakan
  const isDitiadakan = isApelDitiadakan(apelStatus);
  const displayPimpinan = selectedPimpinan || {
    name: orgData.kepala_dinas.nama,
    nip: orgData.kepala_dinas.nip,
    jabatan: orgData.kepala_dinas.jabatan,
    unit: "PIMPINAN",
    scope: "ALL",
    group: "EXECUTIVE",
    description: "Kepala Dinas",
  };

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

  const scopePeople = getScopedPeople(people, displayPimpinan, displayPimpinan.scope);
  const stats = calcAttendanceStats(attendance, apelStatus, scopePeople, { includeMissingAsUnrecorded: true });
  const unaccountedItem = getAttendanceStatItems(apelStatus, { demoMode })[1];
  const showOperationalStats = true;


const getBidangStats = (bidangNama) => {
    const members = people.filter(p => p.bidang === bidangNama);
    return calcAttendanceStats(attendance, apelStatus, members, { includeMissingAsUnrecorded: true });
  };

  const perhatianList = [];
  const visiblePerhatianList = showAllPerhatian ? perhatianList : perhatianList.slice(0, 3);

  const bidangList = orgData.bidang.filter(b => b.id !== "pimpinan");
  const bidangAnalytics = bidangList
    .map(b => ({ ...b, stats: getBidangStats(b.nama) }))
    .filter(b => b.stats.total > 0);
  const todayRanking = [...bidangAnalytics].sort((a, b) => b.stats.persen - a.stats.persen || b.stats.hadir - a.stats.hadir || a.nama.localeCompare(b.nama));
  const visibleTodayRanking = showAllBidangToday ? todayRanking : todayRanking.slice(0, 3);
  const lastMonthRanking = demoMode
    ? bidangList
        .map(b => ({ ...b, persen: DEMO_LAST_MONTH_DISCIPLINE[b.id] ?? 80 }))
        .sort((a, b) => b.persen - a.persen || a.nama.localeCompare(b.nama))
    : [];
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
              <ProfileLines
                name={displayPimpinan.name}
                nip={displayPimpinan.nip}
                jabatan={displayPimpinan.jabatan}
                nameClassName="text-xl font-black text-slate-50 leading-tight"
                metaClassName="text-slate-400 text-xs mt-0.5"
              />
              <p className="text-slate-400 text-xs mt-1">{displayPimpinan.group} · {displayPimpinan.scope === "ALL" ? "Scope ALL" : `Scope ${getUnitLabel(displayPimpinan.unit)}`} · {orgData.dinas}</p>
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
          <>
            <Card className="p-5 mb-4 border-amber-200/15 bg-slate-950/70 shadow-[0_18px_55px_rgba(0,0,0,0.28)]">
              <div className="flex items-center gap-5">
                {showOperationalStats ? (
                  <ProgressRing pct={stats.persen} size={100} stroke={9} color="#f59e0b" label="Kehadiran" />
                ) : (
                  <div className="relative flex h-[100px] w-[100px] items-center justify-center rounded-full border border-dashed border-slate-700/60 text-2xl font-black text-slate-500">
                    —
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  {[
                    { label: "Total Pegawai", val: stats.total, color: "text-white" },
                    { label: "Hadir", val: stats.hadir, color: "text-emerald-400" },
                    { label: unaccountedItem.label, val: stats[unaccountedItem.key], color: unaccountedItem.color },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-slate-400 text-xs">{s.label}</span>
                      <span className={`font-bold text-sm ${s.color}`}>{showOperationalStats ? s.val : "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {getAttendanceStatItems(apelStatus, { demoMode }).map(item => ({ label: item.label, val: stats[item.key], icon: item.icon, color: item.color })).map(s => (
                <Card key={s.label} className="p-3 text-center border-slate-600/35 bg-slate-950/55 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className={`text-lg font-black ${s.color}`}>{showOperationalStats ? s.val : "—"}</div>
                  <div className="text-slate-400 text-xs leading-tight">{s.label}</div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Perlu Perhatian */}
        <Card className="p-4 mb-4 border-slate-600/40 bg-slate-950/65 shadow-[0_14px_42px_rgba(0,0,0,0.24)]">
          <div className="mb-3 border-b border-slate-700/50 pb-3">
            <div className="text-slate-50 font-bold text-sm">Pegawai Perlu Perhatian</div>
            <div className="text-slate-500 text-xs mt-0.5">Top 3 berdasarkan sanksi bulan ini</div>
          </div>
          {visiblePerhatianList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/35 px-4 py-5 text-center">
              <div className="text-slate-300 text-sm font-semibold">Belum ada data operasional</div>
              <div className="text-slate-500 text-xs mt-1">Daftar ini akan terisi setelah data sanksi nyata tersedia.</div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </Card>

        {/* Kehadiran per Bidang */}
        <div className="mb-2">
          <Card className="p-4 border-amber-200/15 bg-slate-950/65 shadow-[0_18px_55px_rgba(0,0,0,0.26)]">
            <div className="mb-4 border-b border-amber-200/10 pb-3">
              <div className="text-amber-100/90 text-xs font-semibold uppercase tracking-[0.18em]">Kehadiran Per Bidang</div>
              <div className="text-slate-600 text-[11px] mt-0.5">Analitik performa bidang hari ini dan bulan lalu</div>
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-slate-900/55 p-3.5 mb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-slate-50 text-sm font-black">🏆 Peringkat Hari Ini</div>
                  <div className="text-slate-500 text-[11px]">
                    {showOperationalStats && !isDitiadakan ? "Berdasarkan data absensi realtime" : "Menunggu data pilot"}
                  </div>
                </div>
                <button
                  onClick={() => showOperationalStats && setShowAllBidangToday(prev => !prev)}
                  disabled={!showOperationalStats || isDitiadakan}
                  className="text-xs font-bold rounded-lg px-2.5 py-1.5 transition-all active:scale-[0.98] border border-slate-700/70 bg-slate-950/80 text-slate-300 disabled:cursor-not-allowed disabled:opacity-60 hover:border-amber-200/25 hover:text-amber-100"
                >
                  {showOperationalStats ? (showAllBidangToday ? "Tutup" : "Lihat Semua") : "—"}
                </button>
              </div>

              {showOperationalStats && !isDitiadakan ? (
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
              ) : (
                <div className="space-y-2">
                  {[1, 2, 3].map((index) => (
                    <div key={index} className="w-full rounded-xl border border-dashed border-slate-700/60 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 text-xl text-center text-slate-500">—</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-slate-300 text-sm font-bold truncate">Menunggu data pilot</div>
                          <div className="text-slate-500 text-[11px]">Peringkat hari ini belum tersedia</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-black text-slate-500">—</div>
                          <div className="text-slate-600 text-[10px]">—/—</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-slate-900/55 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-slate-50 text-sm font-black">🏅 Disiplin Bulan Lalu</div>
                  <div className="text-slate-500 text-[11px]">
                    {showOperationalStats ? "Data demo untuk preview Developer" : "Menunggu data pilot"}
                  </div>
                </div>
                <button
                  onClick={() => showOperationalStats && setShowAllLastMonth(prev => !prev)}
                  disabled={!showOperationalStats}
                  className="text-xs font-bold rounded-lg px-2.5 py-1.5 transition-all active:scale-[0.98] border border-slate-700/70 bg-slate-950/80 text-slate-300 disabled:cursor-not-allowed disabled:opacity-60 hover:border-amber-200/25 hover:text-amber-100"
                >
                  {showOperationalStats ? (showAllLastMonth ? "Tutup" : "Lihat Semua") : "—"}
                </button>
              </div>

              {showOperationalStats ? (
                demoMode ? (
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
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/35 px-4 py-5 text-center">
                    <div className="text-slate-300 text-sm font-semibold">Belum ada data disiplin bulan lalu</div>
                    <div className="text-slate-500 text-xs mt-1">Panel ini hanya akan aktif jika data operasional benar-benar tersedia.</div>
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  {[1, 2, 3].map((index) => (
                    <div key={index} className="w-full rounded-xl border border-dashed border-slate-700/60 bg-slate-950/40 p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 text-xl text-center text-slate-500">—</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-slate-300 text-sm font-bold truncate">Menunggu data pilot</div>
                          <div className="text-slate-500 text-[11px]">Disiplin bulan lalu belum tersedia</div>
                        </div>
                        <div className="text-lg font-black text-slate-500 shrink-0">—%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ─── PERUBAHAN STATUS HARI INI - PIMPINAN (RINGKASAN) ─── */}
        <Card className="p-4 mb-4 border-slate-600/40 bg-slate-950/65">
          <div className="mb-3 border-b border-slate-700/50 pb-3">
            <div className="text-slate-50 font-bold text-sm">📋 Perubahan Status Hari Ini</div>
            <div className="text-slate-500 text-xs mt-0.5">Monitoring perubahan absensi pegawai</div>
          </div>

          {showOperationalStats && !isDitiadakan ? (
            PENGJUAN_STATUS_DATA.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-4">
                Belum ada perubahan status hari ini
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="text-2xl font-black text-white mb-1">{PENGJUAN_STATUS_DATA.length}</div>
                  <div className="text-slate-500 text-xs">Perubahan Status</div>
                </div>

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

                <button
                  onClick={() => setShowDetailPengajuan(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors border border-slate-700/50"
                >
                  Lihat Detail
                </button>
              </>
            )
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/40 p-4 text-center">
                <div className="text-slate-300 text-sm font-semibold">Menunggu data pilot</div>
                <div className="text-slate-500 text-xs mt-1">Panel perubahan status akan terisi saat pilot project berjalan.</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["Dinas Luar", "Izin", "Sakit"].map((label) => (
                  <div key={label} className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/40 p-3 text-center">
                    <div className="text-lg mb-1">—</div>
                    <div className="text-slate-400 text-xs font-semibold">{label}</div>
                    <div className="text-slate-500 text-sm font-black mt-1">—</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

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
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: DASHBOARD ADMIN
// ══════════════════════════════════════════════════════════════════════════════
const DashboardAdmin = ({ people = pegawaiData, attendance, apelStatus, apelSession, apelReason, apelReasonText, onAppealPhaseChange, onApelReasonChange, onScanSimulate, onReset, onBack, onKoreksi, onAddPegawai, onUpdatePegawai, onDeletePegawai, readOnly = false, demoMode = false }) => {
  const [now, setNow] = useState(new Date());
  const [currentQr, setCurrentQr] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [kelolaTab, setKelolaTab] = useState("pegawai");
  const [kelolaSearch, setKelolaSearch] = useState("");
  const [selectedPegawaiId, setSelectedPegawaiId] = useState(null);
  const [pegawaiDraft, setPegawaiDraft] = useState({
    nama: "",
    nip: "",
    jabatan: "",
    unit: "",
    bidang: "",
    role: "EMPLOYEE",
    password: "",
    isActive: true,
  });
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

  const stats = calcAttendanceStats(attendance, apelStatus, people, { includeMissingAsUnrecorded: true });
  const showOperationalStats = true;


const qrActive = !readOnly && apelStatus === "ongoing";

  const selectedPegawai = selectedPegawaiId
    ? people.find((item) => String(item.id) === String(selectedPegawaiId)) || null
    : null;

  useEffect(() => {
    if (!selectedPegawai) {
      if (selectedPegawaiId === "new") return;
      return;
    }

    setPegawaiDraft({
      nama: selectedPegawai.nama || "",
      nip: selectedPegawai.nip || "",
      jabatan: selectedPegawai.jabatan || "",
      unit: selectedPegawai.unit || "",
      bidang: selectedPegawai.bidang || "",
      role: selectedPegawai.role || "EMPLOYEE",
      password: "",
      isActive: selectedPegawai.isActive !== false,
    });
  }, [selectedPegawai, selectedPegawaiId]);

  useEffect(() => {
    if (selectedPegawaiId !== "new") return;
    setPegawaiDraft({
      nama: "",
      nip: "",
      jabatan: "",
      unit: "",
      bidang: "",
      role: "EMPLOYEE",
      password: "",
      isActive: true,
    });
  }, [selectedPegawaiId]);

  useEffect(() => {
    if (selectedPegawaiId !== null) return;
    setPegawaiDraft({
      nama: "",
      nip: "",
      jabatan: "",
      unit: "",
      bidang: "",
      role: "EMPLOYEE",
      password: "",
      isActive: true,
    });
  }, [selectedPegawaiId]);

  const openNewPegawai = () => {
    setSelectedPegawaiId("new");
    setKelolaTab("pegawai");
    setPegawaiDraft({
      nama: "",
      nip: "",
      jabatan: "",
      unit: "",
      bidang: "",
      role: "EMPLOYEE",
      password: "",
      isActive: true,
    });
  };

  const savePegawaiDraft = () => {
    const payload = {
      ...pegawaiDraft,
      nama: pegawaiDraft.nama.trim(),
      nip: pegawaiDraft.nip.trim(),
      jabatan: pegawaiDraft.jabatan.trim(),
      unit: pegawaiDraft.unit.trim(),
      bidang: pegawaiDraft.bidang.trim() || pegawaiDraft.unit.trim(),
      role: pegawaiDraft.role,
      password: selectedPegawaiId === "new"
        ? pegawaiDraft.password
        : (pegawaiDraft.password || selectedPegawai?.password || ""),
      isActive: pegawaiDraft.isActive !== false,
    };

    if (!payload.nama) return;

    if (selectedPegawaiId === "new") {
      onAddPegawai?.(payload);
    } else if (selectedPegawaiId) {
      onUpdatePegawai?.(selectedPegawaiId, payload);
    }
    setSelectedPegawaiId(null);
    setPegawaiDraft({
      nama: "",
      nip: "",
      jabatan: "",
      unit: "",
      bidang: "",
      role: "EMPLOYEE",
      password: "",
      isActive: true,
    });
  };

  const deleteSelectedPegawai = () => {
    if (!selectedPegawai) return;
    const confirmed = window.confirm(`Hapus ${selectedPegawai.nama} dari master aktif?`);
    if (!confirmed) return;
    onDeletePegawai?.(selectedPegawai.id);
    setSelectedPegawaiId(null);
    setPegawaiDraft({
      nama: "",
      nip: "",
      jabatan: "",
      unit: "",
      bidang: "",
      role: "EMPLOYEE",
      password: "",
      isActive: true,
    });
  };

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
    const filteredPegawai = people.filter(p => {
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
      .map(([id]) => people.find(p => p.id === parseInt(id)))
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
      const members = people.filter(p => p.bidang === b.nama);
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
              <div><div className="text-2xl font-black text-white">{showOperationalStats ? stats.total : "—"}</div><div className="text-slate-500 text-xs">Total</div></div>
              <div><div className="text-2xl font-black text-emerald-400">{showOperationalStats ? stats.hadir : "—"}</div><div className="text-slate-500 text-xs">Hadir</div></div>
              <div><div className="text-2xl font-black text-amber-400">{showOperationalStats ? `${stats.persen}%` : "—"}</div><div className="text-slate-500 text-xs">Persentase</div></div>
            </div>
          </Card>

          <div className="space-y-2">
            {showOperationalStats ? (
              bidangStats.map(b => (
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
              ))
            ) : (
              orgData.bidang.filter(b => b.id !== "pimpinan").map((b) => (
                <Card key={b.id} className="p-3.5 border-dashed border-slate-700/60 bg-slate-950/40">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-white text-sm font-semibold">{b.nama}</div>
                    <div className="text-slate-500 font-bold text-sm">—</div>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-400 flex-wrap gap-y-1">
                    <span>✅ —</span>
                    <span>🚫 —</span>
                    <span>🏢 —</span>
                    <span>🚗 —</span>
                    <span>📄 —</span>
                    <span>🤒 —</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (activeMenu === "kelola") {
    const isPimpinanTab = kelolaTab === "pimpinan";
    const visiblePeople = people
      .filter((person) => (isPimpinanTab ? person.role !== "EMPLOYEE" : true))
      .filter((person) => {
        const q = kelolaSearch.trim().toLowerCase();
        if (!q) return true;
        const searchable = `${person.nama} ${person.nip || ""} ${person.jabatan || ""} ${person.unit || ""} ${person.bidang || ""} ${person.role || ""}`.toLowerCase();
        return searchable.includes(q);
      });
    const unitOptions = [
      { id: "PIMPINAN", nama: "Pimpinan" },
      ...orgData.bidang.filter((b) => b.id !== "pimpinan"),
    ];
    const selectedTitle = selectedPegawaiId === "new"
      ? "Tambah Pegawai Baru"
      : selectedPegawai
        ? `Edit ${selectedPegawai.nama || "Pegawai"}`
        : "Pilih pegawai untuk diedit";

    return (
      <div className="min-h-screen bg-[#080c14] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => setActiveMenu(null)} />
          <h2 className="text-xl font-black text-white mb-1">Kelola Pegawai</h2>
          <p className="text-slate-500 text-xs mb-4">{people.length} pegawai aktif terdaftar</p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setKelolaTab("pegawai")}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${kelolaTab === "pegawai" ? "border-blue-500/50 bg-blue-500/15 text-white" : "border-slate-700/60 bg-slate-900/60 text-slate-400"}`}
            >
              Data Pegawai
            </button>
            <button
              onClick={() => setKelolaTab("pimpinan")}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${kelolaTab === "pimpinan" ? "border-amber-500/50 bg-amber-500/15 text-white" : "border-slate-700/60 bg-slate-900/60 text-slate-400"}`}
            >
              Pimpinan
            </button>
          </div>

          <div className="relative mb-3">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={kelolaSearch}
              onChange={(e) => setKelolaSearch(e.target.value)}
              placeholder="Cari nama, NIP, unit, jabatan..."
              className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800"
            />
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={openNewPegawai}
              disabled={readOnly}
              className="flex-1 rounded-xl bg-blue-500/20 border border-blue-500/30 py-3 text-sm font-semibold text-blue-200 hover:bg-blue-500/30 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Tambah Pegawai
            </button>
            <button
              onClick={() => setSelectedPegawaiId(null)}
              className="rounded-xl bg-slate-800 border border-slate-700/60 py-3 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Bersihkan
            </button>
          </div>

          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-white text-sm font-bold">{selectedTitle}</div>
                <div className="text-slate-500 text-xs mt-0.5">Nama wajib diisi. Field lain boleh kosong sesuai data asli.</div>
              </div>
              <span className="rounded-full border border-slate-700/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {selectedPegawaiId === "new" ? "NEW" : selectedPegawai ? "EDIT" : "VIEW"}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Nama</label>
                <input value={pegawaiDraft.nama} disabled={readOnly} onChange={(e) => setPegawaiDraft((prev) => ({ ...prev, nama: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder="Nama pegawai" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">NIP</label>
                  <input value={pegawaiDraft.nip} disabled={readOnly} onChange={(e) => setPegawaiDraft((prev) => ({ ...prev, nip: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder="Kosong jika belum ada" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Role</label>
                  <select value={pegawaiDraft.role} disabled={readOnly} onChange={(e) => setPegawaiDraft((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60">
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="UNIT_LEADER">UNIT_LEADER</option>
                    <option value="EXECUTIVE">EXECUTIVE</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Jabatan</label>
                <input value={pegawaiDraft.jabatan} disabled={readOnly} onChange={(e) => setPegawaiDraft((prev) => ({ ...prev, jabatan: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder="Kosong jika belum ada" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Unit / Bidang</label>
                  <select value={pegawaiDraft.unit} disabled={readOnly} onChange={(e) => {
                    const unit = e.target.value;
                    const bid = unitOptions.find((item) => item.id === unit)?.nama || unit;
                    setPegawaiDraft((prev) => ({ ...prev, unit, bidang: bid }));
                  }}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60">
                    <option value="">Pilih unit</option>
                    {unitOptions.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.nama}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Password</label>
                  <input value={pegawaiDraft.password} disabled={readOnly} onChange={(e) => setPegawaiDraft((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder="Kosong jika tidak diubah" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={savePegawaiDraft}
                disabled={readOnly || !pegawaiDraft.nama.trim()}
                className="flex-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 py-3 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-500/30 transition-colors"
              >
                Simpan
              </button>
              <button
                onClick={deleteSelectedPegawai}
                disabled={readOnly || !selectedPegawai || selectedPegawaiId === "new"}
                className="rounded-xl bg-red-500/20 border border-red-500/30 py-3 px-4 text-sm font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-red-500/30 transition-colors"
              >
                Hapus
              </button>
            </div>
          </Card>

          <div className="space-y-2">
            {visiblePeople.map((person) => (
              <Card
                key={person.id}
                className={`p-3.5 transition-all duration-150 ${String(selectedPegawaiId) === String(person.id) ? "border-blue-500/50 bg-blue-500/10" : "bg-slate-950/40"}`}
                onClick={() => setSelectedPegawaiId(person.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <ProfileLines
                      name={person.nama || "Nama belum diisi"}
                      nip={person.nip}
                      jabatan={person.jabatan}
                      nameClassName="text-white text-sm font-semibold"
                      metaClassName="text-slate-500 text-xs"
                    />
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                        {getUnitLabel(person.unit) || "Tanpa Unit"}
                      </span>
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {person.role}
                      </span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Card>
            ))}
            {visiblePeople.length === 0 && (
              <Card className="p-6 text-center border-dashed border-slate-700/60 bg-slate-950/40">
                <div className="text-slate-400 text-sm">Pegawai tidak ditemukan</div>
              </Card>
            )}
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
            {getAttendanceStatItems(apelStatus, { demoMode }).map(item => ({ label: item.label, val: stats[item.key], icon: item.icon, color: item.color })).map(s => (
              <Card key={s.label} className="p-3 text-center">
                <div className="text-lg mb-0.5">{s.icon}</div>
                <div className={`text-xl font-black ${showOperationalStats ? s.color : "text-slate-400"}`}>{showOperationalStats ? s.val : "—"}</div>
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
            { id: "kelola", label: "Kelola Pegawai", icon: "👥", color: "from-blue-500/20 to-indigo-500/10", border: "hover:border-blue-500/50" },
            { id: "koreksi", label: "Koreksi Absensi", icon: "✏️", color: "from-amber-500/20 to-yellow-500/10", border: "hover:border-amber-500/50" },
            { id: "pengajuan", label: "Pengajuan Status", icon: "📥", color: "from-orange-500/20 to-red-500/10", border: "hover:border-orange-500/50" },
            { id: "apel", label: "Pengaturan Apel", icon: "⏱️", color: "from-violet-500/20 to-purple-500/10", border: "hover:border-violet-500/50" },
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

            {PENGJUAN_STATUS_DATA.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/40 px-4 py-5 text-center">
                <div className="text-slate-300 text-sm font-semibold">Belum ada pengajuan status</div>
                <div className="text-slate-500 text-xs mt-1">Jalur operasional akan menampilkan data nyata ketika pengajuan masuk.</div>
              </div>
            ) : (
              PENGJUAN_STATUS_DATA.map((p, i) => (
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
              ))
            )}
          </div>
        </div>
      )}

      {activeMenu === "apel" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">⏱️ Pengaturan Apel</h3>
              <button onClick={() => setActiveMenu(null)} className="text-slate-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-slate-500 text-xs mb-4">Atur fase apel dan alasan jika ditiadakan. Perubahan ini dipakai semua dashboard.</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: "Sebelum", value: APEL_SESSIONS.BEFORE, tone: "bg-slate-800 text-slate-300 border-slate-700/60" },
                { label: "Saat Apel", value: APEL_SESSIONS.ONGOING, tone: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
                { label: "Setelah", value: APEL_SESSIONS.ENDED, tone: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
                { label: "Ditiadakan", value: APEL_SESSIONS.DITIADAKAN, tone: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    onAppealPhaseChange(item.value);
                    if (item.value !== APEL_SESSIONS.DITIADAKAN) setActiveMenu(null);
                  }}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${item.tone}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {apelStatus === "ditiadakan" && (
              <div className="space-y-2">
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-[0.18em]">Alasan</div>
                {REASON_OPTIONS.map((reason) => (
                  <button
                    key={reason.id}
                    onClick={() => {
                      if (reason.id === "lainnya") {
                        const customText = window.prompt("Tulis alasan ditiadakan", apelReasonText || "");
                        if (customText !== null) onApelReasonChange("lainnya", customText);
                      } else {
                        onApelReasonChange(reason.id);
                      }
                      setActiveMenu(null);
                    }}
                    className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition-all active:scale-[0.98] ${
                      apelReason === reason.id
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                        : "border-slate-700/60 bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <span className="mr-2">{reason.icon}</span>
                    {reason.label}
                  </button>
                ))}
              </div>
            )}
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
  const [selectedPimpinan, setSelectedPimpinan] = useState(null);
  const [masterPegawaiData, setMasterPegawaiData] = useState(loadMasterPegawaiData);
  const [attendance, setAttendance] = useState(() => buildInitialAttendance(loadMasterPegawaiData()));
  const [apelSession, setApelSession] = useState(APEL_SESSIONS.ONGOING); // sebelum/saat/sesudah/ditiadakan
  const [apelReason, setApelReason] = useState(null); // alasan penaltiadakan
  const [apelReasonText, setApelReasonText] = useState(""); // teks alasan custom (jika lainnya)

  // Calculate apelStatus based on session and time
  const apelStatus = getApelStatus(new Date(), apelSession);
  const pimpinanAccessRoles = useMemo(() => buildPimpinanAccessRoles(masterPegawaiData), [masterPegawaiData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(MASTER_PEGAWAI_STORAGE_KEY, JSON.stringify(masterPegawaiData));
    } catch (error) {
      console.error("Failed to persist master pegawai data:", error);
    }
  }, [masterPegawaiData]);

  useEffect(() => {
    if (activePegawai && !masterPegawaiData.some((person) => String(person.id) === String(activePegawai.id))) {
      setActivePegawai(null);
      setPage("pegawai_login");
    }
  }, [activePegawai, masterPegawaiData]);

  useEffect(() => {
    if (selectedPimpinan && !pimpinanAccessRoles.some((person) => String(person.id) === String(selectedPimpinan.id))) {
      setSelectedPimpinan(null);
      setPage("pimpinan_select");
    }
  }, [pimpinanAccessRoles, selectedPimpinan]);

  useEffect(() => {
    const attendanceRef = ref(database, ATTENDANCE_PATH);
    return onValue(attendanceRef, (snapshot) => {
      const snapshotAttendance = snapshot.val();
      if (snapshotAttendance === null) {
        const initialAttendance = buildInitialAttendance(masterPegawaiData);
        setAttendance(initialAttendance);
        set(attendanceRef, initialAttendance);
        return;
      }

      setAttendance(mergeAttendanceWithPeople(snapshotAttendance, masterPegawaiData));
    }, (error) => {
      console.error("Failed to load realtime attendance:", error);
    });
  }, [masterPegawaiData]);

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
    if (r === "pimpinan") setPage("pimpinan_select");
    else if (r === "admin") setPage("admin");
    else if (r === "developer") setPage("developer");
    else setPage("pegawai_login");
  };

  const handlePegawaiLogin = (p) => {
    setActivePegawai(p);
    setPage("pegawai_dashboard");
  };

  const handlePimpinanSelect = (item) => {
    setSelectedPimpinan(item);
    setPage("pimpinan_dashboard");
  };

  const handleScan = (pegawaiId) => {
    if (attendance[pegawaiId]?.status === "Hadir") return;

    const jamNow = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    set(ref(database, `${ATTENDANCE_PATH}/${pegawaiId}`), { status: "Hadir", jamHadir: jamNow });
  };

  const handleScanSimulate = (count) => {
    const finalStatuses = new Set(["Hadir", "Dinas Dalam", "Dinas Luar", "Izin", "Sakit"]);
    const belum = masterPegawaiData
      .filter(p => !finalStatuses.has(attendance[p.id]?.status))
      .map(p => p.id);
    const toScan = belum.slice(0, count);
    if (toScan.length === 0) return;
    const jamNow = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const updates = {};
    for (const id of toScan) updates[id] = { status: "Hadir", jamHadir: jamNow };
    update(ref(database, ATTENDANCE_PATH), updates);
  };

  const handleReset = () => set(ref(database, ATTENDANCE_PATH), buildInitialAttendance(masterPegawaiData));

  const handleKoreksi = (pegawaiId, newStatus) => {
    const currentAttendance = attendance[pegawaiId] || { status: null, jamHadir: null };
    set(ref(database, `${ATTENDANCE_PATH}/${pegawaiId}`), { ...currentAttendance, status: newStatus });
  };

  const handleAddPegawai = (pegawaiDraft) => {
    setMasterPegawaiData((current) => {
      const nextId = current.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
      return normalizePegawaiData([
        ...current,
        normalizePegawaiRecord({ ...pegawaiDraft, id: nextId }, nextId),
      ]);
    });
  };

  const handleUpdatePegawai = (pegawaiId, updates) => {
    setMasterPegawaiData((current) =>
      normalizePegawaiData(
        current.map((item) => {
          if (String(item.id) !== String(pegawaiId)) return item;
          return normalizePegawaiRecord({ ...item, ...updates, id: item.id }, item.id);
        })
      )
    );
  };

  const handleDeletePegawai = (pegawaiId) => {
    setMasterPegawaiData((current) =>
      normalizePegawaiData(current.filter((item) => String(item.id) !== String(pegawaiId)))
    );
  };

  return (
      <div style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>
      {page === "role" && <RoleSelector onSelect={handleRoleSelect} />}
      {page === "pegawai_login" && <PegawaiLogin people={masterPegawaiData} onBack={() => setPage("role")} onLogin={handlePegawaiLogin} />}
      {page === "pegawai_dashboard" && activePegawai && (
        <DashboardPegawai
          pegawai={activePegawai}
          people={masterPegawaiData}
          attendance={attendance}
          apelStatus={apelStatus}
          apelSession={apelSession}
          apelReason={apelReason}
          apelReasonText={apelReasonText}
          onScan={handleScan}
          onBack={() => setPage("pegawai_login")}
          demoMode={false}
        />
      )}
      {page === "pimpinan_select" && (
        <PimpinanSelector
          pimpinanAccessRoles={pimpinanAccessRoles}
          onBack={() => setPage("role")}
          onSelect={handlePimpinanSelect}
        />
      )}
      {page === "pimpinan_dashboard" && (
        <DashboardPimpinan
          people={masterPegawaiData}
          attendance={attendance}
          apelStatus={apelStatus}
          apelSession={apelSession}
          apelReason={apelReason}
          apelReasonText={apelReasonText}
          selectedPimpinan={selectedPimpinan}
          onBack={() => setPage("pimpinan_select")}
          demoMode={false}
        />
      )}
      {page === "admin" && (
        <DashboardAdmin
          people={masterPegawaiData}
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
          onAddPegawai={handleAddPegawai}
          onUpdatePegawai={handleUpdatePegawai}
          onDeletePegawai={handleDeletePegawai}
          demoMode={false}
        />
      )}
      {page === "developer" && (
        <DeveloperConsole
          masterPegawaiData={masterPegawaiData}
          legacyPegawaiData={legacyPegawaiData}
          attendance={attendance}
          apelStatus={apelStatus}
          apelSession={apelSession}
          apelReason={apelReason}
          apelReasonText={apelReasonText}
          onScan={handleScan}
          onReset={handleReset}
          onKoreksi={handleKoreksi}
          onApelSessionChange={handleApelSessionChange}
          onApelReasonChange={handleApelReasonChange}
          onScanSimulate={handleScanSimulate}
          onAddPegawai={handleAddPegawai}
          onUpdatePegawai={handleUpdatePegawai}
          onDeletePegawai={handleDeletePegawai}
          onBack={() => setPage("role")}
        />
      )}
    </div>
  );
}
