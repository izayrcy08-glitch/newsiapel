#!/usr/bin/env node

/**
 * generate-passwords.mjs — SATU KALI PAKAI
 * =========================================
 * 1. Tambah field "nik" (setelah "nip") — diisi "" untuk semua
 * 2. Tambah field "phoneFingerprint" ("") — untuk device binding nanti
 * 3. Generate password 6 digit angka acak untuk semua pegawai
 *
 * Output:
 *   - Update src/data/pegawai_master.json (in-place)
 *   - Print daftar password ke terminal
 *   - Simpan CSV: daftar_password_siapel.csv
 *
 * Cara pakai:
 *   node scripts/generate-passwords.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "..", "src", "data", "pegawai_master.json");

// ── Baca ──
const raw = readFileSync(DATA_PATH, "utf-8");
const pegawaiList = JSON.parse(raw);

if (!Array.isArray(pegawaiList)) {
  console.error("ERROR: pegawai_master.json bukan array");
  process.exit(1);
}

console.log(`Membaca ${pegawaiList.length} pegawai...\n`);

// ── Generate 6 digit random (string biar leading zeros aman) ──
function generatePassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Proses tiap record ──
const results = [];

for (const p of pegawaiList) {
  p.nik = p.nik ?? "";
  p.phoneFingerprint = p.phoneFingerprint ?? "";
  p.password = generatePassword();

  results.push({
    id: p.id,
    nama: p.nama,
    nip: p.nip || "",
    nik: p.nik,
    password: p.password,
  });
}

// ── Urutkan field biar konsisten: id, nama, nip, nik, jabatan, bidang, unit, role, isActive?, password, phoneFingerprint ──
const fieldOrder = [
  "id", "nama", "nip", "nik", "jabatan", "bidang", "unit",
  "role", "isActive", "password", "phoneFingerprint",
];

const ordered = pegawaiList.map((p) => {
  const obj = {};
  for (const key of fieldOrder) {
    if (key in p) obj[key] = p[key];
  }
  // Include any extra fields not in our order list
  for (const key of Object.keys(p)) {
    if (!fieldOrder.includes(key)) obj[key] = p[key];
  }
  return obj;
});

// ── Tulis ──
writeFileSync(DATA_PATH, JSON.stringify(ordered, null, 2) + "\n", "utf-8");
console.log(`✅ pegawai_master.json diperbarui — ${ordered.length} records\n`);

// ── Output daftar password ──
console.log("=".repeat(72));
console.log("             DAFTAR PASSWORD SIAPEL — ${ordered.length} Pegawai");
console.log("=".repeat(72));
console.log("");

// Header tabel
console.log(
  "ID".padEnd(4) +
  "NIP".padEnd(20) +
  "NIK".padEnd(12) +
  "Nama".padEnd(28) +
  "Password"
);
console.log("─".repeat(76));

for (const r of results) {
  console.log(
    String(r.id).padEnd(4) +
    (r.nip || "-").padEnd(20) +
    (r.nik || "-").padEnd(12) +
    (r.nama || "").slice(0, 27).padEnd(28) +
    r.password
  );
}

console.log("─".repeat(76));
console.log(`Total: ${results.length} pegawai`);
console.log("");

// ── Simpan CSV ──
const csvPath = resolve(__dirname, "..", "daftar_password_siapel.csv");
const header = "ID,Nama,NIP,NIK,Password\n";
const csvRows = results.map((r) => {
  const nama = `"${(r.nama || "").replace(/"/g, '""')}"`;
  return `${r.id},${nama},${r.nip || ""},${r.nik || ""},${r.password}`;
});
writeFileSync(csvPath, header + csvRows.join("\n"), "utf-8");
console.log(`📄 CSV: daftar_password_siapel.csv`);
console.log("⚠️  FILE INI MENGANDUNG PASSWORD — jangan commit ke git!");
