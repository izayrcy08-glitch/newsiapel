import { useState, useEffect } from "react";
import { ref, onValue, set } from "firebase/database";
import { database } from "../firebase";
import { createQrToken } from "../utils/qr-token";
import { QR_PATH, QR_TOKEN_TTL_MS } from "../bersama/konstanta_aplikasi";

/**
 * QR token generation lifecycle untuk Admin.
 *
 * Semua device membaca token dari Firebase (QR_PATH) via onValue.
 * Hanya device yang melihat token expired/tidak ada yang menulis ulang.
 * Dengan demikian semua device menampilkan token yang SAMA.
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

    const qrRef = ref(database, QR_PATH);

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

    // Subscribe ke perubahan QR_PATH
    const unsub = onValue(
      qrRef,
      (snapshot) => {
        const val = snapshot.val();
        if (!val) {
          // Tidak ada token sama sekali → generate
          generateAndStoreToken();
        } else if (val.expiresAt <= Date.now()) {
          // Token expired → generate baru
          generateAndStoreToken();
        } else {
          // Token masih valid — pakai dari Firebase (sama untuk semua device)
          setCurrentQr(val);
        }
      },
      (error) => {
        console.error("Gagal baca QR token dari Firebase:", error);
        // Fallback: pakai token lokal kalau Firebase error
        if (!currentQr) generateAndStoreToken();
      }
    );

    // Clock untuk hitung mundur
    const clockTimer = setInterval(() => setNow(Date.now()), 500);

    return () => {
      unsub();
      clearInterval(clockTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const secsLeft =
    currentQr && active
      ? Math.max(0, Math.ceil((currentQr.expiresAt - now) / 1000))
      : 0;
  const qrActive = active && currentQr !== null;

  return { currentQr, secsLeft, qrActive };
}
