import orgData from "../data/organization.json";
import { getEffectiveAttendanceStatus, calcAttendanceStats } from "../fitur/absensi/logika_absensi";

const DINAS = orgData.dinas || "Dinas PUPR";
const KABUPATEN = orgData.kabupaten || "";

const formatTanggal = (date) =>
  date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const buildRows = (members, attendance, apelStatus) =>
  members
    .slice()
    .sort((a, b) => (a.nama || "").localeCompare(b.nama || ""))
    .map((p, index) => {
      const status = getEffectiveAttendanceStatus(attendance[p.id], apelStatus) || "-";
      const jam = attendance[p.id]?.jamHadir;
      const ket = status === "Hadir" && jam ? `Hadir (${jam})` : status;
      return [String(index + 1), p.nama || "-", p.nip ? String(p.nip) : "-", ket];
    });

/**
 * Ringkasan kehadiran + bar sederhana sebelum tabel.
 * Mengembalikan posisi Y berikutnya untuk konten setelahnya.
 */
const drawSummary = (doc, stats, startY) => {
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = startY;

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Total Pegawai: ${stats.total}`, marginX, y);

  const ringkasan = [
    `Hadir: ${stats.hadir}`,
    `Izin: ${stats.izin}`,
    `Sakit: ${stats.sakit}`,
    `Dinas Dalam: ${stats.dinasD}`,
    `Dinas Luar: ${stats.dinasL}`,
    stats.tanpaKet ? `Tanpa Keterangan: ${stats.tanpaKet}` : `Belum Hadir: ${stats.belumAbsen}`,
  ];
  y += 16;
  doc.text(ringkasan.join("   |   "), marginX, y);

  // Bar persentase kehadiran (grafik sederhana)
  y += 18;
  const barWidth = pageWidth - marginX * 2;
  const barHeight = 12;
  doc.setFillColor(226, 232, 240);
  doc.rect(marginX, y, barWidth, barHeight, "F");
  doc.setFillColor(16, 185, 129);
  doc.rect(marginX, y, (barWidth * (stats.persen || 0)) / 100, barHeight, "F");
  doc.setFontSize(9);
  doc.setTextColor(30);
  doc.text(`Persentase Kehadiran: ${stats.persen || 0}%`, marginX, y + barHeight + 14);

  return y + barHeight + 28;
};

const drawHeader = (doc, judul, tanggalStr) => {
  const marginX = 40;
  doc.setFontSize(14);
  doc.setTextColor(15);
  doc.text("Laporan Absensi Apel Harian", marginX, 46);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(DINAS + (KABUPATEN ? ` — ${KABUPATEN}` : ""), marginX, 62);
  doc.setFontSize(11);
  doc.setTextColor(15);
  doc.text(judul, marginX, 84);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(tanggalStr, marginX, 100);
  return 116;
};

const addSection = (doc, autoTable, { judul, tanggalStr, stats, rows, startY }) => {
  let y = startY;
  if (judul) {
    doc.setFontSize(11);
    doc.setTextColor(15);
    doc.text(judul, 40, y);
    y += 10;
  }
  y = drawSummary(doc, stats, y + 6);
  autoTable(doc, {
    startY: y,
    head: [["No", "Nama", "NIP", "Keterangan Absen"]],
    body: rows.length > 0 ? rows : [["-", "Tidak ada pegawai", "-", "-"]],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 32, halign: "center" },
      2: { cellWidth: 130 },
    },
    margin: { left: 40, right: 40 },
  });
  return doc.lastAutoTable.finalY + 24;
};

const triggerDownload = (doc, filename) => {
  doc.save(filename);
};

const slugify = (str) =>
  String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const dateStamp = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};

/** Load jsPDF + autotable secara lazy (hanya saat tombol ditekan). */
const loadPdfEngine = async () => {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default || autoTableModule.autoTable;
  return { jsPDF, autoTable };
};

/** Download PDF laporan untuk satu bidang. */
export const downloadLaporanBidang = async ({ bidangNama, people, attendance, apelStatus, now = new Date() }) => {
  const { jsPDF, autoTable } = await loadPdfEngine();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const tanggalStr = formatTanggal(now);

  const members = people.filter((p) => p.bidang === bidangNama);
  const stats = calcAttendanceStats(attendance, apelStatus, members, { includeMissingAsUnrecorded: true });
  const rows = buildRows(members, attendance, apelStatus);

  let y = drawHeader(doc, `Bidang/UPT: ${bidangNama}`, tanggalStr);
  addSection(doc, autoTable, { judul: "", tanggalStr, stats, rows, startY: y });

  triggerDownload(doc, `laporan-apel-${slugify(bidangNama)}-${dateStamp(now)}.pdf`);
};

/** Download satu PDF berisi semua bidang (dikelompokkan per bidang). */
export const downloadLaporanSemua = async ({ people, attendance, apelStatus, now = new Date() }) => {
  const { jsPDF, autoTable } = await loadPdfEngine();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const tanggalStr = formatTanggal(now);
  const pageHeight = doc.internal.pageSize.getHeight();

  const bidangList = orgData.bidang.filter((b) => b.id !== "pimpinan");

  // Ringkasan keseluruhan di halaman awal
  const statsAll = calcAttendanceStats(attendance, apelStatus, people, { includeMissingAsUnrecorded: true });
  let y = drawHeader(doc, "Rekap Seluruh Bidang/UPT", tanggalStr);
  y = drawSummary(doc, statsAll, y + 6);
  y += 8;

  for (const b of bidangList) {
    const members = people.filter((p) => p.bidang === b.nama);
    if (members.length === 0) continue;

    const stats = calcAttendanceStats(attendance, apelStatus, members, { includeMissingAsUnrecorded: true });
    const rows = buildRows(members, attendance, apelStatus);

    if (y > pageHeight - 160) {
      doc.addPage();
      y = 56;
    }
    y = addSection(doc, autoTable, { judul: `Bidang/UPT: ${b.nama}`, tanggalStr, stats, rows, startY: y });
  }

  triggerDownload(doc, `laporan-apel-semua-bidang-${dateStamp(now)}.pdf`);
};
