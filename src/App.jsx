import { lazy, Suspense, useCallback } from "react";
import { SessionProvider, useSession } from "./contexts/SessionContext";
import { FirebaseDataProvider, useFirebaseData } from "./contexts/FirebaseDataContext";
import { LoginPage } from "./pages/LoginPage";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { AuthInit } from "./components/AuthInit";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy import dengan retry — di jaringan HP yang tidak stabil, chunk kadang gagal
// dimuat saat pertama kali navigasi (layar jadi blank). Coba ulang sekali sebelum menyerah.
const lazyWithRetry = (importFn) =>
  lazy(() =>
    importFn().catch(
      () =>
        new Promise((resolve, reject) => {
          setTimeout(() => importFn().then(resolve).catch(reject), 800);
        })
    )
  );

const DashboardPegawai = lazyWithRetry(() => import("./pages/DashboardPegawai"));
const DashboardPimpinan = lazyWithRetry(() => import("./pages/DashboardPimpinan"));
const PimpinanSelector = lazyWithRetry(() => import("./pages/PimpinanSelector"));
const DashboardAdmin = lazyWithRetry(() => import("./pages/DashboardAdmin"));
const DeveloperConsole = lazyWithRetry(() => import("./pages/DeveloperConsole"));

function AppRouter() {
  const {
    page, role, activePegawai, selectedPimpinan,
    masterPegawaiData, goBack, pimpinanAccessRoles, syncStatus,
    handleAddPegawai, handleUpdatePegawai, handleDeletePegawai, handlePimpinanSelect,
  } = useSession();

  const {
    attendance, monthlyAttendance, apelMeta, monthKey, dayKey,
    apelStatus, apelSession, apelReason, apelReasonText,
    pengajuan, activeUserId,
    handleClearActiveSession,
    handleScan, handleScanSimulate, handleReset, handleKoreksi,
    handleApelSessionChange, handleApelReasonChange,
    handlePengajuanSubmit, handlePengajuanVerifikasi,
    handleSavePasswordOverride,
  } = useFirebaseData();

  // ── Logout handler: bersihkan session Firebase + navigasi ke login ──
  const handleLogout = useCallback(() => {
    if (activeUserId) {
      handleClearActiveSession(activeUserId);
    }
    goBack();
  }, [activeUserId, handleClearActiveSession, goBack]);

  // Bridge: saat password pegawai diubah, simpan juga ke Firebase
  const handleUpdatePegawaiWithFirebase = (pegawaiId, updates) => {
    handleUpdatePegawai(pegawaiId, updates);
    if (updates.password) {
      handleSavePasswordOverride(`pegawai_${pegawaiId}`, updates.password);
    }
  };

  const wrap = (children) => (
    <Suspense fallback={<LoadingSpinner message="Memuat halaman..." />}>
      {children}
    </Suspense>
  );

  switch (page) {
    case "login":
      return <LoginPage />;

     case "pegawai_dashboard":
       return activePegawai
         ? wrap(
             <DashboardPegawai
               pegawai={activePegawai}
               people={masterPegawaiData}
               attendance={attendance}
               monthlyAttendance={monthlyAttendance}
               apelMeta={apelMeta}
               monthKey={monthKey}
               dayKey={dayKey}
               apelStatus={apelStatus}
               apelSession={apelSession}
               apelReason={apelReason}
               apelReasonText={apelReasonText}
               pengajuan={pengajuan}
               onScan={handleScan}
               onPengajuanSubmit={handlePengajuanSubmit}
               onLogout={handleLogout}
             />
           )
         : null;

    case "pimpinan_selector":
      return wrap(
        <PimpinanSelector
          pimpinanAccessRoles={pimpinanAccessRoles}
          masterPegawaiData={masterPegawaiData}
          onBack={goBack}
          onSelect={handlePimpinanSelect}
        />
      );

     case "pimpinan_dashboard":
      return wrap(
        <DashboardPimpinan
          people={masterPegawaiData}
          attendance={attendance}
          monthlyAttendance={monthlyAttendance}
          apelMeta={apelMeta}
          monthKey={monthKey}
          dayKey={dayKey}
          pengajuan={pengajuan}
          apelStatus={apelStatus}
          apelSession={apelSession}
          apelReason={apelReason}
          apelReasonText={apelReasonText}
          selectedPimpinan={selectedPimpinan}
          onLogout={handleLogout}
        />
      );

    case "admin":
      return wrap(
        <DashboardAdmin
          people={masterPegawaiData}
          attendance={attendance}
          pengajuan={pengajuan}
          apelStatus={apelStatus}
          apelSession={apelSession}
          apelReason={apelReason}
          apelReasonText={apelReasonText}
          onAppealPhaseChange={handleApelSessionChange}
          onApelReasonChange={handleApelReasonChange}
          onScanSimulate={handleScanSimulate}
          onReset={handleReset}
          onLogout={handleLogout}
          onKoreksi={handleKoreksi}
          onPengajuanVerifikasi={handlePengajuanVerifikasi}
          onAddPegawai={handleAddPegawai}
          onUpdatePegawai={handleUpdatePegawaiWithFirebase}
          onDeletePegawai={handleDeletePegawai}
          onClearActiveSession={handleClearActiveSession}
        />
      );

    case "developer":
      return wrap(
        <DeveloperConsole
          masterPegawaiData={masterPegawaiData}
          attendance={attendance}
          pengajuan={pengajuan}
          apelStatus={apelStatus}
          apelSession={apelSession}
          apelReason={apelReason}
          apelReasonText={apelReasonText}
          onScan={handleScan}
          onReset={handleReset}
          onKoreksi={handleKoreksi}
          onApelSessionChange={handleApelSessionChange}
          onApelReasonChange={handleApelReasonChange}
          onScanSimulate={handleScanSimulate}
          onPengajuanSubmit={handlePengajuanSubmit}
          onPengajuanVerifikasi={handlePengajuanVerifikasi}
          onAddPegawai={handleAddPegawai}
          onUpdatePegawai={handleUpdatePegawaiWithFirebase}
          onDeletePegawai={handleDeletePegawai}
          onClearActiveSession={handleClearActiveSession}
          onSavePasswordOverride={handleSavePasswordOverride}
          onLogout={handleLogout}
          syncStatus={syncStatus}
        />
      );

    default:
      return <LoginPage />;
  }
}

export default function App() {
  try {
    window.localStorage.removeItem("siapel.masterPegawaiData.v1.version");
  } catch (_) {}

  return (
    <ErrorBoundary>
      <AuthInit>
        <SessionProvider>
          <FirebaseDataProvider>
            <div style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>
              <AppRouter />
            </div>
          </FirebaseDataProvider>
        </SessionProvider>
      </AuthInit>
    </ErrorBoundary>
  );
}
