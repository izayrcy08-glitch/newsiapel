/** Format jam "HH:MM" — wajib titik dua agar lolos Firebase Rules. */
export const formatJamHadir = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
