/** Lookup record absensi — Firebase key bisa string atau number. */
export const getAttendanceRecord = (attendance = {}, pegawaiId) => {
  if (!attendance || pegawaiId == null) return null;
  const raw = String(pegawaiId);
  const numeric = parseInt(raw, 10);
  return (
    attendance[pegawaiId] ??
    attendance[raw] ??
    (!Number.isNaN(numeric) ? attendance[numeric] : null) ??
    null
  );
};

/** Key Firebase untuk path attendance/{id}. */
export const resolveAttendancePegawaiId = (pegawaiId) => {
  const raw = String(pegawaiId);
  const numeric = parseInt(raw, 10);
  if (!Number.isNaN(numeric)) return numeric;
  return raw;
};
