import { useState, useEffect, useRef } from "react";
import { useSession } from "../contexts/SessionContext";
import { useFirebaseData } from "../contexts/FirebaseDataContext";
import { getDeviceFingerprint } from "../utils/device-fingerprint";

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: LOGIN PAGE — Premium Cinematic Design
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
  const [phase, setPhase] = useState("idle"); // idle → focus → submit
  const canvasRef = useRef(null);
  const usernameRef = useRef(null);

  // ── WebGL Gradient Background ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      time += 0.002;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Floating organic blobs
      const blobs = [
        { x: 0.2 + Math.sin(time * 0.3) * 0.1, y: 0.3 + Math.cos(time * 0.4) * 0.15, r: 0.35, color: [16, 185, 129], a: 0.12 },
        { x: 0.8 + Math.sin(time * 0.5 + 1) * 0.1, y: 0.2 + Math.cos(time * 0.3 + 1) * 0.1, r: 0.3, color: [59, 130, 246], a: 0.08 },
        { x: 0.5 + Math.sin(time * 0.2 + 2) * 0.15, y: 0.7 + Math.cos(time * 0.25 + 2) * 0.12, r: 0.4, color: [16, 185, 129], a: 0.06 },
        { x: 0.1 + Math.sin(time * 0.4 + 3) * 0.08, y: 0.6 + Math.cos(time * 0.35 + 3) * 0.1, r: 0.25, color: [5, 150, 105], a: 0.1 },
        { x: 0.7 + Math.sin(time * 0.35 + 4) * 0.12, y: 0.8 + Math.cos(time * 0.45 + 4) * 0.08, r: 0.3, color: [52, 211, 153], a: 0.07 },
      ];

      blobs.forEach((b) => {
        const gradient = ctx.createRadialGradient(
          w * b.x, h * b.y, 0,
          w * b.x, h * b.y, w * b.r
        );
        gradient.addColorStop(0, `rgba(${b.color.join(",")}, ${b.a})`);
        gradient.addColorStop(0.5, `rgba(${b.color.join(",")}, ${b.a * 0.4})`);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      });

      // Subtle grid overlay
      ctx.strokeStyle = "rgba(255,255,255,0.015)";
      ctx.lineWidth = 1;
      const step = 60;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // ── Floating Particles ──
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 6,
    duration: Math.random() * 12 + 8,
    drift: Math.random() * 30 - 15,
  }));

  // ── Login Handler ──
  const handleLogin = async () => {
    setError("");
    if (!username.trim()) { setError("Masukkan username"); return; }
    if (!password.trim()) { setError("Masukkan password"); return; }
    setLoading(true);
    setPhase("submit");

    await new Promise((r) => setTimeout(r, 400));

    try {
      if (username.trim().toLowerCase() === ADMIN_CRED.username) {
        if (password !== ADMIN_CRED.password) { setError("Password salah"); setLoading(false); setPhase("idle"); return; }
        setRole("admin"); setPage("admin"); return;
      }
      if (username.trim().toLowerCase() === DEVELOPER_CRED.username) {
        if (password !== DEVELOPER_CRED.password) { setError("Password salah"); setLoading(false); setPhase("idle"); return; }
        setRole("developer"); setPage("developer"); return;
      }

      const pegawai = resolvePegawai(masterPegawaiData, username);
      if (!pegawai) { setError("Username tidak ditemukan"); setLoading(false); setPhase("idle"); return; }
      if (!pegawai.password) { setError("Password belum di-set. Hubungi admin."); setLoading(false); setPhase("idle"); return; }
      if (password !== pegawai.password) { setError("Password salah"); setPassword(""); setLoading(false); setPhase("idle"); return; }

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
    } catch { setError("Terjadi kesalahan"); setLoading(false); setPhase("idle"); }
    setLoading(false);
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleLogin(); };

  return (
    <div className="relative min-h-screen bg-[#05080f] overflow-hidden font-sans">
      {/* ── WebGL Canvas Background ── */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      {/* ── Scanning line effect ── */}
      <div className="absolute inset-0 z-[1] pointer-events-none">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.003)_2px,rgba(255,255,255,0.003)_4px)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent animate-scan-line" />
      </div>

      {/* ── Vignette ── */}
      <div className="absolute inset-0 z-[1] pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 50%, rgba(5,8,15,0.8) 100%)"
      }} />

      {/* ── Particle Orbs ── */}
      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: 0.15,
              animation: `particle-float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
              transform: `translateX(${p.drift}px)`,
            }}
          />
        ))}
      </div>

      {/* ── Corner Accents ── */}
      <div className="absolute top-0 left-0 w-32 h-32 z-[1] pointer-events-none">
        <div className="absolute top-0 left-0 w-8 h-px bg-gradient-to-r from-emerald-400/40 to-transparent" />
        <div className="absolute top-0 left-0 h-8 w-px bg-gradient-to-b from-emerald-400/40 to-transparent" />
      </div>
      <div className="absolute top-0 right-0 w-32 h-32 z-[1] pointer-events-none">
        <div className="absolute top-0 right-0 w-8 h-px bg-gradient-to-l from-emerald-400/40 to-transparent" />
        <div className="absolute top-0 right-0 h-8 w-px bg-gradient-to-b from-emerald-400/40 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 w-32 h-32 z-[1] pointer-events-none">
        <div className="absolute bottom-0 left-0 w-8 h-px bg-gradient-to-r from-emerald-400/40 to-transparent" />
        <div className="absolute bottom-0 left-0 h-8 w-px bg-gradient-to-t from-emerald-400/40 to-transparent" />
      </div>
      <div className="absolute bottom-0 right-0 w-32 h-32 z-[1] pointer-events-none">
        <div className="absolute bottom-0 right-0 w-8 h-px bg-gradient-to-l from-emerald-400/40 to-transparent" />
        <div className="absolute bottom-0 right-0 h-8 w-px bg-gradient-to-t from-emerald-400/40 to-transparent" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px] mx-auto animate-fade-up">
          {/* ── Glass Card ── */}
          <div className="relative group">
            {/* Glow border */}
            <div className="absolute -inset-[1.5px] rounded-2xl bg-gradient-to-b from-emerald-400/20 via-emerald-500/5 to-blue-500/20 opacity-80 group-hover:opacity-100 blur-[2px] transition-opacity duration-700" />
            <div className="absolute -inset-[3px] rounded-2xl bg-gradient-to-b from-emerald-400/10 via-transparent to-blue-500/10 blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-1000" />

            <div className="relative rounded-2xl bg-[#0a0f1a]/80 backdrop-blur-2xl border border-white/[0.06] overflow-hidden">
              {/* Inner top glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

              <div className="p-8 sm:p-10">
                {/* ── Logo & Brand ── */}
                <div className="flex flex-col items-center mb-9 animate-slide-down" style={{ animationDelay: "0.1s" }}>
                  <div className="relative mb-4">
                    <div className="absolute inset-0 bg-emerald-500/15 rounded-full blur-2xl animate-pulse-slow" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-b from-emerald-500/10 to-emerald-600/5 border border-white/[0.06] flex items-center justify-center p-3">
                      <img
                        src="/logo-siapel.png"
                        alt="SIAPEL"
                        className="w-full h-full object-contain drop-shadow-2xl"
                      />
                    </div>
                    {/* Orbital ring */}
                    <div className="absolute -inset-3 rounded-full border border-emerald-500/10 animate-spin-slow" />
                    <div className="absolute -inset-5 rounded-full border border-emerald-500/5 animate-spin-slower" />
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    SIAPEL
                  </h1>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1.5 font-medium tracking-[0.15em] uppercase">
                    Sistem Informasi Apel Pegawai
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-slate-600">Dinas PUPR</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span className="text-[10px] text-slate-600">Barito Utara</span>
                  </div>
                </div>

                {/* ── Form ── */}
                <div className="space-y-4 animate-slide-down" style={{ animationDelay: "0.2s" }}>
                  {/* Username */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em]">
                      Username
                    </label>
                    <div className="relative group/input">
                      <div className="absolute inset-0 rounded-xl bg-emerald-500/[0.02] opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-500" />
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/input:text-emerald-400 transition-colors duration-300">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <input
                        ref={usernameRef}
                        type="text"
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); setError(""); }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setPhase("focus")}
                        placeholder="NIP, NIK, Nama, atau username..."
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.05] transition-all duration-300"
                        autoFocus
                        autoComplete="username"
                      />
                      <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-emerald-400/0 to-transparent group-focus-within/input:via-emerald-400/30 transition-all duration-500" />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em]">
                        Password
                      </label>
                    </div>
                    <div className="relative group/input">
                      <div className="absolute inset-0 rounded-xl bg-emerald-500/[0.02] opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-500" />
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/input:text-emerald-400 transition-colors duration-300">
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
                        onFocus={() => setPhase("focus")}
                        placeholder="6 digit angka"
                        maxLength={6}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.05] transition-all duration-300 text-center tracking-[0.3em]"
                        autoComplete="current-password"
                      />
                      <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-emerald-400/0 to-transparent group-focus-within/input:via-emerald-400/30 transition-all duration-500" />
                    </div>
                    <div className="flex justify-center gap-1.5 mt-2">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            password.length > i
                              ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                              : "bg-white/[0.06]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 animate-shake">
                      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <p className="text-red-400 text-xs">{error}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="relative w-full mt-2 group/btn"
                  >
                    <div className={`absolute -inset-[1px] rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 transition-all duration-500 ${
                      loading ? "opacity-50" : "opacity-70 group-hover/btn:opacity-100 group-hover/btn:blur-sm"
                    }`} />
                    <div className={`relative w-full rounded-xl font-semibold py-3.5 text-sm transition-all duration-300 flex items-center justify-center gap-2.5 overflow-hidden ${
                      loading
                        ? "bg-emerald-600/50 text-white/70"
                        : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white hover:from-emerald-400 hover:to-emerald-300 active:scale-[0.98] shadow-lg shadow-emerald-500/20"
                    }`}>
                      {/* Shimmer */}
                      {!loading && (
                        <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      )}
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
                          <span>Masuk ke Aplikasi</span>
                          <svg className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </>
                      )}
                    </div>
                  </button>
                </div>

                {/* ── Footer ── */}
                <div className="mt-8 pt-6 border-t border-white/[0.04] animate-fade-in" style={{ animationDelay: "0.4s" }}>
                  <p className="text-[10px] text-center text-slate-600 leading-relaxed">
                    Masuk dengan username dan password yang telah diberikan.
                  </p>
                  <p className="text-[10px] text-center text-slate-700 mt-1">
                    Hubungi admin jika lupa password
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Version */}
          <div className="text-center mt-6 animate-fade-in" style={{ animationDelay: "0.5s" }}>
            <span className="text-[9px] text-slate-800 tracking-[0.2em] uppercase">
              SIAPEL Prototype v1.0 · Dinas PUPR Barito Utara
            </span>
          </div>
        </div>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes particle-float {
          0% { transform: translateY(0px) translateX(0); opacity: 0.08; }
          50% { transform: translateY(-30px) translateX(5px); opacity: 0.2; }
          100% { transform: translateY(0px) translateX(0); opacity: 0.08; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        @keyframes scan-line {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-slower {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        .animate-fade-up { animation: fade-up 0.6s ease-out forwards; }
        .animate-slide-down { animation: slide-down 0.5s ease-out forwards; opacity: 0; }
        .animate-fade-in { animation: fade-in 0.6s ease-out forwards; opacity: 0; }
        .animate-shake { animation: shake 0.4s ease-out; }
        .animate-scan-line { animation: scan-line 4s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
        .animate-spin-slower { animation: spin-slower 20s linear infinite; }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export { LoginPage };
export default LoginPage;
