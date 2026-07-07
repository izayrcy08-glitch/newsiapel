import { useEffect } from "react";
import { getAuth, signInAnonymously } from "firebase/auth";

/**
 * AuthInit — Anonymous Firebase Auth with await
 *
 * Menunggu anonymous auth selesai SEBELUM render children.
 * Ini memastikan saat FirebaseDataContext baca data, auth sudah siap.
 * Mencegah permission_denied errors karena timing race condition.
 */
export function AuthInit({ children }) {
  useEffect(() => {
    const initAuth = async () => {
      try {
        const auth = getAuth();
        await signInAnonymously(auth);
        console.log("✅ [AuthInit] Anonymous auth initialized successfully");
      } catch (err) {
        console.error("❌ [AuthInit] Firebase anonymous auth failed:", err);
      }
    };

    initAuth();
  }, []);

  return children;
}
