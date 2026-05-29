import Card from "../../../shared/ui/Card";
import ProgressRing from "../../../shared/ui/ProgressRing";
import { getAttendanceStatItems } from "../../../shared/utils/attendance";

export default function StatisticsGrid({ apelStatus, stats }) {
  const unaccountedItem = getAttendanceStatItems(apelStatus)[1];
  const highlightItems = [
    { label: "Total Pegawai", val: stats.total, color: "text-white" },
    { label: unaccountedItem.label, val: stats[unaccountedItem.key], color: unaccountedItem.color },
    { label: "Hadir", val: stats.hadir, color: "text-emerald-400" },
  ];
  const breakdownItems = getAttendanceStatItems(apelStatus).map((item) => ({
    label: item.label,
    val: stats[item.key],
    icon: item.icon,
    color: item.color,
  }));

  return (
    <>
      <Card className="p-5 mb-4 border-amber-200/15 bg-slate-950/70 shadow-[0_18px_55px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-5">
          <ProgressRing pct={stats.persen} size={100} stroke={9} color="#f59e0b" label="Kehadiran" />
          <div className="flex-1 space-y-2">
            {highlightItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">{item.label}</span>
                <span className={`font-bold text-sm ${item.color}`}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {breakdownItems.map((item) => (
          <Card key={item.label} className="p-3 text-center border-slate-600/35 bg-slate-950/55 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
            <div className="text-xl mb-1">{item.icon}</div>
            <div className={`text-lg font-black ${item.color}`}>{item.val}</div>
            <div className="text-slate-400 text-xs leading-tight">{item.label}</div>
          </Card>
        ))}
      </div>
    </>
  );
}
