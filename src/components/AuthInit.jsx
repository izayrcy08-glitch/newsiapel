import { useState, useEffect, useRef } from "react";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { LoadingSpinner } from "./LoadingSpinner";

/**
 * AuthInit — Anonymous Firebase Auth
 *
 * Diam-diam login anonim ke Firebase agar Realtime Database tidak dalam
 * Test Mode (yang expire 30 hari). Rules menggunakan `auth !== null`.
 *
 * Dampak ke user: NOL. Tidak ada UI login tambahan, tidak ada email.
 * Hanya loading ~0.5-1 detik saat pertama buka app.
 *
 * Jika gagal (Firebase outage), app tetap render — data akan error alami.
 */
export function AuthInit({ children }) {
  const [state, setState] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState("");
  const initiatedRef = useRef(false);

  useEffect(() => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;

    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Sudah login (dari session sebelumnya atau baru selesai sign-in)
        setState("ready");
      } else if (!initiatedRef.current) {
        // Belum login — sign in anonymously (sekali saja)
        initiatedRef.current = true;
        signInAnonymously(auth).catch((err) => {
          console.error("Firebase anonymous auth gagal:", err);
          setErrorMsg(
            err.code === "auth/api-key-not-valid."
              ? "Konfigurasi aplikasi tidak valid. Hubungi admin."
              : err.message || "Gagal menginisialisasi koneksi database."
          );
          setState("error");
        });
      }
    });

    return () => unsub();
  }, []);

  if (state === "loading") {
    return <LoadingSpinner message="Menyiapkan koneksi aman..." />;
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Koneksi Database Gagal
          </h2>
          <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
          <p className="text-slate-500 text-xs mb-6">
            Periksa koneksi internet atau hubungi admin.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl
                       font-medium transition-colors text-sm"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  return children;
}
