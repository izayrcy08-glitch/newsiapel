import { useState } from "react";
import { BackButton } from "../components/BackButton";
import { ProfileLines } from "../fitur/bersama/profile_lines";
import { getUnitLabel } from "../bersama/util_unit_dan_scope";

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: PIMPINAN SELECTOR
// Two-step: pilih nama → password 6 digit
// ══════════════════════════════════════════════════════════════════════════════
const PimpinanSelector = ({ pimpinanAccessRoles = [], masterPegawaiData = [], onBack, onSelect }) => {
  // ── Step state machine ──
  const [step, setStep] = useState("select"); // "select" | "password"
  const [selectedItem, setSelectedItem] = useState(null);

  // ── Password ──
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // ── Kelompok data ──
  const executive = pimpinanAccessRoles.filter((item) => item.group === "EXECUTIVE");
  const unitLeaders = pimpinanAccessRoles.filter((item) => item.group === "UNIT_LEADER");

  // ── Helper: cari password asli dari masterPegawaiData ──
  const findPegawaiPassword = (item) => {
    // Cari berdasarkan NIP dulu
    if (item.nip) {
      const match = masterPegawaiData.find((p) => p.nip === item.nip);
      if (match) return match.password || "";
    }
    // Fallback: cocokkan nama
    const match = masterPegawaiData.find((p) => p.nama === item.name);
    return match ? (match.password || "") : "";
  };

  // ── Dapatkan "username" (NIP prioritas → NIK → Nama) ──
  const getUsername = (item) => {
    if (item.nip) return item.nip;
    // Cek NIK dari master data jika tidak ada NIP
    const fromMaster = masterPegawaiData.find((p) => p.nama === item.name);
    if (fromMaster && fromMaster.nik) return fromMaster.nik;
    return item.name || "(tanpa identitas)";
  };

  // ── Handler: pilih pimpinan → step password ──
  const handleSelectPimpinan = (item) => {
    setSelectedItem(item);
    setPasswordInput("");
    setPasswordError("");
    setStep("password");
  };

  // ── Handler: verifikasi password ──
  const handlePasswordSubmit = () => {
    const cleaned = passwordInput.trim();
    if (!cleaned) {
      setPasswordError("Masukkan password");
      return;
    }
    if (!selectedItem) {
      setPasswordError("Data tidak valid");
      return;
    }

    const correctPassword = findPegawaiPassword(selectedItem);
    if (!correctPassword) {
      setPasswordError("Password belum di-set. Hubungi admin.");
      return;
    }
    if (cleaned !== correctPassword) {
      setPasswordError("Password salah");
      setPasswordInput("");
      return;
    }

    // Login sukses
    onSelect(selectedItem);
  };

  // ── Handler: tombol Back ──
  const handleBack = () => {
    if (step === "password") {
      setStep("select");
      setSelectedItem(null);
      setPasswordInput("");
      setPasswordError("");
    } else {
      onBack();
    }
  };

  // ── Keyboard ──
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handlePasswordSubmit();
  };

  // ── Render card pimpinan ──
  const renderCard = (item) => (
    <button
      key={`${item.group}-${item.nip || item.name}`}
      onClick={() => handleSelectPimpinan(item)}
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

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={handleBack} />

        {/* ═══════════════ STEP: PILIH PIMPINAN ═══════════════ */}
        {step === "select" && (
          <>
            <div className="mb-5">
              <h2 className="text-xl font-black text-white">Pilih Role Pimpinan</h2>
              <p className="mt-1 text-slate-500 text-xs">Pilih nama Anda, lalu masukkan password 6 digit.</p>
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
          </>
        )}

        {/* ═══════════════ STEP: PASSWORD ═══════════════ */}
        {step === "password" && selectedItem && (
          <div className="mt-2">
            {/* Info pimpinan yang terpilih */}
            <div className="p-4 mb-6 rounded-2xl border border-amber-500/30 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/30 to-yellow-500/30 flex items-center justify-center text-white text-lg font-bold shrink-0">
                  {selectedItem.name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold">{selectedItem.name}</div>
                  {selectedItem.nip && (
                    <div className="text-slate-400 text-xs mt-0.5">
                      NIP: {selectedItem.nip}
                    </div>
                  )}
                  <div className="text-slate-500 text-xs mt-0.5">
                    {selectedItem.jabatan}
                    {selectedItem.unit ? ` · ${getUnitLabel(selectedItem.unit)}` : ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Username */}
            <div className="mb-4">
              <label className="text-slate-400 text-xs font-medium mb-1 block">
                Username
              </label>
              <div className="w-full bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3 text-slate-300 text-sm select-all">
                {getUsername(selectedItem)}
              </div>
            </div>

            {/* Password */}
            <div className="space-y-4">
              <div>
                <label className="text-slate-300 text-sm font-medium mb-1.5 block">
                  Password (6 digit)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={passwordInput}
                  onChange={(e) => {
                    const numeric = e.target.value.replace(/\D/g, "");
                    if (numeric.length <= 6) {
                      setPasswordInput(numeric);
                      setPasswordError("");
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Masukkan password..."
                  maxLength={6}
                  className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500/50 text-center tracking-[0.3em]"
                  autoFocus
                />
              </div>

              {passwordError && (
                <p className="text-red-400 text-sm text-center">{passwordError}</p>
              )}

              <button
                onClick={handlePasswordSubmit}
                className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl transition-all duration-150 shadow-lg shadow-amber-500/20"
              >
                Masuk
              </button>

              <button
                onClick={() => {
                  setStep("select");
                  setSelectedItem(null);
                  setPasswordInput("");
                  setPasswordError("");
                }}
                className="w-full text-slate-400 hover:text-slate-300 text-sm py-2 transition-colors"
              >
                Bukan ini? Pilih ulang
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { PimpinanSelector };
export default PimpinanSelector;
