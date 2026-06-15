import { QRDisplay } from "./QRDisplay";

const FullscreenQR = ({ currentQr, qrActive, secsLeft, onExit }) => {
  return (
    <div className="fixed inset-0 z-[100] min-h-screen overflow-hidden bg-[#080c14] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#080c14] via-[#101827] to-[#06111f]" />
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[460px] w-[460px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <button
        onClick={onExit}
        className="fixed right-4 top-4 z-20 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white shadow-lg backdrop-blur-xl transition-all hover:bg-white/15 active:scale-[0.98] md:right-6 md:top-6"
      >
        Keluar
      </button>

      <div className="relative z-10 grid h-screen w-full grid-rows-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-4 py-3 text-center sm:px-8 sm:py-4 lg:px-12">
        <header className="flex min-h-0 flex-col items-center justify-center">
          <h1 className="text-[clamp(1.65rem,4.6vw,4.75rem)] font-black leading-none tracking-normal text-white">
            APEL PAGI
          </h1>
          <p className="mt-1 text-[clamp(0.95rem,2.1vw,2.15rem)] font-black leading-tight tracking-normal text-blue-100/90 sm:mt-2">
            DINAS PUPR KAB. BARITO UTARA
          </p>
        </header>

        <main className="flex min-h-0 w-full items-center justify-center overflow-hidden py-1">
          <div className={`relative flex items-center justify-center rounded-[2rem] border border-white/15 bg-white/10 p-[clamp(0.75rem,1.5vw,1.5rem)] shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl ${!qrActive && "opacity-30 grayscale"}`}>
            <QRDisplay
              token={currentQr?.token}
              size={1024}
              className="rounded-[1.5rem] shadow-2xl"
              style={{
                width: "min(86vw, 56dvh, 820px)",
                height: "min(86vw, 56dvh, 820px)",
              }}
            />
            {qrActive && (
              <div className="absolute right-2 top-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                {secsLeft}s
              </div>
            )}
          </div>
        </main>

        <section className="flex min-h-0 w-full flex-col items-center justify-center">
          <div className="min-w-[min(92vw,520px)] rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-2 shadow-[0_18px_50px_rgba(16,185,129,0.14)] backdrop-blur-xl sm:px-9 sm:py-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200/80 sm:text-sm">
              KODE ABSENSI
            </p>
            <div className="mt-1 font-mono text-[clamp(1.95rem,5.4vw,4.5rem)] font-black leading-none tracking-normal text-white">
              {qrActive && currentQr?.token ? currentQr.token : "------"}
            </div>
          </div>
          <footer className="mt-2 flex flex-col items-center justify-center text-[clamp(0.72rem,1.25vw,1rem)] font-semibold leading-tight text-slate-400 sm:mt-3">
            <p>Berganti setiap 10 detik</p>
            <p>Aktif hingga 08:00</p>
          </footer>
        </section>
      </div>
    </div>
  );
};

export { FullscreenQR };
export default FullscreenQR;
