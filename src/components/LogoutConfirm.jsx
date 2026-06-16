import { useState } from "react";
import { LogOut } from "lucide-react";

// ─── LOGOUT CONFIRM — reusable button + confirmation modal ─────
const LogoutConfirm = ({ onConfirm }) => {
  const [show, setShow] = useState(false);

  return (
    <>
      {/* ── Trigger button (pojok kanan atas) ── */}
      <div className="flex justify-end mb-4">
        <button onClick={() => setShow(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/30 backdrop-blur-md border border-blue-700/20 hover:border-red-400/50 hover:bg-red-950/20 group transition-all duration-200 active:scale-[0.95] text-xs">
          <LogOut className="w-3.5 h-3.5 text-blue-400 group-hover:text-red-400 transition-colors" />
          <span className="text-slate-400 group-hover:text-red-300 transition-colors">Keluar</span>
        </button>
      </div>

      {/* ── Konfirmasi modal ── */}
      {show && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/50 backdrop-blur-xl border border-blue-700/20 rounded-2xl p-6 w-full max-w-xs text-center shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-red-400" />
            </div>
            <div className="text-white font-bold text-lg mb-2">Yakin keluar?</div>
            <div className="text-slate-400 text-xs mb-6">Anda akan kembali ke halaman login</div>
            <div className="flex gap-3">
              <button onClick={() => setShow(false)}
                className="flex-1 py-2.5 rounded-xl bg-blue-900/30 backdrop-blur-md hover:bg-blue-800/40 text-slate-300 text-sm font-semibold transition-all border border-blue-700/30 active:scale-[0.97]">
                Batal
              </button>
              <button onClick={() => { setShow(false); onConfirm(); }}
                className="flex-1 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 text-sm font-semibold transition-all border border-red-500/30 active:scale-[0.97]">
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export { LogoutConfirm };
export default LogoutConfirm;
