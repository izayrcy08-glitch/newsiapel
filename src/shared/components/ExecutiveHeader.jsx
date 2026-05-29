import { getGreeting } from "../utils/time";

export default function ExecutiveHeader({ currentTime, leader, organizationName, formatDate, formatTime }) {
  return (
    <div className="mb-6 border-b border-amber-200/10 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-amber-200/80 text-sm font-medium">{getGreeting()},</p>
          <h1 className="text-xl font-black text-slate-50 leading-tight">{leader.nama}</h1>
          {leader.nip && <p className="text-slate-400 text-xs mt-0.5">NIP. {leader.nip}</p>}
          <p className="text-slate-400 text-xs mt-0.5">
            {leader.jabatan} · {organizationName}
          </p>
        </div>
        <div className="text-right shrink-0 hidden sm:block">
          <div className="text-amber-200/90 text-xs font-medium leading-tight">{formatDate(currentTime)}</div>
          <div className="text-white text-lg font-bold font-mono tracking-wide mt-1">
            {formatTime(currentTime)} <span className="text-amber-200/60 text-xs font-normal">WIB</span>
          </div>
        </div>
      </div>
      <div className="sm:hidden mt-3 pt-3 border-t border-amber-200/10 flex items-center justify-between">
        <span className="text-amber-200/80 text-xs">{formatDate(currentTime)}</span>
        <span className="text-white text-sm font-bold font-mono">
          {formatTime(currentTime)} <span className="text-amber-200/60 text-xs font-normal">WIB</span>
        </span>
      </div>
    </div>
  );
}
