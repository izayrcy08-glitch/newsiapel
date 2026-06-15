import { useState, useMemo } from "react";
import pegawaiData from "../data/pegawai_master.json";
import { Card } from "../components/Card";
import { BackButton } from "../components/BackButton";
import { Eye, EyeOff } from "lucide-react";
import { ProfileLines } from "../fitur/bersama/profile_lines";
import { DashboardPegawai } from "./DashboardPegawai";
import { DashboardPimpinan } from "./DashboardPimpinan";
import { DashboardAdmin } from "./DashboardAdmin";
import { getUnitLabel } from "../bersama/util_unit_dan_scope";
import PanelKelolaPegawai from "../panels/PanelKelolaPegawai";
import PanelKoreksi from "../panels/PanelKoreksi";

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const PASSWORD_STORAGE = {
  admin: { key: "siapel.adminPassword", default: "123455" },
  developer: { key: "siapel.developerPassword", default: "723254" },
};

const getStoredPassword = (type) => {
  const cfg = PASSWORD_STORAGE[type];
  if (!cfg) return "";
  try {
    return window.localStorage.getItem(cfg.key) || cfg.default;
  } catch {
    return cfg.default;
  }
};

const savePassword = (type, newPw) => {
  const cfg = PASSWORD_STORAGE[type];
  if (!cfg) return false;
  try {
    window.localStorage.setItem(cfg.key, newPw);
    return true;
  } catch {
    return false;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// STATIC sub-components (defined OUTSIDE to prevent React remount on re-render)
// ══════════════════════════════════════════════════════════════════════════════
const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <svg
      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder || "Cari nama, unit, jabatan..."}
      className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800 transition-all duration-150"
    />
  </div>
);

// ── Pegawai search logic ──
function searchPegawai(people, query) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return [];
  const matched = people.filter((p) => {
    const haystack = [p.nama, p.nip, p.jabatan, p.unit, p.role]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
  return matched.sort((a, b) => {
    const aName = (a.nama || "").toLowerCase();
    const bName = (b.nama || "").toLowerCase();
    const aPrefix = aName.startsWith(q) ? 0 : 1;
    const bPrefix = bName.startsWith(q) ? 0 : 1;
    return aPrefix - bPrefix;
  });
}

// ── Inner password form — 1 field: tampilkan password saat ini, ubah langsung ──
const PasswordForm = ({ type, onSavePasswordOverride }) => {
  const [password, setPassword] = useState(getStoredPassword(type));
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const label = type === "admin" ? "Admin" : "Developer";
  const emoji = type === "admin" ? "🛡️" : "🔧";

  const handleSave = () => {
    setMessage("");
    setIsError(false);

    if (!/^\d{6}$/.test(password)) {
      setMessage("Password harus 6 digit angka");
      setIsError(true);
      return;
    }

    const ok = savePassword(type, password);
    if (!ok) {
      setMessage("Gagal menyimpan — coba lagi");
      setIsError(true);
      return;
    }

    // Simpan juga ke Firebase agar berlaku di semua domain
    onSavePasswordOverride?.(type, password);

    setMessage("✓ Password berhasil diubah");
    setIsError(false);
  };

  return (
    <Card className="p-4 border-slate-700/60 bg-slate-900/80">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg">
          {emoji}
        </div>
        <div>
          <div className="text-white text-sm font-bold">Akun {label}</div>
          <div className="text-slate-500 text-[11px]">
            Username: <span className="font-mono text-slate-400">{type}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              inputMode="numeric"
              value={password}
              onFocus={(e) => e.target.select()}
              onChange={(e) => { setPassword(e.target.value.replace(/\D/g, "")); setMessage(""); }}
              maxLength={6}
              className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 pr-11 text-sm text-white text-center tracking-[0.3em] placeholder-slate-600 focus:border-violet-500/60 focus:outline-none"
              placeholder="password saat ini"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {message && (
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs ${
            isError
              ? "bg-red-500/10 border border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
          }`}>
            <span>{message}</span>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!/^\d{6}$/.test(password)}
          className="w-full rounded-xl bg-violet-500/20 border border-violet-500/30 py-3 text-sm font-semibold text-violet-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-500/30 transition-colors"
        >
          Simpan Password
        </button>
      </div>
    </Card>
  );
};

// ── Ganti Password Page (with Admin / Developer tabs) ──
const PasswordChangeForm = ({ onBack, onSavePasswordOverride }) => {
  const [tab, setTab] = useState("admin");

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />
        <div className="mb-4">
          <h2 className="text-xl font-black text-white">Ganti Password</h2>
          <p className="mt-1 text-slate-500 text-xs">Ubah password akun admin atau developer — 6 digit angka.</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl border border-slate-700/60 bg-slate-900/60 p-0.5 mb-4">
          <button onClick={() => setTab("admin")}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              tab === "admin" ? "bg-violet-500/20 text-violet-300 shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}>
            🛡️ Admin
          </button>
          <button onClick={() => setTab("developer")}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              tab === "developer" ? "bg-violet-500/20 text-violet-300 shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}>
            🔧 Developer
          </button>
        </div>

        <PasswordForm key={tab} type={tab} onSavePasswordOverride={onSavePasswordOverride} />
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: DEVELOPER CONSOLE
// ══════════════════════════════════════════════════════════════════════════════
const DeveloperConsole = ({
  onBack,
  masterPegawaiData,
  attendance,
  pengajuan = [],
  apelStatus,
  apelSession,
  apelReason,
  apelReasonText,
  onScan,
  onReset,
  onKoreksi,
  onApelSessionChange,
  onApelReasonChange,
  onScanSimulate,
  onPengajuanSubmit,
  onPengajuanVerifikasi,
  onAddPegawai,
  onUpdatePegawai,
  onDeletePegawai,
  onSavePasswordOverride,
}) => {
  const [search, setSearch] = useState("");
  const [viewAsRole, setViewAsRole] = useState(null);
  const [viewAsPersonId, setViewAsPersonId] = useState("");
  const [activeMenu, setActiveMenu] = useState(null);

  const summaryCards = [
    { label: "Total Data", value: masterPegawaiData.length, tone: "text-white" },
    { label: "Executive", value: masterPegawaiData.filter((p) => p.role === "EXECUTIVE").length, tone: "text-amber-200" },
    { label: "Unit Leader", value: masterPegawaiData.filter((p) => p.role === "UNIT_LEADER").length, tone: "text-sky-200" },
    { label: "Employee", value: masterPegawaiData.filter((p) => p.role === "EMPLOYEE").length, tone: "text-emerald-200" },
  ];

  const roleOptions = [
    { id: "employee", label: "Pegawai", desc: "View as employee", icon: "👤" },
    { id: "unit_leader", label: "Unit Leader", desc: "View as unit/bidang", icon: "⭐" },
    { id: "executive", label: "Executive", desc: "View as all org", icon: "🏛️" },
    { id: "admin", label: "Admin", desc: "View as operasional", icon: "🛡️" },
  ];

  const roleCandidates = viewAsRole === "admin"
    ? []
    : masterPegawaiData.filter((p) => {
        if (viewAsRole === "employee") return p.role === "EMPLOYEE";
        if (viewAsRole === "unit_leader") return p.role === "UNIT_LEADER";
        if (viewAsRole === "executive") return p.role === "EXECUTIVE";
        return false;
      });

  const searchQuery = (search || "").toLowerCase().trim();
  const searchResults = searchPegawai(masterPegawaiData, search);

  const filteredRoleCandidates = searchQuery
    ? searchPegawai(roleCandidates, search)
    : roleCandidates;

  const selectedViewPerson = roleCandidates.find((p) => String(p.id) === String(viewAsPersonId)) || roleCandidates[0] || null;
  const selectedPimpinanView = selectedViewPerson
    ? {
        name: selectedViewPerson.nama,
        nip: selectedViewPerson.nip || "",
        jabatan: selectedViewPerson.jabatan || "",
        unit: selectedViewPerson.unit || "",
        scope: selectedViewPerson.role === "EXECUTIVE" ? "ALL" : "UNIT",
        group: selectedViewPerson.role === "EXECUTIVE" ? "EXECUTIVE" : "UNIT_LEADER",
        description: selectedViewPerson.role === "EXECUTIVE" ? "Kepala Dinas" : getUnitLabel(selectedViewPerson.unit),
      }
    : null;

  const handleSearchChange = (e) => setSearch(e.target.value);

  // ── Panel routing (full-page panels) ──
  if (activeMenu === "kelola") {
    return (
      <PanelKelolaPegawai
        people={masterPegawaiData}
        readOnly={false}
        onAddPegawai={onAddPegawai}
        onUpdatePegawai={onUpdatePegawai}
        onDeletePegawai={onDeletePegawai}
        onBack={() => setActiveMenu(null)}
      />
    );
  }

  if (activeMenu === "koreksi") {
    return (
      <PanelKoreksi
        people={masterPegawaiData}
        attendance={attendance}
        onKoreksi={onKoreksi}
        onBack={() => setActiveMenu(null)}
        pengajuan={pengajuan}
        onPengajuanVerifikasi={onPengajuanVerifikasi}
        readOnly={false}
      />
    );
  }

  if (activeMenu === "gantiPassword") {
    return (
      <PasswordChangeForm
        onBack={() => setActiveMenu(null)}
        onSavePasswordOverride={onSavePasswordOverride}
      />
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW AS MODE
  // ══════════════════════════════════════════════════════════════════════════
  if (viewAsRole) {
    return (
      <div className="min-h-screen bg-[#080c14] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => { setViewAsRole(null); setSearch(""); }} />

          <div className="mb-4">
            <h2 className="text-xl font-black text-white">View As</h2>
            <p className="mt-1 text-slate-500 text-xs">
              {roleOptions.find((r) => r.id === viewAsRole)?.label || "Role"}
            </p>
          </div>

          {viewAsRole !== "admin" && roleCandidates.length > 1 && (
            <>
              <div className="mb-3">
                <SearchInput
                  value={search}
                  onChange={handleSearchChange}
                />
              </div>

              <Card className="p-4 mb-3 border-slate-700/60 bg-slate-900/80">
                <div className="mb-3 text-sm font-bold text-white">
                  Pilih Akun
                  {searchQuery && filteredRoleCandidates.length < roleCandidates.length && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {filteredRoleCandidates.length} dari {roleCandidates.length}
                    </span>
                  )}
                </div>

                {filteredRoleCandidates.length > 0 ? (
                  <div className="max-h-44 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                    {filteredRoleCandidates.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => setViewAsPersonId(String(person.id))}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition-all duration-150 ${
                          String(viewAsPersonId) === String(person.id)
                            ? "border-emerald-500/50 bg-emerald-500/15"
                            : "border-slate-700/60 bg-slate-800/60 hover:border-slate-600/70 hover:bg-slate-800"
                        }`}
                      >
                        <ProfileLines
                          name={person.nama}
                          nip={person.nip}
                          jabatan={person.jabatan}
                          nameClassName="text-white text-sm font-semibold"
                          metaClassName="text-slate-500 text-xs"
                        />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                            {getUnitLabel(person.unit) || "Tanpa Unit"}
                          </span>
                          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {person.role}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/35 px-4 py-5 text-center text-sm text-slate-500">
                    Tidak ada akun yang cocok dengan pencarian.
                  </div>
                )}
              </Card>
            </>
          )}

          {viewAsRole !== "admin" && roleCandidates.length === 1 && (
            <div className="mb-3 px-1">
              <p className="text-[11px] text-slate-500">
                Akun: <span className="text-slate-300 font-semibold">{roleCandidates[0].nama}</span>
              </p>
            </div>
          )}

          {viewAsRole === "employee" && selectedViewPerson && (
            <DashboardPegawai
              pegawai={selectedViewPerson}
              people={masterPegawaiData}
              attendance={attendance}
              pengajuan={pengajuan}
              apelStatus={apelStatus}
              apelSession={apelSession}
              apelReason={apelReason}
              apelReasonText={apelReasonText}
              onScan={onScan}
              onPengajuanSubmit={onPengajuanSubmit}
              onBack={() => setViewAsRole(null)}
            />
          )}

          {viewAsRole === "unit_leader" && selectedPimpinanView && (
            <DashboardPimpinan
              people={masterPegawaiData}
              attendance={attendance}
              pengajuan={pengajuan}
              apelStatus={apelStatus}
              apelSession={apelSession}
              apelReason={apelReason}
              apelReasonText={apelReasonText}
              selectedPimpinan={selectedPimpinanView}
              onBack={() => setViewAsRole(null)}
            />
          )}

          {viewAsRole === "executive" && selectedPimpinanView && (
            <DashboardPimpinan
              people={masterPegawaiData}
              attendance={attendance}
              pengajuan={pengajuan}
              apelStatus={apelStatus}
              apelSession={apelSession}
              apelReason={apelReason}
              apelReasonText={apelReasonText}
              selectedPimpinan={selectedPimpinanView}
              onBack={() => setViewAsRole(null)}
            />
          )}

          {viewAsRole === "admin" && (
            <DashboardAdmin
              people={masterPegawaiData}
              attendance={attendance}
              pengajuan={pengajuan}
              apelStatus={apelStatus}
              apelSession={apelSession}
              apelReason={apelReason}
              apelReasonText={apelReasonText}
              onAppealPhaseChange={onApelSessionChange}
              onApelReasonChange={onApelReasonChange}
              onScanSimulate={onScanSimulate}
              onReset={onReset}
              onBack={() => setViewAsRole(null)}
              onKoreksi={onKoreksi}
              onPengajuanVerifikasi={onPengajuanVerifikasi}
              onAddPegawai={onAddPegawai}
              onUpdatePegawai={onUpdatePegawai}
              onDeletePegawai={onDeletePegawai}
            />
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />
        <div className="mb-5">
          <h2 className="text-xl font-black text-white">Developer Console</h2>
          <p className="mt-1 text-slate-500 text-xs">Akun teknis internal untuk simulasi, audit, dan recovery.</p>
        </div>

        {/* ════════════════════════════════════════════════════ */}
        {/* FEATURE MENU — kelola pegawai, pengajuan, password  */}
        {/* ════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { id: "kelola", label: "Kelola Pegawai", icon: "👥", desc: "CRUD data master pegawai", color: "from-blue-500/20 to-indigo-500/10", border: "hover:border-blue-500/50" },
            { id: "koreksi", label: "Koreksi Absensi", icon: "✏️", desc: "Koreksi manual & verifikasi pengajuan", color: "from-amber-500/20 to-yellow-500/10", border: "hover:border-amber-500/50" },
            { id: "gantiPassword", label: "Ganti Password", icon: "🔑", desc: "Ubah password admin/dev", color: "from-violet-500/20 to-purple-500/10", border: "hover:border-violet-500/50" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMenu(m.id)}
              className={`text-left p-3 rounded-xl bg-gradient-to-br ${m.color} border border-slate-700/60 ${m.border} transition-all duration-150 active:scale-[0.97]`}
            >
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className="text-white text-xs font-semibold leading-tight">{m.label}</div>
              <div className="text-slate-500 text-[9px] mt-1 leading-tight">{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {summaryCards.map((item) => (
            <Card key={item.label} className="p-3 text-center border-slate-700/60 bg-slate-900/80">
              <div className={`text-lg font-black ${item.tone}`}>{item.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
            </Card>
          ))}
        </div>

        {/* Reset Attendance */}
        <Card className="p-4 mb-3 border-red-900/40 bg-red-950/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-red-300">Data Absensi</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-red-400/70">
                {Object.keys(attendance).length > 0
                  ? `${Object.keys(attendance).length} record tersimpan`
                  : "Kosong — siap untuk pilot"}
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm("Hapus semua data absensi hari ini? Tindakan ini tidak bisa dibatalkan.")) {
                  onReset();
                }
              }}
              className="rounded-xl border border-red-700/50 bg-red-800/40 px-4 py-2.5 text-xs font-bold text-red-200 transition-all duration-150 hover:bg-red-700/50 hover:border-red-500/50 active:scale-[0.97]"
            >
              Reset Attendance
            </button>
          </div>
        </Card>

        {/* Pencarian — cari pegawai untuk View As */}
        <div className="relative mb-3">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Cari pegawai untuk View As..."
          />

          {/* Hasil pencarian — dropdown overlay */}
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-slate-600/60 bg-slate-900 shadow-xl shadow-black/40">
              <div className="max-h-[55vh] space-y-1 overflow-y-auto p-2 scrollbar-thin">
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {searchResults.length} hasil ditemukan
                </div>
                {searchResults.length > 0 ? (
                  searchResults.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => {
                        const roleMap = {
                          EMPLOYEE: "employee",
                          UNIT_LEADER: "unit_leader",
                          EXECUTIVE: "executive",
                        };
                        setViewAsRole(roleMap[person.role] || "employee");
                        setViewAsPersonId(String(person.id));
                      }}
                      className="w-full rounded-lg border border-slate-700/40 bg-slate-800/50 px-3 py-2.5 text-left transition-all duration-150 hover:border-emerald-600/50 hover:bg-slate-800 active:scale-[0.98]"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {person.nama.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <ProfileLines
                                name={person.nama}
                                nip={person.nip}
                                jabatan={person.jabatan}
                                nameClassName="text-white text-xs font-semibold"
                                metaClassName="text-slate-500 text-[10px]"
                              />
                            </div>
                            <div className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                              View As &rarr;
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-300">
                              {getUnitLabel(person.unit) || "Tanpa Unit"}
                            </span>
                            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                              {person.role}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-700/40 bg-slate-950/30 px-4 py-5 text-center text-sm text-slate-500">
                    Tidak ada pegawai yang cocok dengan pencarian.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* View As — role buttons */}
        <Card className="p-4 border-slate-700/60 bg-slate-900/80">
          <div className="mb-3 text-sm font-bold text-white">View As</div>
          <div className="grid grid-cols-2 gap-2">
            {roleOptions.map((roleItem) => (
              <button
                key={roleItem.id}
                onClick={() => {
                  setViewAsRole(roleItem.id);
                  const defaultPerson = roleItem.id === "admin"
                    ? null
                    : masterPegawaiData.find((p) => {
                        if (roleItem.id === "employee") return p.role === "EMPLOYEE";
                        if (roleItem.id === "unit_leader") return p.role === "UNIT_LEADER";
                        if (roleItem.id === "executive") return p.role === "EXECUTIVE";
                        return false;
                      });
                  setViewAsPersonId(defaultPerson ? String(defaultPerson.id) : "");
                }}
                className="rounded-xl border border-slate-700/50 bg-slate-800/70 px-3 py-3 text-left transition-all duration-150 hover:border-slate-600/70 hover:bg-slate-800 active:scale-[0.98]"
              >
                <div className="text-lg">{roleItem.icon}</div>
                <div className="mt-2 text-xs font-bold text-white">{roleItem.label}</div>
                <div className="mt-1 text-[10px] text-slate-500">{roleItem.desc}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>

    </div>
  );
};

export { DeveloperConsole };
export default DeveloperConsole;
