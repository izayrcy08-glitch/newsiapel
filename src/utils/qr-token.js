import { ref, get } from "firebase/database";
import { database } from "../firebase";
import { QR_PATH } from "../bersama/konstanta_aplikasi";

export const createQrToken = () => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1000000).padStart(6, "0");
};

export const validateQrToken = async (token, timeoutMs = 5000) => {
  const submittedToken = token.trim();
  
  try {
    const getPromise = get(ref(database, QR_PATH));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Firebase validation timeout")), timeoutMs)
    );
    
    const snapshot = await Promise.race([getPromise, timeoutPromise]);
    const currentQr = snapshot.val();

    if (!currentQr?.token || submittedToken !== currentQr.token) {
      return { type: "invalid", label: "Token tidak valid — coba lagi" };
    }

    if (Date.now() > currentQr.expiresAt) {
      return { type: "expired", label: "Token kedaluwarsa — arahkan ke QR baru" };
    }

    return { type: "valid", label: "Token valid — absensi tercatat" };
  } catch (error) {
    if (error.message === "Firebase validation timeout") {
      return { type: "timeout", label: "Validasi timeout — periksa koneksi" };
    }
    console.error("QR validation error:", error);
    return { type: "error", label: "Gagal validasi — coba lagi" };
  }
};
