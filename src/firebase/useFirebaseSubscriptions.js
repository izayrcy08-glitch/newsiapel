import { useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../firebase";
import {
  ATTENDANCE_ROOT,
  APEL_META_ROOT,
  APEL_SESSION_PATH,
  APEL_REASON_PATH,
  PENGAJUAN_PATH,
  RIWAYAT_PERUBAHAN_ROOT,
} from "../bersama/konstanta_aplikasi";
import {
  buildAttendanceDayPath,
  buildApelMetaDayPath,
  buildRiwayatDayPath,
} from "../bersama/util_tanggal";
import { getFirebaseSubscriptionTier } from "./get-subscription-tier";

/**
 * Pasang listener RTDB sesuai tier halaman aktif.
 */
export function useFirebaseSubscriptions(
  page,
  { monthKey, dayKey },
  {
    setAttendance,
    setMonthlyAttendance,
    setApelMeta,
    setApelSession,
    setApelReason,
    setApelReasonText,
    setPengajuan,
    setRiwayatPerubahan,
  }
) {
  const tier = getFirebaseSubscriptionTier(page);
  const attendanceDayPath = buildAttendanceDayPath(ATTENDANCE_ROOT, monthKey, dayKey);
  const riwayatDayPath = buildRiwayatDayPath(RIWAYAT_PERUBAHAN_ROOT, monthKey, dayKey);

  useEffect(() => {
    if (!tier.attendanceToday) {
      setAttendance({});
      return undefined;
    }
    const unsub = onValue(
      ref(database, attendanceDayPath),
      (snapshot) => setAttendance(snapshot.val() ?? {}),
      (error) => console.error("Gagal memuat data absensi:", error)
    );
    return () => unsub();
  }, [tier.attendanceToday, attendanceDayPath, setAttendance]);

  useEffect(() => {
    if (!tier.monthly) {
      setMonthlyAttendance({});
      return undefined;
    }
    const unsub = onValue(
      ref(database, `${ATTENDANCE_ROOT}/${monthKey}`),
      (snapshot) => setMonthlyAttendance(snapshot.val() || {}),
      (error) => console.error("Gagal memuat data absensi bulanan:", error)
    );
    return () => unsub();
  }, [tier.monthly, monthKey, setMonthlyAttendance]);

  useEffect(() => {
    if (!tier.apelMeta) {
      setApelMeta({});
      return undefined;
    }
    const unsub = onValue(
      ref(database, `${APEL_META_ROOT}/${monthKey}`),
      (snapshot) => setApelMeta(snapshot.val() || {}),
      (error) => console.error("Gagal memuat apelMeta:", error)
    );
    return () => unsub();
  }, [tier.apelMeta, monthKey, setApelMeta]);

  useEffect(() => {
    if (!tier.apelSession) return undefined;
    const unsubSession = onValue(ref(database, APEL_SESSION_PATH), (snapshot) => {
      const val = snapshot.val();
      if (val) setApelSession(val);
    });
    const unsubReason = onValue(ref(database, APEL_REASON_PATH), (snapshot) => {
      const val = snapshot.val();
      if (!val) return;
      if (typeof val === "object") {
        setApelReason(val.id || "lainnya");
        setApelReasonText(val.text || "");
      } else {
        setApelReason(val);
        setApelReasonText("");
      }
    });
    return () => {
      unsubSession();
      unsubReason();
    };
  }, [tier.apelSession, setApelSession, setApelReason, setApelReasonText]);

  useEffect(() => {
    if (!tier.pengajuan) {
      setPengajuan([]);
      return undefined;
    }
    const unsub = onValue(
      ref(database, PENGAJUAN_PATH),
      (snapshot) => {
        const val = snapshot.val();
        if (val === null) {
          setPengajuan([]);
        } else {
          setPengajuan(
            Object.entries(val).map(([id, data]) => ({ id, ...data }))
          );
        }
      },
      (error) => console.error("Gagal memuat data pengajuan:", error)
    );
    return () => unsub();
  }, [tier.pengajuan, setPengajuan]);

  useEffect(() => {
    if (!tier.riwayat) {
      setRiwayatPerubahan([]);
      return undefined;
    }
    const unsub = onValue(
      ref(database, riwayatDayPath),
      (snapshot) => {
        const val = snapshot.val();
        if (val === null) {
          setRiwayatPerubahan([]);
        } else {
          setRiwayatPerubahan(
            Object.entries(val).map(([id, data]) => ({ id, ...data }))
          );
        }
      },
      (error) => console.error("Gagal memuat riwayat perubahan:", error)
    );
    return () => unsub();
  }, [tier.riwayat, riwayatDayPath, setRiwayatPerubahan]);
}
