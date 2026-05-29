export default function Card({ children, className = "", onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-slate-900/60 border border-slate-700/50 rounded-2xl backdrop-blur-sm ${
        onClick ? "cursor-pointer hover:border-slate-600/70 hover:bg-slate-800/60 active:scale-[0.98]" : ""
      } transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
}
