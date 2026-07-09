import { useState, useEffect } from "react";
import orgData from "../data/organization.json";
import { Card } from "../components/Card";
import { BackButton } from "../components/BackButton";
import {
  downloadLaporanBidang,
  downloadLaporanSemua,
  previewLaporanBidang,
  previewLaporanSemua,
  revokePdfPreview,
  downloadFromPreviewDoc,
} from "../utils/laporan-pdf";

export default function PanelLaporan({ people, attendance, stats, apelStatus, onBack }) {
  const [busy, setBusy] = useState(null); // null | "preview-semua" | "download-semua" | "preview:bidang" | "download:bidang"
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // { blobUrl, filename, title, doc }

  useEffect(() => {
    return () => {
      if (preview?.blobUrl) revokePdfPreview(preview.blobUrl);
    };
  }, [preview?.blobUrl]);

  const closePreview = () => {
    if (preview?.blobUrl) revokePdfPreview(preview.blobUrl);
    setPreview(null);
  };

  const pdfParams = { people, attendance, apelStatus, now: new Date() };
  const todayLabel = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const isBusy = busy !== null;

  const bidangStats = orgData.bidang
    .filter((b) => b.id !== "pimpinan")
    .map((b) => {
      const members = people.filter((p) => p.bidang === b.nama);
      let hadir = 0, tanpaKet = 0, izin = 0, sakit = 0, dinasD = 0, dinasL = 0;
      for (const p of members) {
        const att = attendance[p.id];
        if (!att?.status) continue;
        if (att.status === "Hadir") hadir++;
        else if (att.status === "Tanpa Keterangan") tanpaKet++;
        else if (att.status === "Izin") izin++;
        else if (att.status === "Sakit") sakit++;
        else if (att.status === "Dinas Dalam") dinasD++;
        else if (att.status === "Dinas Luar") dinasL++;
      }
      return { ...b, total: members.length, hadir, tanpaKet, izin, sakit, dinasD, dinasL };
    })
    .filter((b) => b.total > 0);

  const runPdfAction = async (key, fn) => {
    setError("");
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      console.error("Gagal membuat PDF:", err);
      setError("Gagal membuat PDF. Coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  const handlePreviewSemua = async () => {
    setError("");
    setBusy("preview-semua");
    try {
      if (preview?.blobUrl) revokePdfPreview(preview.blobUrl);
      const result = await previewLaporanSemua(pdfParams);
      setPreview(result);
    } catch (err) {
      console.error("Gagal preview PDF semua bidang:", err);
      setError("Gagal membuat preview PDF. Coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  const handlePreviewBidang = async (bidangNama) => {
    setError("");
    setBusy(`preview:${bidangNama}`);
    try {
      if (preview?.blobUrl) revokePdfPreview(preview.blobUrl);
      const result = await previewLaporanBidang({ ...pdfParams, bidangNama });
      setPreview(result);
    } catch (err) {
      console.error("Gagal preview PDF bidang:", err);
      setError("Gagal membuat preview PDF. Coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  const PdfActionButtons = ({ onPreview, onDownload, previewKey, downloadKey, compact = false }) => (
    <div className={`flex gap-2 ${compact ? "" : "mb-3"}`}>
      <button
        onClick={onPreview}
        disabled={isBusy}
        className="flex-1 py-2 rounded-lg bg-slate-800 border border-slate-600/60 text-slate-200 text-xs font-medium transition-all active:scale-[0.98] hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy === previewKey ? "Menyiapkan..." : "👁️ Preview"}
      </button>
      <button
        onClick={onDownload}
        disabled={isBusy}
        className="flex-1 py-2 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-200 text-xs font-medium transition-all active:scale-[0.98] hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy === downloadKey ? "Menyiapkan..." : "⬇️ Download"}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />
        <h2 className="text-xl font-black text-white mb-1">Laporan Harian</h2>
        <p className="text-slate-500 text-xs mb-5">{todayLabel}</p>

        <Card className="p-4 mb-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-black text-white">{stats.total}</div>
              <div className="text-slate-500 text-xs">Total</div>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-400">{stats.hadir}</div>
              <div className="text-slate-500 text-xs">Hadir</div>
            </div>
            <div>
              <div className="text-2xl font-black text-amber-400">{`${stats.persen}%`}</div>
              <div className="text-slate-500 text-xs">Persentase</div>
            </div>
          </div>
        </Card>

        <div className="mb-1 text-slate-400 text-[10px] font-semibold uppercase tracking-wide">
          Semua Bidang
        </div>
        <PdfActionButtons
          onPreview={handlePreviewSemua}
          onDownload={() => runPdfAction("download-semua", () => downloadLaporanSemua(pdfParams))}
          previewKey="preview-semua"
          downloadKey="download-semua"
        />

        {error && (
          <div className="mb-3 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="space-y-2 mt-4">
          {bidangStats.map((b) => (
            <Card key={b.id} className="p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white text-sm font-semibold">{b.nama}</div>
                <div className="text-emerald-400 font-bold text-sm">
                  {b.total > 0 ? Math.round((b.hadir / b.total) * 100) : 0}%
                </div>
              </div>
              <div className="flex gap-3 text-xs text-slate-400 flex-wrap gap-y-1 mb-3">
                <span>✅ {b.hadir}</span>
                <span>🚫 {b.tanpaKet}</span>
                <span>🏢 {b.dinasD}</span>
                <span>🚗 {b.dinasL}</span>
                <span>📄 {b.izin}</span>
                <span>🤒 {b.sakit}</span>
              </div>
              <PdfActionButtons
                compact
                onPreview={() => handlePreviewBidang(b.nama)}
                onDownload={() =>
                  runPdfAction(`download:${b.nama}`, () =>
                    downloadLaporanBidang({ ...pdfParams, bidangNama: b.nama })
                  )
                }
                previewKey={`preview:${b.nama}`}
                downloadKey={`download:${b.nama}`}
              />
            </Card>
          ))}
        </div>
      </div>

      {/* Modal Preview PDF */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-900 border-b border-slate-700/60 shrink-0">
            <div className="min-w-0">
              <div className="text-white text-sm font-semibold truncate">{preview.title}</div>
              <div className="text-slate-500 text-[10px] truncate">{preview.filename}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => downloadFromPreviewDoc(preview.doc, preview.filename)}
                className="px-3 py-1.5 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-200 text-xs font-medium"
              >
                ⬇️ Download
              </button>
              <button
                onClick={closePreview}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600/60 text-slate-300 text-xs"
                aria-label="Tutup preview"
              >
                ✕ Tutup
              </button>
            </div>
          </div>
          <iframe
            src={preview.blobUrl}
            title={preview.title}
            className="flex-1 w-full bg-white border-0"
          />
        </div>
      )}
    </div>
  );
}
