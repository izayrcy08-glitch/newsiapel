import Card from "../../../shared/ui/Card";

export default function StatusTodayCard({
  now,
  displayStatus,
  showAttendanceTime,
  attendanceTime,
  discipline,
  tanpaKeteranganBulanIni,
  onOpenRules,
}) {
  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Status Hari Ini</span>
        <span className="text-slate-500 text-xs">{now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col items-center text-center">
          <div className="flex flex-col items-center mb-2">
            <span className="text-lg mb-1">🟢</span>
            <span className="text-emerald-400 text-xs font-semibold">
              {displayStatus === "Hadir" ? "Hadir" : displayStatus}
            </span>
          </div>

          <div className="text-white text-sm font-bold mb-2">
            {now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
          </div>

          {showAttendanceTime ? (
            <div>
              <div className="text-slate-500 text-xs">Jam Hadir</div>
              <div className="text-white text-xl font-black">{attendanceTime} WIB</div>
            </div>
          ) : (
            <div className="text-slate-500 text-xs">Belum Absen</div>
          )}
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col items-center text-center">
          <div className="flex flex-col items-center mb-2">
            <span className="text-lg mb-1">{discipline.icon}</span>
            <span className="text-amber-400 text-xs font-semibold">Bulan Ini</span>
          </div>

          <div className="text-white text-xl font-black leading-tight">{tanpaKeteranganBulanIni} Kali</div>
          <div className="text-slate-400 text-xs mt-1">Tanpa Keterangan</div>

          <div
            className={`text-xs font-semibold mt-2 ${
              tanpaKeteranganBulanIni === 0
                ? "text-emerald-400"
                : tanpaKeteranganBulanIni <= 2
                  ? "text-amber-400"
                  : tanpaKeteranganBulanIni <= 4
                    ? "text-orange-400"
                    : "text-red-400"
            }`}
          >
            {discipline.label}
          </div>

          <button
            onClick={onOpenRules}
            className="mt-3 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/50 transition-all active:scale-[0.98]"
          >
            Lihat Aturan
          </button>
        </div>
      </div>
    </Card>
  );
}
