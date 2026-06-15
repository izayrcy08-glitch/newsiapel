import { QRCodeSVG } from "qrcode.react";

// ─── QR CODE DISPLAY ────────────────────────────────────────────────
const QRDisplay = ({ token, size = 200, className = "rounded-xl", style }) => {
  return (
    <QRCodeSVG
      value={token || "SIAPEL-QR-INACTIVE"}
      size={size}
      bgColor="#ffffff"
      fgColor="#0f172a"
      level="M"
      includeMargin
      className={className}
      style={style}
    />
  );
};

export { QRDisplay };
export default QRDisplay;
