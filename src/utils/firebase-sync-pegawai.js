import { database } from '../firebase';
import { ref, set, get, child, update } from 'firebase/database';
import { resolvePegawaiLoginId } from './login-username';

export const MASTER_PEGAWAI_PATH = 'master_pegawai';

/** Bentuk record yang lolos validasi Firebase Rules master_pegawai. */
function buildFirebasePegawaiRecord(pegawai) {
  const record = {
    id: Number(pegawai.id),
    nama: String(pegawai.nama || '').trim(),
    nip: resolvePegawaiLoginId(pegawai),
    nik: String(pegawai.nik || ''),
    jabatan: String(pegawai.jabatan || ''),
    bidang: String(pegawai.bidang || ''),
    unit: String(pegawai.unit || ''),
    role: String(pegawai.role || 'EMPLOYEE'),
    password: String(pegawai.password || ''),
    isActive: pegawai.isActive !== undefined ? Boolean(pegawai.isActive) : true,
  };
  if (pegawai.phoneFingerprint) {
    record.phoneFingerprint = String(pegawai.phoneFingerprint);
  }
  return record;
}

export async function syncPegawaiToFirebase(pegawaiData) {
  if (!Array.isArray(pegawaiData)) {
    console.error('Invalid pegawaiData format');
    return false;
  }

  try {
    const updates = {};
    let skipped = 0;

    pegawaiData.forEach((pegawai) => {
      if (!pegawai?.id) return;
      const validation = validatePegawaiData(buildFirebasePegawaiRecord(pegawai));
      if (!validation.isValid) {
        skipped += 1;
        console.warn(
          `[Firebase] Skip sync pegawai id=${pegawai.id}:`,
          validation.errors.join(', ')
        );
        return;
      }
      const pegawaiId = String(pegawai.id);
      updates[`${MASTER_PEGAWAI_PATH}/${pegawaiId}`] = buildFirebasePegawaiRecord(pegawai);
    });

    const count = Object.keys(updates).length;
    if (count === 0) {
      console.warn('[Firebase] Tidak ada pegawai valid untuk disync');
      return false;
    }

    await update(ref(database), updates);
    console.log(
      `✅ [Firebase] Synced ${count} pegawai ke ${MASTER_PEGAWAI_PATH}` +
        (skipped ? ` (${skipped} dilewati — data tidak valid)` : '')
    );
    return true;
  } catch (error) {
    console.error('Error syncing pegawai to Firebase:', error);
    return false;
  }
}

export async function syncSinglePegawaiToFirebase(pegawai) {
  if (!pegawai?.id) {
    console.error('Invalid pegawai object');
    return false;
  }

  const record = buildFirebasePegawaiRecord(pegawai);
  const validation = validatePegawaiData(record);
  if (!validation.isValid) {
    console.error('[Firebase] Sync single pegawai gagal validasi:', validation.errors);
    return false;
  }

  try {
    await set(ref(database, `${MASTER_PEGAWAI_PATH}/${pegawai.id}`), record);
    return true;
  } catch (error) {
    console.error('Error syncing single pegawai to Firebase:', error);
    return false;
  }
}

export async function loadPegawaiFromFirebase() {
  try {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, MASTER_PEGAWAI_PATH));

    if (snapshot.exists()) {
      const data = snapshot.val();
      const pegawaiArray = Object.values(data).map((pegawai) => ({
        id: pegawai.id,
        nama: pegawai.nama || '',
        nip: pegawai.nip || '',
        nik: pegawai.nik || '',
        jabatan: pegawai.jabatan || '',
        bidang: pegawai.bidang || '',
        unit: pegawai.unit || '',
        role: pegawai.role || 'EMPLOYEE',
        password: pegawai.password || '',
        phoneFingerprint: pegawai.phoneFingerprint || null,
        isActive: pegawai.isActive !== undefined ? pegawai.isActive : true,
      }));

      return pegawaiArray.sort((a, b) => a.id - b.id);
    }

    return [];
  } catch (error) {
    console.error('Error loading pegawai from Firebase:', error);
    return [];
  }
}

export function validatePegawaiData(pegawai) {
  const errors = [];

  if (!pegawai.id || typeof pegawai.id !== 'number') {
    errors.push('ID must be a number');
  }

  if (!pegawai.nama || typeof pegawai.nama !== 'string' || pegawai.nama.trim().length === 0) {
    errors.push('Nama harus diisi');
  }

  if (!pegawai.nip || typeof pegawai.nip !== 'string' || pegawai.nip.trim().length === 0) {
    errors.push('NIP harus diisi');
  }

  if (typeof pegawai.nik !== 'string') {
    errors.push('NIK harus berupa string');
  }

  if (!pegawai.unit || typeof pegawai.unit !== 'string' || pegawai.unit.trim().length === 0) {
    errors.push('Unit/Bidang harus diisi');
  }

  if (!pegawai.password || typeof pegawai.password !== 'string' || pegawai.password.length < 4) {
    errors.push('Password minimal 4 karakter');
  }

  if (!['EMPLOYEE', 'UNIT_LEADER', 'EXECUTIVE', 'ADMIN', 'DEVELOPER'].includes(pegawai.role)) {
    errors.push('Role tidak valid');
  }

  if (typeof pegawai.isActive !== 'boolean') {
    errors.push('isActive harus boolean');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function normalizePegawaiData(pegawaiArray) {
  return pegawaiArray
    .map((pegawai) => ({
      id: Number(pegawai.id),
      nama: String(pegawai.nama || ''),
      nip: String(pegawai.nip || ''),
      nik: String(pegawai.nik || ''),
      jabatan: String(pegawai.jabatan || ''),
      bidang: String(pegawai.bidang || ''),
      unit: String(pegawai.unit || ''),
      role: String(pegawai.role || 'EMPLOYEE'),
      password: String(pegawai.password || ''),
      phoneFingerprint: pegawai.phoneFingerprint ? String(pegawai.phoneFingerprint) : null,
      isActive: Boolean(pegawai.isActive),
    }))
    .sort((a, b) => a.id - b.id);
}
