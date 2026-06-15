import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { ref, onValue, set, update, push } from "firebase/database";
import { database } from "../firebase";
import { deleteStorageFile } from "../utils/storage-helper";
import { useSession } from "./SessionContext";
import {
  ATTENDANCE_PATH,
  APEL_SESSION_PATH,
  APEL_REASON_PATH,
  APEL_SESSIONS,
  PENGAJUAN_PATH,
} from "../bersama/konstanta_aplikasi";
import { getApelStatus } from "../bersama/util_waktu_dan_apel";

const FirebaseDataContext = createContext(null);

export function FirebaseDataProvider({ children }) {
  const { masterPegawaiData } = useSession();

  const [attendance, setAttendance] = useState({});
  const [apelSession, setApelSession] = useState(APEL_SESSIONS.ONGOING);
  const [apelReason, setApelReason] = useState(null);
  const [apelReasonText, setApelReasonText] = useState("");
  const [pengajuan, setPengajuan] = useState([]);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);

  // ── Subscription: Attendance ──
  useEffect(() => {
    const attendanceRef = ref(database, ATTENDANCE_PATH);
    const unsub = onValue(
      attendanceRef,
      (snapshot) => {
        const snapshotAttendance = snapshot.val();
        if (snapshotAttendance === null) {
          setAttendance({});
        } else {
          setAttendance(snapshotAttendance);
        }
        setFirebaseReady(true);
        setFirebaseError(null);
      },
      (error) => {
        console.error("Gagal memuat data absensi:", error);
        setFirebaseError("Gagal memuat data absensi. Periksa koneksi internet.");
        setFirebaseReady(true);
      }
    );
    return () => unsub();
  }, []);

  // ── Subscription: Apel session + reason ──
  useEffect(() => {
    const sessionRef = ref(database, APEL_SESSION_PATH);
    const reasonRef = ref(database, APEL_REASON_PATH);

    const unsubSession = onValue(sessionRef, (snapshot) => {
      const val = snapshot.val();
      if (val) setApelSession(val);
    });

    const unsubReason = onValue(reasonRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        if (typeof val === "object") {
          setApelReason(val.id || "lainnya");
          setApelReasonText(val.text || "");
        } else {
          setApelReason(val);
          setApelReasonText("");
        }
      }
    });

    return () => {
      unsubSession();
      unsubReason();
    };
  }, []);

  // ── Subscription: Pengajuan ──
  useEffect(() => {
    const pengajuanRef = ref(database, PENGAJUAN_PATH);
    const unsub = onValue(
      pengajuanRef,
      (snapshot) => {
        const val = snapshot.val();
        if (val === null) {
          setPengajuan([]);
        } else {
          const items = Object.entries(val).map(([id, data]) => ({
            id,
            ...data,
          }));
          setPengajuan(items);
        }
      },
      (error) => {
        console.error("Gagal memuat data pengajuan:", error);
      }
    );
    return () => unsub();
  }, []);

  // ── Auto-cleanup: hapus file storage >24j setelah disetujui ──
  useEffect(() => {
    const FILE_TTL_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const item of pengajuan) {
      if (
        item.statusVerifikasi === "disetujui" &&
        item.dokumenPath &&
        item.approvedAt &&
        now - item.approvedAt >= FILE_TTL_MS
      ) {
        deleteStorageFile(item.dokumenPath)
          .then(() => {
            // Hapus referensi file di database
            update(ref(database, `${PENGAJUAN_PATH}/${item.id}`), {
              dokumenPath: "",
              dokumen: "",
            }).catch(() => {});
          })
          .catch((err) => {
            if (err.code === "storage/object-not-found") {
              // File sudah tidak ada — tetap bersihkan referensi
              update(ref(database, `${PENGAJUAN_PATH}/${item.id}`), {
                dokumenPath: "",
                dokumen: "",
              }).catch(() => {});
            } else {
              console.error("Gagal hapus file storage:", item.dokumenPath, err);
            }
          });
      }
    }
  }, [pengajuan]);

  // ── Derived state ──
  const apelStatus = useMemo(() => getApelStatus(new Date(), apelSession), [apelSession]);

  // ── Mutation handlers ──

  const handleApelSessionChange = useCallback((session) => {
    setApelSession(session);
    set(ref(database, APEL_SESSION_PATH), session);
    if (session !== APEL_SESSIONS.DITIADAKAN) {
      setApelReason(null);
      setApelReasonText("");
      set(ref(database, APEL_REASON_PATH), null);
    }
  }, []);

  const handleApelReasonChange = useCallback((reasonId, customText = "") => {
    setApelReason(reasonId);
    if (reasonId === "lainnya") {
      setApelReasonText(customText);
      set(ref(database, APEL_REASON_PATH), { id: "lainnya", text: customText });
    } else {
      setApelReasonText("");
      set(ref(database, APEL_REASON_PATH), reasonId);
    }
  }, []);

  const handleScan = useCallback(
    (pegawaiId) => {
      if (attendance[pegawaiId]?.status === "Hadir") return;
      const jamNow = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      set(ref(database, `${ATTENDANCE_PATH}/${pegawaiId}`), {
        status: "Hadir",
        jamHadir: jamNow,
      });
    },
    [attendance]
  );

  const handleScanSimulate = useCallback(
    (count) => {
      const finalStatuses = new Set(["Hadir", "Dinas Dalam", "Dinas Luar", "Izin", "Sakit"]);
      const belum = masterPegawaiData
        .filter((p) => !finalStatuses.has(attendance[p.id]?.status))
        .map((p) => p.id);
      const toScan = belum.slice(0, count);
      if (toScan.length === 0) return;
      const jamNow = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const updates = {};
      for (const id of toScan) updates[id] = { status: "Hadir", jamHadir: jamNow };
      update(ref(database, ATTENDANCE_PATH), updates);
    },
    [attendance, masterPegawaiData]
  );

  const handleReset = useCallback(() => {
    set(ref(database, ATTENDANCE_PATH), null);
  }, []);

  const handleKoreksi = useCallback(
    (pegawaiId, newStatus) => {
      const currentAttendance = attendance[pegawaiId] || {
        status: null,
        jamHadir: null,
      };
      set(ref(database, `${ATTENDANCE_PATH}/${pegawaiId}`), {
        ...currentAttendance,
        status: newStatus,
      });
    },
    [attendance]
  );

  const handlePengajuanSubmit = useCallback((pegawaiId, data) => {
    const submission = {
      pegawaiId,
      nama: data.nama || "",
      nip: data.nip || "",
      statusLama: data.statusLama || "",
      statusBaru: data.statusBaru || "",
      keterangan: data.keterangan || "",
      dokumen: data.dokumen || "",
      dokumenPath: data.dokumenPath || "",
      waktu: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      statusVerifikasi: "menunggu",
      createdAt: Date.now(),
    };
    return push(ref(database, PENGAJUAN_PATH), submission);
  }, []);

  const handlePengajuanVerifikasi = useCallback(
    (submissionId, newStatus) => {
      // Update status + timestamp approval (untuk scheduling hapus file)
      update(ref(database, `${PENGAJUAN_PATH}/${submissionId}`), {
        statusVerifikasi: newStatus,
        ...(newStatus === "disetujui" ? { approvedAt: Date.now() } : {}),
      });

      if (newStatus === "disetujui") {
        const submission = pengajuan.find((s) => s.id === submissionId);
        if (submission && submission.pegawaiId && submission.statusBaru) {
          const current = attendance[submission.pegawaiId] || {
            status: null,
            jamHadir: null,
          };
          set(ref(database, `${ATTENDANCE_PATH}/${submission.pegawaiId}`), {
            ...current,
            status: submission.statusBaru,
          });
        }
      }
    },
    [pengajuan, attendance]
  );

  const value = useMemo(
    () => ({
      attendance,
      apelSession,
      apelReason,
      apelReasonText,
      apelStatus,
      pengajuan,
      firebaseReady,
      firebaseError,
      handleScan,
      handleScanSimulate,
      handleReset,
      handleKoreksi,
      handleApelSessionChange,
      handleApelReasonChange,
      handlePengajuanSubmit,
      handlePengajuanVerifikasi,
    }),
    [
      attendance, apelSession, apelReason, apelReasonText, apelStatus, pengajuan,
      firebaseReady, firebaseError,
      handleScan, handleScanSimulate, handleReset, handleKoreksi,
      handleApelSessionChange, handleApelReasonChange,
      handlePengajuanSubmit, handlePengajuanVerifikasi,
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
