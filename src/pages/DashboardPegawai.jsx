import { useState, useEffect } from "react";
import pegawaiData from "../data/pegawai_master.json";
import { Card } from "../components/Card";
import { BackButton } from "../components/BackButton";
import { Countdown } from "../components/Countdown";
import { ProgressRing } from "../components/ProgressRing";
import { TokenFeedback } from "../components/TokenFeedback";
import { ProfileLines } from "../fitur/bersama/profile_lines";
import { PengajuanStatusForm } from "../components/PengajuanStatusForm";
import { REASON_OPTIONS } from "../bersama/konstanta_aplikasi";
import { getDisciplineStatus } from "../bersama/util_status_dan_warna";
import { getScopedPeople } from "../bersama/util_unit_dan_scope";
import { validateQrToken } from "../utils/qr-token";
import { useClock } from "../hooks/useClock";
import { useAttendanceStats } from "../hooks/useAttendanceStats";
import { useQrScanner } from "../hooks/useQrScanner";

// ══════════════════════════════════════════════════════════════════════════════
// PAGE: DASHBOARD PEGAWAI
// ══════════════════════════════════════════════════════════════════════════════
const DashboardPegawai = ({ pegawai, people = pegawaiData, attendance, apelStatus, apelReason, apelReasonText, onScan, onBack, onPengajuanSubmit }) => {
  const { now, greeting } = useClock();
  const [showScanner, setShowScanner] = useState(false);
  const [showManualCode, setShowManualCode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);
  const [showAturanModal, setShowAturanModal] = useState(false);

  const myAttendance = attendance[pegawai.id] || { status: null, jamHadir: null };
  const scopePeople = getScopedPeople(people, pegawai, "UNIT");
  const { stats, statItems, isDitiadakan } = useAttendanceStats(attendance, apelStatus, scopePeople);
  const sudahAbsen = myAttendance.status === "Hadir";
  const canSubmitAttendance = apelStatus === "ongoing";

  const {
    startScanning,
    scanResult,
    setScanResult,
    resetResult,
  } = useQrScanner({
    enabled: showScanner && canSubmitAttendance,
    onScanSuccess: (result) => {
      if (result.type === "valid") {
        setAttendanceSuccess(true);
        if (!sudahAbsen) {
          onScan(pegawai.id);
        }
        setShowScanner(false);
      }
    },
  });

  // Trigger scanner start when modal opens
  useEffect(() => {
    if (showScanner && canSubmitAttendance) {
      startScanning();
    }
  }, [showScanner, canSubmitAttendance, startScanning]);

  // Close scanner/modal when apel ends
  useEffect(() => {
    if (!canSubmitAttendance) {
      setShowManualCode(false);
      setShowScanner(false);
    }
  }, [canSubmitAttendance]);

  // Auto-attendance success bypass (simulasi)
  const getReasonDisplay = () => {
    if (apelReason === "lainnya") return apelReasonText || "Lainnya";
    const reason = REASON_OPTIONS.find(r => r.id === apelReason);
    return reason ? reason.label : "Ditiadakan";
  };

  const isUnrecordedStatus = !myAttendance.status || myAttendance.status === "Tanpa Keterangan";
  const displayStatus = isUnrecordedStatus
    ? (apelStatus === "ended" ? "Tanpa Keterangan" : "Belum Melakukan Absensi")
    : myAttendance.status;
  const showAttendanceTime = !isUnrecordedStatus && myAttendance.jamHadir;
  const monthlyDisciplineCount = myAttendance.status === "Tanpa Keterangan" || (!myAttendance.status && apelStatus === "ended") ? 1 : 0;
  const monthlyDisciplineStatus = getDisciplineStatus(monthlyDisciplineCount);
  const statusLabel = displayStatus === "Hadir" ? "Hadir" : displayStatus;

  useEffect(() => {
    if (!canSubmitAttendance) {
      setShowManualCode(false);
      setShowScanner(false);
    }
  }, [canSubmitAttendance]);

  const handleManualCodeSubmit = async () => {
    if (!canSubmitAttendance) return;
    if (!manualCode.trim()) return;
    try {
      const result = await validateQrToken(manualCode);
      if (result.type === "valid") {
        setAttendanceSuccess(true);
        setShowManualCode(false);
        if (!sudahAbsen) {
          onScan(pegawai.id);
        }
      }
      setScanResult(result);
    } catch (error) {
      console.error("Gagal validasi kode manual:", error);
      setScanResult({ type: "invalid", label: "INVALID TOKEN" });
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />

        {/* Header */}
        <div className="mb-6">
          <p className="text-slate-400 text-sm">{greeting},</p>
          <ProfileLines
            name={pegawai.nama}
            nip={pegawai.nip}
            jabatan={pegawai.jabatan}
            nameClassName="text-2xl font-black text-white leading-tight"
            metaClassName="text-slate-500 text-xs mt-0.5"
          />
        </div>

        {isDitiadakan ? (
          <Card className="p-4 border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-xl">⚠️</div>
              <div>
                <div className="text-amber-400 font-bold text-sm">Apel Hari Ini Ditiadakan</div>
                <div className="text-amber-300/70 text-xs">{getReasonDisplay()}</div>
              </div>
            </div>
            <div className="text-slate-400 text-xs leading-relaxed">
              Apel hari ini tidak dilaksanakan.<br />
              Absensi dan statistik kehadiran tidak tersedia.
            </div>
          </Card>
        ) : (
        <>
        {/* Status Card - Two Column Layout */}
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Status Hari Ini</span>
            <span className="text-slate-500 text-xs">{now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Left Column: Hadir / Status */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col items-center text-center">
              <div className="flex flex-col items-center mb-2">
                <span className="text-lg mb-1">🟢</span>
                <span className="text-xs font-semibold text-emerald-400">
                  {statusLabel}
                </span>
              </div>
              <div className="text-sm font-bold mb-2 text-white">
                {now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
              </div>
              {showAttendanceTime ? (
                <div>
                  <div className="text-slate-500 text-xs">Jam Hadir</div>
                  <div className="text-white text-xl font-black">{myAttendance.jamHadir} WIB</div>
                </div>
              ) : (
                <div className="text-slate-500 text-xs">Belum Absen</div>
              )}
            </div>

            {/* Right Column: Tanpa Keterangan Bulan Ini */}
            {(() => {
              const discipline = monthlyDisciplineStatus;
              return (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col items-center text-center">
                  <div className="flex flex-col items-center mb-2">
                    <span className="text-lg mb-1">{discipline ? discipline.icon : "⏳"}</span>
                    <span className="text-xs font-semibold text-amber-400">Bulan Ini</span>
                  </div>
                  <div className="text-xl font-black leading-tight text-white">
                    {monthlyDisciplineCount !== null ? `${monthlyDisciplineCount} Kali` : "—"}
                  </div>
                  <div className="text-slate-400 text-xs mt-1">Tanpa Keterangan</div>
                  <div className={`text-xs font-semibold mt-2 ${
                    monthlyDisciplineCount === null ? "text-slate-500" :
                    monthlyDisciplineCount === 0 ? "text-emerald-400" :
                    monthlyDisciplineCount <= 2 ? "text-amber-400" :
                    monthlyDisciplineCount <= 4 ? "text-orange-400" :
                    "text-red-400"
                  }`}>
                    {discipline ? discipline.label : "Menunggu data pilot"}
                  </div>
                  <button
                    onClick={() => setShowAturanModal(true)}
                    className="mt-3 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/50 transition-all active:scale-[0.98]"
                  >
                    Lihat Aturan
                  </button>
                </div>
              );
            })()}
          </div>
        </Card>

        {/* Apel Status */}
        {!sudahAbsen && (
        <Card className="p-4 mb-4">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Sesi Apel</div>
          {apelStatus === "before" && (
            <>
              <p className="text-slate-300 text-sm mb-3">Apel Dimulai Dalam</p>
              <Countdown targetHour={7} />
            </>
          )}
          {apelStatus === "ongoing" && (
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-emerald-400 font-semibold">Apel Sedang Berlangsung</span>
            </div>
          )}
          {apelStatus === "ended" && (
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-slate-600" />
              <span className="text-slate-400 font-medium">Sesi Apel Telah Berakhir</span>
            </div>
          )}
        </Card>
        )}

        {attendanceSuccess && (
          <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-center font-black tracking-wide text-emerald-300">
            ✓ Kehadiran berhasil dicatat
          </div>
        )}

        {/* Scan QR Button */}
        {!sudahAbsen ? (
          <>
          <button
            onClick={() => canSubmitAttendance && (resetResult(), setShowScanner(true))}
            disabled={!canSubmitAttendance}
            className={`w-full py-4 rounded-2xl font-black text-lg tracking-tight transition-all duration-200 active:scale-[0.98] mb-6 ${canSubmitAttendance
              ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              : "bg-slate-800/60 border border-slate-700/50 text-slate-600 cursor-not-allowed"}`}>
            {apelStatus === "before" ? "🔒 Apel Belum Dimulai" :
              apelStatus === "ended" ? "🔒 Sesi Telah Berakhir" : "📱 SCAN QR ABSENSI"}
          </button>
          <Card className="p-4 mb-6">
            <button
              onClick={() => {
                if (!canSubmitAttendance) return;
                setScanResult(null);
                setAttendanceSuccess(false);
                setShowManualCode(prev => !prev);
              }}
              disabled={!canSubmitAttendance}
              className={`w-full py-3 rounded-xl text-sm font-bold border active:scale-[0.98] ${
                canSubmitAttendance
                  ? "bg-slate-800 text-white border-slate-700"
                  : "bg-slate-800/60 text-slate-600 border-slate-700/50 cursor-not-allowed"
              }`}
            >
              Enter Code
            </button>
            {showManualCode && (
              <div className="mt-3">
                <div className="flex gap-2">
                  <input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6 digit code"
                    inputMode="numeric"
                    maxLength={6}
                    className="min-w-0 flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    onClick={handleManualCodeSubmit}
                    className="px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold active:scale-[0.98]"
                  >
                    Validate
                  </button>
                </div>
                <TokenFeedback result={scanResult} />
              </div>
            )}
          </Card>
          </>
        ) : (
          <Card className="p-4 mb-6 border-emerald-500/30 bg-emerald-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-xl">✅</div>
              <div>
                <div className="text-emerald-400 font-bold text-sm">Absensi Tercatat</div>
                <div className="text-slate-400 text-xs">Anda sudah melakukan absensi hari ini</div>
              </div>
            </div>
          </Card>
        )}

        {/* Org Stats */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Statistik Organisasi</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 text-xs">Realtime</span>
            </div>
          </div>
          <Card className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <ProgressRing pct={stats.persen} size={80} stroke={7} label="Kehadiran" />
              <div>
                <div className="text-white text-xl font-black">{`${stats.persen}%`}</div>
                <div className="text-slate-400 text-xs">Tingkat Kehadiran</div>
                <div className="text-slate-500 text-xs mt-1">
                  {`${stats.hadir} dari ${stats.total} pegawai`}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {statItems.map(s => (
                <div key={s.label} className="bg-slate-800/60 rounded-xl p-2.5 text-center">
                  <div className="text-base mb-0.5">{s.icon}</div>
                  <div className={`text-base font-bold ${s.color}`}>{s.value ?? "—"}</div>
                  <div className="text-slate-400 text-xs leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ─── PENGAJUAN PERUBAHAN STATUS ─── */}
        <PengajuanStatusForm myStatus={displayStatus} pegawai={pegawai} onSubmit={onPengajuanSubmit} />

        {/* ATURAN MODAL */}
        {showAturanModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">📖 Aturan Ketidakhadiran Bulan Berjalan</h3>
                <button onClick={() => setShowAturanModal(false)} className="text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 text-center">
                <div className="text-slate-400 text-xs mb-1">Posisi Anda Saat Ini</div>
                <div className="text-2xl font-black text-amber-400">
                  {monthlyDisciplineCount !== null ? `${monthlyDisciplineCount} Kali` : "Menunggu data pilot"}
                </div>
              </div>
              <div className="border-t border-slate-700/50 my-3" />
              <div className="space-y-2">
                <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-xl">🟢</span>
                  <div className="flex-1"><span className="text-white text-sm font-semibold">0 Kali</span></div>
                  <span className="text-emerald-400 text-sm font-bold">Sangat Baik</span>
                </div>
                <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <span className="text-xl">🟡</span>
                  <div className="flex-1"><span className="text-white text-sm font-semibold">1 - 2 Kali</span></div>
                  <span className="text-yellow-400 text-sm font-bold">Perlu Perhatian</span>
                </div>
                <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                  <span className="text-xl">🟠</span>
                  <div className="flex-1"><span className="text-white text-sm font-semibold">3 - 4 Kali</span></div>
                  <span className="text-orange-400 text-sm font-bold">Pembinaan</span>
                </div>
                <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <span className="text-xl">🔴</span>
                  <div className="flex-1"><span className="text-white text-sm font-semibold">≥ 5 Kali</span></div>
                  <span className="text-red-400 text-sm font-bold">Tindak Lanjut</span>
                </div>
              </div>
              <button onClick={() => setShowAturanModal(false)} className="w-full mt-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors border border-slate-700/50">
                Tutup
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto overscroll-contain px-4 pt-4 [padding-bottom:calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex min-h-full items-start justify-center sm:items-center">
            <div className="relative z-10 bg-slate-900 border border-slate-700 rounded-2xl p-4 [padding-bottom:calc(1rem+env(safe-area-inset-bottom))] w-full max-w-sm max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-bottom))] overflow-y-auto">
              <h3 className="text-white font-bold mb-3">Scan QR Absensi</h3>
              <div
                id="qr-reader"
                className="relative z-0 bg-white rounded-xl w-full h-[48vh] min-h-[240px] max-h-[420px] overflow-hidden [&_*]:!max-w-full [&_video]:!relative [&_video]:!z-0 [&_video]:!h-full [&_video]:!max-h-full [&_video]:!object-cover"
              />
              <div className="relative z-10">
                <TokenFeedback result={scanResult} />
              </div>
              <button onClick={() => setShowScanner(false)} className="relative z-10 w-full mt-4 py-3 rounded-xl bg-slate-800 text-white">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { DashboardPegawai };
export default DashboardPegawai;
