import { useState } from "react";
import Card from "../../../shared/ui/Card";

function getSanctionText(count) {
  if (count >= 5) return "Pemotongan TPP 10%";
  if (count === 4) return "SP2";
  if (count === 3) return "SP1";
  return "Belum Ada Sanksi";
}

function getIndicatorClass(count) {
  if (count >= 5) return "bg-red-500";
  if (count === 4) return "bg-orange-500";
  if (count >= 2) return "bg-yellow-400";
  return "bg-slate-200";
}

export default function AttentionEmployees({ items }) {
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? items : items.slice(0, 3);

  return (
    <Card className="p-4 mb-4 border-slate-600/40 bg-slate-950/65 shadow-[0_14px_42px_rgba(0,0,0,0.24)]">
      <div className="mb-3 border-b border-slate-700/50 pb-3">
        <div className="text-slate-50 font-bold text-sm">Pegawai Perlu Perhatian</div>
        <div className="text-slate-500 text-xs mt-0.5">Top 3 berdasarkan sanksi bulan ini</div>
      </div>

      <div className="space-y-2">
        {visibleItems.map((item) => {
          const tanpaKeterangan = item.totalTanpaKeterangan;
          return (
            <div key={item.pegawaiId} className="rounded-xl border border-slate-700/50 bg-slate-900/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${getIndicatorClass(tanpaKeterangan)}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-white text-sm font-semibold truncate">{item.pegawai.nama}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5 truncate">NIP {item.pegawai.nip}</div>
                  <div className="text-slate-400 text-xs mt-1 truncate">Bidang/UPT: {item.pegawai.bidang}</div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-amber-200/10">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">Tanpa Keterangan</span>
                  <span className="text-red-400 text-sm font-black">{tanpaKeterangan}x</span>
                </div>
                <div className="mt-1 text-sm font-black text-white">{getSanctionText(tanpaKeterangan)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setShowAll((prev) => !prev)}
        className="mt-3 w-full py-2.5 rounded-xl bg-slate-900/80 text-slate-300 text-xs font-bold border border-slate-700/70 hover:border-amber-200/25 hover:text-amber-100 active:scale-[0.98] transition-all"
      >
        {showAll ? "Tutup Detail" : "Lihat Semua"}
      </button>
    </Card>
  );
}
