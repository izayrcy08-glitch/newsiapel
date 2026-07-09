import { useCallback, useMemo } from "react";
import { ref, set, update, push, get } from "firebase/database";
import { database } from "../firebase";
import { deleteStorageFile } from "../utils/storage-helper";
import {
  ATTENDANCE_ROOT,
  APEL_META_ROOT,
  APEL_SESSION_PATH,
  APEL_REASON_PATH,
  APEL_SESSIONS,
  PENGAJUAN_PATH,
  RIWAYAT_PERUBAHAN_ROOT,
  FINGERPRINT_PATH,
  PEGAWAI_PASSWORDS_PATH,
  ACTIVE_SESSION_PATH,
} from "../bersama/konstanta_aplikasi";
import {
  isWeekend,
  buildAttendanceDayPath,
  buildApelMetaDayPath,
  buildRiwayatDayPath,
  getWibNow,
  getWibDayStamp,
  getWibDayStampFromTs,
  isPengajuanHariIni,
} from "../bersama/util_tanggal";
import {
  getAttendanceRecord,
  resolveAttendancePegawaiId,
} from "../bersama/util_attendance";
import { filterPengajuanByMonth } from "../bersama/util_revisi";
import { formatJamHadir } from "./format-jam-hadir";
import {
  SESSION_ID_KEY,
  generateUUID,
  DEVELOPER_USER_ID,
  isDeveloperSessionStale,
} from "./device-session";

/**
 * Handler tulis/baca Firebase — dipisah dari provider agar context tetap ringkas.
 */
export function useFirebaseMutations({
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
}) {
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
  }, [dateKeysRef, setApelSession, setApelReason, setApelReasonText]);

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
  }, [dateKeysRef, setApelReason, setApelReasonText]);

  const handleScan = useCallback(
    (pegawaiId) => {
      const existing = getAttendanceRecord(attendance, pegawaiId);
      if (existing?.status === "Hadir") {
        return Promise.reject(new Error("sudah_hadir"));
      }
      const id = resolveAttendancePegawaiId(pegawaiId);
      const path = `${attendanceDayPath}/${id}`;
      return set(ref(database, path), {
        status: "Hadir",
        jamHadir: formatJamHadir(),
      }).catch((err) => {
        console.error("Gagal menyimpan absensi (handleScan):", pegawaiId, err);
        throw err;
      });
    },
    [attendance, attendanceDayPath]
  );

  const handleScanSimulate = useCallback(
    (count) => {
      const finalStatuses = new Set(["Hadir", "Dinas Dalam", "Dinas Luar", "Izin", "Sakit"]);
      const belum = masterPegawaiData
        .filter((p) => !finalStatuses.has(getAttendanceRecord(attendance, p.id)?.status))
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

  const deleteTodayPengajuan = useCallback(async () => {
    const todayStamp = getWibDayStamp();
    const toDelete = pengajuan.filter(
      (p) => p.createdAt && getWibDayStampFromTs(p.createdAt) === todayStamp
    );
    await Promise.all(
      toDelete.map((p) =>
        set(ref(database, `${PENGAJUAN_PATH}/${p.id}`), null).catch((err) =>
          console.error("Gagal hapus pengajuan hari ini:", p.id, err)
        )
      )
    );
  }, [pengajuan]);

  const deletePengajuanByMonth = useCallback(
    async (targetMonthKey) => {
      const toDelete = filterPengajuanByMonth(pengajuan, targetMonthKey);
      await Promise.all(
        toDelete.map((p) =>
          set(ref(database, `${PENGAJUAN_PATH}/${p.id}`), null).catch((err) =>
            console.error("Gagal hapus pengajuan bulan:", p.id, err)
          )
        )
      );
    },
    [pengajuan]
  );

  const handleReset = useCallback(async () => {
    const { monthKey: mk, dayKey: dk } = dateKeysRef.current;
    const attendancePath = buildAttendanceDayPath(ATTENDANCE_ROOT, mk, dk);
    const metaPath = buildApelMetaDayPath(APEL_META_ROOT, mk, dk);
    const riwayatPath = buildRiwayatDayPath(RIWAYAT_PERUBAHAN_ROOT, mk, dk);

    await Promise.all([
      set(ref(database, attendancePath), null),
      set(ref(database, metaPath), null),
      set(ref(database, riwayatPath), null),
      deleteTodayPengajuan(),
    ]).catch((err) => console.error("Gagal reset hari ini:", err));
  }, [dateKeysRef, deleteTodayPengajuan]);

  const handleResetMonth = useCallback(
    async (targetMonthKey) => {
      const mk = targetMonthKey || dateKeysRef.current.monthKey;
      await Promise.all([
        set(ref(database, `${ATTENDANCE_ROOT}/${mk}`), null),
        set(ref(database, `${APEL_META_ROOT}/${mk}`), null),
        set(ref(database, `${RIWAYAT_PERUBAHAN_ROOT}/${mk}`), null),
        deletePengajuanByMonth(mk),
      ]).catch((err) => console.error("Gagal reset bulan:", mk, err));
    },
    [dateKeysRef, deletePengajuanByMonth]
  );

  const handleResetPegawai = useCallback((pegawaiId) => {
    const { monthKey: mk, dayKey: dk } = dateKeysRef.current;
    const path = `${buildAttendanceDayPath(ATTENDANCE_ROOT, mk, dk)}/${pegawaiId}`;
    set(ref(database, path), null).catch((err) =>
      console.error("Gagal reset absensi pegawai:", pegawaiId, err)
    );
  }, [dateKeysRef]);

  const writeRiwayatPerubahan = useCallback(
    async (payload) => {
      const { monthKey: mk, dayKey: dk } = dateKeysRef.current;
      const path = buildRiwayatDayPath(RIWAYAT_PERUBAHAN_ROOT, mk, dk);
      return push(ref(database, path), {
        ...payload,
        createdAt: Date.now(),
        waktu: payload.waktu || formatJamHadir(),
      });
    },
    [dateKeysRef]
  );

  const handleKoreksi = useCallback(
    async (pegawaiId, newStatus, actorInfo = {}, pegawaiMeta = {}) => {
      const id = resolveAttendancePegawaiId(pegawaiId);
      const currentAttendance = getAttendanceRecord(attendance, pegawaiId) || {
        status: null,
        jamHadir: null,
      };
      const statusLama =
        currentAttendance.status ||
        pegawaiMeta.statusLama ||
        "Belum Hadir";
      const jamHadir =
        newStatus === "Hadir" && !currentAttendance.jamHadir
          ? formatJamHadir()
          : currentAttendance.jamHadir;
      const payload = { status: newStatus };
      if (jamHadir) payload.jamHadir = jamHadir;

      await set(ref(database, `${attendanceDayPath}/${id}`), payload).catch((err) => {
        console.error("Gagal menyimpan koreksi:", pegawaiId, err);
        throw err;
      });

      if (actorInfo?.nama) {
        await writeRiwayatPerubahan({
          pegawaiId: String(pegawaiId),
          nama: pegawaiMeta.nama || "",
          nip: pegawaiMeta.nip || "",
          statusLama,
          statusBaru: newStatus,
          sumber: "koreksi_manual",
          olehId: String(actorInfo.id || ""),
          olehNama: actorInfo.nama,
          olehRole: actorInfo.role || "ADMIN",
        });
      }
    },
    [attendance, attendanceDayPath, writeRiwayatPerubahan]
  );

  const handlePengajuanSubmit = useCallback(
    (pegawaiId, data) => {
      const hasPending = pengajuan.some(
        (p) =>
          String(p.pegawaiId) === String(pegawaiId) &&
          p.statusVerifikasi === "menunggu" &&
          isPengajuanHariIni(p)
      );
      if (hasPending) {
        return Promise.reject(new Error("pengajuan_pending"));
      }

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
    },
    [pengajuan]
  );

  const handlePengajuanVerifikasi = useCallback(
    async (submissionId, newStatus, alasanAdmin = "", actorInfo = {}) => {
      const submissionSnap = await get(ref(database, `${PENGAJUAN_PATH}/${submissionId}`));
      const submission = submissionSnap.val();
      if (!submission) {
        console.error("Pengajuan tidak ditemukan:", submissionId);
        return;
      }

      const verifiedAt = Date.now();
      const updates = {
        statusVerifikasi: newStatus,
        verifiedAt,
        verifiedById: String(actorInfo.id || ""),
        verifiedByNama: actorInfo.nama || "",
        verifiedByRole: actorInfo.role || "ADMIN",
        ...(newStatus === "ditolak" && alasanAdmin.trim()
          ? { alasanAdmin: alasanAdmin.trim() }
          : {}),
      };

      await update(ref(database, `${PENGAJUAN_PATH}/${submissionId}`), updates).catch((err) => {
        console.error("Gagal verifikasi pengajuan:", submissionId, err);
        throw err;
      });

      if (newStatus === "disetujui" && submission.pegawaiId && submission.statusBaru) {
        const pegawaiId = resolveAttendancePegawaiId(submission.pegawaiId);
        const current = getAttendanceRecord(attendance, submission.pegawaiId) || {
          status: null,
          jamHadir: null,
        };
        await set(ref(database, `${attendanceDayPath}/${pegawaiId}`), {
          ...current,
          status: submission.statusBaru,
        }).catch((err) => {
          console.error("Gagal update absensi dari pengajuan:", pegawaiId, err);
          throw err;
        });

        if (actorInfo?.nama) {
          await writeRiwayatPerubahan({
            pegawaiId: String(submission.pegawaiId),
            nama: submission.nama || "",
            nip: submission.nip || "",
            statusLama: submission.statusLama || "",
            statusBaru: submission.statusBaru,
            keterangan: submission.keterangan || "",
            sumber: "pengajuan",
            pengajuanId: submissionId,
            olehId: String(actorInfo.id || ""),
            olehNama: actorInfo.nama,
            olehRole: actorInfo.role || "ADMIN",
          });
        }
      }
    },
    [attendance, attendanceDayPath, writeRiwayatPerubahan]
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
    try {
      window.sessionStorage.removeItem(SESSION_ID_KEY);
    } catch (_) {}
    sessionIdRef.current = generateUUID();
    try {
      window.sessionStorage.setItem(SESSION_ID_KEY, sessionIdRef.current);
    } catch (_) {}
  }, [sessionIdRef]);

  /** Hapus seluruh node activeSessions — semua user bisa login ulang (developer only). */
  const handleClearAllActiveSessions = useCallback(async () => {
    await set(ref(database, ACTIVE_SESSION_PATH), null).catch((err) => {
      console.error("Gagal clear semua active session:", err);
      throw err;
    });
  }, []);

  const handleRegisterSession = useCallback(async (userId) => {
    if (!userId) return { ok: true };
    const sessionRef = ref(database, `${ACTIVE_SESSION_PATH}/${userId}`);
    const isDeveloper = userId === DEVELOPER_USER_ID;

    const attempt = async () => {
      const now = Date.now();
      const existing = (await get(sessionRef)).val();

      if (existing && existing.deviceId !== deviceIdRef.current) {
        if (!(isDeveloper && isDeveloperSessionStale(existing, now))) {
          return { ok: false, reason: "device_lain" };
        }
      }

      const payload = {
        sessionId: sessionIdRef.current,
        deviceId: deviceIdRef.current,
        loginAt:
          existing?.deviceId === deviceIdRef.current
            ? existing.loginAt || now
            : now,
      };
      if (isDeveloper) {
        payload.lastSeen = now;
      }

      await set(sessionRef, payload);
      return { ok: true };
    };

    for (let i = 0; i < 3; i++) {
      try {
        return await attempt();
      } catch (error) {
        const code = String(error?.code || "");
        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)));
          continue;
        }
        console.error("[LOGIN] Gagal register session:", error);
        if (code.includes("permission") || code.includes("PERMISSION")) {
          return { ok: false, reason: "permission" };
        }
        return { ok: false, reason: "error" };
      }
    }
    return { ok: false, reason: "error" };
  }, [deviceIdRef, sessionIdRef]);

  return useMemo(
    () => ({
      handleApelSessionChange,
      handleApelReasonChange,
      handleScan,
      handleScanSimulate,
      handleReset,
      handleResetMonth,
      handleResetPegawai,
      handleKoreksi,
      handlePengajuanSubmit,
      handlePengajuanVerifikasi,
      handleSaveFingerprint,
      handleSavePasswordOverride,
      handleClearActiveSession,
      handleClearAllActiveSessions,
      handleRegisterSession,
    }),
    [
      handleApelSessionChange,
      handleApelReasonChange,
      handleScan,
      handleScanSimulate,
      handleReset,
      handleResetMonth,
      handleResetPegawai,
      handleKoreksi,
      handlePengajuanSubmit,
      handlePengajuanVerifikasi,
      handleSaveFingerprint,
      handleSavePasswordOverride,
      handleClearActiveSession,
      handleClearAllActiveSessions,
      handleRegisterSession,
    ]
  );
}
