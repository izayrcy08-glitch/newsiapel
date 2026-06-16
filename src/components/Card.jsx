import { cn } from "../lib/utils";

// ─── GLASS CARD ───────────────────────────────────────────────
const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick}
    className={cn(
      "bg-slate-900/60 border border-slate-700/50 rounded-2xl backdrop-blur-sm transition-all duration-200",
      onClick && "cursor-pointer hover:border-slate-600/70 hover:bg-slate-800/60 active:scale-[0.98]",
      className
    )}>
    {children}
  </div>
);

export { Card };
export default Card;
