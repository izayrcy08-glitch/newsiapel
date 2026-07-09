import { useClock } from "../hooks/useClock";
import { formatTime } from "../bersama/util_waktu_dan_apel";

/** Baris waktu live — isolasi re-render dari parent dashboard. */
export function AdminTimeLine({ className = "text-slate-500 text-xs" }) {
  const { now } = useClock();
  return <p className={className}>{formatTime(now)}</p>;
}

export default AdminTimeLine;
