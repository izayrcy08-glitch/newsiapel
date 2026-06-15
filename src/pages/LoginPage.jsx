import { useState } from "react";
import { useSession } from "../contexts/SessionContext";
import { useFirebaseData } from "../contexts/FirebaseDataContext";
import { getDeviceFingerprint } from "../utils/device-fingerprint";

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: LOGIN PAGE — Clean Professional
// Unified login untuk semua role (admin/developer/pegawai/pimpinan)
// ═══════════════════════════════════════════════════════════════════════════════

const ADMIN_CRED = { username: "admin", password: "355454" };
const DEVELOPER_CRED = { username: "developer", password: "723254" };

const resolvePegawai = (masterData, username) => {
  if (!username.trim()) return null;
  const input = username.trim();
  let match = masterData.find((p) => p.nip === input);
  if (match) return match;
  match = masterData.find((p) => p.nik && p.nik === input);
  if (match) return match;
  const lower = input.toLowerCase();
  match = masterData.find((p) => p.nama.toLowerCase() === lower);
  return match || null;
};

const LoginPage = () => {
  const { masterPegawaiData, setPage, setRole, setActivePegawai, setSelectedPimpinan, handleUpdatePegawai, handlePimpinanSelect } = useSession();
  const { handleSaveFingerprint } = useFirebaseData();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Login Handler ──
  const handleLogin = async () => {
    setError("");
    if (!username.trim()) { setError("Masukkan username"); return; }
    if (!password.trim()) { setError("Masukkan password"); return; }
    setLoading(true);

    try {
      if (username.trim().toLowerCase() === ADMIN_CRED.username) {
        if (password !== ADMIN_CRED.password) { setError("Password salah"); setLoading(false); return; }
        setRole("admin"); setPage("admin"); return;
      }
      if (username.trim().toLowerCase() === DEVELOPER_CRED.username) {
        if (password !== DEVELOPER_CRED.password) { setError("Password salah"); setLoading(false); return; }
        setRole("developer"); setPage("developer"); return;
      }

      const pegawai = resolvePegawai(masterPegawaiData, username);
      if (!pegawai) { setError("Username tidak ditemukan"); setLoading(false); return; }
      if (!pegawai.password) { setError("Password belum di-set. Hubungi admin."); setLoading(false); return; }
      if (password !== pegawai.password) { setError("Password salah"); setPassword(""); setLoading(false); return; }

      const fp = getDeviceFingerprint();
      handleSaveFingerprint(pegawai.id, fp);
      handleUpdatePegawai(pegawai.id, { phoneFingerprint: fp });

      if (pegawai.role === "EXECUTIVE" || pegawai.role === "UNIT_LEADER") {
        handlePimpinanSelect({
          id: `${pegawai.role.toLowerCase()}-${pegawai.nip || pegawai.nama}`,
          group: pegawai.role, name: pegawai.nama, nip: pegawai.nip || "",
          jabatan: pegawai.jabatan || "", unit: pegawai.unit || "",
          scope: pegawai.role === "EXECUTIVE" ? "ALL" : "UNIT",
        });
      } else {
        setActivePegawai(pegawai);
        setPage("pegawai_dashboard");
      }
    } catch { setError("Terjadi kesalahan"); }
    setLoading(false);
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleLogin(); };

  return (
    <div className="relative min-h-screen bg-[#080c14] flex flex-col items-center justify-center overflow-hidden font-sans selection:bg-emerald-500/30">
      {/* ── Clean background gradient ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-500/[0.03] rounded-full blur-[100px]" />
        <div className="absolute top-0 left-0 w-80 h-80 bg-emerald-500/[0.02] rounded-full blur-[100px]" />
      </div>

      {/* ── Subtle grid overlay ── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }}
      />

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 w-full max-w-[400px] mx-4">
        {/* ── Logo Area ── */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="w-28 h-28 sm:w-32 sm:h-32">
              <img
                src="/logo-siapel.png"
                alt="SIAPEL"
                className="w-full h-full object-contain drop-shadow-2xl"
              />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            SIAPEL
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 font-medium tracking-[0.12em] uppercase">
            Sistem Informasi Apel Pegawai
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-600">Dinas PUPR</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span className="text-[10px] text-slate-600">Barito Utara</span>
          </div>
        </div>

        {/* ── Card ── */}
        <div className="rounded-2xl bg-[#0d1220]/90 border border-slate-800/60 shadow-xl shadow-black/30">
          <div className="p-6 sm:p-8">
            <div className="space-y-4">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.12em]">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(""); }}
                    onKeyDown={handleKeyDown}
                    placeholder="NIP, NIK, Nama, atau username..."
                    className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all duration-200"
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.12em]">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={password}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length <= 6) { setPassword(val); setError(""); }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="6 digit angka"
                    maxLength={6}
                    className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all duration-200 text-center tracking-[0.3em]"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:from-emerald-600/50 disabled:to-emerald-600/50 text-white font-semibold py-3 rounded-xl text-sm transition-all duration-200 active:scale-[0.98] shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-1"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-[10px] text-slate-700 mt-6 tracking-wider">
          Prototype v1.0 · Dinas PUPR Barito Utara
        </p>
      </div>
    </div>
  );
};

export { LoginPage };
export default LoginPage;
