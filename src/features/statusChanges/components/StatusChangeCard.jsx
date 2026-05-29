import { useState } from "react";
import Card from "../../../shared/ui/Card";
import { getStatusIcon } from "../../../shared/utils/attendance";

export default function StatusChangeCard({ items }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <Card className="p-4 mb-4 border-slate-600/40 bg-slate-950/65">
        <div className="mb-3 border-b border-slate-700/50 pb-3">
          <div className="text-slate-50 font-bold text-sm">📋 Perubahan Status Hari Ini</div>
          <div className="text-slate-500 text-xs mt-0.5">Monitoring perubahan absensi pegawai</div>
        </div>

        {items.length === 0 ? (
          <div className="text-slate-500 text-xs text-center py-4">Belum ada perubahan status hari ini</div>
        ) : (
          <>
            <div className="text-center mb-4">
              <div className="text-2xl font-black text-white mb-1">{items.length}</div>
              <div className="text-slate-500 text-xs">Perubahan Status</div>
            </div>

            <div className="flex justify-center gap-6 mb-4">
              {[
                { status: "Dinas Luar", icon: "🚗" },
                { status: "Izin", icon: "📝" },
                { status: "Sakit", icon: "🤒" },
              ].map((item) => {
                const count = items.filter((entry) => entry.statusBaru === item.status).length;
                if (count === 0) return null;
                return (
                  <div key={item.status} className="text-center">
                    <div className="text-xl mb-0.5">{item.icon}</div>
                    <div className="text-white text-sm font-bold">{count}</div>
                    <div className="text-slate-600 text-[10px]">{item.status}</div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowDetail(true)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors border border-slate-700/50"
            >
              Lihat Detail
            </button>
          </>
        )}
      </Card>

      {showDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-bold">📋 Perubahan Status Hari Ini</h3>
                <p className="text-slate-500 text-xs mt-0.5">Monitoring perubahan absensi pegawai</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-slate-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="border-t border-slate-800/60 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-slate-400">🔄</span>
                    <span className="text-white text-sm font-semibold">{item.nama}</span>
                  </div>
                  <div className="text-slate-600 text-[10px] mb-2 ml-6">NIP: {item.nip}</div>

                  <div className="bg-slate-800/60 rounded-xl p-3 mb-2 ml-6">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs">{item.statusLama}</span>
                      <span className="text-slate-600">↓</span>
                      <span className="text-sm">{getStatusIcon(item.statusBaru).icon}</span>
                      <span className="text-blue-300 text-xs">{getStatusIcon(item.statusBaru).label}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-slate-500 text-xs ml-6 mb-2">
                    <span>📄 {item.dokumen}</span>
                    <span>🕘 {item.waktu} WIB</span>
                  </div>

                  <div className="ml-6">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        item.statusVerifikasi === "disetujui"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {item.statusVerifikasi === "disetujui" ? "🟢 Disetujui" : "🟡 Menunggu Verifikasi"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowDetail(false)}
              className="w-full mt-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors border border-slate-700/50"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
