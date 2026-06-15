import { useState } from "react";
import { Card } from "../components/Card";
import { BackButton } from "../components/BackButton";
import { StatusBadge } from "../components/StatusBadge";
import { useShowMore } from "../hooks/useShowMore";
import { usePegawaiSearch } from "../hooks/usePegawaiSearch";

export default function PanelAbsensi({ people, attendance, now, onBack }) {
  const [search, setSearch] = useState("");
  const { filtered } = usePegawaiSearch(people, search, {
    searchFields: ["nama", "nip", "bidang", "jabatan"],
  });
  const { showAll, toggle, visibleItems } = useShowMore(filtered, 7);

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />
        <h2 className="text-xl font-black text-white mb-1">Absensi Hari Ini</h2>
        <p className="text-slate-500 text-xs mb-5">
          {now.toLocaleDateString("id-ID", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
        </p>

        <div className="relative mb-4">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NIP, bidang atau UPT..."
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:bg-slate-800"
          />
        </div>

        <div className="space-y-2">
          {visibleItems.length === 0 ? (
            <Card className="p-6 text-center">
              <div className="text-slate-400 text-sm">Pegawai tidak ditemukan</div>
            </Card>
          ) : (
            visibleItems.map((p) => {
              const att = attendance[p.id];
              return (
                <Card key={p.id} className="p-3.5">
                  <div className="mb-3">
                    <div className="text-white text-sm font-semibold leading-snug">{p.nama}</div>
                    <div className="text-slate-500 text-xs mt-1">NIP: {p.nip}</div>
                    <div className="text-slate-500 text-xs">Bidang / UPT: {p.bidang}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px] uppercase font-semibold tracking-wider mb-1">Status Saat Ini</div>
                    {att?.status ? <StatusBadge status={att.status} /> : <StatusBadge status="Belum" />}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {!showAll && filtered.length > 7 && (
          <button onClick={toggle}
            className="mt-3 w-full py-2.5 rounded-xl bg-slate-800/80 text-slate-300 text-xs font-bold border border-slate-700/70 hover:border-cyan-500/40 hover:text-cyan-200 active:scale-[0.98] transition-all">
            Lihat Semua ({filtered.length} pegawai)
          </button>
        )}
        {showAll && filtered.length > 7 && (
          <button onClick={toggle}
            className="mt-3 w-full py-2.5 rounded-xl bg-slate-800/80 text-slate-300 text-xs font-bold border border-slate-700/70 hover:border-cyan-500/40 hover:text-cyan-200 active:scale-[0.98] transition-all">
            Tampilkan 7 pegawai
          </button>
        )}
      </div>
    </div>
  );
}
