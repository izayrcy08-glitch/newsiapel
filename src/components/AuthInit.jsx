import { useEffect } from "react";
import { getAuth, signInAnonymously } from "firebase/auth";

/**
 * AuthInit — Anonymous Firebase Auth (fire-and-forget)
 *
 * Langsung render children, auth jalan di background tanpa loading.
 * Firebase SDK otomatis reconnect subscriptions saat auth siap.
 */
export function AuthInit({ children }) {
  useEffect(() => {
    const auth = getAuth();
    signInAnonymously(auth).catch((err) => {
      console.error("Firebase anonymous auth gagal:", err);
    });
  }, []);

  return children;
}
