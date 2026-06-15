import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import pegawaiData from "../data/pegawai_master.json";
import { buildPimpinanAccessRoles } from "../bersama/util_unit_dan_scope";

const SessionContext = createContext(null);

const MASTER_PEGAWAI_STORAGE_KEY = "siapel.masterPegawaiData.v3";
const SESSION_KEY = "siapel.session.v1";

const normalizePegawaiRecord = (pegawai, fallbackId) => {
  const unit = pegawai.unit || pegawai.bidang || "";
  const bidang = pegawai.bidang || pegawai.unit || "";
  return {
    ...pegawai,
    id: pegawai.id ?? fallbackId,
    nama: pegawai.nama || "",
    nip: pegawai.nip || "",
    nik: pegawai.nik || "",
    jabatan: pegawai.jabatan || "",
    unit,
    bidang,
    role: pegawai.role || "EMPLOYEE",
    password: pegawai.password || "",
    phoneFingerprint: pegawai.phoneFingerprint || "",
    isActive: pegawai.isActive !== false,
  };
};

const normalizePegawaiData = (people = []) =>
  people.map((pegawai, index) => normalizePegawaiRecord(pegawai, index + 1));

const loadMasterPegawaiData = () => {
  // Prioritas 1: Baca dari localStorage (data hasil edit/admin sebelumnya)
  try {
    const saved = window.localStorage.getItem(MASTER_PEGAWAI_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Validasi integritas: pastikan record pertama punya field penting
        // (password, nik, phoneFingerprint). Jika tidak ada, anggap basi.
        const first = parsed[0];
        if (first && "password" in first && "nik" in first && "phoneFingerprint" in first) {
          return normalizePegawaiData(parsed);
        }
      }
    }
  } catch (_) {
    // Abaikan error baca localStorage — fallback ke JSON
  }
  // Prioritas 2: Fallback ke file statis (first run / cache kosong)
  return normalizePegawaiData(pegawaiData);
};

const restoreSession = (masterData) => {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw);
    const p = saved.activePegawaiId
      ? masterData.find((item) => String(item.id) === String(saved.activePegawaiId))
      : null;
    const sp = saved.selectedPimpinanId
      ? masterData.find((item) => String(item.id) === String(saved.selectedPimpinanId))
      : null;
    return {
      page: saved.page || "login",
      activePegawai: p || null,
      selectedPimpinan: sp || null,
    };
  } catch (e) {
    return {};
  }
};

export function SessionProvider({ children }) {
  const initialMaster = useMemo(() => loadMasterPegawaiData(), []);
  const initialSession = useMemo(() => restoreSession(initialMaster), []);

  // Bersihkan localStorage basi dari versi sebelumnya (v1, v2 → v3)
  useEffect(() => {
    try {
      window.localStorage.removeItem("siapel.masterPegawaiData.v1");
      window.localStorage.removeItem("siapel.masterPegawaiData.v1.version");
      window.localStorage.removeItem("siapel.masterPegawaiData.v2");
    } catch (_) {}
  }, []);

  const [page, setPage] = useState(initialSession.page || "login");
  const [role, setRole] = useState(null);
  const [activePegawai, setActivePegawai] = useState(initialSession.activePegawai || null);
  const [selectedPimpinan, setSelectedPimpinan] = useState(initialSession.selectedPimpinan || null);
  const [masterPegawaiData, setMasterPegawaiData] = useState(initialMaster);

  const pimpinanAccessRoles = useMemo(
    () => buildPimpinanAccessRoles(masterPegawaiData),
    [masterPegawaiData]
  );

  // Persist master data ke localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(MASTER_PEGAWAI_STORAGE_KEY, JSON.stringify(masterPegawaiData));
    } catch (error) {
      console.error("Gagal persist master pegawai:", error);
    }
  }, [masterPegawaiData]);

  // Persist session
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          page,
          activePegawaiId: activePegawai?.id || null,
          selectedPimpinanId: selectedPimpinan?.id || null,
        })
      );
    } catch (error) {
      console.error("Gagal persist session:", error);
    }
  }, [page, activePegawai, selectedPimpinan]);

  // Validasi activePegawai masih ada di master data
  useEffect(() => {
    if (
      activePegawai &&
      !masterPegawaiData.some((person) => String(person.id) === String(activePegawai.id))
    ) {
      setActivePegawai(null);
      setPage("login");
    }
  }, [activePegawai, masterPegawaiData]);

  // Validasi selectedPimpinan masih ada di access roles
  useEffect(() => {
    if (
      selectedPimpinan &&
      !pimpinanAccessRoles.some((person) => String(person.id) === String(selectedPimpinan.id))
    ) {
      setSelectedPimpinan(null);
      setPage("login");
    }
  }, [pimpinanAccessRoles, selectedPimpinan]);

  // ── Navigation handlers ──

  const handleRoleSelect = useCallback(() => {
    setPage("login");
  }, []);

  const handlePegawaiLogin = useCallback((p) => {
    setActivePegawai(p);
    setPage("pegawai_dashboard");
  }, []);

  const handlePimpinanSelect = useCallback((item) => {
    setSelectedPimpinan(item);
    setPage("pimpinan_dashboard");
  }, []);

  const goBack = useCallback(() => {
    setPage("login");
    setRole(null);
    setActivePegawai(null);
    setSelectedPimpinan(null);
  }, []);

  // ── Pegawai CRUD handlers ──

  const handleAddPegawai = useCallback((pegawaiDraft) => {
    setMasterPegawaiData((current) => {
      const nextId =
        current.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
      return normalizePegawaiData([
        ...current,
        normalizePegawaiRecord({ ...pegawaiDraft, id: nextId }, nextId),
      ]);
    });
  }, []);

  const handleUpdatePegawai = useCallback((pegawaiId, updates) => {
    setMasterPegawaiData((current) =>
      normalizePegawaiData(
        current.map((item) => {
          if (String(item.id) !== String(pegawaiId)) return item;
          return normalizePegawaiRecord({ ...item, ...updates, id: item.id }, item.id);
        })
      )
    );
  }, []);

  const handleDeletePegawai = useCallback((pegawaiId) => {
    setMasterPegawaiData((current) =>
      normalizePegawaiData(current.filter((item) => String(item.id) !== String(pegawaiId)))
    );
  }, []);

  const value = useMemo(
    () => ({
      page,
      role,
      activePegawai,
      selectedPimpinan,
      masterPegawaiData,
      pimpinanAccessRoles,
      setPage,
      setRole,
      setActivePegawai,
      setSelectedPimpinan,
      handleRoleSelect,
      handlePegawaiLogin,
      handlePimpinanSelect,
      goBack,
      handleAddPegawai,
      handleUpdatePegawai,
      handleDeletePegawai,
    }),
    [
      page, role, activePegawai, selectedPimpinan, masterPegawaiData, pimpinanAccessRoles,
      handleRoleSelect, handlePegawaiLogin, handlePimpinanSelect, goBack,
      handleAddPegawai, handleUpdatePegawai, handleDeletePegawai,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
