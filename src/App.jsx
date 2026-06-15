import { lazy, Suspense } from "react";
import { SessionProvider, useSession } from "./contexts/SessionContext";
import { FirebaseDataProvider, useFirebaseData } from "./contexts/FirebaseDataContext";
import { RoleSelector } from "./pages/RoleSelector";
import { PegawaiLogin } from "./pages/PegawaiLogin";
import { PimpinanSelector } from "./pages/PimpinanSelector";
import { LoadingSpinner } from "./components/LoadingSpinner";

const DashboardPegawai = lazy(() => import("./pages/DashboardPegawai"));
const DashboardPimpinan = lazy(() => import("./pages/DashboardPimpinan"));
const DashboardAdmin = lazy(() => import("./pages/DashboardAdmin"));
const DeveloperConsole = lazy(() => import("./pages/DeveloperConsole"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const DeveloperLogin = lazy(() => import("./pages/DeveloperLogin"));

function AppRouter() {
  const {
    page, setPage, activePegawai, selectedPimpinan,
    handleRoleSelect, handlePimpinanSelect,
    masterPegawaiData, pimpinanAccessRoles,
    handleAddPegawai, handleUpdatePegawai, handleDeletePegawai,
  } = useSession();

  const {
    attendance, apelStatus, apelSession, apelReason, apelReasonText,
    pengajuan,
    handleScan, handleScanSimulate, handleReset, handleKoreksi,
    handleApelSessionChange, handleApelReasonChange,
    handlePengajuanSubmit, handlePengajuanVerifikasi,
  } = useFirebaseData();

  const wrap = (children) => (
    <Suspense fallback={<LoadingSpinner message="Memuat halaman..." />}>
      {children}
    </Suspense>
  );

  switch (page) {
    case "role":
      return <RoleSelector onSelect={handleRoleSelect} />;

    case "pegawai_login":
      return <PegawaiLogin />;

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
              onBack={() => setPage("pegawai_login")}
            />
          )
        : null;

    case "pimpinan_select":
      return (
        <PimpinanSelector
          pimpinanAccessRoles={pimpinanAccessRoles}
          masterPegawaiData={masterPegawaiData}
          onBack={() => setPage("role")}
          onSelect={handlePimpinanSelect}
        />
      );

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
          onBack={() => setPage("pimpinan_select")}
        />
      );

    case "admin_login":
      return wrap(<AdminLogin />);

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
          onBack={() => setPage("role")}
          onKoreksi={handleKoreksi}
          onPengajuanVerifikasi={handlePengajuanVerifikasi}
          onAddPegawai={handleAddPegawai}
          onUpdatePegawai={handleUpdatePegawai}
          onDeletePegawai={handleDeletePegawai}
        />
      );

    case "developer_login":
      return wrap(<DeveloperLogin />);

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
          onUpdatePegawai={handleUpdatePegawai}
          onDeletePegawai={handleDeletePegawai}
          onBack={() => setPage("role")}
        />
      );

    default:
      return <RoleSelector onSelect={handleRoleSelect} />;
  }
}

export default function App() {
  // Hapus localStorage legacy — cukup sekali
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
