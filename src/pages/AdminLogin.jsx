import { useState } from "react";
import { useSession } from "../contexts/SessionContext";
import { BackButton } from "../components/BackButton";

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: ADMIN LOGIN
// Username: admin | Password: 355454
// ══════════════════════════════════════════════════════════════════════════════
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "355454";

const AdminLogin = () => {
  const { setPage, goBack } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");
    if (!username.trim()) {
      setError("Masukkan username");
      return;
    }
    if (!password.trim()) {
      setError("Masukkan password");
      return;
    }
    if (username.trim() !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      setError("Username atau password salah");
      return;
    }
    setPage("admin");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-blue-600/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={goBack} />

        <h1 className="text-white text-xl font-bold mt-2 mb-1">
          Masuk sebagai Admin
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          Pusat operasional & QR apel
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-slate-300 text-sm font-medium mb-1.5 block">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="Masukkan username admin..."
              className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              autoFocus
            />
          </div>

          <div>
            <label className="text-slate-300 text-sm font-medium mb-1.5 block">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="Masukkan password..."
              className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            className="w-full bg-blue-500 hover:bg-blue-400 active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all duration-150 shadow-lg shadow-blue-500/20"
          >
            Masuk
          </button>
        </div>
      </div>
    </div>
  );
};

export { AdminLogin };
export default AdminLogin;
