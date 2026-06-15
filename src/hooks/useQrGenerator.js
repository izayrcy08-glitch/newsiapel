import { useState, useEffect } from "react";
import { ref, set } from "firebase/database";
import { database } from "../firebase";
import { createQrToken } from "../utils/qr-token";
import { QR_PATH, QR_TOKEN_TTL_MS } from "../bersama/konstanta_aplikasi";

/**
 * QR token generation lifecycle untuk Admin.
 * Auto-generate token, auto-refresh tiap QR_TOKEN_TTL_MS, simpan ke Firebase.
 * Menggantikan inline logic di DashboardAdmin.
 *
 * @param {{ active: boolean }} params — aktifkan generator (biasanya saat apel ongoing)
 * @returns {{ currentQr: object|null, secsLeft: number, qrActive: boolean }}
 */
export function useQrGenerator({ active = false } = {}) {
  const [currentQr, setCurrentQr] = useState(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!active) {
      setCurrentQr(null);
      return;
    }

    const generateAndStoreToken = () => {
      const issuedAt = Date.now();
      const qrData = {
        token: createQrToken(),
        issuedAt,
        expiresAt: issuedAt + QR_TOKEN_TTL_MS,
      };
      setCurrentQr(qrData);
      set(ref(database, QR_PATH), qrData).catch((error) => {
        console.error("Gagal menyimpan QR token:", error);
      });
    };

    generateAndStoreToken();
    const tokenTimer = setInterval(generateAndStoreToken, QR_TOKEN_TTL_MS);

    // Clock untuk hitung mundur
    const clockTimer = setInterval(() => setNow(Date.now()), 500);

    return () => {
      clearInterval(tokenTimer);
      clearInterval(clockTimer);
    };
  }, [active]);

  const secsLeft =
    currentQr && active
      ? Math.max(0, Math.ceil((currentQr.expiresAt - now) / 1000))
      : 0;
  const qrActive = active && currentQr !== null;

  return { currentQr, secsLeft, qrActive };
}
