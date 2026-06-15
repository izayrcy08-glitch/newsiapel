// ─── PROGRESS RING ────────────────────────────────────────────────────────────
const ProgressRing = ({ pct, size = 120, stroke = 8, color = "#10b981", label, sublabel }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-white leading-none">{pct}%</span>
        {label && <span className="text-[10px] text-slate-400 mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

export { ProgressRing };
export default ProgressRing;
