import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const defaultSourcePath = "C:\\Users\\USER\\.codex\\attachments\\3212e84e-22a7-43f6-9b14-0a864bcf2a0b\\pasted-text.txt";
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSourcePath;
const currentMasterPath = path.join(root, "src", "data", "pegawai_master.json");
const targetPath = path.join(root, "src", "data", "pegawai_master.json");

const UNIT_TO_LABEL = {
  PIMPINAN: "Pimpinan",
  DINAS: "Dinas",
  SEKRETARIAT: "Sekretariat",
  ALKAL: "UPT ALKAL",
  BINA_MARGA: "Bina Marga",
  SDA: "Sumber Daya Air",
  CIPTA_KARYA: "Cipta Karya",
  TATA_KOTA: "Tata Kota",
  TATA_RUANG: "Tata Ruang",
  JASA_KONSTRUKSI: "Jasa Konstruksi",
};

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseRecords(text) {
  const lines = text.split(/\r?\n/);
  const records = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^Nama:/i.test(trimmed)) {
      if (current) records.push(current);
      current = { nama: "", nip: "", jabatan: "", unit: "", role: "" };
      current.nama = trimmed.replace(/^Nama:/i, "").trim();
      continue;
    }

    if (!current) continue;

    if (/^NIP:/i.test(trimmed)) {
      current.nip = trimmed.replace(/^NIP:/i, "").trim();
      continue;
    }

    if (/^Jabatan:/i.test(trimmed)) {
      current.jabatan = trimmed.replace(/^Jabatan:/i, "").trim();
      continue;
    }

    if (/^Unit:/i.test(trimmed)) {
      current.unit = trimmed.replace(/^Unit:/i, "").trim();
      continue;
    }

    if (/^Role:/i.test(trimmed)) {
      current.role = trimmed.replace(/^Role:/i, "").trim();
      continue;
    }
  }

  if (current) records.push(current);

  return records;
}

function buildIdMaps(existing) {
  const byNip = new Map();
  const byName = new Map();
  let maxId = 0;

  for (const item of existing) {
    const id = Number(item.id) || 0;
    if (id > maxId) maxId = id;
    if (item.nip) byNip.set(normalize(item.nip), id);
    if (item.nama) byName.set(normalize(item.nama), id);
  }

  return { byNip, byName, maxId };
}

function buildUniqueKey(record) {
  const nipKey = normalize(record.nip);
  if (nipKey) return `nip:${nipKey}`;
  const nameKey = normalize(record.nama);
  const unitKey = normalize(record.unit);
  const roleKey = normalize(record.role);
  const jabatanKey = normalize(record.jabatan);
  return `name:${nameKey}|unit:${unitKey}|role:${roleKey}|jabatan:${jabatanKey}`;
}

function resolveId(record, maps, nextId) {
  const nipKey = normalize(record.nip);
  if (nipKey && maps.byNip.has(nipKey)) {
    return maps.byNip.get(nipKey);
  }

  const nameKey = normalize(record.nama);
  if (nameKey && maps.byName.has(nameKey)) {
    return maps.byName.get(nameKey);
  }

  return nextId.value++;
}

function unitToBidang(unit) {
  return UNIT_TO_LABEL[unit] || unit || "";
}

const sourceText = fs.readFileSync(sourcePath, "utf8");
const parsed = parseRecords(sourceText);
const existing = fs.existsSync(currentMasterPath)
  ? JSON.parse(fs.readFileSync(currentMasterPath, "utf8"))
  : [];
const maps = buildIdMaps(existing);
const nextId = { value: maps.maxId + 1 };

const seen = new Set();
const output = [];
let duplicatesDropped = 0;
let preservedIds = 0;
let newIds = 0;

for (const record of parsed) {
  const uniqueKey = buildUniqueKey(record);
  if (seen.has(uniqueKey)) {
    duplicatesDropped++;
    continue;
  }
  seen.add(uniqueKey);

  const id = resolveId(record, maps, nextId);
  if ((maps.byNip.has(normalize(record.nip)) || maps.byName.has(normalize(record.nama))) && id) {
    preservedIds++;
  } else {
    newIds++;
  }

  output.push({
    id,
    nama: record.nama,
    nip: record.nip,
    jabatan: record.jabatan,
    bidang: unitToBidang(record.unit),
    unit: record.unit,
    role: record.role || "EMPLOYEE",
    password: "",
  });
}

output.sort((a, b) => Number(a.id) - Number(b.id));

fs.writeFileSync(targetPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(`source: ${path.relative(root, sourcePath)}`);
console.log(`records parsed: ${parsed.length}`);
console.log(`records written: ${output.length}`);
console.log(`duplicates dropped: ${duplicatesDropped}`);
console.log(`ids preserved: ${preservedIds}`);
console.log(`new ids assigned: ${newIds}`);
