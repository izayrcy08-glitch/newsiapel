import { Card } from "../components/Card";
import { getStatusIcon } from "../bersama/util_status_dan_warna";
import { useShowMore } from "../hooks/useShowMore";

export default function PanelPengajuan({ pengajuan, readOnly, onPengajuanVerifikasi, onClose }) {
  const pending = pengajuan.filter((p) => p.statusVerifikasi === "menunggu");
  const { showAll, toggle, visibleItems } = useShowMore(pending, 10);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">📥 Pengajuan Perubahan Status</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-slate-500 text-xs mb-4">Verifikasi pengajuan perubahan status pegawai</p>

        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/40 px-4 py-5 text-center">
            <div className="text-slate-300 text-sm font-semibold">Belum ada pengajuan status</div>
            <div className="text-slate-500 text-xs mt-1">Pengajuan dari pegawai akan muncul di sini.</div>
          </div>
        ) : (
          <>
            {visibleItems.map((p, i) => (
              <div key={p.id}>
                {i > 0 && <div className="border-t border-slate-800 my-4" />}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-slate-400">👤</span>
                  <span className="text-white text-sm font-semibold">{p.nama}</span>
                </div>
                <div className="text-slate-600 text-[10px] mb-3 ml-6">NIP: {p.nip}</div>

                <div className="text-slate-500 text-[10px] mb-1 ml-6">Status Saat Ini:</div>
                <div className="bg-slate-800/60 rounded-xl p-2 mb-2 ml-6">
                  <span className="text-slate-400 text-xs">{p.statusLama}</span>
                </div>

                <div className="text-slate-500 text-[10px] mb-1 ml-6">Pengajuan:</div>
                <div className="bg-slate-800/60 rounded-xl p-2 mb-2 ml-6">
                  {getStatusIcon(p.statusBaru) ? (
                    <><span className="text-sm">{getStatusIcon(p.statusBaru).icon}</span><span className="text-blue-300 text-xs ml-1">{getStatusIcon(p.statusBaru).label}</span></>
                  ) : (
                    <span className="text-blue-300 text-xs">{p.statusBaru}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-slate-500 text-xs mb-2 ml-6">
                  <span>📄</span>
                  {p.dokumen && p.dokumen.startsWith("http") ? (
                    <a href={p.dokumen} target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline underline-offset-2 truncate max-w-[200px]">
                      Lihat Lampiran ↗
                    </a>
                  ) : (
                    <span>{p.dokumen || "Tidak ada lampiran"}</span>
                  )}
                </div>

                {p.keterangan && (
                  <div className="text-slate-400 text-xs mb-2 ml-6 italic">"{p.keterangan}"</div>
                )}

                <div className="text-slate-500 text-xs mb-3 ml-6">🕘 {p.waktu || "—"} WIB</div>

                <div className="flex gap-2 ml-6">
                  <button onClick={() => onPengajuanVerifikasi?.(p.id, "disetujui")} disabled={readOnly}
                    className="flex-1 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                    ✅ Setujui
                  </button>
                  <button onClick={() => onPengajuanVerifikasi?.(p.id, "ditolak")} disabled={readOnly}
                    className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                    ❌ Tolak
                  </button>
                </div>
              </div>
            ))}
            {!showAll && pending.length > 10 && (
              <button onClick={toggle}
                className="mt-3 w-full py-2.5 rounded-xl bg-slate-800/80 text-slate-300 text-xs font-bold border border-slate-700/70 hover:border-orange-500/40 hover:text-orange-200 active:scale-[0.98] transition-all">
                Lihat Semua ({pending.length} pengajuan)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
