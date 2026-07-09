export const STATUS_OPTIONS = ["Dinas Dalam", "Dinas Luar", "Izin", "Sakit"];

export const ATTENDANCE_ROOT = "attendance";
export const APEL_META_ROOT = "apelMeta";
export const APEL_SESSION_PATH = "apel/session";
export const APEL_REASON_PATH = "apel/reason";
export const QR_PATH = "qr/current";
export const QR_TOKEN_TTL_MS = 10000;

export const PENGAJUAN_PATH = "pengajuan";
export const RIWAYAT_PERUBAHAN_ROOT = "riwayatPerubahan";
export const FINGERPRINT_PATH = "fingerprints";
export const PEGAWAI_PASSWORDS_PATH = "pegawai_passwords";
export const ACTIVE_SESSION_PATH = "activeSessions";

export const APEL_SESSIONS = {
  BEFORE: "before",
  ONGOING: "ongoing",
  ENDED: "ended",
  DITIADAKAN: "ditiadakan",
};

export const APEL_SESSION_LABELS = {
  [APEL_SESSIONS.BEFORE]: "Sebelum Apel",
  [APEL_SESSIONS.ONGOING]: "Saat Apel",
  [APEL_SESSIONS.ENDED]: "Setelah Apel",
  [APEL_SESSIONS.DITIADAKAN]: "Ditiadakan",
};

export const REASON_OPTIONS = [
  { id: "hujan", label: "Hujan Deras", icon: "🌧️" },
  { id: "libur_nasional", label: "Libur Nasional", icon: "🇮🇩" },
  { id: "cuti_bersama", label: "Cuti Bersama", icon: "📅" },
  { id: "apel_gabungan", label: "Apel Gabungan", icon: "🤝" },
  { id: "lainnya", label: "Lainnya", icon: "✏️" },
];
