// ─── BACK BUTTON ─────────────────────────────────────────────────────────────
const BackButton = ({ onClick }) => (
  <button onClick={onClick}
    className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors mb-4">
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
    Kembali
  </button>
);

export { BackButton };
export default BackButton;
