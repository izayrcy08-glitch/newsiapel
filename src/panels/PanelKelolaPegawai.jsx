import { useState, useEffect } from "react";
import orgData from "../data/organization.json";
import { Card } from "../components/Card";
import { BackButton } from "../components/BackButton";
import { ProfileLines } from "../fitur/bersama/profile_lines";
import { getUnitLabel } from "../bersama/util_unit_dan_scope";
import { usePegawaiSearch } from "../hooks/usePegawaiSearch";
import { useShowMore } from "../hooks/useShowMore";

const INITIAL_DRAFT = {
  nama: "", nip: "", jabatan: "", unit: "", bidang: "",
  role: "EMPLOYEE", password: "", isActive: true,
};

const getSessionUserId = (person) => {
  if (person?.role === "ADMIN") return "admin";
  if (person?.role === "DEVELOPER") return "developer";
  return `pegawai_${person.id}`;
};

export default function PanelKelolaPegawai({ people, readOnly, onAddPegawai, onUpdatePegawai, onDeletePegawai, onClearActiveSession, onBack }) {
  const [tab, setTab] = useState("pegawai");
  const [search, setSearch] = useState("");
  const [selectedPegawaiId, setSelectedPegawaiId] = useState(null);
  const [draft, setDraft] = useState(INITIAL_DRAFT);

  const isPimpinanTab = tab === "pimpinan";
  const customFilter = (person) => (isPimpinanTab ? person.role !== "EMPLOYEE" : true);
  const { filtered: visiblePeople } = usePegawaiSearch(people, search, { customFilter });
  const { showAll, toggle, visibleItems } = useShowMore(visiblePeople, 10);

  const selectedPegawai = selectedPegawaiId
    ? people.find((item) => String(item.id) === String(selectedPegawaiId)) || null
    : null;

  const unitOptions = [
    { id: "PIMPINAN", nama: "Pimpinan" },
    ...orgData.bidang.filter((b) => b.id !== "pimpinan"),
  ];

  useEffect(() => {
    if (selectedPegawaiId === "new") {
      setDraft({ ...INITIAL_DRAFT });
    } else if (selectedPegawaiId && selectedPegawai) {
      setDraft({
        nama: selectedPegawai.nama || "",
        nip: selectedPegawai.nip || "",
        jabatan: selectedPegawai.jabatan || "",
        unit: selectedPegawai.unit || "",
        bidang: selectedPegawai.bidang || "",
        role: selectedPegawai.role || "EMPLOYEE",
        password: selectedPegawai.password || "",
        isActive: selectedPegawai.isActive !== false,
      });
    } else {
      setDraft({ ...INITIAL_DRAFT });
    }
  }, [selectedPegawaiId, selectedPegawai]);

  const openNew = () => {
    setSelectedPegawaiId("new");
    setTab("pegawai");
    setDraft({ ...INITIAL_DRAFT });
  };

  const save = () => {
    const payload = {
      ...draft,
      nama: draft.nama.trim(),
      nip: draft.nip.trim(),
      jabatan: draft.jabatan.trim(),
      unit: draft.unit.trim(),
      bidang: draft.bidang.trim() || draft.unit.trim(),
      role: draft.role,
      password: selectedPegawaiId === "new" ? draft.password : (draft.password || selectedPegawai?.password || ""),
      isActive: draft.isActive !== false,
    };
    if (!payload.nama) return;

    if (selectedPegawaiId === "new") {
      onAddPegawai?.(payload);
    } else if (selectedPegawaiId) {
      onUpdatePegawai?.(selectedPegawaiId, payload);
    }
    setSelectedPegawaiId(null);
    setDraft({ ...INITIAL_DRAFT });
  };

  const deleteSelected = () => {
    if (!selectedPegawai) return;
    if (!window.confirm(`Hapus ${selectedPegawai.nama} dari master aktif?`)) return;
    onDeletePegawai?.(selectedPegawai.id);
    setSelectedPegawaiId(null);
    setDraft({ ...INITIAL_DRAFT });
  };

  const resetSession = () => {
    if (!selectedPegawai || !onClearActiveSession) return;
    const userId = getSessionUserId(selectedPegawai);
    if (!window.confirm(
      `Reset sesi login untuk ${selectedPegawai.nama}?\n\nPerangkat lama akan dilepas. Pegawai bisa login di HP baru dengan username & password yang sama.`
    )) return;
    onClearActiveSession(userId);
  };

  const selectedTitle = selectedPegawaiId === "new"
    ? "Tambah Pegawai Baru"
    : selectedPegawai
      ? `Edit ${selectedPegawai.nama || "Pegawai"}`
      : "Pilih pegawai untuk diedit";

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-black text-white">Kelola Pegawai</h2>
          <span className="text-slate-500 text-xs">{visiblePeople.length} dari {people.length} pegawai</span>
        </div>
        <p className="text-slate-500 text-xs mb-4">Kelola data master pegawai dan role pimpinan.</p>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex rounded-xl border border-slate-700/60 bg-slate-900/60 p-0.5 flex-1">
            <button onClick={() => { setTab("pegawai"); setSelectedPegawaiId(null); }}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${tab === "pegawai" ? "bg-blue-500/20 text-blue-300 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>
              Pegawai
            </button>
            <button onClick={() => { setTab("pimpinan"); setSelectedPegawaiId(null); }}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${tab === "pimpinan" ? "bg-amber-500/20 text-amber-300 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>
              Pimpinan
            </button>
          </div>
          <button onClick={openNew} disabled={readOnly}
            className="rounded-xl bg-blue-500/20 border border-blue-500/30 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
            + Baru
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NIP, unit, jabatan..."
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800" />
        </div>

        {/* Daftar */}
        {selectedPegawaiId === null && (
          <div className="space-y-2 mb-4">
            {visiblePeople.length === 0 ? (
              <Card className="p-6 text-center border-dashed border-slate-700/60 bg-slate-950/40">
                <div className="text-slate-400 text-sm">Pegawai tidak ditemukan</div>
              </Card>
            ) : (
              visibleItems.map((person) => (
                <Card key={person.id} className="p-3.5 bg-slate-950/40 hover:border-blue-500/40 cursor-pointer transition-all duration-150"
                  onClick={() => setSelectedPegawaiId(person.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <ProfileLines name={person.nama || "Nama belum diisi"} nip={person.nip} jabatan={person.jabatan}
                        nameClassName="text-white text-sm font-semibold" metaClassName="text-slate-500 text-xs" />
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                          {getUnitLabel(person.unit) || "Tanpa Unit"}
                        </span>
                        <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {person.role}
                        </span>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Card>
              ))
            )}
            {!showAll && visiblePeople.length > 10 && (
              <button onClick={toggle}
                className="w-full py-2.5 rounded-xl bg-slate-800/80 text-slate-300 text-xs font-bold border border-slate-700/70 hover:border-blue-500/40 hover:text-blue-200 active:scale-[0.98] transition-all">
                Lihat lebih banyak ({visiblePeople.length} pegawai)
              </button>
            )}
            {showAll && visiblePeople.length > 10 && (
              <button onClick={toggle}
                className="w-full py-2.5 rounded-xl bg-slate-800/80 text-slate-300 text-xs font-bold border border-slate-700/70 hover:border-blue-500/40 hover:text-blue-200 active:scale-[0.98] transition-all">
                Lihat lebih sedikit
              </button>
            )}
          </div>
        )}

        {/* Form Editor */}
        {selectedPegawaiId !== null && (
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-white text-sm font-bold">{selectedTitle}</div>
                <div className="text-slate-500 text-xs mt-0.5">Nama wajib diisi.</div>
              </div>
              <span className="rounded-full border border-slate-700/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {selectedPegawaiId === "new" ? "NEW" : "EDIT"}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Nama</label>
                <input value={draft.nama} disabled={readOnly} onChange={(e) => setDraft((prev) => ({ ...prev, nama: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder="Nama pegawai" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">NIP</label>
                  <input value={draft.nip} disabled={readOnly} onChange={(e) => setDraft((prev) => ({ ...prev, nip: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder="Kosong jika belum ada" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Role</label>
                  <select value={draft.role} disabled={readOnly} onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60">
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="UNIT_LEADER">UNIT_LEADER</option>
                    <option value="EXECUTIVE">EXECUTIVE</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Jabatan</label>
                <input value={draft.jabatan} disabled={readOnly} onChange={(e) => setDraft((prev) => ({ ...prev, jabatan: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder="Kosong jika belum ada" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Unit / Bidang</label>
                  <select value={draft.unit} disabled={readOnly} onChange={(e) => {
                    const unit = e.target.value;
                    const bid = unitOptions.find((item) => item.id === unit)?.nama || unit;
                    setDraft((prev) => ({ ...prev, unit, bidang: bid }));
                  }}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60">
                    <option value="">Pilih unit</option>
                    {unitOptions.map((unit) => (<option key={unit.id} value={unit.id}>{unit.nama}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Password</label>
                  <input value={draft.password} disabled={readOnly} onChange={(e) => setDraft((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder="Password saat ini" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={save} disabled={readOnly || !draft.nama.trim()}
                className="flex-1 min-w-[120px] rounded-xl bg-emerald-500/20 border border-emerald-500/30 py-3 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-500/30 transition-colors">
                Simpan
              </button>
              {selectedPegawaiId !== "new" && (
                <>
                  <button onClick={resetSession} disabled={readOnly || !onClearActiveSession}
                    className="rounded-xl bg-amber-500/20 border border-amber-500/30 py-3 px-4 text-sm font-semibold text-amber-200 disabled:opacity-50 hover:bg-amber-500/30 transition-colors"
                    title="Lepaskan kunci perangkat agar pegawai bisa login di HP baru">
                    Reset Sesi
                  </button>
                  <button onClick={deleteSelected} disabled={readOnly}
                    className="rounded-xl bg-red-500/20 border border-red-500/30 py-3 px-4 text-sm font-semibold text-red-200 disabled:opacity-50 hover:bg-red-500/30 transition-colors">
                    Hapus
                  </button>
                </>
              )}
              <button onClick={() => setSelectedPegawaiId(null)}
                className="rounded-xl bg-slate-800 border border-slate-700/60 py-3 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors">
                Batal
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
