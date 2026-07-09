/**
 * Username login untuk pegawai tanpa NIP resmi.
 * Nama tampilan (`nama`) tetap lengkap; username praktis tanpa gelar.
 */

const OFFICIAL_NIP_PATTERN = /^\d{8,}$/;
const SYSTEM_NIPS = new Set(["admin", "developer"]);

/** NIP resmi (angka) atau akun sistem — jangan timpa. */
export function isOfficialNip(nip) {
  const value = String(nip ?? "").trim();
  if (!value) return false;
  if (SYSTEM_NIPS.has(value)) return true;
  return OFFICIAL_NIP_PATTERN.test(value);
}

/** Buang gelar umum dari nama (suffix setelah koma atau di akhir). */
export function stripGelar(nama) {
  let value = String(nama ?? "").trim();
  if (!value) return "";

  const commaIndex = value.indexOf(",");
  if (commaIndex > 0) {
    value = value.slice(0, commaIndex).trim();
  }

  // Gelar menempel tanpa spasi, mis. RARA.S.AG
  value = value.replace(
    /\.?\s*\b(S\.?\s*M\.?|S\.?\s*T\.?|ST\.?|M\.?\s*T\.?|MT\.?|M\.?\s*S\.?|M\.?\s*Si\.?|S\.?\s*Si\.?|S\.?\s*P\.?|S\.?\s*Pd\.?|S\.?\s*H\.?|SH\.?|S\.?\s*Hut\.?|S\.?\s*ST\.?|S\.?\s*Kom\.?|S\.?\s*Ak\.?|S\.?\s*Farm\.?|S\.?\s*IP\.?|S\.?\s*Sos\.?|S\.?\s*Ag\.?|SE\.?|SKom\.?|SPd\.?|A\.?\s*Md\.?\.?T?\.?)\b\.?$/gi,
    ""
  ).trim();

  // Sisa titik/koma di akhir, mis. "BENY PRATAMA. S"
  value = value.replace(/\.\s*[A-Za-z]\s*$/, "").trim();
  value = value.replace(/[.,\s]+$/, "").trim();

  return value;
}

/** Username login tanpa gelar; fallback ke nama lengkap jika hasil kosong. */
export function buildLoginUsername(nama) {
  const stripped = stripGelar(nama);
  return stripped || String(nama ?? "").trim();
}

/** NIP efektif untuk login & sync Firebase. */
export function resolvePegawaiLoginId(pegawai) {
  const nip = String(pegawai?.nip ?? "").trim();
  if (isOfficialNip(nip)) return nip;
  if (nip) return nip;
  return buildLoginUsername(pegawai?.nama);
}

/** Cocokkan input login ke pegawai — backward compatible. */
export function findPegawaiByLoginInput(masterData, username) {
  const input = String(username ?? "").trim();
  if (!input) return null;

  let match = masterData.find((p) => p.nip === input);
  if (match) return match;

  match = masterData.find((p) => p.nik && p.nik === input);
  if (match) return match;

  const lower = input.toLowerCase();
  match = masterData.find((p) => p.nama.toLowerCase() === lower);
  if (match) return match;

  match = masterData.find((p) => buildLoginUsername(p.nama).toLowerCase() === lower);
  if (match) return match;

  match = masterData.find((p) => resolvePegawaiLoginId(p).toLowerCase() === lower);
  if (match) return match;

  return null;
}
