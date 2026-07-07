import { useState } from "react";
import { uploadPengajuanFile } from "../utils/storage-helper";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { STATUS_OPTIONS } from "../bersama/konstanta_aplikasi";

// ─── PENGAJUAN PERUBAHAN STATUS ────────────────────────────────────────────────
const PengajuanStatusForm = ({ myStatus, pegawai, onSubmit }) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [keterangan, setKeterangan] = useState("");
  const [toast, setToast] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const showToast = (message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async () => {
    if (!selectedStatus) {
      showToast("Pilih status baru terlebih dahulu", true);
      return;
    }
    if (!keterangan.trim()) {
      showToast("Keterangan tidak boleh kosong", true);
      return;
    }

    if (!onSubmit || !pegawai) {
      showToast("Sistem belum siap — coba lagi nanti", true);
      return;
    }

    setUploading(true);

    try {
      let dokumenUrl = "";
      let dokumenPath = "";

      // Upload file ke Firebase Storage jika ada (lazy — SDK hanya di-load saat upload)
      if (file) {
        const result = await uploadPengajuanFile(pegawai.id, file);
        dokumenUrl = result.downloadUrl;
        dokumenPath = result.path;
      }

      // Kirim pengajuan ke Firebase via callback
      await onSubmit(pegawai.id, {
        nama: pegawai.nama,
        nip: pegawai.nip,
        statusLama: myStatus || "",
        statusBaru: selectedStatus,
        keterangan: keterangan.trim(),
        dokumen: dokumenUrl,
        dokumenPath: dokumenPath,
      });

      showToast("Pengajuan berhasil dikirim");
      setSelectedStatus(null);
      setKeterangan("");
      setFile(null);
      setShowForm(false);
    } catch (err) {
      console.error("Gagal mengirim pengajuan:", err);
      showToast("Gagal mengirim — periksa koneksi dan coba lagi", true);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 2 * 1024 * 1024) {
        showToast("File maksimal 2 MB", true);
        e.target.value = "";
        return;
      }
      setFile(selected);
    }
  };

  if (!showForm) {
    return (
      <Card className="p-4 mb-4" onClick={() => setShowForm(true)}>
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-xl">📄</div>
          <div className="flex-1">
            <div className="text-white text-sm font-semibold">Pengajuan Perubahan Status</div>
            <div className="text-slate-400 text-xs">Ajukan perubahan status absensi</div>
          </div>
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-4 border-blue-500/30">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 border text-sm font-medium px-4 py-3 rounded-xl shadow-lg backdrop-blur-xl ${
          toast.isError
            ? "bg-red-500/90 border-red-400/40 text-white"
            : "bg-emerald-500/90 border-emerald-400/40 text-white"
        }`}>
          {toast.isError ? "✕" : "✓"} {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-sm font-bold">📄 Pengajuan Perubahan Status</h3>
        <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white" disabled={uploading}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status Saat Ini */}
      <div className="mb-4">
        <div className="text-slate-500 text-xs mb-1">Status Saat Ini</div>
        <div className="flex items-center gap-2">
          <StatusBadge status={myStatus || "Tanpa Keterangan"} />
        </div>
      </div>

      {/* Status Baru */}
      <div className="mb-4">
        <div className="text-slate-500 text-xs mb-2">Ajukan Status Baru:</div>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map(status => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              disabled={uploading}
              className={`p-3 rounded-xl border text-xs font-semibold transition-all active:scale-[0.97] ${
                selectedStatus === status
                  ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                  : "bg-slate-800 border-slate-700/50 text-slate-300 hover:border-slate-600"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Dokumen Pendukung */}
      <div className="mb-4">
        <div className="text-slate-500 text-xs mb-2">Dokumen Pendukung (opsional, maks 2 MB)</div>
        <label className="block">
          <div className={`flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 bg-slate-800 cursor-pointer hover:border-slate-600 transition-colors ${
            file ? "border-emerald-500/30" : ""
          }`}>
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-sm">📎</div>
            <div className="flex-1 min-w-0">
              <div className="text-slate-400 text-xs truncate">{file ? file.name : "Pilih File (PDF/JPG/PNG)"}</div>
              {file && (
                <div className="text-slate-500 text-[10px] mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              )}
            </div>
          </div>
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} disabled={uploading} />
        </label>
      </div>

      {/* Keterangan */}
      <div className="mb-4">
        <div className="text-slate-500 text-xs mb-2">Keterangan</div>
        <textarea
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          placeholder="Tuliskan alasan pengajuan..."
          rows={3}
          disabled={uploading}
          className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50 resize-none"
        />
      </div>

      {/* Tombol Kirim */}
      <button
        onClick={handleSubmit}
        disabled={!selectedStatus || !keterangan.trim() || uploading}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
          selectedStatus && keterangan.trim() && !uploading
            ? "bg-blue-600 hover:bg-blue-500 text-white"
            : "bg-slate-800 text-slate-600 cursor-not-allowed"
        }`}
      >
        {uploading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Mengirim...
          </>
        ) : (
          "Kirim Pengajuan"
        )}
      </button>
    </Card>
  );
};

export { PengajuanStatusForm };
export default PengajuanStatusForm;
