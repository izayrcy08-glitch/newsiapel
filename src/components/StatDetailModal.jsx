import { Card } from "./Card";

const StatDetailModal = ({ statItem, people, onClose }) => {
  if (!statItem) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-sm">
              {statItem.icon} {statItem.label}
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">{people.length} pegawai</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2 flex-1">
          {people.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-6">Tidak ada pegawai</div>
          ) : (
            people.map((p, idx) => (
              <Card key={p.id} className="p-3 border-slate-700/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-semibold truncate">
                      {statItem.key === "hadir" ? `${idx + 1}. ` : ""}{p.nama}
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
        </div>
        <div className="p-4 border-t border-slate-700/50">
          <button
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
