import Card from "../../../shared/ui/Card";
import Countdown from "../../../shared/ui/Countdown";

export default function SessionCard({ apelStatus }) {
  return (
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
  );
}
