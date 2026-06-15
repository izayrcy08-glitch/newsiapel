import { useState } from "react";
import pegawaiData from "../data/pegawai_master.json";
import { Card } from "../components/Card";
import { BackButton } from "../components/BackButton";
import { ProfileLines } from "../fitur/bersama/profile_lines";
import { DashboardPegawai } from "./DashboardPegawai";
import { DashboardPimpinan } from "./DashboardPimpinan";
import { DashboardAdmin } from "./DashboardAdmin";
import { getUnitLabel } from "../bersama/util_unit_dan_scope";
import { usePegawaiSearch } from "../hooks/usePegawaiSearch";

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
}) => {
  const [search, setSearch] = useState("");
  const [viewAsRole, setViewAsRole] = useState(null);
  const [viewAsPersonId, setViewAsPersonId] = useState("");

  const { filtered, grouped: groupedEntries } = usePegawaiSearch(masterPegawaiData, search);

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

  if (viewAsRole) {
    return (
      <div className="min-h-screen bg-[#080c14] px-4 py-6">
        <div className="relative z-10 max-w-sm mx-auto">
          <BackButton onClick={() => setViewAsRole(null)} />

          <div className="mb-4">
            <h2 className="text-xl font-black text-white">View As</h2>
            <p className="mt-1 text-slate-500 text-xs">
              {roleOptions.find((r) => r.id === viewAsRole)?.label || "Role"}
            </p>
          </div>

          {viewAsRole !== "admin" && roleCandidates.length > 1 && (
            <Card className="p-4 mb-3 border-slate-700/60 bg-slate-900/80">
              <div className="mb-3 text-sm font-bold text-white">Pilih Akun</div>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                {roleCandidates.map((person) => (
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
            </Card>
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

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />
        <div className="mb-5">
          <h2 className="text-xl font-black text-white">Developer Console</h2>
          <p className="mt-1 text-slate-500 text-xs">Akun teknis internal untuk simulasi, audit, dan recovery.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {summaryCards.map((item) => (
            <Card key={item.label} className="p-3 text-center border-slate-700/60 bg-slate-900/80">
              <div className={`text-lg font-black ${item.tone}`}>{item.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
            </Card>
          ))}
        </div>

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

        <Card className="p-4 mb-3 border-slate-700/60 bg-slate-900/80">
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

        <div className="relative mb-3">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, unit, jabatan, role..."
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800"
          />
        </div>

        <Card className="p-4 border-slate-700/60 bg-slate-900/80">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-bold text-white">Preview Data</div>
              <div className="mt-1 text-xs text-slate-500">
                {filtered.length} hasil dari {masterPegawaiData.length} data
              </div>
            </div>
          </div>

          {groupedEntries.length > 0 ? (
            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1 scrollbar-thin">
              {groupedEntries.map(([groupKey, items]) => (
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
                    {items.slice(0, 8).map((pegawai) => (
                      <div key={pegawai.id} className="rounded-xl border border-slate-700/50 bg-slate-950/35 px-3 py-3">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {pegawai.nama.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <ProfileLines
                              name={pegawai.nama}
                              nip={pegawai.nip}
                              jabatan={pegawai.jabatan}
                              nameClassName="text-white text-sm font-semibold"
                              metaClassName="text-slate-500 text-xs"
                            />
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                                {getUnitLabel(pegawai.unit) || "Tanpa Unit"}
                              </span>
                              <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {pegawai.role || "UNKNOWN"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {items.length > 8 ? (
                      <div className="px-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        +{items.length - 8} data lain
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/35 px-4 py-6 text-center text-sm text-slate-500">
              Tidak ada data yang cocok dengan pencarian.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

// ── Helper: group label ──
const PEGAWAI_GROUP_LABELS = {
  PIMPINAN: "Pimpinan",
  DINAS: "Dinas",
  SEKRETARIAT: "Sekretariat",
  ALKAL: "UPT ALKAL",
  BINA_MARGA: "Bina Marga",
  SDA: "Sumber Daya Air",
  CIPTA_KARYA: "Cipta Karya",
  TATA_RUANG: "Tata Ruang",
  TATA_KOTA: "Tata Kota",
  JASA_KONSTRUKSI: "Jasa Konstruksi",
};

function getPegawaiGroupLabel(group) {
  const upper = (group || "").toUpperCase().replace(/\s+/g, "_");
  return PEGAWAI_GROUP_LABELS[upper] || group || "Unknown";
}

export { DeveloperConsole };
export default DeveloperConsole;
