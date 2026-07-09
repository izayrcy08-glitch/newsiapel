import { isPengajuanHariIni } from "./util_tanggal";
import { getWibDayStampFromTs } from "./util_tanggal";

export const ROLE_LABELS = {
  ADMIN: "Admin",
  DEVELOPER: "Developer",
  EXECUTIVE: "Pimpinan",
  UNIT_LEADER: "Kepala Unit",
};

export const formatRoleLabel = (role) => ROLE_LABELS[role] || role || "Petugas";

/** Label pelaku untuk tampilan UI. */
export const formatRevisiActorLabel = (record, { variant = "auto" } = {}) => {
  const nama = record?.verifiedByNama || record?.olehNama;
  const role = record?.verifiedByRole || record?.olehRole;
  if (!nama) return null;

  const roleLabel = formatRoleLabel(role);
  const sumber = record?.sumber || variant;

  if (record?.statusVerifikasi === "ditolak" || variant === "ditolak") {
    return `Ditolak oleh ${nama} (${roleLabel})`;
  }
  if (record?.statusVerifikasi === "disetujui" || sumber === "pengajuan" || variant === "disetujui") {
    return `Disetujui oleh ${nama} (${roleLabel})`;
  }
  if (sumber === "koreksi_manual" || variant === "koreksi") {
    return `Dikoreksi oleh ${nama} (${roleLabel})`;
  }
  return `Oleh ${nama} (${roleLabel})`;
};

/** Info pelaku dari session login saat ini. */
export const buildActorInfo = (role, { activePegawai, selectedPimpinan, masterPegawaiData = [] } = {}) => {
  if (role === "admin") {
    const admin = masterPegawaiData.find((p) => p.nip === "admin" || p.role === "ADMIN");
    return {
      id: String(admin?.id ?? "admin"),
      nama: admin?.nama || "Admin TU",
      role: "ADMIN",
    };
  }
  if (role === "developer") {
    const dev = masterPegawaiData.find((p) => p.nip === "developer" || p.role === "DEVELOPER");
    return {
      id: String(dev?.id ?? "developer"),
      nama: dev?.nama || "Developer",
      role: "DEVELOPER",
    };
  }
  if (selectedPimpinan) {
    return {
      id: String(selectedPimpinan.pegawaiId ?? selectedPimpinan.id ?? ""),
      nama: selectedPimpinan.name || selectedPimpinan.nama || "Pimpinan",
      role: selectedPimpinan.group || "EXECUTIVE",
    };
  }
  if (activePegawai) {
    return {
      id: String(activePegawai.id),
      nama: activePegawai.nama || "Pegawai",
      role: activePegawai.role || "EMPLOYEE",
    };
  }
  return { id: "", nama: "Sistem", role: "ADMIN" };
};

const isInMonth = (createdAt, monthKey) => {
  if (!createdAt || !monthKey) return false;
  return getWibDayStampFromTs(createdAt).startsWith(`${monthKey}-`);
};

/** Gabungkan pengajuan + riwayat koreksi untuk tampilan perubahan status. */
export const buildPerubahanStatusList = (
  pengajuan = [],
  riwayatPerubahan = [],
  { todayOnly = true, scopedPegawaiIds = null } = {}
) => {
  const inScope = (pegawaiId) =>
    !scopedPegawaiIds || scopedPegawaiIds.has(String(pegawaiId));

  const fromPengajuan = pengajuan
    .filter((p) => {
      if (!inScope(p.pegawaiId)) return false;
      if (todayOnly && !isPengajuanHariIni(p)) return false;
      return p.statusVerifikasi !== "menunggu";
    })
    .map((p) => ({
      id: `pengajuan-${p.id}`,
      sourceType: "pengajuan",
      pegawaiId: p.pegawaiId,
      nama: p.nama,
      nip: p.nip,
      statusLama: p.statusLama,
      statusBaru: p.statusBaru,
      keterangan: p.keterangan,
      statusVerifikasi: p.statusVerifikasi,
      alasanAdmin: p.alasanAdmin,
      verifiedByNama: p.verifiedByNama,
      verifiedByRole: p.verifiedByRole,
      waktu: p.waktu,
      createdAt: p.verifiedAt || p.createdAt,
      sumber: "pengajuan",
    }));

  const fromRiwayat = riwayatPerubahan
    .filter((r) => {
      if (!inScope(r.pegawaiId)) return false;
      if (todayOnly && r.createdAt && !isPengajuanHariIni({ createdAt: r.createdAt })) return false;
      return r.sumber === "koreksi_manual";
    })
    .map((r) => ({
      id: `riwayat-${r.id}`,
      sourceType: "riwayat",
      pegawaiId: r.pegawaiId,
      nama: r.nama,
      nip: r.nip,
      statusLama: r.statusLama,
      statusBaru: r.statusBaru,
      keterangan: r.keterangan || "",
      statusVerifikasi: "disetujui",
      olehNama: r.olehNama,
      olehRole: r.olehRole,
      waktu: r.waktu,
      createdAt: r.createdAt,
      sumber: "koreksi_manual",
    }));

  return [...fromPengajuan, ...fromRiwayat].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
};

export const filterPengajuanByMonth = (pengajuan, monthKey) =>
  pengajuan.filter((p) => p.createdAt && isInMonth(p.createdAt, monthKey));
