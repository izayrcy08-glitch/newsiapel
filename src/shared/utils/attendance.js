import pegawaiData from "../../data/pegawai.json";

const ATTENDANCE_STAT_ITEMS = [
  { key: "hadir", status: "Hadir", label: "Hadir", icon: "✅", color: "text-emerald-400" },
  { key: "unaccounted", status: "Tanpa Keterangan", label: "Tanpa Keterangan", icon: "🚫", color: "text-red-400" },
  { key: "dinasD", status: "Dinas Dalam", label: "Dinas Dalam", icon: "🏢", color: "text-blue-400" },
  { key: "dinasL", status: "Dinas Luar", label: "Dinas Luar", icon: "🚗", color: "text-violet-400" },
  { key: "izin", status: "Izin", label: "Izin", icon: "📄", color: "text-amber-400" },
  { key: "sakit", status: "Sakit", label: "Sakit", icon: "🤒", color: "text-orange-400" },
];

const STATUS_ICONS = {
  "Dinas Luar": { icon: "🚗", label: "Dinas Luar" },
  "Dinas Dalam": { icon: "🏢", label: "Dinas Dalam" },
  Izin: { icon: "📝", label: "Izin" },
  Sakit: { icon: "🤒", label: "Sakit" },
  Hadir: { icon: "✅", label: "Hadir" },
  "Tanpa Keterangan": { icon: "❌", label: "Tanpa Keterangan" },
};

export const TANPA_KETERANGAN_BULAN_INI = 2;

export function getStatusIcon(status) {
  return STATUS_ICONS[status] || { icon: "❓", label: status };
}

export function getDisciplineStatus(count) {
  if (count === 0) return { icon: "🟢", label: "Sangat Baik" };
  if (count <= 2) return { icon: "🟡", label: "Perlu Perhatian" };
  if (count <= 4) return { icon: "🟠", label: "Pembinaan" };
  return { icon: "🔴", label: "Tindak Lanjut" };
}

export function getAttendanceStatItems(apelStatus) {
  if (apelStatus === "ditiadakan") {
    return [{ key: "info", status: "info", label: "Apel Ditiadakan", icon: "⚠️", color: "text-amber-400" }];
  }

  return ATTENDANCE_STAT_ITEMS.map((item, index) => {
    if (index !== 1 || apelStatus === "ended") return item;
    return { ...item, status: "Belum Absen", label: "Belum Absen", icon: "⏳", color: "text-slate-400" };
  });
}

export function isApelDitiadakan(apelStatus) {
  return apelStatus === "ditiadakan";
}

export function calcAttendanceStats(attendance, apelStatus, people = pegawaiData) {
  let hadir = 0;
  let unaccounted = 0;
  let dinasD = 0;
  let dinasL = 0;
  let izin = 0;
  let sakit = 0;

  for (const person of people) {
    const status = attendance[person.id]?.status;

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
}

export function getBidangPerformanceStatus(persen) {
  if (persen >= 90) return { label: "Sangat Baik", color: "text-emerald-300", bg: "bg-emerald-500/15", border: "border-emerald-500/30" };
  if (persen >= 80) return { label: "Baik", color: "text-blue-300", bg: "bg-blue-500/15", border: "border-blue-500/30" };
  if (persen >= 70) return { label: "Perlu Perhatian", color: "text-amber-300", bg: "bg-amber-500/15", border: "border-amber-500/30" };
  return { label: "Perlu Tindak Lanjut", color: "text-red-300", bg: "bg-red-500/15", border: "border-red-500/30" };
}
