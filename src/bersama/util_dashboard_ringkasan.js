export const getBidangPerformanceStatus = (persen) => {
  if (persen >= 90) return { label: "Sangat Baik", color: "text-emerald-300", bg: "bg-emerald-500/15", border: "border-emerald-500/30" };
  if (persen >= 80) return { label: "Baik", color: "text-blue-300", bg: "bg-blue-500/15", border: "border-blue-500/30" };
  if (persen >= 70) return { label: "Perlu Perhatian", color: "text-amber-300", bg: "bg-amber-500/15", border: "border-amber-500/30" };
  return { label: "Perlu Tindak Lanjut", color: "text-red-300", bg: "bg-red-500/15", border: "border-red-500/30" };
};

export const RANK_MEDALS = ["🥇", "🥈", "🥉"];
