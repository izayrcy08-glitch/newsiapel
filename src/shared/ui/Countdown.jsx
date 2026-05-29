import { useEffect, useState } from "react";

export default function Countdown({ targetHour, targetMinute = 0 }) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(targetHour, targetMinute, 0, 0);
      setSecs(Math.max(0, Math.ceil((target - now) / 1000)));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetHour, targetMinute]);

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  return (
    <div className="flex items-center gap-2 justify-center">
      {[h, m, s].map((value, index) => (
        <span key={index} className="flex items-center gap-2">
          <span className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-2xl font-mono font-bold text-white min-w-[3rem] text-center">
            {String(value).padStart(2, "0")}
          </span>
          {index < 2 && <span className="text-slate-500 text-xl font-bold">:</span>}
        </span>
      ))}
    </div>
  );
}
