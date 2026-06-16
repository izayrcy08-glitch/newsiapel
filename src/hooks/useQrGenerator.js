import { useState, useEffect, useRef } from "react";
import { ref, onValue, set } from "firebase/database";
import { database } from "../firebase";
import { createQrToken } from "../utils/qr-token";
import { QR_PATH, QR_TOKEN_TTL_MS } from "../bersama/konstanta_aplikasi";

/**
 * QR token generation lifecycle untuk Admin.
 *
 * Semua device membaca token yang SAMA dari Firebase via onValue.
 * Regenerasi via timer tiap 1 detik (bukan via onValue) — timer update ref
 * LANGSUNG supaya tidak ada race antara ref dan React render cycle.
 *
 * onValue hanya untuk BACA dari device lain — tidak pernah nulis.
 * Dengan begitu tidak ada feedback loop antara 2 device.
 *
 * @param {{ active: boolean }} params
 * @returns {{ currentQr: object|null, secsLeft: number, qrActive: boolean }}
 */
export function useQrGenerator({ active = false } = {}) {
  const [currentQr, setCurrentQr] = useState(null);
  const [now, setNow] = useState(Date.now);
  const currentQrRef = useRef(currentQr);
  currentQrRef.current = currentQr;

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
      // Update ref LANGSUNG supaya timer lihat data baru tanpa nunggu render
      currentQrRef.current = qrData;
      setCurrentQr(qrData);
      set(ref(database, QR_PATH), qrData).catch((error) => {
        console.error("Gagal menyimpan QR token:", error);
      });
    };

    // ── onValue BACA SAJA — tidak pernah nulis ──
    const unsub = onValue(
      qrRef,
      (snapshot) => {
        const val = snapshot.val();
        if (val && val.expiresAt > Date.now()) {
          setCurrentQr(val);
        }
      },
      (error) => {
        console.error("Gagal baca QR token:", error);
      }
    );

    // ── Timer: update jam + regenerasi token expired ──
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const qr = currentQrRef.current;
      if (!qr) {
        generateAndStoreToken();
      } else if (qr.expiresAt <= t) {
        generateAndStoreToken();
      }
    }, 1000);

    return () => {
      unsub();
      clearInterval(timer);
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
