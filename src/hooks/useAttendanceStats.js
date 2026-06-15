import { useMemo } from "react";
import {
  calcAttendanceStats,
  getAttendanceStatItems,
  isApelDitiadakan,
} from "../fitur/absensi/logika_absensi";

/**
 * Menghitung statistik absensi + stat items untuk display.
 * Wrapper di atas calcAttendanceStats + getAttendanceStatItems.
 *
 * @param {object} attendance — data absensi dari Firebase
 * @param {string} apelStatus — fase apel
 * @param {Array} people — daftar pegawai dalam scope
 * @returns {{ stats: object, statItems: Array, isDitiadakan: boolean }}
 */
export function useAttendanceStats(attendance, apelStatus, people) {
  return useMemo(() => {
    const stats = calcAttendanceStats(attendance, apelStatus, people, {
      includeMissingAsUnrecorded: true,
    });

    const rawItems = getAttendanceStatItems(apelStatus);
    const statItems = rawItems.map((item) => ({
      ...item,
      value: stats[item.key],
    }));

    return {
      stats,
      statItems,
      isDitiadakan: isApelDitiadakan(apelStatus),
    };
  }, [attendance, apelStatus, people]);
}
