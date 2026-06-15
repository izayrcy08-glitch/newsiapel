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

export const calcAttendanceStats = (attendance, apelStatus, people, { includeMissingAsUnrecorded = true } = {}) => {
  // Pilot belum dimulai — data absensi masih kosong
  if (!attendance || Object.keys(attendance).length === 0) {
    const total = people.length;
    return { total, recorded: 0, hadir: 0, unaccounted: 0, tanpaKet: 0, belumAbsen: 0, dinasD: 0, dinasL: 0, izin: 0, sakit: 0, persen: 0 };
  }

  let hadir = 0, unaccounted = 0, dinasD = 0, dinasL = 0, izin = 0, sakit = 0, recorded = 0;

  for (const p of people) {
    const status = attendance[p.id]?.status;

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
