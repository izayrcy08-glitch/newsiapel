import { Card } from "../components/Card";
import { QRDisplay } from "../components/QRDisplay";

export default function PanelQR({ currentQr, qrActive, secsLeft, apelStatus, enterFullscreenQr }) {
  return (
    <Card className={`p-5 mb-5 flex flex-col items-center ${qrActive ? "border-emerald-500/30" : "border-slate-700/50"}`}>
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
        {qrActive ? "QR Apel Aktif" : "QR Apel Nonaktif"}
      </p>

      <div className={`relative ${!qrActive && "opacity-30 grayscale"}`}>
        <QRDisplay token={currentQr?.token} />
        {qrActive && (
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
            {secsLeft}
          </div>
        )}
      </div>

      {qrActive && currentQr?.token && (
        <div className="mt-3 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-2xl font-black font-mono">
          {currentQr.token}
        </div>
      )}

      <p className="text-slate-500 text-xs mt-3 text-center">
        {qrActive
          ? "Berganti setiap 10 detik · Aktif hingga 08:00"
          : apelStatus === "before"
            ? "QR aktif otomatis pada pukul 07:00"
            : "Sesi apel telah berakhir pukul 08:00"}
      </p>

      <button onClick={enterFullscreenQr} disabled={!qrActive}
        className={`mt-4 w-full rounded-xl py-3 text-sm font-black transition-all active:scale-[0.98] ${
          qrActive
            ? "bg-white text-slate-950 hover:bg-slate-200"
            : "cursor-not-allowed bg-slate-800 text-slate-600"
        }`}>
        Fullscreen QR
      </button>
    </Card>
  );
}
