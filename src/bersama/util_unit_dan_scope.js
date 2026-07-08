export const UNIT_LABELS = {
  PIMPINAN: "Pimpinan",
  DINAS: "Dinas",
  SEKRETARIAT: "Sekretariat",
  ALKAL: "UPT ALKAL",
  BINA_MARGA: "Bina Marga",
  SDA: "Sumber Daya Air",
  CIPTA_KARYA: "Cipta Karya",
  TATA_RUANG: "Tata Ruang",
  TATA_KOTA: "Tata Kota",
  JASA_KONSTRUKSI: "Jasa Konstruksi",
};

export const PEGAWAI_GROUP_ORDER = [
  "PIMPINAN",
  "DINAS",
  "SEKRETARIAT",
  "ALKAL",
  "BINA_MARGA",
  "SDA",
  "CIPTA_KARYA",
  "TATA_KOTA",
  "TATA_RUANG",
  "JASA_KONSTRUKSI",
];

export const getUnitLabel = (unitCode) => UNIT_LABELS[unitCode] || unitCode || "";

/** Akun login operasional — bukan pegawai absensi. */
export const isSystemAccount = (p) => p?.role === "ADMIN" || p?.role === "DEVELOPER";

/** Hanya pegawai yang ikut absensi (exclude admin/developer). */
export const excludeSystemAccounts = (people = []) => people.filter((p) => !isSystemAccount(p));

export const getPegawaiGroupKey = (pegawai) => pegawai.unit || pegawai.bidang || "LAINNYA";

export const getPegawaiGroupLabel = (groupKey) => getUnitLabel(groupKey);

export const getScopedPeople = (people, sourcePerson, scope = "ALL") => {
  if (scope === "ALL" || !sourcePerson) return people;
  const scopeKey = getPegawaiGroupKey(sourcePerson);
  if (!scopeKey) return people;
  return people.filter((person) => getPegawaiGroupKey(person) === scopeKey);
};

const normalizeIdentity = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

export const buildPimpinanAccessRoles = (people) => {
  const seen = new Set();
  const items = [];

  const rolePriority = { EXECUTIVE: 0, UNIT_LEADER: 1 };
  const unitPriority = {
    DINAS: 0,
    SEKRETARIAT: 1,
    ALKAL: 2,
    SDA: 3,
    BINA_MARGA: 4,
    CIPTA_KARYA: 5,
    TATA_KOTA: 6,
    TATA_RUANG: 7,
    JASA_KONSTRUKSI: 8,
  };

  for (const person of people) {
    if (person.role !== "EXECUTIVE" && person.role !== "UNIT_LEADER") continue;

    const dedupeKey = `${person.role}|${normalizeIdentity(person.nip)}|${normalizeIdentity(person.nama)}|${normalizeIdentity(person.jabatan)}|${person.unit}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    items.push({
      id: `${person.role.toLowerCase()}-${person.nip || normalizeIdentity(person.nama) || normalizeIdentity(person.jabatan) || normalizeIdentity(person.unit)}`,
      pegawaiId: person.id,
      group: person.role,
      name: person.nama || person.jabatan || "Sekretaris Dinas",
      nip: person.nip || "",
      jabatan: person.jabatan || "",
      unit: person.unit || "",
      scope: person.role === "EXECUTIVE" ? "ALL" : "UNIT",
      description: person.role === "EXECUTIVE"
        ? (person.nama ? "Kepala Dinas" : "Belum diisi")
        : getUnitLabel(person.unit),
    });
  }

  return items.sort((a, b) => {
    const roleDiff = (rolePriority[a.group] ?? 99) - (rolePriority[b.group] ?? 99);
    if (roleDiff !== 0) return roleDiff;
    const unitDiff = (unitPriority[a.unit] ?? 99) - (unitPriority[b.unit] ?? 99);
    if (unitDiff !== 0) return unitDiff;
    return a.name.localeCompare(b.name);
  });
};
