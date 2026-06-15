import { useState, useMemo } from "react";
import { useSession } from "../contexts/SessionContext";
import { useFirebaseData } from "../contexts/FirebaseDataContext";
import { getDeviceFingerprint } from "../utils/device-fingerprint";

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: LOGIN PAGE — Unified login untuk semua role
// 1 input username (auto-detect role) + 1 input password
// ══════════════════════════════════════════════════════════════════════════════

const ADMIN_CRED = { username: "admin", password: "355454" };
const DEVELOPER_CRED = { username: "developer", password: "723254" };

/**
 * Resolve username ke data pegawai. Prioritas: NIP → NIK → Nama (case-insensitive)
 */
const resolvePegawai = (masterData, username) => {
  if (!username.trim()) return null;
  const input = username.trim();
  // 1. NIP
  let match = masterData.find((p) => p.nip === input);
  if (match) return match;
  // 2. NIK
  match = masterData.find((p) => p.nik && p.nik === input);
  if (match) return match;
  // 3. Nama (case-insensitive)
  const lower = input.toLowerCase();
  match = masterData.find((p) => p.nama.toLowerCase() === lower);
  return match || null;
};

const LoginPage = () => {
  const {
    masterPegawaiData,
    setPage,
    setRole,
    setActivePegawai,
    setSelectedPimpinan,
    handleUpdatePegawai,
    handlePimpinanSelect,
  } = useSession();

  const { handleSaveFingerprint } = useFirebaseData();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Animasi background particle — cukup untuk efek
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      delay: Math.random() * 5,
      duration: Math.random() * 10 + 10,
    })),
  []);

  const handleLogin = async () => {
    setError("");
    if (!username.trim()) {
      setError("Masukkan username");
      return;
    }
    if (!password.trim()) {
      setError("Masukkan password");
      return;
    }

    setLoading(true);

    try {
      // ── 1. Cek Admin ──
      if (username.trim().toLowerCase() === ADMIN_CRED.username) {
        if (password !== ADMIN_CRED.password) {
          setError("Password salah");
          setLoading(false);
          return;
        }
        setRole("admin");
        setPage("admin");
        setLoading(false);
        return;
      }

      // ── 2. Cek Developer ──
      if (username.trim().toLowerCase() === DEVELOPER_CRED.username) {
        if (password !== DEVELOPER_CRED.password) {
          setError("Password salah");
          setLoading(false);
          return;
        }
        setRole("developer");
        setPage("developer");
        setLoading(false);
        return;
      }

      // ── 3. Cek Pegawai / Pimpinan dari master data ──
      const pegawai = resolvePegawai(masterPegawaiData, username);
      if (!pegawai) {
        setError("Username tidak ditemukan");
        setLoading(false);
        return;
      }

      if (!pegawai.password) {
        setError("Password belum di-set. Hubungi admin.");
        setLoading(false);
        return;
      }

      if (password !== pegawai.password) {
        setError("Password salah");
        setPassword("");
        setLoading(false);
        return;
      }

      // ── Login sukses ──
      const fp = getDeviceFingerprint();
      handleSaveFingerprint(pegawai.id, fp);
      handleUpdatePegawai(pegawai.id, { phoneFingerprint: fp });

      if (pegawai.role === "EXECUTIVE" || pegawai.role === "UNIT_LEADER") {
        // Pimpinan — butuh data tambahan
        const pimpinanItem = {
          id: `${pegawai.role.toLowerCase()}-${pegawai.nip || pegawai.nama}`,
          group: pegawai.role,
          name: pegawai.nama,
          nip: pegawai.nip || "",
          jabatan: pegawai.jabatan || "",
          unit: pegawai.unit || "",
          scope: pegawai.role === "EXECUTIVE" ? "ALL" : "UNIT",
        };
        handlePimpinanSelect(pimpinanItem);
      } else {
        // Pegawai biasa
        setActivePegawai(pegawai);
        setPage("pegawai_dashboard");
      }
    } catch (err) {
      setError("Terjadi kesalahan. Coba lagi.");
    }

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="relative min-h-screen bg-[#080c14] flex items-center justify-center overflow-hidden selection:bg-emerald-500/30">
      {/* ── Animated background particles ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-emerald-500/8 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-blue-500/6 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-400/4 rounded-full blur-[150px]" />
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-white/10"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animation: `float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* ── Floating orbs ── */}
      <div className="absolute top-20 left-10 w-16 h-16 border border-emerald-500/10 rounded-full blur-sm" />
      <div className="absolute bottom-20 right-10 w-24 h-24 border border-blue-500/10 rounded-full blur-sm" />

      {/* ── Glass card ── */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="relative">
          {/* Glow border */}
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-emerald-500/20 via-emerald-500/5 to-blue-500/20 blur-sm" />

          <div className="relative backdrop-blur-xl bg-slate-900/70 rounded-2xl border border-slate-700/50 shadow-2xl shadow-emerald-500/5 overflow-hidden">
            {/* Top decoration */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

            <div className="p-8 sm:p-10">
              {/* ── Logo & Brand ── */}
              <div className="flex flex-col items-center mb-8">
                <div className="relative mb-5">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl" />
                  <img
                    src="/logo-siapel.png"
                    alt="SIAPEL"
                    className="relative w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-2xl"
                  />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  SIAPEL
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm mt-1.5 font-medium tracking-wider">
                  Sistem Informasi Apel Pegawai
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-slate-600">Dinas PUPR</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-[11px] text-slate-600">Barito Utara</span>
                </div>
              </div>

              {/* ── Form ── */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-[0.1em]">
                    Username
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-xl bg-emerald-500/5 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setError(""); }}
                      onKeyDown={handleKeyDown}
                      placeholder="NIP, NIK, Nama, atau username..."
                      className="relative w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-4 py-3.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all duration-200"
                      autoFocus
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-[0.1em]">
                      Password
                    </label>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-xl bg-emerald-500/5 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
                    <input
                      type="password"
                      inputMode="numeric"
                      value={password}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val.length <= 6) {
                          setPassword(val);
                          setError("");
                        }
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="6 digit angka"
                      maxLength={6}
                      className="relative w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-4 py-3.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all duration-200 text-center tracking-[0.3em]"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 text-sm text-center animate-fadeIn">{error}</p>
                )}

                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="relative w-full mt-2 group"
                >
                  <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 opacity-70 group-hover:opacity-100 blur-sm transition-opacity duration-300" />
                  <div className="relative w-full bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:from-emerald-600/50 disabled:to-emerald-600/50 text-white font-bold py-3.5 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
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
                        <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {/* ── Footer ── */}
              <div className="mt-8 pt-6 border-t border-slate-800/60">
                <p className="text-[11px] text-center text-slate-600 leading-relaxed">
                  Masuk dengan username dan password yang telah diberikan.<br />
                  Hubungi admin jika lupa password.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Version ── */}
        <p className="text-center text-[10px] text-slate-700 mt-5 tracking-wider">
          Prototype v1.0 · Dinas PUPR Barito Utara
        </p>
      </div>

      {/* ── Keyframes (inline style tag) ── */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          100% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.25s ease-out;
        }
      `}</style>
    </div>
  );
};

export { LoginPage };
export default LoginPage;
