import { useState } from "react";
import pegawaiData from "../data/pegawai_master.json";
import { BackButton } from "../components/BackButton";
import { Card } from "../components/Card";
import { ProfileLines } from "../fitur/bersama/profile_lines";
import { getUnitLabel } from "../bersama/util_unit_dan_scope";
import { usePegawaiSearch } from "../hooks/usePegawaiSearch";

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: PEGAWAI LOGIN
// ══════════════════════════════════════════════════════════════════════════════
const PegawaiLogin = ({ people = pegawaiData, onBack, onLogin }) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const { filtered, grouped: groupedEntries } = usePegawaiSearch(people, search);

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }}
            placeholder="Cari nama pegawai..."
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800" />
        </div>

        {/* List */}
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 scrollbar-thin">
          {search.trim() !== '' && groupedEntries.map(([groupKey, items]) => (
            <div key={groupKey} className="space-y-2">
              <div className="flex items-center gap-3 px-1">
                <div>
                  <div className="text-slate-300 text-[11px] font-semibold uppercase tracking-[0.18em]">
                    {getPegawaiGroupLabel(groupKey)}
                  </div>
                  <div className="text-slate-500 text-[10px] mt-0.5">{items.length} pegawai</div>
                </div>
                <div className="h-px flex-1 bg-slate-800/70" />
              </div>
              <div className="space-y-2">
                {items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 active:scale-[0.98] ${selected?.id === p.id
                      ? "bg-emerald-500/20 border-emerald-500/50"
                      : "bg-slate-900/60 border-slate-700/50 hover:border-slate-600/70 hover:bg-slate-800/60"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {p.nama.split(" ").slice(0, 2).map(n => n[0]).join("")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <ProfileLines
                          name={p.nama}
                          nip={p.nip}
                          jabatan={p.jabatan}
                          nameClassName="text-white text-sm font-semibold"
                          metaClassName="text-slate-500 text-xs"
                        />
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                            {getUnitLabel(p.unit) || "Tanpa Unit"}
                          </span>
                          {p.bidang && p.bidang !== getUnitLabel(p.unit) ? (
                            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {p.bidang}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {selected?.id === p.id && (
                        <svg className="w-5 h-5 text-emerald-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-slate-600 py-8 text-sm">Pegawai tidak ditemukan</div>
          )}
        </div>

        {selected && (
          <div className="mt-4 sticky bottom-0 pb-2">
            <Card className="p-3 mb-3 border-emerald-500/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center text-white text-sm font-bold">
                  {selected.nama.split(" ").slice(0, 2).map(n => n[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white text-sm font-semibold">{selected.nama}</div>
                  {selected.nip ? <div className="text-slate-400 text-xs mt-0.5">NIP: {selected.nip}</div> : null}
                  <div className="text-slate-400 text-xs mt-0.5">
                    {getUnitLabel(selected.unit) || selected.bidang || ""}
                    {selected.bidang && getUnitLabel(selected.unit) && selected.bidang !== getUnitLabel(selected.unit) ? ` · ${selected.bidang}` : ""}
                  </div>
                  {selected.jabatan ? <div className="text-slate-400 text-xs mt-0.5">{selected.jabatan}</div> : null}
                </div>
              </div>
            </Card>
            <button onClick={() => onLogin(selected)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl transition-all duration-150 shadow-lg shadow-emerald-500/20">
              Masuk Sebagai Pegawai
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export { PegawaiLogin };
export default PegawaiLogin;
