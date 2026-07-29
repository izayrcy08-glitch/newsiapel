import { useMemo, useState } from "react";
import { usePegawaiSearch } from "../hooks/usePegawaiSearch";
import { useShowMore } from "../hooks/useShowMore";
import { getTanpaKeteranganTone } from "../bersama/util_status_dan_warna";

/**
 * Modal daftar Pegawai Perlu Perhatian — search + filter bidang + show-more.
 * Jangan expand list panjang di halaman dashboard.
 */
const PerhatianListModal = ({ items = [], onClose }) => {
  const [search, setSearch] = useState("");
  const [bidangFilter, setBidangFilter] = useState("");

  const searchable = useMemo(
    () =>
      items.map((r) => ({
        id: r.pegawaiId,
        nama: r.pegawai?.nama || "",
        nip: r.pegawai?.nip || "",
        bidang: r.pegawai?.bidang || "",
        totalTanpaKeterangan: r.totalTanpaKeterangan,
      })),
    [items]
  );

  const bidangList = useMemo(
    () => [...new Set(searchable.map((p) => p.bidang).filter(Boolean))].sort(),
    [searchable]
  );

  const { filtered } = usePegawaiSearch(searchable, search, {
    searchFields: ["nama", "nip", "bidang"],
  });

  const filteredByBidang = useMemo(
    () => (bidangFilter ? filtered.filter((p) => p.bidang === bidangFilter) : filtered),
    [filtered, bidangFilter]
  );

  const { showAll, toggle, visibleItems } = useShowMore(filteredByBidang, 10);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="perhatian-modal-title"
      >
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between shrink-0">
          <div>
            <h3 id="perhatian-modal-title" className="text-white font-bold text-sm">
              Pegawai Perlu Perhatian
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              {filteredByBidang.length} dari {items.length} pegawai
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

        <div className="px-4 pt-3 shrink-0 space-y-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau NIP..."
            aria-label="Cari pegawai"
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500"
          />
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setBidangFilter("")}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${
                !bidangFilter
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600"
              }`}
            >
              Semua
            </button>
            {bidangList.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBidangFilter(b)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${
                  bidangFilter === b
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                    : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-1.5 flex-1">
          {visibleItems.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-6">
              {items.length === 0 ? "Tidak ada pegawai" : "Tidak ada hasil pencarian"}
            </div>
          ) : (
            visibleItems.map((p) => {
              const tone = getTanpaKeteranganTone(p.totalTanpaKeterangan);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-sm font-semibold truncate">{p.nama}</div>
                    <div className="text-slate-500 text-[10px] truncate">
                      {p.bidang || "—"} · NIP {p.nip || "—"}
                    </div>
                  </div>
                  <span className={`text-sm font-black shrink-0 ${tone.text}`}>
                    {p.totalTanpaKeterangan}x
                  </span>
                </div>
              );
            })
          )}
          {filteredByBidang.length > 10 && (
            <button
              type="button"
              onClick={toggle}
              className="w-full mt-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700 hover:border-slate-500"
            >
              {showAll ? "Tampilkan lebih sedikit" : `Lihat semua (${filteredByBidang.length})`}
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

export { PerhatianListModal };
export default PerhatianListModal;
