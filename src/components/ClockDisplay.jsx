import { useClock } from "../hooks/useClock";

/** Jam/tanggal live — isolasi re-render dari parent dashboard. */
const ClockDisplay = ({ showDate = true, showSeconds = true, className = "" }) => {
  const { dateStr, timeWIB } = useClock();

  return (
    <div className={className}>
      {showDate && (
        <div className="text-amber-200/90 text-xs font-medium leading-tight">{dateStr}</div>
      )}
      <div className="text-white text-lg font-bold font-mono tracking-wide mt-1">
        {showSeconds ? timeWIB : timeWIB.slice(0, 5)}{" "}
        <span className="text-amber-200/60 text-xs font-normal">WIB</span>
      </div>
    </div>
  );
};

export { ClockDisplay };
export default ClockDisplay;
