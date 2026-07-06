import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ref, onValue, set, update, push, get } from "firebase/database";
import { database } from "../firebase";
import { deleteStorageFile } from "../utils/storage-helper";
import { useSession } from "./SessionContext";
import {
  ATTENDANCE_PATH,
  APEL_SESSION_PATH,
  APEL_REASON_PATH,
  APEL_SESSIONS,
  PENGAJUAN_PATH,
  FINGERPRINT_PATH,
  PEGAWAI_PASSWORDS_PATH,
  ACTIVE_SESSION_PATH,
} from "../bersama/konstanta_aplikasi";
import { getApelStatus } from "../bersama/util_waktu_dan_apel";

/**
 * generateUUID — UUID v4 yang kompatibel semua browser (termasuk Chrome < 93,
 * Samsung Internet, Android WebView).
 *
 * - Priority 1: crypto.randomUUID() (Chrome 93+, modern browsers)
 * - Priority 2: crypto.getRandomValues() (semua browser modern)
 * - Priority 3: Math.random() fallback (browser sangat tua)
 */
const generateUUID = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback pakai getRandomValues (didukung sejak Chrome 11+, Safari 6+, Firefox 21+)
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
    buf[8] = (buf[8] & 0x3f) | 0x80; // variant
    const hex = (b) => b.toString(16).padStart(2, "0");
    return `${hex(buf[0])}${hex(buf[1])}${hex(buf[2])}${hex(buf[3])}-${hex(buf[4])}${hex(buf[5])}-${hex(buf[6])}${hex(buf[7])}-${hex(buf[8])}${hex(buf[9])}-${hex(buf[10])}${hex(buf[11])}${hex(buf[12])}${hex(buf[13])}${hex(buf[14])}${hex(buf[15])}`;
  }
  // Fallback terakhir: Math.random (sangat kecil kemungkinan collision)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/**
 * getDeviceId — ID unik perangkat yang PERSISTEN di localStorage.
 * Berbeda dari sessionId yang baru tiap halaman di-refresh.
 * Dipakai untuk bedain "device sama setelah refresh" vs "device beda".
 */
const getDeviceId = () => {
  try {
    let id = window.localStorage.getItem("siapel_device_id");
    if (!id) {
      id = generateUUID();
      window.localStorage.setItem("siapel_device_id", id);
    }
    return id;
  } catch {
    return generateUUID();
  }
};

const FirebaseDataContext = createContext(null);

export function FirebaseDataProvider({ children }) {
  const { page, role, activePegawai, selectedPimpinan, goBack, masterPegawaiData } = useSession();

  // Session ID unik tiap kali halaman di-load — dipakai untuk deteksi login ganda
  const sessionIdRef = useRef(generateUUID());

  // Device ID persisten (localStorage) — tetap sama walau halaman di-refresh
  // Dipakai untuk bedain "device yang sama setelah F5" vs "device berbeda"
  const deviceIdRef = useRef(getDeviceId());

  const [attendance, setAttendance] = useState({});
  const [apelSession, setApelSession] = useState(APEL_SESSIONS.ONGOING);
  const [apelReason, setApelReason] = useState(null);
  const [apelReasonText, setApelReasonText] = useState("");
  const [pengajuan, setPengajuan] = useState([]);
  const [passwordOverrides, setPasswordOverrides] = useState({});
  const [passwordOverridesLoaded, setPasswordOverridesLoaded] = useState(false);
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

  // ── Subscription: Password overrides ──
  useEffect(() => {
    const pwRef = ref(database, PEGAWAI_PASSWORDS_PATH);
    const unsub = onValue(
      pwRef,
      (snapshot) => {
        const val = snapshot.val();
        setPasswordOverrides(val || {});
        if (!passwordOverridesLoaded) {
          setPasswordOverridesLoaded(true);
          // Sync admin password default ke Firebase sekali saat pertama load
          // supaya tidak ada mismatch antara kode dan Firebase override
          if (!val?.admin) {
            set(ref(database, `${PEGAWAI_PASSWORDS_PATH}/admin`), "123455").catch(err => console.error("Gagal sync admin password:", err));
          }
        }
      },
      (error) => {
        console.error("Gagal memuat password overrides:", error);
        setPasswordOverridesLoaded(true);
      }
    );
    return () => unsub();
  }, []);

  // ── Derived: activeUserId dari session state ──
  const activeUserId = useMemo(() => {
    if (page === "login") return null;
    if (role === "admin") return "admin";
    if (role === "developer") return "developer";
    if (activePegawai) return `pegawai_${activePegawai.id}`;
    if (selectedPimpinan?.pegawaiId) return `pegawai_${selectedPimpinan.pegawaiId}`;
    return null;
  }, [page, role, activePegawai, selectedPimpinan]);

  // ── Ref: apakah ini callback pertama setelah subscribe (sync awal) ──
  const initialSyncRef = useRef(true);

  // ── Subscription: Active Session (deteksi login dari device lain) ──
  // Strategi:
  //   - Subscription listen untuk session changes (conflict detection)
  //   - Registration sudah dilakukan di LoginPage via handleRegisterSession()
  //   - Jika sessionId/deviceId berubah → ada login device lain → goBack()
  useEffect(() => {
    if (!activeUserId) {
      initialSyncRef.current = true;
      return;
    }

    let isFirstSync = true;

    const sessionRef = ref(database, `${ACTIVE_SESSION_PATH}/${activeUserId}`);
    const unsub = onValue(sessionRef, (snapshot) => {
      const val = snapshot.val();

      if (isFirstSync) {
        console.log(`[SESSION] Initial sync for ${activeUserId}:`, val);
        isFirstSync = false;
        return;
      }

      if (val && (val.sessionId !== sessionIdRef.current || val.deviceId !== deviceIdRef.current)) {
        console.warn(`[SESSION] 🔴 Device conflict detected:`, {
          stored: { sessionId: val.sessionId, deviceId: val.deviceId },
          current: { sessionId: sessionIdRef.current, deviceId: deviceIdRef.current },
        });
        goBack();
      }
    });

    // Periodic conflict check tiap 15 detik sebagai fallback
    const conflictTimer = setInterval(async () => {
      try {
        const snap = await get(ref(database, `${ACTIVE_SESSION_PATH}/${activeUserId}`));
        const val = snap.val();
        if (val && val.sessionId !== sessionIdRef.current) {
          console.warn(`[SESSION] Conflict detected on periodic check`);
          goBack();
        }
      } catch (_) {
        // Silent
      }
    }, 15000);

    return () => {
      unsub();
      clearInterval(conflictTimer);
    };
  }, [activeUserId, goBack]);

  // ── Bersihkan session saat logout (activeUserId berubah dari X → null) ──
  // Dipisah dari subscription biar nge-clear sesi bahkan saat onValue sedang delay
  const prevActiveUserIdRef = useRef(activeUserId);
  useEffect(() => {
    const prev = prevActiveUserIdRef.current;
    prevActiveUserIdRef.current = activeUserId;

    if (prev && prev !== activeUserId) {
      // Cek dulu: apakah session path ini masih berisi session KITA?
      // Jika sudah di-overwrite oleh device lain (conflict detection), biarkan saja
      get(ref(database, `${ACTIVE_SESSION_PATH}/${prev}`))
        .then((snap) => {
          const val = snap.val();
          if (val && val.sessionId === sessionIdRef.current) {
            // Session masih milik kita → ini logout sadar → hapus
            set(ref(database, `${ACTIVE_SESSION_PATH}/${prev}`), null);
          }
          // else: session sudah di-overwrite device lain → biarkan (tidak dihapus)
        })
        .catch((err) => {
          console.error("Gagal cek session sebelum cleanup:", err);
          // Fallback: tetap clear (mungkin koneksi bermasalah)
          set(ref(database, `${ACTIVE_SESSION_PATH}/${prev}`), null);
        });
    }
  }, [activeUserId]);

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
            }).catch(err => console.error("Gagal hapus referensi dokumen (1):", err));
          })
          .catch((err) => {
            if (err.code === "storage/object-not-found") {
              // File sudah tidak ada — tetap bersihkan referensi
              update(ref(database, `${PENGAJUAN_PATH}/${item.id}`), {
                dokumenPath: "",
                dokumen: "",
              }).catch(err2 => console.error("Gagal hapus referensi dokumen (2):", err2));
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

  const handleSaveFingerprint = useCallback((pegawaiId, fingerprint) => {
    set(ref(database, `${FINGERPRINT_PATH}/${pegawaiId}`), {
      deviceId: fingerprint,
      lastLogin: Date.now(),
      deviceInfo: (navigator.userAgent || "").slice(0, 100),
    });
  }, []);

  const handleSavePasswordOverride = useCallback((key, password) => {
    set(ref(database, `${PEGAWAI_PASSWORDS_PATH}/${key}`), password);
  }, []);

  const handleClearActiveSession = useCallback((userId) => {
    if (!userId) return;
    set(ref(database, `${ACTIVE_SESSION_PATH}/${userId}`), null);
  }, []);

  const handleRegisterSession = useCallback(async (userId) => {
    if (!userId) return true;
    const sessionRef = ref(database, `${ACTIVE_SESSION_PATH}/${userId}`);
    const newSessionData = {
      sessionId: sessionIdRef.current,
      deviceId: deviceIdRef.current,
      loginAt: Date.now(),
    };
    try {
      console.log(`[LOGIN] Writing new session for ${userId}`, {
        sessionId: sessionIdRef.current,
        deviceId: deviceIdRef.current,
      });
      await set(sessionRef, newSessionData);
      
      const snap = await get(sessionRef);
      const written = snap.val();
      console.log(`[LOGIN] Verified session written:`, written);
      
      if (written && written.sessionId === sessionIdRef.current) {
        console.log(`[LOGIN] ✅ Session registered successfully for ${userId}`);
        return true;
      } else {
        console.error(`[LOGIN] ❌ Session verification failed - data mismatch`);
        return false;
      }
    } catch (error) {
      console.error("[LOGIN] ❌ Gagal register session:", error);
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      attendance,
      apelSession,
      apelReason,
      apelReasonText,
      apelStatus,
      pengajuan,
      passwordOverrides,
      passwordOverridesLoaded,
      firebaseReady,
      firebaseError,
      activeUserId,
      handleScan,
      handleScanSimulate,
      handleReset,
      handleKoreksi,
      handleApelSessionChange,
      handleApelReasonChange,
      handlePengajuanSubmit,
      handlePengajuanVerifikasi,
      handleSaveFingerprint,
      handleSavePasswordOverride,
      handleClearActiveSession,
      handleRegisterSession,
    }),
    [
      attendance, apelSession, apelReason, apelReasonText, apelStatus, pengajuan, passwordOverrides,
      passwordOverridesLoaded, activeUserId,
      firebaseReady, firebaseError,
      handleScan, handleScanSimulate, handleReset, handleKoreksi,
      handleApelSessionChange, handleApelReasonChange,
      handlePengajuanSubmit, handlePengajuanVerifikasi,
      handleSaveFingerprint, handleSavePasswordOverride,
      handleClearActiveSession, handleRegisterSession,
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
