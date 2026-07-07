const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Konversi waktu lokal browser ke representasi WIB (UTC+7). */
export const getWibNow = () => {
  const now = new Date();
  return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + WIB_OFFSET_MS);
};

export const getMonthKey = (date = getWibNow()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

export const getDayKey = (date = getWibNow()) => {
  return String(date.getDate()).padStart(2, "0");
};

export const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

export const buildAttendanceDayPath = (root, monthKey, dayKey) =>
  `${root}/${monthKey}/${dayKey}`;

export const buildApelMetaDayPath = (root, monthKey, dayKey) =>
  `${root}/${monthKey}/${dayKey}`;
