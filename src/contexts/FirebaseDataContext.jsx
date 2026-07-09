import { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import { ref, set, get } from "firebase/database";
import { database } from "../firebase";
import { deleteStorageFile } from "../utils/storage-helper";
import { useSession } from "./SessionContext";
import {
  ATTENDANCE_ROOT,
  APEL_META_ROOT,
  PENGAJUAN_PATH,
  PEGAWAI_PASSWORDS_PATH,
  ACTIVE_SESSION_PATH,
  APEL_SESSIONS,
} from "../bersama/konstanta_aplikasi";
import { getApelStatus } from "../bersama/util_waktu_dan_apel";
import {
  getMonthKey,
  getDayKey,
  buildAttendanceDayPath,
  getWibDayStamp,
  getWibDayStampFromTs,
} from "../bersama/util_tanggal";
import {
  getOrCreateSessionId,
  getDeviceId,
} from "../firebase/device-session";
import { useFirebaseSubscriptions } from "../firebase/useFirebaseSubscriptions";
import { useFirebaseMutations } from "../firebase/useFirebaseMutations";

const FirebaseDataContext = createContext(null);

export function FirebaseDataProvider({ children }) {
  const { page, role, activePegawai, selectedPimpinan, goBack, masterPegawaiData } = useSession();

  const sessionIdRef = useRef(getOrCreateSessionId());
  const deviceIdRef = useRef(getDeviceId());

  const [attendance, setAttendance] = useState({});
  const [monthlyAttendance, setMonthlyAttendance] = useState({});
  const [apelMeta, setApelMeta] = useState({});
  const [dateKeys, setDateKeys] = useState(() => ({
    monthKey: getMonthKey(),
    dayKey: getDayKey(),
  }));
  const dateKeysRef = useRef(dateKeys);
  dateKeysRef.current = dateKeys;

  const [apelSession, setApelSession] = useState(APEL_SESSIONS.ONGOING);
  const [apelReason, setApelReason] = useState(null);
  const [apelReasonText, setApelReasonText] = useState("");
  const [pengajuan, setPengajuan] = useState([]);
  const [riwayatPerubahan, setRiwayatPerubahan] = useState([]);

  useEffect(() => {
    const check = () => {
      const monthKey = getMonthKey();
      const dayKey = getDayKey();
      setDateKeys((prev) =>
        prev.monthKey !== monthKey || prev.dayKey !== dayKey
          ? { monthKey, dayKey }
          : prev
      );
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  const { monthKey, dayKey } = dateKeys;
  const attendanceDayPath = buildAttendanceDayPath(ATTENDANCE_ROOT, monthKey, dayKey);

  useFirebaseSubscriptions(page, { monthKey, dayKey }, {
    setAttendance,
    setMonthlyAttendance,
    setApelMeta,
    setApelSession,
    setApelReason,
    setApelReasonText,
    setPengajuan,
    setRiwayatPerubahan,
  });

  // Sync password admin default sekali (tanpa listener realtime)
  useEffect(() => {
    get(ref(database, `${PEGAWAI_PASSWORDS_PATH}/admin`))
      .then((snap) => {
        if (!snap.val()) {
          set(ref(database, `${PEGAWAI_PASSWORDS_PATH}/admin`), "123455").catch((err) =>
            console.error("Gagal sync admin password:", err)
          );
        }
      })
      .catch((err) => console.error("Gagal cek admin password:", err));
  }, []);

  const activeUserId = useMemo(() => {
    if (page === "login") return null;
    if (role === "admin") return "admin";
    if (role === "developer") return "developer";
    if (activePegawai) return `pegawai_${activePegawai.id}`;
    if (selectedPimpinan?.pegawaiId) return `pegawai_${selectedPimpinan.pegawaiId}`;
    return null;
  }, [page, role, activePegawai, selectedPimpinan]);

  const prevActiveUserIdRef = useRef(activeUserId);
  useEffect(() => {
    const prev = prevActiveUserIdRef.current;
    prevActiveUserIdRef.current = activeUserId;

    if (prev && prev !== activeUserId) {
      get(ref(database, `${ACTIVE_SESSION_PATH}/${prev}`))
        .then((snap) => {
          const val = snap.val();
          if (val && val.deviceId === deviceIdRef.current) {
            set(ref(database, `${ACTIVE_SESSION_PATH}/${prev}`), null);
          }
        })
        .catch((err) => {
          console.error("Gagal cek session sebelum cleanup:", err);
          set(ref(database, `${ACTIVE_SESSION_PATH}/${prev}`), null);
        });
    }
  }, [activeUserId]);

  useEffect(() => {
    const todayStamp = getWibDayStamp();

    for (const item of pengajuan) {
      if (!item.createdAt) continue;
      const itemStamp = getWibDayStampFromTs(item.createdAt);
      if (itemStamp >= todayStamp) continue;
      if (item.statusVerifikasi === "menunggu") continue;

      const removeRecord = () =>
        set(ref(database, `${PENGAJUAN_PATH}/${item.id}`), null).catch((err) =>
          console.error("Gagal hapus record pengajuan lama:", item.id, err)
        );

      if (item.dokumenPath) {
        deleteStorageFile(item.dokumenPath)
          .then(removeRecord)
          .catch((err) => {
            if (err.code === "storage/object-not-found") {
              removeRecord();
            } else {
              console.error("Gagal hapus file storage lama:", item.dokumenPath, err);
            }
          });
      } else {
        removeRecord();
      }
    }
  }, [pengajuan, dayKey]);

  const apelStatus = useMemo(() => getApelStatus(new Date(), apelSession), [apelSession]);

  const mutations = useFirebaseMutations({
    dateKeysRef,
    deviceIdRef,
    sessionIdRef,
    attendance,
    attendanceDayPath,
    pengajuan,
    masterPegawaiData,
    setApelSession,
    setApelReason,
    setApelReasonText,
  });

  const { handleRegisterSession } = mutations;

  useEffect(() => {
    if (!activeUserId || page === "login") return;
    let cancelled = false;
    handleRegisterSession(activeUserId).then((result) => {
      if (!cancelled && !result.ok) {
        console.warn("[SESSION] Reclaim gagal — logout paksa");
        goBack();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeUserId, page, handleRegisterSession, goBack]);

  const value = useMemo(
    () => ({
      attendance,
      monthlyAttendance,
      apelMeta,
      monthKey,
      dayKey,
      apelSession,
      apelReason,
      apelReasonText,
      apelStatus,
      pengajuan,
      riwayatPerubahan,
      activeUserId,
      ...mutations,
    }),
    [
      attendance,
      monthlyAttendance,
      apelMeta,
      monthKey,
      dayKey,
      apelSession,
      apelReason,
      apelReasonText,
      apelStatus,
      pengajuan,
      riwayatPerubahan,
      activeUserId,
      mutations,
    ]
  );

  return (
    <FirebaseDataContext.Provider value={value}>
      {children}
    </FirebaseDataContext.Provider>
  );
}

export function useFirebaseData() {
  const ctx = useContext(FirebaseDataContext);
  if (!ctx) throw new Error("useFirebaseData must be used within FirebaseDataProvider");
  return ctx;
}
