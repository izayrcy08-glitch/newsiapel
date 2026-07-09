// ─── TOKEN FEEDBACK ────────────────────────────────────────────────
const TokenFeedback = ({ result }) => {
  if (!result) return null;

  const tone =
    result.type === "valid"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
      : result.type === "expired"
        ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
        : result.type === "timeout"
          ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
          : "border-red-500/40 bg-red-500/15 text-red-300";

  return (
    <div className={`mt-4 rounded-xl border px-4 py-3 text-center font-bold tracking-wide text-sm ${tone}`}>
      {result.label}
    </div>
  );
};

export { TokenFeedback };
export default TokenFeedback;
