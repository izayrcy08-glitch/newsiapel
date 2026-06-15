// ─── LOADING SPINNER ────────────────────────────────────────────────
const LoadingSpinner = ({ message = "Memuat data..." }) => (
  <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-emerald-400 animate-spin" />
      <p className="text-slate-400 text-sm font-medium">{message}</p>
    </div>
  </div>
);

export { LoadingSpinner };
export default LoadingSpinner;
