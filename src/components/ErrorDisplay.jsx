// ─── ERROR DISPLAY ────────────────────────────────────────────────
const ErrorDisplay = ({ message = "Terjadi kesalahan", onRetry }) => (
  <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4">
    <div className="flex flex-col items-center gap-4 text-center max-w-sm">
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-3xl">⚠️</div>
      <p className="text-red-400 text-sm font-semibold">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold border border-slate-700/50 transition-all"
        >
          Coba Lagi
        </button>
      )}
    </div>
  </div>
);

export { ErrorDisplay };
export default ErrorDisplay;
