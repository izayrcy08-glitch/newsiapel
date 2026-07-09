import { useState } from "react";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { RevisiActorNote } from "./RevisiActorNote";
import { STATUS_OPTIONS } from "../bersama/konstanta_aplikasi";

// Upload dokumen membutuhkan Firebase Storage (plan Blaze). Nonaktif sementara di pilot Spark.
const UPLOAD_DOKUMEN_AKTIF = false;

// ─── PENGAJUAN PERUBAHAN STATUS ────────────────────────────────────────────────
const PengajuanStatusForm = ({ myStatus, pegawai, myPengajuan = [], onSubmit }) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [keterangan, setKeterangan] = useState("");
  const [toast, setToast] = useState(null);
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
      await onSubmit(pegawai.id, {
        nama: pegawai.nama,
        nip: pegawai.nip,
        statusLama: myStatus || "",
        statusBaru: selectedStatus,
        keterangan: keterangan.trim(),
        dokumen: "",
        dokumenPath: "",
      });

      showToast("Pengajuan berhasil dikirim");
      setSelectedStatus(null);
      setKeterangan("");
      setShowForm(false);
    } catch (err) {
      console.error("Gagal mengirim pengajuan:", err);
      if (err?.message === "pengajuan_pending") {
        showToast("Anda masih punya pengajuan yang menunggu verifikasi", true);
      } else {
        showToast("Gagal mengirim — periksa koneksi dan coba lagi", true);
      }
    } finally {
      setUploading(false);
    }
  };

  if (!showForm) {
    return (
      <>
        <Card className="p-4 mb-4" onClick={() => setShowForm(true)}>
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-xl">📄</div>
            <div className="flex-1">
              <div className="text-white text-sm font-semibold">Pengajuan Perubahan Status</div>
              <div className="text-slate-400 text-xs">Ajukan status baru + keterangan (tanpa lampiran file)</div>
            </div>
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Card>
        {myPengajuan.length > 0 && (
          <PengajuanRiwayatList items={myPengajuan} />
        )}
      </>
    );
  }

  return (
    <>
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

      <p className="text-slate-400 text-xs mb-4 leading-relaxed">
        Pilih status yang ingin diajukan, tuliskan alasan, lalu kirim. Admin akan meninjau keterangan Anda
        sebelum menyetujui atau menolak.
      </p>

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

      {/* Peringatan: upload dokumen belum aktif */}
      {!UPLOAD_DOKUMEN_AKTIF && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0" aria-hidden="true">⚠️</span>
            <div>
              <div className="text-amber-200 text-xs font-semibold">Upload dokumen belum aktif</div>
              <p className="text-amber-100/70 text-[11px] mt-1 leading-relaxed">
                Fitur lampiran surat (PDF/gambar) sementara dinonaktifkan. Anda tetap bisa mengajukan
                perubahan status dengan <strong className="text-amber-100/90">keterangan teks</strong> saja.
                Admin akan meninjau alasan Anda di tab Pengajuan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Keterangan */}
      <div className="mb-4">
        <div className="text-slate-500 text-xs mb-2">Keterangan / Alasan <span className="text-red-400">*</span></div>
        <textarea
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          placeholder="Contoh: Dinas ke lapangan proyek jembatan, ada surat tugas nomor ..."
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
    {myPengajuan.length > 0 && (
      <PengajuanRiwayatList items={myPengajuan} />
    )}
    </>
  );
};

const PengajuanRiwayatList = ({ items }) => (
  <Card className="p-4 mb-4 border-slate-700/60">
    <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
      Riwayat Pengajuan Saya
    </div>
    <div className="space-y-2">
      {items.map((p) => {
        const isMenunggu = p.statusVerifikasi === "menunggu";
        const isDisetujui = p.statusVerifikasi === "disetujui";
        const isDitolak = p.statusVerifikasi === "ditolak";
        return (
          <div
            key={p.id}
            className={`rounded-xl border p-3 ${
              isDisetujui
                ? "border-emerald-500/30 bg-emerald-500/10"
                : isDitolak
                  ? "border-red-500/30 bg-red-500/10"
                  : "border-amber-500/30 bg-amber-500/10"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-white text-xs font-semibold">{p.statusBaru}</span>
              <span className={`text-[10px] font-bold uppercase ${
                isDisetujui ? "text-emerald-400" : isDitolak ? "text-red-400" : "text-amber-400"
              }`}>
                {isMenunggu ? "Menunggu" : isDisetujui ? "Disetujui" : "Ditolak"}
              </span>
            </div>
            {p.keterangan && (
              <p className="text-slate-400 text-[11px] italic mb-1">"{p.keterangan}"</p>
            )}
            {isDisetujui && (
              <RevisiActorNote record={p} className="mb-1" />
            )}
            {isDitolak && (
              <>
                <RevisiActorNote record={p} variant="ditolak" className="mb-1" />
                {p.alasanAdmin && (
                  <p className="text-red-300/80 text-[11px]">
                    Alasan: {p.alasanAdmin}
                  </p>
                )}
              </>
            )}
            <div className="text-slate-500 text-[10px] mt-1">🕘 {p.waktu || "—"} WIB</div>
          </div>
        );
      })}
    </div>
  </Card>
);

export { PengajuanStatusForm };
export default PengajuanStatusForm;
