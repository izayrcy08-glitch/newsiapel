import { database } from '../firebase';
import { ref, set, get, child, update } from 'firebase/database';

export const MASTER_PEGAWAI_PATH = 'master_pegawai';

export async function syncPegawaiToFirebase(pegawaiData) {
  if (!Array.isArray(pegawaiData)) {
    console.error('Invalid pegawaiData format');
    return false;
  }

  try {
    const updates = {};
    
    pegawaiData.forEach((pegawai) => {
      if (pegawai && pegawai.id) {
        const pegawaiId = String(pegawai.id);
        updates[`${MASTER_PEGAWAI_PATH}/${pegawaiId}`] = {
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
          isActive: pegawai.isActive !== undefined ? pegawai.isActive : true
        };
      }
    });

    await update(ref(database), updates);
    return true;
  } catch (error) {
    console.error('Error syncing pegawai to Firebase:', error);
    return false;
  }
}

export async function syncSinglePegawaiToFirebase(pegawai) {
  if (!pegawai || !pegawai.id) {
    console.error('Invalid pegawai object');
    return false;
  }

  try {
    const pegawaiRef = ref(database, `${MASTER_PEGAWAI_PATH}/${pegawai.id}`);
    const pegawaiData = {
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
      isActive: pegawai.isActive !== undefined ? pegawai.isActive : true
    };

    await set(pegawaiRef, pegawaiData);
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
        isActive: pegawai.isActive !== undefined ? pegawai.isActive : true
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

  if (!pegawai.nik || typeof pegawai.nik !== 'string') {
    errors.push('NIK harus diisi');
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
    errors
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
      isActive: Boolean(pegawai.isActive)
    }))
    .sort((a, b) => a.id - b.id);
}
