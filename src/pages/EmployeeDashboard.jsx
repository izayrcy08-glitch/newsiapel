import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { REASON_OPTIONS } from "../constants/reasons";
import SessionCard from "../features/sessions/components/SessionCard";
import StatusTodayCard from "../features/attendance/components/StatusTodayCard";
import BackButton from "../shared/ui/BackButton";
import Card from "../shared/ui/Card";
import ProgressRing from "../shared/ui/ProgressRing";
import {
  calcAttendanceStats,
  getAttendanceStatItems,
  getDisciplineStatus,
  isApelDitiadakan,
  TANPA_KETERANGAN_BULAN_INI,
} from "../shared/utils/attendance";
import { getGreeting } from "../shared/utils/time";

export default function EmployeeDashboard({
  pegawai,
  attendance,
  apelStatus,
  apelReason,
  apelReasonText,
  onScan,
  onBack,
  validateQrToken,
  PengajuanStatusForm,
  TokenFeedback,
}) {
  const [now, setNow] = useState(new Date());
  const [showScanner, setShowScanner] = useState(false);
  const [showManualCode, setShowManualCode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);
  const [showAturanModal, setShowAturanModal] = useState(false);
  const isValidatingScan = useRef(false);
  const myAttendance = attendance[pegawai.id] || { status: null, jamHadir: null };
  const stats = calcAttendanceStats(attendance, apelStatus);
  const sudahAbsen = myAttendance.status === "Hadir";
  const canSubmitAttendance = apelStatus === "ongoing";
  const isDitiadakan = isApelDitiadakan(apelStatus);
  const getReasonDisplay = () => {
    if (apelReason === "lainnya") return apelReasonText || "Lainnya";
    const reason = REASON_OPTIONS.find((r) => r.id === apelReason);
    return reason ? reason.label : "Ditiadakan";
  };
  const isUnrecordedStatus = !myAttendance.status || myAttendance.status === "Tanpa Keterangan";
  const displayStatus = isUnrecordedStatus
    ? apelStatus === "ended"
      ? "Tanpa Keterangan"
      : "Belum Melakukan Absensi"
    : myAttendance.status;
  const showAttendanceTime = !isUnrecordedStatus && myAttendance.jamHadir;

  useEffect(() => {
    console.info("[EmployeeDashboard] mounted", {
      pegawaiId: pegawai?.id,
      pegawaiNama: pegawai?.nama,
      validateQrTokenType: typeof validateQrToken,
      pengajuanStatusFormType: typeof PengajuanStatusForm,
      tokenFeedbackType: typeof TokenFeedback,
    });
  }, [pegawai?.id, pegawai?.nama, validateQrToken, PengajuanStatusForm, TokenFeedback]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!canSubmitAttendance) {
      setShowManualCode(false);
      setShowScanner(false);
    }
  }, [canSubmitAttendance]);

  useEffect(() => {
    if (!showScanner) return;

    console.info("[EmployeeDashboard] scanner effect started", {
      showScanner,
      canSubmitAttendance,
      pegawaiId: pegawai?.id,
    });
    setScanResult(null);
    isValidatingScan.current = false;

    let scanner;
    let scannerStarted = false;
    let cancelled = false;
    try {
      const scannerElement = document.getElementById("qr-reader");
      console.info("[EmployeeDashboard] scanner container lookup", {
        found: Boolean(scannerElement),
      });
      scanner = new Html5Qrcode("qr-reader");
      console.info("[EmployeeDashboard] Html5Qrcode constructor success");
    } catch (error) {
      console.error("Html5Qrcode constructor error:", error);
      console.error("[EmployeeDashboard] Html5Qrcode constructor failed", error);
      return;
    }

    const stopScanner = async () => {
      console.info("[EmployeeDashboard] stopScanner called", {
        scannerStarted,
        cancelled,
      });
      if (!scanner || !scannerStarted) return;
      try {
        await scanner.stop();
        scannerStarted = false;
        console.info("[EmployeeDashboard] scanner.stop success");
      } catch (error) {
        console.error("Html5Qrcode stop error:", error);
        console.error("[EmployeeDashboard] scanner.stop failed", error);
      }
      try {
        await scanner.clear();
        console.info("[EmployeeDashboard] scanner.clear success");
      } catch (error) {
        console.error("Html5Qrcode clear error:", error);
        console.error("[EmployeeDashboard] scanner.clear failed", error);
      }
    };

    const startScanner = async () => {
      try {
        console.info("[EmployeeDashboard] Html5Qrcode.getCameras called");
        const cameras = await Html5Qrcode.getCameras();
        console.info("[EmployeeDashboard] Html5Qrcode.getCameras success", {
          count: cameras.length,
          labels: cameras.map((camera) => camera.label),
        });
        const rearCamera = cameras.find((camera) => /back|rear|environment/i.test(camera.label));
        const selectedCamera = rearCamera || cameras[0];

        if (!selectedCamera) {
          console.error("No camera available for Html5Qrcode.start");
          console.error("[EmployeeDashboard] no camera available for scanner.start");
          return;
        }

        if (cancelled) return;

        const onScanSuccess = async (decodedText) => {
          if (isValidatingScan.current) return;
          isValidatingScan.current = true;
          console.info("[EmployeeDashboard] scanner decoded QR", {
            decodedText,
          });

          try {
            console.info("[EmployeeDashboard] scanner calling validateQrToken", {
              decodedText,
            });
            const result = await validateQrToken(decodedText);
            console.info("[EmployeeDashboard] scanner validateQrToken result", result);
            handleValidationSuccess(result);
            await stopScanner();
            if (result.type === "valid") {
              setShowScanner(false);
            }
          } catch (error) {
            console.error("Failed to validate QR token:", error);
            console.error("[EmployeeDashboard] scanner validateQrToken threw", error);
            setScanResult({ type: "invalid", label: "INVALID TOKEN" });
            await stopScanner();
          }
        };

        const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 } };
        const preferredCameraConfig = rearCamera ? rearCamera.id : { facingMode: "environment" };
        try {
          console.info("[EmployeeDashboard] scanner.start called", {
            mode: rearCamera ? "rear-camera-id" : "facingMode-environment",
            preferredCameraConfig,
            scanConfig,
          });
          await scanner.start(preferredCameraConfig, scanConfig, onScanSuccess);
          console.info("[EmployeeDashboard] scanner.start success", {
            strategy: rearCamera ? "rear-camera-id" : "facingMode-environment",
          });
        } catch (error) {
          console.error("[EmployeeDashboard] scanner.start primary failed", error);
          if (cancelled || rearCamera) throw error;
          console.info("[EmployeeDashboard] scanner.start fallback called", {
            selectedCameraId: selectedCamera.id,
            scanConfig,
          });
          await scanner.start(selectedCamera.id, scanConfig, onScanSuccess);
          console.info("[EmployeeDashboard] scanner.start fallback success", {
            selectedCameraId: selectedCamera.id,
          });
        }
        scannerStarted = true;
      } catch (error) {
        console.error("Html5Qrcode start error:", error);
        console.error("[EmployeeDashboard] Html5Qrcode start failed", error);
      }
    };

    startScanner();

    return () => {
      console.info("[EmployeeDashboard] scanner effect cleanup", {
        scannerStarted,
        cancelled,
      });
      cancelled = true;
      isValidatingScan.current = false;
      stopScanner();
    };
  }, [showScanner, canSubmitAttendance, pegawai?.id, validateQrToken]);

  const handleValidationSuccess = (result) => {
    console.info("[EmployeeDashboard] handleValidationSuccess called", {
      result,
      canSubmitAttendance,
      sudahAbsen,
      pegawaiId: pegawai?.id,
    });
    if (!canSubmitAttendance) return;

    if (result.type === "valid") {
      setScanResult(null);
      setAttendanceSuccess(true);
      if (!sudahAbsen) {
        console.info("[EmployeeDashboard] handleValidationSuccess triggering onScan", {
          pegawaiId: pegawai.id,
        });
        onScan(pegawai.id);
      }
      return;
    }

    setAttendanceSuccess(false);
    setScanResult(result);
  };

  const handleManualCodeSubmit = async () => {
    console.info("[EmployeeDashboard] handleManualCodeSubmit called", {
      manualCode,
      canSubmitAttendance,
      pegawaiId: pegawai?.id,
    });
    if (!canSubmitAttendance) return;
    if (!manualCode.trim()) return;
    try {
      console.info("[EmployeeDashboard] handleManualCodeSubmit calling validateQrToken", {
        manualCode,
      });
      const result = await validateQrToken(manualCode);
      console.info("[EmployeeDashboard] handleManualCodeSubmit validateQrToken result", result);
      handleValidationSuccess(result);
    } catch (error) {
      console.error("Failed to validate manual QR code:", error);
      console.error("[EmployeeDashboard] handleManualCodeSubmit caught error", error);
      setScanResult({ type: "invalid", label: "INVALID TOKEN" });
    }
  };

  const statItems = getAttendanceStatItems(apelStatus).map((item) => ({ ...item, value: stats[item.key] }));

  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <BackButton onClick={onBack} />

        <div className="mb-6">
          <p className="text-slate-400 text-sm">{getGreeting()},</p>
          <h1 className="text-2xl font-black text-white leading-tight">{pegawai.nama.split(",")[0]}</h1>
          <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{pegawai.jabatan}</p>
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
              Apel hari ini tidak dilaksanakan.
              <br />
              Absensi dan statistik kehadiran tidak tersedia.
            </div>
          </Card>
        ) : (
          <>
            <StatusTodayCard
              now={now}
              displayStatus={displayStatus}
              showAttendanceTime={showAttendanceTime}
              attendanceTime={myAttendance.jamHadir}
              discipline={getDisciplineStatus(TANPA_KETERANGAN_BULAN_INI)}
              tanpaKeteranganBulanIni={TANPA_KETERANGAN_BULAN_INI}
              onOpenRules={() => setShowAturanModal(true)}
            />

            {!sudahAbsen && <SessionCard apelStatus={apelStatus} />}

            {attendanceSuccess && (
              <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-center font-black tracking-wide text-emerald-300">
                ✓ Kehadiran berhasil dicatat
              </div>
            )}

            {!sudahAbsen ? (
              <>
                <button
                  onClick={() => canSubmitAttendance && setShowScanner(true)}
                  disabled={!canSubmitAttendance}
                  className={`w-full py-4 rounded-2xl font-black text-lg tracking-tight transition-all duration-200 active:scale-[0.98] mb-6 ${
                    canSubmitAttendance
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                      : "bg-slate-800/60 border border-slate-700/50 text-slate-600 cursor-not-allowed"
                  }`}
                >
                  {apelStatus === "before" ? "🔒 Apel Belum Dimulai" : apelStatus === "ended" ? "🔒 Sesi Telah Berakhir" : "📱 SCAN QR ABSENSI"}
                </button>
                <Card className="p-4 mb-6">
                  <button
                    onClick={() => {
                      if (!canSubmitAttendance) return;
                      setScanResult(null);
                      setAttendanceSuccess(false);
                      setShowManualCode((prev) => !prev);
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
                    <div className="text-white text-xl font-black">{stats.persen}%</div>
                    <div className="text-slate-400 text-xs">Tingkat Kehadiran</div>
                    <div className="text-slate-500 text-xs mt-1">
                      {stats.hadir} dari {stats.total} pegawai
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {statItems.map((s) => (
                    <div key={s.label} className="bg-slate-800/60 rounded-xl p-2.5 text-center">
                      <div className="text-base mb-0.5">{s.icon}</div>
                      <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-slate-400 text-xs leading-tight">{s.label}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <PengajuanStatusForm myStatus={displayStatus} />

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
                    <div className="text-2xl font-black text-amber-400">{TANPA_KETERANGAN_BULAN_INI} Kali</div>
                  </div>

                  <div className="border-t border-slate-700/50 my-3" />

                  <div className="space-y-2">
                    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <span className="text-xl">🟢</span>
                      <div className="flex-1">
                        <span className="text-white text-sm font-semibold">0 Kali</span>
                      </div>
                      <span className="text-emerald-400 text-sm font-bold">Sangat Baik</span>
                    </div>

                    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                      <span className="text-xl">🟡</span>
                      <div className="flex-1">
                        <span className="text-white text-sm font-semibold">1 - 2 Kali</span>
                      </div>
                      <span className="text-yellow-400 text-sm font-bold">Perlu Perhatian</span>
                    </div>

                    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                      <span className="text-xl">🟠</span>
                      <div className="flex-1">
                        <span className="text-white text-sm font-semibold">3 - 4 Kali</span>
                      </div>
                      <span className="text-orange-400 text-sm font-bold">Pembinaan</span>
                    </div>

                    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/30">
                      <span className="text-xl">🔴</span>
                      <div className="flex-1">
                        <span className="text-white text-sm font-semibold">≥ 5 Kali</span>
                      </div>
                      <span className="text-red-400 text-sm font-bold">Tindak Lanjut</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowAturanModal(false)}
                    className="w-full mt-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors border border-slate-700/50"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
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

              <button
                onClick={() => setShowScanner(false)}
                className="relative z-10 w-full mt-4 py-3 rounded-xl bg-slate-800 text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
