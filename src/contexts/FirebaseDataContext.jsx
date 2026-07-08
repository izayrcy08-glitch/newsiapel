import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ref, onValue, set, update, push, get } from "firebase/database";
import { database } from "../firebase";
import { deleteStorageFile } from "../utils/storage-helper";
import { useSession } from "./SessionContext";
import {
  ATTENDANCE_ROOT,
  APEL_META_ROOT,
  APEL_SESSION_PATH,
  APEL_REASON_PATH,
  APEL_SESSIONS,
  PENGAJUAN_PATH,
  FINGERPRINT_PATH,
  PEGAWAI_PASSWORDS_PATH,
  ACTIVE_SESSION_PATH,
} from "../bersama/konstanta_aplikasi";
import { getApelStatus } from "../bersama/util_waktu_dan_apel";
import {
  getWibNow,
  getMonthKey,
  getDayKey,
  isWeekend,
  buildAttendanceDayPath,
  buildApelMetaDayPath,
  getWibDayStamp,
  getWibDayStampFromTs,
} from "../bersama/util_tanggal";
import { loadPegawaiFromFirebase } from "../utils/firebase-sync-pegawai";

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
 * getDeviceId — ID unik perangkat (localStorage, sama di semua tab browser ini).
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

const SESSION_ID_KEY = "siapel_session_id";

// Interval pengiriman heartbeat oleh tab yang sedang aktif.
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 detik

/**
 * getOrCreateSessionId — ID unik per TAB (sessionStorage).
 * Tab baru = ID baru → bisa bedakan 2 jendela di browser yang sama.
 * Refresh tab yang sama = ID tetap → tidak kena tendang sendiri.
 */
const getOrCreateSessionId = () => {
  try {
    let id = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = generateUUID();
      window.sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return generateUUID();
  }
};

/**
 * formatJamHadir — format jam "HH:MM" (selalu titik dua).
 * PENTING: jangan pakai toLocaleTimeString("id-ID") karena locale Indonesia
 * menghasilkan titik ("07.15"), sedangkan Firebase Rules mewajibkan titik dua
 * ("07:15"). Ketidakcocokan ini bikin penyimpanan absensi ditolak diam-diam.
 */
const formatJamHadir = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const FirebaseDataContext = createContext(null);

export function FirebaseDataProvider({ children }) {
  const { page, role, activePegawai, selectedPimpinan, goBack, masterPegawaiData } = useSession();

  // Session ID unik per TAB (sessionStorage) — beda tiap jendela/tab browser
  const sessionIdRef = useRef(getOrCreateSessionId());

  // Device ID persisten (localStorage) — tetap sama walau halaman di-refresh
  // Dipakai untuk bedain "device yang sama setelah F5" vs "device berbeda"
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
  const [passwordOverrides, setPasswordOverrides] = useState({});
  const [passwordOverridesLoaded, setPasswordOverridesLoaded] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);

  // ── Deteksi pergantian tanggal WIB (reset harian otomatis) ──
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
  const apelMetaDayPath = buildApelMetaDayPath(APEL_META_ROOT, monthKey, dayKey);

  // ── Subscription: Attendance hari ini ──
  useEffect(() => {
    const attendanceRef = ref(database, attendanceDayPath);
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
  }, [attendanceDayPath]);

  // ── Subscription: Attendance bulan ini (akumulasi bulanan) ──
  useEffect(() => {
    const monthlyRef = ref(database, `${ATTENDANCE_ROOT}/${monthKey}`);
    const unsub = onValue(
      monthlyRef,
      (snapshot) => {
        setMonthlyAttendance(snapshot.val() || {});
      },
      (error) => {
        console.error("Gagal memuat data absensi bulanan:", error);
      }
    );
    return () => unsub();
  }, [monthKey]);

  // ── Subscription: ApelMeta bulan ini ──
  useEffect(() => {
    const metaRef = ref(database, `${APEL_META_ROOT}/${monthKey}`);
    const unsub = onValue(
      metaRef,
      (snapshot) => {
        setApelMeta(snapshot.val() || {});
      },
      (error) => {
        console.error("Gagal memuat apelMeta:", error);
      }
    );
    return () => unsub();
  }, [monthKey]);

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

  // ── Bersihkan session saat logout (activeUserId berubah dari X → null) ──
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

  // ── Heartbeat: perbarui lastSeen (visibilitas admin, bukan auto-lepas kunci) ──
  useEffect(() => {
    if (!activeUserId) return;
    const sessionRef = ref(database, `${ACTIVE_SESSION_PATH}/${activeUserId}`);
    const beat = () => {
      update(sessionRef, { lastSeen: Date.now() }).catch(() => {});
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [activeUserId]);

  // ── Auto-cleanup: hapus pengajuan hari sebelumnya saat ganti hari (00:00 WIB) ──
  // Tujuan: jaga memori Firebase (Storage + RTDB) tetap aman. Pengajuan itu
  // berlaku untuk hari pengirimannya; begitu lewat tengah malam, absensi sudah
  // tercatat per-tanggal sehingga pengajuan lama tidak diperlukan lagi.
  // Pengecualian: yang masih "menunggu" (belum diverifikasi) TIDAK dihapus,
  // supaya admin tidak kehilangan pengajuan yang dikirim larut malam.
  useEffect(() => {
    const todayStamp = getWibDayStamp();

    for (const item of pengajuan) {
      if (!item.createdAt) continue;
      const itemStamp = getWibDayStampFromTs(item.createdAt);
      if (itemStamp >= todayStamp) continue; // hari ini — biarkan
      if (item.statusVerifikasi === "menunggu") continue; // pending — pertahankan

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

  // ── Derived state ──
  const apelStatus = useMemo(() => getApelStatus(new Date(), apelSession), [apelSession]);

  // ── Mutation handlers ──

  const handleApelSessionChange = useCallback((session) => {
    const { monthKey: mk, dayKey: dk } = dateKeysRef.current;
    const attendancePath = buildAttendanceDayPath(ATTENDANCE_ROOT, mk, dk);
    const metaPath = buildApelMetaDayPath(APEL_META_ROOT, mk, dk);

    setApelSession(session);
    set(ref(database, APEL_SESSION_PATH), session);

    if (session === APEL_SESSIONS.DITIADAKAN) {
      setApelReason(null);
      setApelReasonText("");
      set(ref(database, APEL_REASON_PATH), null);
      set(ref(database, attendancePath), null).catch((err) =>
        console.error("Gagal hapus absensi saat ditiadakan:", err)
      );
      set(ref(database, metaPath), { held: false, reason: "" }).catch((err) =>
        console.error("Gagal set apelMeta ditiadakan:", err)
      );
    } else {
      setApelReason(null);
      setApelReasonText("");
      set(ref(database, APEL_REASON_PATH), null);
      if (session === APEL_SESSIONS.ONGOING && !isWeekend(getWibNow())) {
        set(ref(database, metaPath), { held: true }).catch((err) =>
          console.error("Gagal set apelMeta held:", err)
        );
      }
    }
  }, []);

  const handleApelReasonChange = useCallback((reasonId, customText = "") => {
    const { monthKey: mk, dayKey: dk } = dateKeysRef.current;
    const metaPath = buildApelMetaDayPath(APEL_META_ROOT, mk, dk);
    const reasonStr = reasonId === "lainnya" ? customText : reasonId;

    setApelReason(reasonId);
    if (reasonId === "lainnya") {
      setApelReasonText(customText);
      set(ref(database, APEL_REASON_PATH), { id: "lainnya", text: customText });
    } else {
      setApelReasonText("");
      set(ref(database, APEL_REASON_PATH), reasonId);
    }

    set(ref(database, metaPath), { held: false, reason: reasonStr }).catch((err) =>
      console.error("Gagal update apelMeta reason:", err)
    );
  }, []);

  const handleScan = useCallback(
    (pegawaiId) => {
      if (attendance[pegawaiId]?.status === "Hadir") return;
      const path = `${attendanceDayPath}/${pegawaiId}`;
      set(ref(database, path), {
        status: "Hadir",
        jamHadir: formatJamHadir(),
      }).catch((err) =>
        console.error("Gagal menyimpan absensi (handleScan):", pegawaiId, err)
      );
    },
    [attendance, attendanceDayPath]
  );

  const handleScanSimulate = useCallback(
    (count) => {
      const finalStatuses = new Set(["Hadir", "Dinas Dalam", "Dinas Luar", "Izin", "Sakit"]);
      const belum = masterPegawaiData
        .filter((p) => !finalStatuses.has(attendance[p.id]?.status))
        .map((p) => p.id);
      const toScan = belum.slice(0, count);
      if (toScan.length === 0) return;
      const jamNow = formatJamHadir();
      const updates = {};
      for (const id of toScan) updates[`${attendanceDayPath}/${id}`] = { status: "Hadir", jamHadir: jamNow };
      update(ref(database), updates).catch((err) =>
        console.error("Gagal menyimpan absensi (handleScanSimulate):", err)
      );
    },
    [attendance, masterPegawaiData, attendanceDayPath]
  );

  const handleReset = useCallback(() => {
    const { monthKey: mk, dayKey: dk } = dateKeysRef.current;
    const attendancePath = buildAttendanceDayPath(ATTENDANCE_ROOT, mk, dk);
    const metaPath = buildApelMetaDayPath(APEL_META_ROOT, mk, dk);
    set(ref(database, attendancePath), null).catch((err) =>
      console.error("Gagal reset absensi hari ini:", err)
    );
    set(ref(database, metaPath), null).catch((err) =>
      console.error("Gagal reset apelMeta hari ini:", err)
    );
  }, []);

  const handleResetPegawai = useCallback((pegawaiId) => {
    const { monthKey: mk, dayKey: dk } = dateKeysRef.current;
    const path = `${buildAttendanceDayPath(ATTENDANCE_ROOT, mk, dk)}/${pegawaiId}`;
    set(ref(database, path), null).catch((err) =>
      console.error("Gagal reset absensi pegawai:", pegawaiId, err)
    );
  }, []);

  const handleKoreksi = useCallback(
    (pegawaiId, newStatus) => {
      const currentAttendance = attendance[pegawaiId] || {
        status: null,
        jamHadir: null,
      };
      // Saat set "Hadir" secara manual tapi belum ada jam, isi jam sekarang.
      const jamHadir =
        newStatus === "Hadir" && !currentAttendance.jamHadir
          ? formatJamHadir()
          : currentAttendance.jamHadir;
      const payload = { status: newStatus };
      if (jamHadir) payload.jamHadir = jamHadir;
      set(ref(database, `${attendanceDayPath}/${pegawaiId}`), payload).catch((err) =>
        console.error("Gagal menyimpan koreksi:", pegawaiId, err)
      );
    },
    [attendance, attendanceDayPath]
  );

  const handlePengajuanSubmit = useCallback((pegawaiId, data) => {
    const submission = {
      pegawaiId: String(pegawaiId),
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

  const resolveAttendancePegawaiId = (pegawaiId) => {
    const raw = String(pegawaiId);
    const numeric = parseInt(raw, 10);
    if (!Number.isNaN(numeric)) return numeric;
    return raw;
  };

  const handlePengajuanVerifikasi = useCallback(
    (submissionId, newStatus, alasanAdmin = "") => {
      const verifiedAt = Date.now();
      const updates = {
        statusVerifikasi: newStatus,
        verifiedAt,
        ...(newStatus === "ditolak" && alasanAdmin.trim()
          ? { alasanAdmin: alasanAdmin.trim() }
          : {}),
      };

      update(ref(database, `${PENGAJUAN_PATH}/${submissionId}`), updates).catch((err) =>
        console.error("Gagal verifikasi pengajuan:", submissionId, err)
      );

      if (newStatus === "disetujui") {
        const submission = pengajuan.find((s) => s.id === submissionId);
        if (submission?.pegawaiId && submission.statusBaru) {
          const pegawaiId = resolveAttendancePegawaiId(submission.pegawaiId);
          const current =
            attendance[pegawaiId] ||
            attendance[submission.pegawaiId] || {
              status: null,
              jamHadir: null,
            };
          set(ref(database, `${attendanceDayPath}/${pegawaiId}`), {
            ...current,
            status: submission.statusBaru,
          }).catch((err) =>
            console.error("Gagal update absensi dari pengajuan:", pegawaiId, err)
          );
        }
      }
    },
    [pengajuan, attendance, attendanceDayPath]
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
    set(ref(database, `${ACTIVE_SESSION_PATH}/${userId}`), null).catch((err) =>
      console.error("Gagal clear active session:", err)
    );
    // Reset session tab agar login berikutnya dapat ID sesi baru
    try {
      window.sessionStorage.removeItem(SESSION_ID_KEY);
    } catch (_) {}
    sessionIdRef.current = generateUUID();
    try {
      window.sessionStorage.setItem(SESSION_ID_KEY, sessionIdRef.current);
    } catch (_) {}
  }, []);

  // Skema A + admin-only: 1 akun = 1 perangkat. Reclaim by deviceId (tahan refresh HP).
  const handleRegisterSession = useCallback(async (userId) => {
    if (!userId) return { ok: true };
    const sessionRef = ref(database, `${ACTIVE_SESSION_PATH}/${userId}`);
    try {
      const now = Date.now();
      const existing = (await get(sessionRef)).val();

      if (existing && existing.deviceId === deviceIdRef.current) {
        await update(sessionRef, {
          sessionId: sessionIdRef.current,
          lastSeen: now,
        });
        console.log(`[LOGIN] ✅ Reclaim sesi (deviceId sama)`);
        return { ok: true };
      }

      if (existing && existing.deviceId !== deviceIdRef.current) {
        console.warn(`[LOGIN] ❌ Ditolak — akun aktif di perangkat lain`, {
          existingDeviceId: existing.deviceId,
          myDeviceId: deviceIdRef.current,
        });
        return { ok: false, reason: "device_lain" };
      }

      const newSessionData = {
        sessionId: sessionIdRef.current,
        deviceId: deviceIdRef.current,
        loginAt: now,
        lastSeen: now,
      };
      console.log(`[LOGIN] Writing new session for ${userId}`, newSessionData);
      await set(sessionRef, newSessionData);

      const written = (await get(sessionRef)).val();
      if (written?.deviceId === deviceIdRef.current) {
        console.log(`[LOGIN] ✅ Session registered for ${userId}`);
        return { ok: true };
      }
      console.error(`[LOGIN] ❌ Session verification failed`);
      return { ok: false, reason: "verify_gagal" };
    } catch (error) {
      console.error("[LOGIN] ❌ Gagal register session:", error);
      return { ok: false, reason: "error" };
    }
  }, []);

  // Saat buka dashboard dari localStorage (tanpa lewat login), klaim ulang sesi.
  // Jika sesi sudah dipakai tab/device lain → tendang ke login.
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
      passwordOverrides,
      passwordOverridesLoaded,
      firebaseReady,
      firebaseError,
      activeUserId,
      handleScan,
      handleScanSimulate,
      handleReset,
      handleResetPegawai,
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
      attendance, monthlyAttendance, apelMeta, monthKey, dayKey,
      apelSession, apelReason, apelReasonText, apelStatus, pengajuan, passwordOverrides,
      passwordOverridesLoaded, activeUserId,
      firebaseReady, firebaseError,
      handleScan, handleScanSimulate, handleReset, handleResetPegawai, handleKoreksi,
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
