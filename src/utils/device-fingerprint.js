const STORAGE_KEY = "siapel.deviceFingerprint";

/**
 * Hash function sederhana (djb2) → base-36 numeric string.
 * Memberi output stabil untuk input yang sama.
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  // Buat selalu positif, konversi ke base-36
  return Math.abs(hash).toString(36);
}

/**
 * Kumpulkan komponen dari browser untuk membuat sidik jari device.
 * Tidak bisa diandalkan 100% (bisa berubah), tapi cukup untuk pilot.
 */
function collectComponents() {
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(navigator.hardwareConcurrency || ""),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];
  return parts.join("||");
}

/**
 * Ambil device fingerprint yang sudah tersimpan, atau buat yang baru.
 * Hasil di-cache di localStorage agar konsisten antar sesi.
 *
 * @returns {string} — fingerprint string (contoh: "1a2b3c4d5e")
 */
export function getDeviceFingerprint() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && typeof stored === "string" && stored.length > 4) {
      return stored;
    }
  } catch (_) {
    // localStorage tidak tersedia — lanjut buat baru tanpa cache
  }

  const raw = collectComponents();
  const fp = hashString(raw);

  try {
    window.localStorage.setItem(STORAGE_KEY, fp);
  } catch (_) {
    // Storage penuh atau diblokir — tidak critical
  }

  return fp;
}

/**
 * Hapus fingerprint dari localStorage (untuk testing / reset).
 */
export function clearDeviceFingerprint() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}
