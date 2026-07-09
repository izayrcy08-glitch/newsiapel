/** Tentukan listener Firebase mana yang aktif per halaman — kurangi bandwidth di login/pegawai. */
export function getFirebaseSubscriptionTier(page) {
  if (page === "login") {
    return {
      attendanceToday: false,
      monthly: false,
      apelMeta: false,
      apelSession: false,
      pengajuan: false,
      riwayat: false,
    };
  }
  if (page === "pegawai_dashboard") {
    return {
      attendanceToday: true,
      monthly: true,
      apelMeta: true,
      apelSession: true,
      pengajuan: true,
      riwayat: false,
    };
  }
  return {
    attendanceToday: true,
    monthly: true,
    apelMeta: true,
    apelSession: true,
    pengajuan: true,
    riwayat: true,
  };
}
