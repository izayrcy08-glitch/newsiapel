/**
 * Generate PDF daftar kredensial pegawai (EMPLOYEE saja).
 * Usage: node scripts/generate-kredensial-pegawai-pdf.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { resolvePegawaiLoginId } from "../src/utils/login-username.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataPath = join(root, "src/data/pegawai_master.json");
const outPath = join(root, "SIAPEL-Kredensial-Pegawai.pdf");

const pegawai = JSON.parse(readFileSync(dataPath, "utf8"))
  .filter((p) => p.role === "EMPLOYEE" && p.isActive !== false)
  .sort((a, b) => Number(a.id) - Number(b.id));

const rows = pegawai.map((p, index) => [
  String(index + 1),
  p.nama || "-",
  resolvePegawaiLoginId(p) || "-",
  p.password || "-",
]);

const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
const pageWidth = doc.internal.pageSize.getWidth();
const now = new Date().toLocaleDateString("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

doc.setFontSize(14);
doc.setFont("helvetica", "bold");
doc.text("SIAPEL — Daftar Kredensial Pegawai", pageWidth / 2, 40, { align: "center" });

doc.setFontSize(9);
doc.setFont("helvetica", "normal");
doc.text("Dinas PUPR Kab. Barito Utara — Pilot Absensi Apel", pageWidth / 2, 56, { align: "center" });
doc.text(`Diperbarui: ${now}  |  Total pegawai: ${pegawai.length}`, pageWidth / 2, 70, { align: "center" });
doc.text("Username = NIP angka atau nama tanpa gelar (case-insensitive)", pageWidth / 2, 82, { align: "center" });

autoTable(doc, {
  startY: 96,
  head: [["No", "Nama", "Username", "Password"]],
  body: rows,
  styles: {
    fontSize: 7,
    cellPadding: 3,
    overflow: "linebreak",
  },
  headStyles: {
    fillColor: [30, 64, 120],
    textColor: 255,
    fontStyle: "bold",
  },
  columnStyles: {
    0: { cellWidth: 30, halign: "center" },
    1: { cellWidth: 280 },
    2: { cellWidth: 220 },
    3: { cellWidth: 60, halign: "center" },
  },
  margin: { left: 40, right: 40 },
  didDrawPage: (data) => {
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `Halaman ${data.pageNumber} / ${pageCount} — RAHASIA: jangan dibagikan sembarangan`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" }
    );
  },
});

const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
writeFileSync(outPath, pdfBuffer);
console.log(`✅ PDF dibuat: ${outPath}`);
console.log(`   ${pegawai.length} pegawai (EMPLOYEE, tanpa admin/developer/pimpinan)`);
