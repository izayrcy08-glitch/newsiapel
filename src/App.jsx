import { lazy, Suspense, useCallback } from "react";
import { SessionProvider, useSession } from "./contexts/SessionContext";
import { FirebaseDataProvider, useFirebaseData } from "./contexts/FirebaseDataContext";
import { LoginPage } from "./pages/LoginPage";
import { LoadingSpinner } from "./components/LoadingSpinner";

const DashboardPegawai = lazy(() => import("./pages/DashboardPegawai"));
const DashboardPimpinan = lazy(() => import("./pages/DashboardPimpinan"));
const DashboardAdmin = lazy(() => import("./pages/DashboardAdmin"));
const DeveloperConsole = lazy(() => import("./pages/DeveloperConsole"));

function AppRouter() {
  const {
    page, activePegawai, selectedPimpinan,
    masterPegawaiData, handleRoleSelect,
    handleAddPegawai, handleUpdatePegawai, handleDeletePegawai,
    activeUserId,
  } = useSession();

  const {
    attendance, apelStatus, apelSession, apelReason, apelReasonText,
    pengajuan,
    handleScan, handleScanSimulate, handleReset, handleKoreksi,
    handleApelSessionChange, handleApelReasonChange,
    handlePengajuanSubmit, handlePengajuanVerifikasi,
    handleSavePasswordOverride, handleClearActiveSession,
  } = useFirebaseData();

  // Logout: hapus active session dari Firebase, lalu kembali ke login
  const handleLogout = useCallback(() => {
    handleClearActiveSession(activeUserId);
    handleRoleSelect();
  }, [activeUserId, handleClearActiveSession, handleRoleSelect]);

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
              apelStatus={apelStatus}
              apelSession={apelSession}
              apelReason={apelReason}
              apelReasonText={apelReasonText}
              onScan={handleScan}
              onPengajuanSubmit={handlePengajuanSubmit}
              onBack={handleLogout}
            />
          )
        : null;

    case "pimpinan_dashboard":
      return wrap(
        <DashboardPimpinan
          people={masterPegawaiData}
          attendance={attendance}
          pengajuan={pengajuan}
          apelStatus={apelStatus}
          apelSession={apelSession}
          apelReason={apelReason}
          apelReasonText={apelReasonText}
          selectedPimpinan={selectedPimpinan}
          onBack={() => handleRoleSelect()}
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
          onBack={() => handleRoleSelect()}
          onKoreksi={handleKoreksi}
          onPengajuanVerifikasi={handlePengajuanVerifikasi}
          onAddPegawai={handleAddPegawai}
          onUpdatePegawai={handleUpdatePegawaiWithFirebase}
          onDeletePegawai={handleDeletePegawai}
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
          onSavePasswordOverride={handleSavePasswordOverride}
          onBack={() => handleRoleSelect()}
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
    <SessionProvider>
      <FirebaseDataProvider>
        <div style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>
          <AppRouter />
        </div>
      </FirebaseDataProvider>
    </SessionProvider>
  );
}
