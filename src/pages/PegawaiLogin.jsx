import { useState } from "react";
import { useSession } from "../contexts/SessionContext";
import { useFirebaseData } from "../contexts/FirebaseDataContext";
import { getDeviceFingerprint } from "../utils/device-fingerprint";
import { BackButton } from "../components/BackButton";
import { Card } from "../components/Card";

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: PEGAWAI LOGIN
// Single username (NIP priority → NIK → Nama) + password 6 digit
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve username ke pegawai. Prioritas: NIP → NIK → Nama (case-insensitive)
 */
const resolvePegawai = (masterData, username) => {
  if (!username.trim()) return null;
  const input = username.trim();

  // 1. Coba NIP dulu (paling umum)
  let match = masterData.find((p) => p.nip === input);
  if (match) return match;

  // 2. Coba NIK
  match = masterData.find((p) => p.nik && p.nik === input);
  if (match) return match;

  // 3. Coba Nama (case-insensitive, full match)
  const lower = input.toLowerCase();
  match = masterData.find((p) => p.nama.toLowerCase() === lower);
  if (match) return match;

  return null;
};

const PegawaiLogin = () => {
  const {
    masterPegawaiData,
    handlePegawaiLogin,
    handleUpdatePegawai,
    goBack,
  } = useSession();

  const { handleSaveFingerprint } = useFirebaseData();

  // ── Step state machine ──
  const [step, setStep] = useState("identity"); // "identity" | "password"

  // ── Input ──
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  // ── Resolved pegawai ──
  const [selectedPegawai, setSelectedPegawai] = useState(null);

  // ── Error ──
  const [identityError, setIdentityError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // ── Handler: cari username ──
  const handleSearch = () => {
    setIdentityError("");
    if (!usernameInput.trim()) {
      setIdentityError("Masukkan NIP, NIK, atau Nama");
      return;
    }
    const match = resolvePegawai(masterPegawaiData, usernameInput);
    if (match) {
      setSelectedPegawai(match);
      setPasswordInput("");
      setPasswordError("");
      setStep("password");
    } else {
      setIdentityError("Username tidak ditemukan");
    }
  };

  // ── Handler: password ──
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
    handleSaveFingerprint(selectedPegawai.id, fp);
    handleUpdatePegawai(selectedPegawai.id, { phoneFingerprint: fp });
    handlePegawaiLogin(selectedPegawai);
  };

  // ── Navigation ──
  const handleStepBack = () => {
    if (step === "password") {
      setStep("identity");
      setSelectedPegawai(null);
      setPasswordInput("");
      setPasswordError("");
    } else {
      goBack();
    }
  };

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

        {/* ═══════════════ STEP: USERNAME ═══════════════ */}
        {step === "identity" && (
          <>
            <h1 className="text-white text-xl font-bold mt-2 mb-1">
              Masuk Sebagai Pegawai
            </h1>
            <p className="text-slate-400 text-sm mb-6">
              Masukkan NIP, NIK, atau Nama lengkap
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-slate-300 text-sm font-medium mb-1.5 block">
                  Username
                </label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    setIdentityError("");
                  }}
                  onKeyDown={handleKeyDown(handleSearch)}
                  placeholder="NIP / NIK / Nama lengkap..."
                  className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  autoFocus
                />
              </div>

              <button
                onClick={handleSearch}
                className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all duration-150 shadow-lg shadow-emerald-500/20"
              >
                Lanjutkan
              </button>

              {identityError && (
                <p className="text-red-400 text-sm text-center">{identityError}</p>
              )}
            </div>
          </>
        )}

        {/* ═══════════════ STEP: PASSWORD ═══════════════ */}
        {step === "password" && selectedPegawai && (
          <>
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
                  <div className="text-slate-400 text-xs mt-0.5">
                    {selectedPegawai.nip
                      ? `NIP: ${selectedPegawai.nip}`
                      : selectedPegawai.nik
                        ? `NIK: ${selectedPegawai.nik}`
                        : ""}
                  </div>
                </div>
              </div>
            </Card>

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
