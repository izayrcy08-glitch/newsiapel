import { ref, get } from "firebase/database";
import { database } from "../firebase";
import { QR_PATH } from "../bersama/konstanta_aplikasi";

export const createQrToken = () => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1000000).padStart(6, "0");
};

export const validateQrToken = async (token) => {
  const submittedToken = token.trim();
  const snapshot = await get(ref(database, QR_PATH));
  const currentQr = snapshot.val();

  if (!currentQr?.token || submittedToken !== currentQr.token) {
    return { type: "invalid", label: "INVALID TOKEN" };
  }

  if (Date.now() > currentQr.expiresAt) {
    return { type: "expired", label: "EXPIRED TOKEN" };
  }

  return { type: "valid", label: "VALID TOKEN" };
};
