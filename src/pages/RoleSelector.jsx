// ══════════════════════════════════════════════════════════════════════════════
// PAGE: ROLE SELECTOR
// ══════════════════════════════════════════════════════════════════════════════
const RoleSelector = ({ onSelect }) => {
  const roles = [
    { id: "pegawai", label: "Pegawai", desc: "Absensi & lihat status pribadi", icon: "👤", color: "from-emerald-500/20 to-teal-500/10", border: "hover:border-emerald-500/50" },
    { id: "pimpinan", label: "Pimpinan", desc: "Dashboard eksekutif & rekap", icon: "⭐", color: "from-amber-500/20 to-yellow-500/10", border: "hover:border-amber-500/50" },
    { id: "admin", label: "Admin", desc: "Pusat operasional & QR apel", icon: "🛡️", color: "from-blue-500/20 to-indigo-500/10", border: "hover:border-blue-500/50" },
  ];
  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center px-4 py-12">
      {/* BG decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <img
  src="/logo-siapel.png"
  alt="SIAPEL"
  className="w-40 h-40 mx-auto mb-4 drop-shadow-2xl"
/>
          <h1 className="text-5xl font-black text-white tracking-tight">SIAPEL</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium tracking-wider">Sistem Informasi Apel Pegawai</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-xs text-slate-600">Dinas PUPR</span>
            <span className="text-slate-700">·</span>
            <span className="text-xs text-slate-600">Barito Utara</span>
          </div>
        </div>

        <p className="text-slate-500 text-xs text-center mb-5 tracking-widest uppercase font-semibold">Masuk sebagai</p>

        <div className="flex flex-col gap-3">
          {roles.map((r) => (
            <button key={r.id} onClick={() => onSelect(r.id)}
              className={`group relative text-left p-4 rounded-2xl bg-gradient-to-br ${r.color} border border-slate-700/60 ${r.border} transition-all duration-200 active:scale-[0.98] hover:shadow-lg`}>
              <div className="flex items-center gap-4">
                <span className="text-3xl">{r.icon}</span>
                <div>
                  <div className="text-white font-bold text-base">{r.label}</div>
                  <div className="text-slate-400 text-xs mt-0.5">{r.desc}</div>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-400 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 border-t border-slate-800/70 pt-4">
          <button
            onClick={() => onSelect("developer")}
            className="group relative w-full text-left rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900/95 to-slate-800/80 p-4 transition-all duration-200 hover:border-slate-500/70 hover:shadow-lg active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-2xl">🔧</span>
              <div className="min-w-0">
                <div className="text-white font-bold text-base">Developer</div>
                <div className="text-slate-400 text-xs mt-0.5">Teknis internal, demo, recovery, dan audit</div>
              </div>
              <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-400 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        <p className="text-center text-slate-700 text-xs mt-8">Prototype v1.0 · Hanya untuk demonstrasi</p>
      </div>
    </div>
  );
};

export { RoleSelector };
export default RoleSelector;
