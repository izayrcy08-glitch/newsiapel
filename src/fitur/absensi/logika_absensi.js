import { getAttendanceRecord } from "../../bersama/util_attendance";

const getStatItemsForPhase = (apelStatus) => {
  if (apelStatus === "ended") {
    return [
      { key: "hadir", status: "Hadir", label: "Hadir", icon: "✅", color: "text-emerald-400" },
      { key: "tanpaKet", status: "Tanpa Keterangan", label: "Tanpa Keterangan", icon: "🚫", color: "text-red-400" },
      { key: "dinasD", status: "Dinas Dalam", label: "Dinas Dalam", icon: "🏢", color: "text-blue-400" },
      { key: "dinasL", status: "Dinas Luar", label: "Dinas Luar", icon: "🚗", color: "text-violet-400" },
      { key: "izin", status: "Izin", label: "Izin", icon: "📄", color: "text-amber-400" },
      { key: "sakit", status: "Sakit", label: "Sakit", icon: "🤒", color: "text-orange-400" },
    ];
  }
  // before / ongoing — tampilkan "Belum Hadir" bukan "Tanpa Keterangan"
  return [
    { key: "hadir", status: "Hadir", label: "Hadir", icon: "✅", color: "text-emerald-400" },
    { key: "belumAbsen", status: "Belum Hadir", label: "Belum Hadir", icon: "⏳", color: "text-slate-400" },
    { key: "dinasD", status: "Dinas Dalam", label: "Dinas Dalam", icon: "🏢", color: "text-blue-400" },
    { key: "dinasL", status: "Dinas Luar", label: "Dinas Luar", icon: "🚗", color: "text-violet-400" },
    { key: "izin", status: "Izin", label: "Izin", icon: "📄", color: "text-amber-400" },
    { key: "sakit", status: "Sakit", label: "Sakit", icon: "🤒", color: "text-orange-400" },
  ];
};

export const getAttendanceStatItems = (apelStatus) => {
  if (apelStatus === "ditiadakan") {
    return [
      { key: "info", status: "info", label: "Apel Ditiadakan", icon: "⚠️", color: "text-amber-400" },
    ];
  }
  return getStatItemsForPhase(apelStatus);
};

export const isApelDitiadakan = (apelStatus) => apelStatus === "ditiadakan";

/** Status tampilan untuk UI — TK/Belum Hadir dihitung dari fase apel jika DB kosong. */
export const getEffectiveAttendanceStatus = (attendanceRecord, apelStatus) => {
  const status = attendanceRecord?.status;
  if (status) return status;
  if (apelStatus === "ended") return "Tanpa Keterangan";
  if (apelStatus === "ditiadakan") return null;
  return "Belum Hadir";
};

const ACCOUNTED_STATUSES = new Set([
  "Hadir",
  "Dinas Dalam",
  "Dinas Luar",
  "Izin",
  "Sakit",
]);

/** Hari dihitung jika: bukan akhir pekan, apel diadakan (held=true), hari sudah selesai. */
export const isDayCountable = (
  dayKey,
  monthKey,
  apelMeta,
  { todayMonthKey, todayDayKey, apelStatus, includeTodayLive = false }
) => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, Number(dayKey));
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const meta = apelMeta?.[dayKey];
  if (!meta || meta.held !== true) return false;

  if (monthKey < todayMonthKey) return true;
  if (monthKey === todayMonthKey && dayKey < todayDayKey) return true;
  if (monthKey === todayMonthKey && dayKey === todayDayKey && apelStatus === "ended") return true;
  if (
    includeTodayLive &&
    monthKey === todayMonthKey &&
    dayKey === todayDayKey &&
    apelStatus === "ongoing"
  ) {
    return true;
  }

  return false;
};

const isTanpaKeteranganOnDay = (status) =>
  !status || status === "Tanpa Keterangan" || !ACCOUNTED_STATUSES.has(status);

/** Akumulasi jumlah Tanpa Keterangan per pegawai sepanjang bulan berjalan. */
export const calcMonthlyTanpaKeterangan = (
  monthlyAttendance,
  apelMeta,
  people = [],
  { todayMonthKey, todayDayKey, apelStatus }
) => {
  const counts = {};
  for (const p of people) counts[p.id] = 0;

  if (!monthlyAttendance || people.length === 0) return counts;

  for (const [dayKey, dayAttendance] of Object.entries(monthlyAttendance)) {
    if (!isDayCountable(dayKey, todayMonthKey, apelMeta, { todayMonthKey, todayDayKey, apelStatus })) {
      continue;
    }
    if (!dayAttendance || typeof dayAttendance !== "object") continue;

    for (const p of people) {
      const status = getAttendanceRecord(dayAttendance, p.id)?.status;
      if (isTanpaKeteranganOnDay(status)) {
        counts[p.id]++;
      }
    }
  }

  return counts;
};

/**
 * Rata-rata persentase kehadiran harian per bidang (Cara 1).
 * "Hadir" = hanya status Hadir (scan QR).
 */
export const calcMonthlyBidangStats = (
  monthlyAttendance,
  apelMeta,
  bidangList,
  people = [],
  { todayMonthKey, todayDayKey, apelStatus, dataMonthKey }
) => {
  const evalMonthKey = dataMonthKey || todayMonthKey;

  return bidangList.map((bidang) => {
    const members = people.filter((p) => p.bidang === bidang.nama);
    if (members.length === 0) {
      return { ...bidang, persen: 0, daysCounted: 0, memberCount: 0 };
    }

    const dailyPersents = [];

    for (const [dayKey, dayAttendance] of Object.entries(monthlyAttendance || {})) {
      if (
        !isDayCountable(dayKey, evalMonthKey, apelMeta, {
          todayMonthKey,
          todayDayKey,
          apelStatus,
          includeTodayLive: dataMonthKey ? false : true,
        })
      ) {
        continue;
      }

      let hadir = 0;
      for (const p of members) {
        if (getAttendanceRecord(dayAttendance, p.id)?.status === "Hadir") hadir++;
      }
      dailyPersents.push(Math.round((hadir / members.length) * 100));
    }

    const persen =
      dailyPersents.length > 0
        ? Math.round(dailyPersents.reduce((a, b) => a + b, 0) / dailyPersents.length)
        : 0;

    return { ...bidang, persen, daysCounted: dailyPersents.length, memberCount: members.length };
  });
};

export const calcAttendanceStats = (attendance, apelStatus, people = [], { includeMissingAsUnrecorded = true } = {}) => {
  // Guard: pastikan people array valid
  if (!people || people.length === 0) {
    return { total: 0, recorded: 0, hadir: 0, unaccounted: 0, tanpaKet: 0, belumAbsen: 0, dinasD: 0, dinasL: 0, izin: 0, sakit: 0, persen: 0 };
  }

  // Pilot belum dimulai — data absensi masih kosong
  if (!attendance || Object.keys(attendance).length === 0) {
    const total = people.length;
    return { total, recorded: 0, hadir: 0, unaccounted: 0, tanpaKet: 0, belumAbsen: 0, dinasD: 0, dinasL: 0, izin: 0, sakit: 0, persen: 0 };
  }

  let hadir = 0, unaccounted = 0, dinasD = 0, dinasL = 0, izin = 0, sakit = 0, recorded = 0;

  for (const p of people) {
    const status = getAttendanceRecord(attendance, p.id)?.status;

    if (!status) {
      if (includeMissingAsUnrecorded) unaccounted++;
      continue;
    }

    recorded++;

    if (status === "Hadir") hadir++;
    else if (status === "Dinas Dalam") dinasD++;
    else if (status === "Dinas Luar") dinasL++;
    else if (status === "Izin") izin++;
    else if (status === "Sakit") sakit++;
    else if (status === "Tanpa Keterangan") unaccounted++;
  }

  const total = includeMissingAsUnrecorded ? people.length : recorded;
  const persen = total > 0 ? Math.round((hadir / total) * 100) : 0;
  const tanpaKet = includeMissingAsUnrecorded ? (apelStatus === "ended" ? unaccounted : 0) : unaccounted;
  const belumAbsen = includeMissingAsUnrecorded ? (apelStatus === "ended" ? 0 : unaccounted) : 0;

  return { total, recorded, hadir, unaccounted, tanpaKet, belumAbsen, dinasD, dinasL, izin, sakit, persen };
};

const parseJamHadir = (jam) => {
  if (!jam || typeof jam !== "string") return 9999;
  const [h, m] = jam.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 9999;
  return h * 60 + m;
};

/** Daftar pegawai per kotak stat — Hadir diurut jam absen ascending. */
export const getPeopleByStatKey = (people, attendance, apelStatus, statKey) => {
  const rows = [];

  for (const p of people) {
    const record = getAttendanceRecord(attendance, p.id);
    const status = getEffectiveAttendanceStatus(record, apelStatus);
    const effectiveKey =
      statKey === "tanpaKet" || statKey === "belumAbsen"
        ? (apelStatus === "ended" ? "tanpaKet" : "belumAbsen")
        : statKey;

    let match = false;
    if (effectiveKey === "hadir") match = status === "Hadir";
    else if (effectiveKey === "tanpaKet") match = status === "Tanpa Keterangan";
    else if (effectiveKey === "belumAbsen") match = status === "Belum Hadir";
    else if (effectiveKey === "dinasD") match = status === "Dinas Dalam";
    else if (effectiveKey === "dinasL") match = status === "Dinas Luar";
    else if (effectiveKey === "izin") match = status === "Izin";
    else if (effectiveKey === "sakit") match = status === "Sakit";

    if (match) {
      rows.push({
        id: p.id,
        nama: p.nama,
        nip: p.nip,
        bidang: p.bidang,
        status,
        jamHadir: record?.jamHadir || null,
      });
    }
  }

  if (statKey === "hadir") {
    rows.sort((a, b) => parseJamHadir(a.jamHadir) - parseJamHadir(b.jamHadir));
  } else {
    rows.sort((a, b) => a.nama.localeCompare(b.nama));
  }

  return rows;
};
