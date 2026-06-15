import { useState, useEffect } from "react";
import { getGreeting, formatTime, formatTimeShort } from "../bersama/util_waktu_dan_apel";

/**
 * Memberikan current time yang diupdate tiap interval, plus utilitas waktu.
 * Menggantikan pola `useState(now) + setInterval` yang terduplikasi di 3 dashboard.
 */
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  return {
    now,
    greeting: getGreeting(),
    timeStr: formatTime(now),
    timeStrShort: formatTimeShort(now),
    /** Format: "Senin, 25 Mei 2026" */
    dateStr: `${hari[now.getDay()]}, ${now.getDate()} ${bulan[now.getMonth()]} ${now.getFullYear()}`,
    /** Format: "07:28:43" */
    timeWIB: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`,
    formatTime: (d) => formatTime(d),
    formatTimeShort: (d) => formatTimeShort(d),
  };
}
