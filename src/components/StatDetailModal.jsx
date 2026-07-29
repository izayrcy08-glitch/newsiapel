import { useMemo, useState } from "react";
import { Card } from "./Card";
import { usePegawaiSearch } from "../hooks/usePegawaiSearch";
import { useShowMore } from "../hooks/useShowMore";

const StatDetailModal = ({ statItem, people = [], onClose }) => {
  const [search, setSearch] = useState("");

  const searchable = useMemo(
    () =>
      people.map((p) => ({
        ...p,
        id: p.id,
        nama: p.nama || "",
        nip: p.nip || "",
        bidang: p.bidang || "",
      })),
    [people]
  );

  const { filtered } = usePegawaiSearch(searchable, search, {
    searchFields: ["nama", "nip", "bidang"],
  });

  const { showAll, toggle, visibleItems } = useShowMore(filtered, 10);

  if (!statItem) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stat-detail-title"
      >
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between shrink-0">
          <div>
            <h3 id="stat-detail-title" className="text-white font-bold text-sm">
              {statItem.icon} {statItem.label}
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              {filtered.length} dari {people.length} pegawai
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {people.length > 5 && (
          <div className="px-4 pt-3 shrink-0">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau NIP..."
              aria-label="Cari pegawai"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500"
            />
          </div>
        )}

        <div className="overflow-y-auto p-4 space-y-2 flex-1">
          {visibleItems.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-6">
              {people.length === 0 ? "Tidak ada pegawai" : "Tidak ada hasil pencarian"}
            </div>
          ) : (
            visibleItems.map((p, idx) => (
              <Card key={p.id} className="p-3 border-slate-700/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-semibold truncate">
                      {statItem.key === "hadir" ? `${idx + 1}. ` : ""}
                      {p.nama}
                    </div>
                    <div className="text-slate-500 text-[10px]">NIP {p.nip}</div>
                    {p.bidang && (
                      <div className="text-slate-500 text-[10px] truncate">{p.bidang}</div>
                    )}
                  </div>
                  {p.jamHadir && (
                    <span className="text-emerald-400 text-xs font-bold shrink-0">{p.jamHadir}</span>
                  )}
                </div>
              </Card>
            ))
          )}
          {filtered.length > 10 && (
            <button
              type="button"
              onClick={toggle}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700 hover:border-slate-500"
            >
              {showAll ? "Tampilkan lebih sedikit" : `Lihat semua (${filtered.length})`}
            </button>
          )}
        </div>

        <div className="p-4 border-t border-slate-700/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export { StatDetailModal };
export default StatDetailModal;
