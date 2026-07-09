import { useState, useEffect, useCallback, useMemo } from "react";
import pegawaiData from "../data/pegawai_master.json";
import orgData from "../data/organization.json";
import { Card } from "../components/Card";
import { LogoutConfirm } from "../components/LogoutConfirm";
import { StatDetailModal } from "../components/StatDetailModal";
import { getAttendanceStatItems, calcAttendanceStats, getPeopleByStatKey } from "../fitur/absensi/logika_absensi";
import { REASON_OPTIONS, APEL_SESSIONS } from "../bersama/konstanta_aplikasi";
import { excludeSystemAccounts } from "../bersama/util_unit_dan_scope";
import { AdminTimeLine } from "../components/AdminTimeLine";
import { useQrGenerator } from "../hooks/useQrGenerator";
import { FullscreenQR } from "../components/FullscreenQR";
import PanelKoreksi from "../panels/PanelKoreksi";
import PanelLaporan from "../panels/PanelLaporan";
import PanelKelolaPegawai from "../panels/PanelKelolaPegawai";
import PanelApel from "../panels/PanelApel";
import PanelQR from "../panels/PanelQR";

const DashboardAdmin = ({
  people = pegawaiData, attendance, pengajuan = [], riwayatPerubahan = [], apelStatus, apelSession,
  apelReason, apelReasonText, onAppealPhaseChange, onApelReasonChange,
  onScanSimulate, onReset, onLogout, onKoreksi, onPengajuanVerifikasi,
  onAddPegawai, onUpdatePegawai, onDeletePegawai, onClearActiveSession, readOnly = false,
}) => {
  const [activeMenu, setActiveMenu] = useState(null);
  const [showFullscreenQr, setShowFullscreenQr] = useState(false);
  const [selectedStat, setSelectedStat] = useState(null);

  const attendancePeople = useMemo(() => excludeSystemAccounts(people), [people]);

  const qrActive = !readOnly && apelStatus === "ongoing";
  const { currentQr, secsLeft } = useQrGenerator({ active: qrActive });
  const stats = calcAttendanceStats(attendance, apelStatus, attendancePeople, { includeMissingAsUnrecorded: true });

  const exitFullscreenQr = useCallback(() => {
    setShowFullscreenQr(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const enterFullscreenQr = useCallback(() => {
    setShowFullscreenQr(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!showFullscreenQr) return;
    const handleKeyDown = (e) => { if (e.key === "Escape") setShowFullscreenQr(false); };
    const handleFullscreenChange = () => { if (!document.fullscreenElement) setShowFullscreenQr(false); };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [showFullscreenQr]);

  if (showFullscreenQr) {
    return <FullscreenQR currentQr={currentQr} qrActive={qrActive} secsLeft={secsLeft} onExit={exitFullscreenQr} />;
  }

  // ── Panel routing ──
  if (activeMenu === "koreksi") return <PanelKoreksi people={people} attendance={attendance} apelStatus={apelStatus} onKoreksi={onKoreksi} onBack={() => setActiveMenu(null)} pengajuan={pengajuan} riwayatPerubahan={riwayatPerubahan} onPengajuanVerifikasi={onPengajuanVerifikasi} readOnly={readOnly} />;
  if (activeMenu === "laporan") return <PanelLaporan people={attendancePeople} attendance={attendance} stats={stats} apelStatus={apelStatus} onBack={() => setActiveMenu(null)} />;
  if (activeMenu === "kelola") return <PanelKelolaPegawai people={people} readOnly={readOnly} onAddPegawai={onAddPegawai} onUpdatePegawai={onUpdatePegawai} onDeletePegawai={onDeletePegawai} onClearActiveSession={onClearActiveSession} onBack={() => setActiveMenu(null)} />;

  // ── Main menu ──
  return (
    <div className="min-h-screen bg-[#080c14] px-4 py-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-sm mx-auto">
        <LogoutConfirm onConfirm={onLogout} />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-white">Admin Panel</h1>
            <AdminTimeLine />
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            apelStatus === "ditiadakan"
              ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
              : qrActive
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-slate-800 border-slate-700 text-slate-500"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              apelStatus === "ditiadakan" ? "bg-amber-400" : qrActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
            }`} />
            {apelStatus === "ditiadakan" ? "Ditiadakan" : qrActive ? "Apel Aktif" : apelStatus === "before" ? "Menunggu" : "Selesai"}
          </div>
        </div>

        {/* Stats bar */}
        {apelStatus === "ditiadakan" ? (
          <Card className="p-4 mb-5 border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-xl">⚠️</div>
              <div>
                <div className="text-amber-400 font-bold text-sm">Apel Hari Ini Ditiadakan</div>
                <div className="text-amber-300/70 text-xs">
                  {apelReason === "lainnya" ? apelReasonText : REASON_OPTIONS.find(r => r.id === apelReason)?.label || "Ditiadakan"}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-2 mb-5">
            {getAttendanceStatItems(apelStatus).map(item => ({
              ...item, val: stats[item.key],
            })).map(s => (
              <Card
                key={s.label}
                onClick={() => (s.val > 0 ? setSelectedStat(s) : null)}
                className={`p-3 text-center ${s.val > 0 ? "" : "opacity-70"}`}
              >
                <div className="text-lg mb-0.5">{s.icon}</div>
                <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
                <div className="text-slate-400 text-xs">{s.label}</div>
              </Card>
            ))}
          </div>
        )}

        {/* QR Card */}
        {apelStatus !== "ditiadakan" && (
          <PanelQR currentQr={currentQr} qrActive={qrActive} secsLeft={secsLeft} apelStatus={apelStatus} enterFullscreenQr={enterFullscreenQr} />
        )}

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { id: "laporan", label: "Laporan Harian", icon: "📊", color: "from-emerald-500/20 to-teal-500/10", border: "hover:border-emerald-500/50" },
            { id: "kelola", label: "Kelola Pegawai", icon: "👥", color: "from-blue-500/20 to-indigo-500/10", border: "hover:border-blue-500/50" },
            { id: "koreksi", label: "Koreksi Absensi", icon: "✏️", color: "from-amber-500/20 to-yellow-500/10", border: "hover:border-amber-500/50" },
            { id: "apel", label: "Pengaturan Apel", icon: "⏱️", color: "from-violet-500/20 to-purple-500/10", border: "hover:border-violet-500/50" },
          ].map(m => (
            <button key={m.id} onClick={() => setActiveMenu(m.id)}
              className={`text-left p-4 rounded-xl bg-gradient-to-br ${m.color} border border-slate-700/60 ${m.border} transition-all duration-150 active:scale-[0.97]`}>
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className="text-white text-sm font-semibold">{m.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Apel Modal */}
      {selectedStat && (
        <StatDetailModal
          statItem={selectedStat}
          people={getPeopleByStatKey(attendancePeople, attendance, apelStatus, selectedStat.key)}
          onClose={() => setSelectedStat(null)}
        />
      )}

      {activeMenu === "apel" && (
        <PanelApel apelStatus={apelStatus} apelReason={apelReason} apelReasonText={apelReasonText}
          onAppealPhaseChange={onAppealPhaseChange} onApelReasonChange={onApelReasonChange} onClose={() => setActiveMenu(null)} />
      )}
    </div>
  );
};

export { DashboardAdmin };
export default DashboardAdmin;
