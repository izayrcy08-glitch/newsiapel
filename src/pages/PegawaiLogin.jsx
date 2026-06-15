import { useState } from "react";
import { useSession } from "../contexts/SessionContext";
import { useFirebaseData } from "../contexts/FirebaseDataContext";
import { getDeviceFingerprint } from "../utils/device-fingerprint";
import { BackButton } from "../components/BackButton";
import { Card } from "../components/Card";
import { ProfileLines } from "../fitur/bersama/profile_lines";
import { getUnitLabel, getPegawaiGroupLabel } from "../bersama/util_unit_dan_scope";
import { usePegawaiSearch } from "../hooks/usePegawaiSearch";

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: PEGAWAI LOGIN
// Multi-step login: NIP (prioritas) → NIK → Nama → Password 6 digit
// ══════════════════════════════════════════════════════════════════════════════
const PegawaiLogin = () => {
  const {
    masterPegawaiData,
    handlePegawaiLogin,
    handleUpdatePegawai,
    goBack,
  } = useSession();

  const { handleSaveFingerprint } = useFirebaseData();

  // ── Step state machine ──
  const [step, setStep] = useState("identity");       // "identity" | "password"
  const [identityMode, setIdentityMode] = useState("nip"); // "nip" | "nik" | "nama"

  // ── Form inputs ──
  const [nipInput, setNipInput] = useState("");
  const [nikInput, setNikInput] = useState("");
  const [namaInput, setNamaInput] = useState("");

  // ── Identity resolution ──
  const [selectedPegawai, setSelectedPegawai] = useState(null);

  // ── Error states ──
  const [identityError, setIdentityError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // ── Password input ──
  const [passwordInput, setPasswordInput] = useState("");

  // Nama search (only rendered in "nama" mode, but Hook must be unconditional)
  const { filtered, grouped: groupedEntries } = usePegawaiSearch(
    masterPegawaiData,
    identityMode === "nama" ? namaInput : ""
  );

  // ── Helpers ──

  const sanitizeNumeric = (val) => val.replace(/\D/g, "");

  const findPegawaiByNip = (nip) =>
    masterPegawaiData.find((p) => p.nip === nip);

  const findPegawaiByNik = (nik) =>
    masterPegawaiData.find((p) => p.nik && p.nik === nik);

  // ── Identity handlers ──

  const handleNipSearch = () => {
    const cleaned = nipInput.trim();
    if (!cleaned) {
      setIdentityError("Masukkan NIP");
      return;
    }
    const match = findPegawaiByNip(cleaned);
    if (match) {
      setSelectedPegawai(match);
      setPasswordInput("");
      setPasswordError("");
      setIdentityError("");
      setStep("password");
    } else {
      setIdentityError("NIP tidak ditemukan");
    }
  };

  const handleNikSearch = () => {
    const cleaned = nikInput.trim();
    if (!cleaned) {
      setIdentityError("Masukkan NIK");
      return;
    }
    const match = findPegawaiByNik(cleaned);
    if (match) {
      setSelectedPegawai(match);
      setPasswordInput("");
      setPasswordError("");
      setIdentityError("");
      setStep("password");
    } else {
      setIdentityError("NIK tidak ditemukan");
    }
  };

  const handleNameSelect = (pegawai) => {
    setSelectedPegawai(pegawai);
    setPasswordInput("");
    setPasswordError("");
    setIdentityError("");
    setStep("password");
  };

  // ── Password handler ──

  const handlePasswordSubmit = () => {
    const cleaned = passwordInput.trim();
    if (!cleaned) {
      setPasswordError("Masukkan password");
      return;
    }
    if (!selectedPegawai.password) {
      setPasswordError("Password belum di-set. Hubungi admin.");
      return;
    }
    if (cleaned !== selectedPegawai.password) {
      setPasswordError("Password salah");
      setPasswordInput("");
      return;
    }

    // ── Login sukses ──
    const fp = getDeviceFingerprint();
    // Firebase (async / fire-and-forget — gagal tidak blokir login)
    handleSaveFingerprint(selectedPegawai.id, fp);
    // localStorage — update phoneFingerprint di master data
    handleUpdatePegawai(selectedPegawai.id, { phoneFingerprint: fp });
    // Navigasi ke dashboard
    handlePegawaiLogin(selectedPegawai);
  };

  // ── Navigation ──

  const handleStepBack = () => {
    if (step === "password") {
      setStep("identity");
      setSelectedPegawai(null);
      setPasswordInput("");
      setPasswordError("");
      setIdentityMode("nip");
      setIdentityError("");
    } else if (identityMode === "nip") {
      goBack();
    } else if (identityMode === "nik") {
      setIdentityMode("nip");
      setIdentityError("");
    } else if (identityMode === "nama") {
      setIdentityMode("nik");
      setIdentityError("");
    }
  };

  // ── Keyboard shortcuts ──

  const handleKeyDown = (handler) => (e) => {
    if (e.key === "Enter") handler();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={handleStepBack} />

        {/* ═══════════════ STEP: IDENTITY ═══════════════ */}
        {step === "identity" && (
          <>
            <h1 className="text-white text-xl font-bold mt-2 mb-1">
              Masuk Sebagai Pegawai
            </h1>
            <p className="text-slate-400 text-sm mb-6">
              Masukkan NIP atau klik opsi lain di bawah
            </p>

            {/* ── Mode: NIP (prioritas) ── */}
            {identityMode === "nip" && (
              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm font-medium mb-1.5 block">
                    NIP (18 digit)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={nipInput}
                    onChange={(e) => {
                      setNipInput(sanitizeNumeric(e.target.value));
                      setIdentityError("");
                    }}
                    onKeyDown={handleKeyDown(handleNipSearch)}
                    placeholder="Masukkan NIP..."
                    maxLength={18}
                    className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    autoFocus
                  />
                </div>

                <button
                  onClick={handleNipSearch}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all duration-150 shadow-lg shadow-emerald-500/20"
                >
                  Lanjutkan
                </button>

                {identityError && (
                  <>
                    <p className="text-red-400 text-sm text-center">{identityError}</p>
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => {
                          setIdentityMode("nik");
                          setIdentityError("");
                        }}
                        className="text-emerald-400 hover:text-emerald-300 text-sm underline transition-colors"
                      >
                        Cari berdasarkan NIK
                      </button>
                      <button
                        onClick={() => {
                          setIdentityMode("nama");
                          setIdentityError("");
                          setNamaInput("");
                        }}
                        className="text-emerald-400 hover:text-emerald-300 text-sm underline transition-colors"
                      >
                        Cari berdasarkan Nama
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Mode: NIK (fallback 1) ── */}
            {identityMode === "nik" && (
              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm font-medium mb-1.5 block">
                    NIK
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={nikInput}
                    onChange={(e) => {
                      setNikInput(sanitizeNumeric(e.target.value));
                      setIdentityError("");
                    }}
                    onKeyDown={handleKeyDown(handleNikSearch)}
                    placeholder="Masukkan NIK..."
                    className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    autoFocus
                  />
                </div>

                <button
                  onClick={handleNikSearch}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all duration-150 shadow-lg shadow-emerald-500/20"
                >
                  Lanjutkan
                </button>

                {identityError && (
                  <>
                    <p className="text-red-400 text-sm text-center">{identityError}</p>
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => {
                          setIdentityMode("nama");
                          setIdentityError("");
                          setNamaInput("");
                        }}
                        className="text-emerald-400 hover:text-emerald-300 text-sm underline transition-colors"
                      >
                        Cari berdasarkan Nama
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Mode: Nama (fallback 2 — live search) ── */}
            {identityMode === "nama" && (
              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm font-medium mb-1.5 block">
                    Nama Pegawai
                  </label>
                  <input
                    type="text"
                    value={namaInput}
                    onChange={(e) => setNamaInput(e.target.value)}
                    placeholder="Cari nama pegawai..."
                    className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    autoFocus
                  />
                </div>

                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1 scrollbar-thin">
                  {namaInput.trim() !== "" &&
                    groupedEntries.map(([groupKey, items]) => (
                      <div key={groupKey} className="space-y-2">
                        <div className="flex items-center gap-3 px-1">
                          <div>
                            <div className="text-slate-300 text-[11px] font-semibold uppercase tracking-[0.18em]">
                              {getPegawaiGroupLabel(groupKey)}
                            </div>
                            <div className="text-slate-500 text-[10px] mt-0.5">
                              {items.length} pegawai
                            </div>
                          </div>
                          <div className="h-px flex-1 bg-slate-800/70" />
                        </div>
                        <div className="space-y-2">
                          {items.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handleNameSelect(p)}
                              className="w-full text-left p-3.5 rounded-xl border border-slate-700/50 bg-slate-900/60 hover:border-slate-600/70 hover:bg-slate-800/60 active:scale-[0.98] transition-all duration-150"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                                  {p.nama
                                    .split(" ")
                                    .slice(0, 2)
                                    .map((n) => n[0])
                                    .join("")}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <ProfileLines
                                    name={p.nama}
                                    nip={p.nip}
                                    jabatan={p.jabatan}
                                    nameClassName="text-white text-sm font-semibold"
                                    metaClassName="text-slate-500 text-xs"
                                  />
                                  <span className="inline-block mt-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                                    {getUnitLabel(p.unit) || "Tanpa Unit"}
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  {namaInput.trim() !== "" && filtered.length === 0 && (
                    <div className="text-center text-slate-600 py-8 text-sm">
                      Pegawai tidak ditemukan
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════ STEP: PASSWORD ═══════════════ */}
        {step === "password" && selectedPegawai && (
          <>
            {/* Info pegawai yang terpilih */}
            <Card className="p-4 mb-6 mt-2 border-emerald-500/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center text-white text-lg font-bold shrink-0">
                  {selectedPegawai.nama
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold">
                    {selectedPegawai.nama}
                  </div>
                  {selectedPegawai.nip && (
                    <div className="text-slate-400 text-xs mt-0.5">
                      NIP: {selectedPegawai.nip}
                    </div>
                  )}
                  <div className="text-slate-500 text-xs mt-0.5">
                    {getUnitLabel(selectedPegawai.unit) ||
                      selectedPegawai.bidang ||
                      ""}
                    {selectedPegawai.jabatan
                      ? ` · ${selectedPegawai.jabatan}`
                      : ""}
                  </div>
                </div>
              </div>
            </Card>

            {/* Password input */}
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
                  onKeyDown={handleKeyDown(handlePasswordSubmit)}
                  placeholder="Masukkan password..."
                  maxLength={6}
                  className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 text-center tracking-[0.3em]"
                  autoFocus
                />
              </div>

              {passwordError && (
                <p className="text-red-400 text-sm text-center">{passwordError}</p>
              )}

              <button
                onClick={handlePasswordSubmit}
                className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl transition-all duration-150 shadow-lg shadow-emerald-500/20"
              >
                Masuk
              </button>

              <button
                onClick={handleStepBack}
                className="w-full text-slate-400 hover:text-slate-300 text-sm py-2 transition-colors"
              >
                Bukan pegawai ini? Cari ulang
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export { PegawaiLogin };
export default PegawaiLogin;
