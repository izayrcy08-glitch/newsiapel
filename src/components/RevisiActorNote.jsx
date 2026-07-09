import { formatRevisiActorLabel } from "../bersama/util_revisi";

const RevisiActorNote = ({ record, variant = "auto", className = "" }) => {
  const label = formatRevisiActorLabel(record, { variant });
  if (!label) return null;

  const isDitolak = record?.statusVerifikasi === "ditolak" || variant === "ditolak";
  const isKoreksi = record?.sumber === "koreksi_manual" || variant === "koreksi";

  const tone = isDitolak
    ? "text-red-300/90"
    : isKoreksi
      ? "text-blue-300/90"
      : "text-emerald-300/90";

  return (
    <p className={`text-[11px] font-medium ${tone} ${className}`}>
      {label}
    </p>
  );
};

export { RevisiActorNote };
export default RevisiActorNote;
