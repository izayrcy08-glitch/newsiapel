import { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { cn } from "../lib/utils";
import { useSession } from "../contexts/SessionContext";
import { useFirebaseData } from "../contexts/FirebaseDataContext";
import { getDeviceFingerprint } from "../utils/device-fingerprint";

// ═══════════════════════════════════════════════════════════════════════════════
// CREDENTIAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Helper: race antara promise dan timeout */
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);

const getAdminCred = (overrides = {}) => {
  try {
    const stored = window.localStorage.getItem("siapel.adminPassword");
    return { username: "admin", password: overrides.admin || stored || "123455" };
  } catch { return { username: "admin", password: overrides.admin || "123455" }; }
};
const getDeveloperCred = (overrides = {}) => {
  try {
    const stored = window.localStorage.getItem("siapel.developerPassword");
    return { username: "developer", password: overrides.developer || stored || "723254" };
  } catch { return { username: "developer", password: overrides.developer || "723254" }; }
};

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

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICLE — floating background dots
// ═══════════════════════════════════════════════════════════════════════════════

const Particle = ({ delay = 0 }) => {
  const [size, setSize] = useState({ w: 800, h: 600 });
  const pos = useRef({ x: Math.random() * 800, y: Math.random() * 600 });

  useEffect(() => {
    setSize({ w: window.innerWidth, h: window.innerHeight });
    pos.current = { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight };
  }, []);

  return (
    <motion.div
      className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
      initial={{
        x: pos.current.x,
        y: pos.current.y,
        opacity: 0,
      }}
      animate={{
        y: [null, Math.random() * size.h],
        x: [null, Math.random() * size.w],
        opacity: [0, 0.5, 0],
      }}
      transition={{
        duration: Math.random() * 10 + 10,
        repeat: Infinity,
        delay: delay,
        ease: "linear",
      }}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// GLASS INPUT — glassmorphism input with mouse-tracking glow
// ═══════════════════════════════════════════════════════════════════════════════

const GlassInput = ({ className, icon, ...props }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const BLUE = "rgb(37 99 235)";

  return (
    <div className="relative w-full">
      <div
        className="relative"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <input
          className={cn(
            "w-full h-12 px-4 pl-12 bg-black/20 backdrop-blur-md border border-blue-700/20",
            "rounded-lg text-white placeholder:text-blue-100/40",
            "focus:outline-none focus:border-blue-600/50 focus:bg-black/30",
            "transition-all duration-300",
            className
          )}
          {...props}
        />
        {isHovering && (
          <>
            <div
              className="absolute pointer-events-none top-0 left-0 right-0 h-[2px] z-20 rounded-t-lg overflow-hidden"
              style={{
                background: `radial-gradient(40px circle at ${mousePos.x}px 0px, ${BLUE} 0%, transparent 70%)`,
              }}
            />
            <div
              className="absolute pointer-events-none bottom-0 left-0 right-0 h-[2px] z-20 rounded-b-lg overflow-hidden"
              style={{
                background: `radial-gradient(40px circle at ${mousePos.x}px 2px, ${BLUE} 0%, transparent 70%)`,
              }}
            />
          </>
        )}
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400/60">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE — cinematic glassmorphism design
// ═══════════════════════════════════════════════════════════════════════════════

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
  const { handleSaveFingerprint, passwordOverrides, passwordOverridesLoaded, handleSaveActiveSession } = useFirebaseData();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [8, -8]);
  const rotateY = useTransform(mouseX, [-300, 300], [-8, 8]);

  // ── 3D Tilt Handlers ──
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // ── Login Handler ──
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setError("");
    if (!username.trim()) { setError("Masukkan username"); return; }
    if (!password.trim()) { setError("Masukkan password"); return; }
    setLoading(true);

    // Guard: tunggu password Firebase termuat sebelum validasi login
    if (!passwordOverridesLoaded) {
      setError("Memuat data... Silakan coba lagi.");
      setLoading(false);
      return;
    }

    try {
      const adminCred = getAdminCred(passwordOverrides);
      if (username.trim().toLowerCase() === adminCred.username) {
        if (password !== adminCred.password) {
          setError("Password salah");
          setLoading(false);
          return;
        }
        // Simpan session ke Firebase — await with timeout 3 detik
        await withTimeout(handleSaveActiveSession("admin"), 3000).catch(() => {});
        setRole("admin");
        setPage("admin");
        return;
      }

      const developerCred = getDeveloperCred(passwordOverrides);
      if (username.trim().toLowerCase() === developerCred.username) {
        if (password !== developerCred.password) {
          setError("Password salah");
          setLoading(false);
          return;
        }
        await withTimeout(handleSaveActiveSession("developer"), 3000).catch(() => {});
        setRole("developer");
        setPage("developer");
        return;
      }

      const pegawai = resolvePegawai(masterPegawaiData, username);
      if (!pegawai) {
        setError("Username tidak ditemukan");
        setLoading(false);
        return;
      }
      const fbPw = passwordOverrides?.[`pegawai_${pegawai.id}`];
      const validPassword = fbPw || pegawai.password;
      if (!validPassword) {
        setError("Password belum di-set. Hubungi admin.");
        setLoading(false);
        return;
      }
      if (password !== validPassword) {
        setError("Password salah");
        setPassword("");
        setLoading(false);
        return;
      }

      const userId = `pegawai_${pegawai.id}`;
      await withTimeout(handleSaveActiveSession(userId), 3000).catch(() => {});

      const fp = getDeviceFingerprint();
      handleSaveFingerprint(pegawai.id, fp);
      handleUpdatePegawai(pegawai.id, { phoneFingerprint: fp });

      if (pegawai.role === "EXECUTIVE" || pegawai.role === "UNIT_LEADER") {
        handlePimpinanSelect({
          id: `${pegawai.role.toLowerCase()}-${pegawai.nip || pegawai.nama}`,
          pegawaiId: pegawai.id,
          group: pegawai.role,
          name: pegawai.nama,
          nip: pegawai.nip || "",
          jabatan: pegawai.jabatan || "",
          unit: pegawai.unit || "",
          scope: pegawai.role === "EXECUTIVE" ? "ALL" : "UNIT",
        });
      } else {
        setActivePegawai(pegawai);
        setPage("pegawai_dashboard");
      }
    } catch {
      setError("Terjadi kesalahan");
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin(e);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-blue-950 to-black relative overflow-hidden flex items-center justify-center p-4">
      {/* ── Animated background gradients ── */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            repeatType: "mirror",
          }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-700/20 rounded-full blur-[120px]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            repeatType: "mirror",
            delay: 1,
          }}
        />
      </div>

      {/* ── Particle effects ── */}
      {Array.from({ length: 30 }).map((_, i) => (
        <Particle key={i} delay={i * 0.2} />
      ))}

      {/* ── Grid pattern overlay ── */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(37, 99, 235, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(37, 99, 235, 0.5) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md relative z-10"
        style={{ perspective: 1500 }}
      >
        <motion.div
          className="relative"
          style={{ rotateX, rotateY }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="relative group">
            {/* ── Card glow effect ── */}
            <motion.div
              className="absolute -inset-[2px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              animate={{
                boxShadow: [
                  "0 0 20px 4px rgba(37, 99, 235, 0.1)",
                  "0 0 30px 8px rgba(37, 99, 235, 0.2)",
                  "0 0 20px 4px rgba(37, 99, 235, 0.1)",
                ],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                repeatType: "mirror",
              }}
            />

            {/* ── Traveling light beams ── */}
            <div className="absolute -inset-[1px] rounded-2xl overflow-hidden pointer-events-none">
              <motion.div
                className="absolute top-0 left-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-70"
                animate={{
                  left: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                }}
                transition={{
                  left: {
                    duration: 3,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                  },
                  opacity: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                  },
                }}
              />
              <motion.div
                className="absolute top-0 right-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-70"
                animate={{
                  top: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                }}
                transition={{
                  top: {
                    duration: 3,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                    delay: 0.75,
                  },
                  opacity: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 0.75,
                  },
                }}
              />
              <motion.div
                className="absolute bottom-0 right-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-70"
                animate={{
                  right: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                }}
                transition={{
                  right: {
                    duration: 3,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                    delay: 1.5,
                  },
                  opacity: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 1.5,
                  },
                }}
              />
              <motion.div
                className="absolute bottom-0 left-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-70"
                animate={{
                  bottom: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                }}
                transition={{
                  bottom: {
                    duration: 3,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                    delay: 2.25,
                  },
                  opacity: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 2.25,
                  },
                }}
              />
            </div>

            {/* ── Glass card ── */}
            <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-8 border border-blue-700/20 shadow-2xl overflow-hidden">
              {/* Inner glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-700/5 to-transparent opacity-50" />

              {/* ── Logo section ── */}
              <div className="text-center space-y-2 mb-8 relative z-10">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.8 }}
                  className="mx-auto w-24 h-24 rounded-full border-2 border-blue-700/30 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-700/20 to-blue-950/20"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent"
                  />
                  <img
                    src="/logo-siapel.png"
                    alt="SIAPEL"
                    className="w-full h-full object-cover rounded-full relative z-10"
                  />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-blue-100"
                >
                  SIAPEL
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-blue-100/60 text-sm"
                >
                  Sistem Informasi Apel Pagi
                </motion.p>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="flex items-center justify-center gap-2 mt-1"
                >
                  <span className="text-[10px] text-blue-100/40">Dinas PUPR</span>
                  <span className="w-1 h-1 rounded-full bg-blue-700/50" />
                  <span className="text-[10px] text-blue-100/40">Barito Utara</span>
                </motion.div>
              </div>

              {/* ── Login form ── */}
              <form onSubmit={handleLogin} className="space-y-5 relative z-10">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <label className="block text-blue-100/80 text-sm mb-2 font-medium">
                    Username / NIP / Nama
                  </label>
                  <GlassInput
                    type="text"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(""); }}
                    onFocus={() => {}}
                    onBlur={() => {}}
                    onKeyDown={handleKeyDown}
                    icon={<User className="w-5 h-5" />}
                    autoFocus
                    autoComplete="username"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <label className="block text-blue-100/80 text-sm mb-2 font-medium">
                    Password (6 Digit)
                  </label>
                  <div className="relative">
                    <GlassInput
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••"
                      value={password}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setPassword(value);
                        setError("");
                      }}
                      onFocus={() => {}}
                      onBlur={() => {}}
                      onKeyDown={handleKeyDown}
                      icon={<Lock className="w-5 h-5" />}
                      maxLength={6}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400/60 hover:text-blue-400 transition-colors z-20"
                    >
                      {showPassword ? (
                        <Eye className="w-5 h-5" />
                      ) : (
                        <EyeOff className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </motion.div>

                {/* ── Error message ── */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20"
                    >
                      <svg
                        className="w-4 h-4 text-red-400 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                        />
                      </svg>
                      <p className="text-red-400 text-xs">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Submit button ── */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full relative group/button mt-2"
                >
                  <div className="absolute inset-0 bg-blue-600/20 rounded-lg blur-lg opacity-0 group-hover/button:opacity-100 transition-opacity duration-300" />

                  <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 to-blue-600 text-white font-semibold h-12 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg shadow-blue-700/20">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{
                        x: ["-100%", "100%"],
                      }}
                      transition={{
                        duration: 2,
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatDelay: 1,
                      }}
                      style={{
                        opacity: loading ? 1 : 0,
                      }}
                    />

                    <AnimatePresence mode="wait">
                      {loading ? (
                        <motion.div
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center justify-center"
                        >
                          <div className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                        </motion.div>
                      ) : (
                        <motion.span
                          key="button-text"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center justify-center gap-2 text-sm font-semibold"
                        >
                          MASUK
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>

                {/* ── Contact admin ── */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-center px-4 py-3 rounded-xl bg-white/5 border border-blue-700/10"
                >
                  <p className="text-[11px] text-blue-100/50 leading-relaxed">
                    Lupa password atau terkendala login?
                    <br />
                    Silakan hubungi admin Tata Usaha
                  </p>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.75 }}
                  className="text-center text-[10px] text-blue-100/30 mt-4"
                >
                  Prototype v1.0 &middot; Dinas PUPR Barito Utara
                </motion.p>
              </form>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export { LoginPage };
export default LoginPage;
