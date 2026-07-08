export const STATUS_COLORS = {
  Hadir: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  "Tanpa Keterangan": { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-400" },
  "Belum Hadir": { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30", dot: "bg-slate-400" },
  "Belum Melakukan Absensi": { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30", dot: "bg-slate-400" },
  "Dinas Dalam": { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30", dot: "bg-blue-400" },
  "Dinas Luar": { bg: "bg-violet-500/20", text: "text-violet-400", border: "border-violet-500/30", dot: "bg-violet-400" },
  Izin: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30", dot: "bg-amber-400" },
  Sakit: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30", dot: "bg-orange-400" },
};

export const SANKSI_COLORS = {
  Hijau: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/40" },
  Kuning: { bg: "bg-yellow-500/20", text: "text-yellow-300", border: "border-yellow-500/40" },
  Oranye: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/40" },
  Merah: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/40" },
};

export const STATUS_ICONS = {
  "Dinas Luar": { icon: "🚗", label: "Dinas Luar" },
  "Dinas Dalam": { icon: "🏢", label: "Dinas Dalam" },
  "Izin": { icon: "📝", label: "Izin" },
  "Sakit": { icon: "🤒", label: "Sakit" },
  "Hadir": { icon: "✅", label: "Hadir" },
  "Tanpa Keterangan": { icon: "❌", label: "Tanpa Keterangan" },
  "Belum Hadir": { icon: "⏳", label: "Belum Hadir" },
};

export const getStatusIcon = (status) => {
  return STATUS_ICONS[status] || { icon: "❓", label: status };
};

export const getDisciplineStatus = (count) => {
  if (count === 0) return { icon: "🟢", label: "Sangat Baik" };
  if (count <= 2) return { icon: "🟡", label: "Perlu Perhatian" };
  if (count <= 4) return { icon: "🟠", label: "Pembinaan" };
  return { icon: "🔴", label: "Tindak Lanjut" };
};

/** Indikator warna akumulasi TK bulan ini (dashboard pimpinan). */
export const getTanpaKeteranganTone = (count) => {
  if (count >= 5) return { dot: "bg-red-600", text: "text-red-400" };
  if (count === 4) return { dot: "bg-red-500", text: "text-red-400" };
  if (count === 3) return { dot: "bg-orange-500", text: "text-orange-400" };
  if (count === 2) return { dot: "bg-amber-500", text: "text-amber-400" };
  return { dot: "bg-yellow-400", text: "text-yellow-300" };
};
