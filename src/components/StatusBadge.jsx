import { STATUS_COLORS } from "../bersama/util_status_dan_warna";

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

export { StatusBadge };
export default StatusBadge;
