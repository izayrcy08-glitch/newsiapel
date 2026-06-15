import { Card } from "../components/Card";
import { BackButton } from "../components/BackButton";
import { StatusBadge } from "../components/StatusBadge";

export default function PanelKoreksi({ people, attendance, onKoreksi, onBack }) {
  const tks = Object.entries(attendance)
    .filter(([, v]) => v.status === "Tanpa Keterangan")
    .map(([id]) => people.find((p) => p.id === parseInt(id)))
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />
        <h2 className="text-xl font-black text-white mb-1">Koreksi Absensi</h2>
        <p className="text-slate-500 text-xs mb-5">Ubah status Tanpa Keterangan</p>

        {tks.length === 0 ? (
          <Card className="p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-slate-400">Tidak ada yang perlu dikoreksi</div>
          </Card>
        ) : (
          <div className="space-y-3">
            {tks.map((p) => (
              <Card key={p.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-semibold truncate">{p.nama}</div>
                    <div className="text-slate-500 text-xs">{p.bidang}</div>
                  </div>
                  <StatusBadge status="Tanpa Keterangan" />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Izin", "Sakit", "Dinas Dalam", "Dinas Luar"].map((s) => (
                    <button
                      key={s}
                      onClick={() => onKoreksi(p.id, s)}
                      className="text-xs py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 transition-all active:scale-[0.97]"
                    >
                      → {s}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
