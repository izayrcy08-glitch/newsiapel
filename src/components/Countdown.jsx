import { useState, useEffect } from "react";

// ─── COUNTDOWN ───────────────────────────────────────────────────────────────
const Countdown = ({ targetHour, targetMinute = 0 }) => {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(targetHour, targetMinute, 0, 0);
      setSecs(Math.max(0, Math.ceil((target - now) / 1000)));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetHour, targetMinute]);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <div className="flex items-center gap-2 justify-center">
      {[h, m, s].map((v, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-2xl font-mono font-bold text-white min-w-[3rem] text-center">
            {String(v).padStart(2, "0")}
          </span>
          {i < 2 && <span className="text-slate-500 text-xl font-bold">:</span>}
        </span>
      ))}
    </div>
  );
};

export { Countdown };
export default Countdown;
