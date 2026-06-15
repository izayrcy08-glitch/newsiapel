import { BackButton } from "../components/BackButton";
import { ProfileLines } from "../fitur/bersama/profile_lines";
import { getUnitLabel } from "../bersama/util_unit_dan_scope";

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: PIMPINAN SELECTOR
// ══════════════════════════════════════════════════════════════════════════════
const PimpinanSelector = ({ pimpinanAccessRoles = [], onBack, onSelect }) => {
  const executive = pimpinanAccessRoles.filter((item) => item.group === "EXECUTIVE");
  const unitLeaders = pimpinanAccessRoles.filter((item) => item.group === "UNIT_LEADER");

  const renderCard = (item) => (
    <button
      key={item.id}
      onClick={() => onSelect(item)}
      className="group w-full text-left rounded-2xl border border-slate-700/60 bg-slate-900/75 p-4 transition-all duration-200 hover:border-amber-500/40 hover:bg-slate-900 active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${
          item.group === "EXECUTIVE" ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/20 text-blue-300"
        }`}>
          {item.group === "EXECUTIVE" ? "E" : "U"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <ProfileLines
              name={item.name}
              nip={item.nip}
              jabatan={item.jabatan}
              nameClassName="text-white text-sm font-semibold"
              metaClassName="text-slate-400 text-[11px]"
              containerClassName="flex-1"
            />
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-slate-600 group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${
              item.group === "EXECUTIVE" ? "bg-amber-500/15 text-amber-300" : "bg-blue-500/15 text-blue-300"
            }`}>
              {item.group}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-300">
              {item.scope}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-300">
              {getUnitLabel(item.unit)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />

        <div className="mb-5">
          <h2 className="text-xl font-black text-white">Pilih Role Pimpinan</h2>
          <p className="mt-1 text-slate-500 text-xs">Executive dan Unit Leader memakai dashboard yang sama, scope datanya yang berbeda.</p>
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">Executive</div>
            <div className="space-y-3">
              {executive.map(renderCard)}
            </div>
          </div>

          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200/70">Unit Leader</div>
            <div className="space-y-3">
              {unitLeaders.map(renderCard)}
            </div>
          </div>
        </div>
      </div>
      </div>
  );
};

export { PimpinanSelector };
export default PimpinanSelector;
