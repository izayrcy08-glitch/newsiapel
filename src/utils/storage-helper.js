/**
 * Firebase Storage helper — lazy loading.
 * Storage SDK hanya di-load saat pertama kali dipanggil (dynamic import),
 * tidak ikut di bundle awal aplikasi.
 */
let _storage = null;

async function getStorageInstance() {
  if (_storage) return _storage;
  const { getStorage, getApp } = await import("firebase/storage");
  _storage = getStorage(getApp());
  return _storage;
}

/**
 * Upload file pengajuan ke Firebase Storage.
 * @param {string|number} pegawaiId
 * @param {File} file
 * @returns {{ downloadUrl: string, path: string }}
 */
export async function uploadPengajuanFile(pegawaiId, file) {
  const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
  const storage = await getStorageInstance();

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileRef = ref(storage, `pengajuan/${pegawaiId}/${timestamp}_${safeName}`);
  const snapshot = await uploadBytes(fileRef, file);
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return { downloadUrl, path: fileRef.fullPath };
}

/**
 * Hapus file dari Firebase Storage.
 * @param {string} path — fullPath dari fileRef
 */
export async function deleteStorageFile(path) {
  const { ref, deleteObject } = await import("firebase/storage");
  const storage = await getStorageInstance();
  return deleteObject(ref(storage, path));
}
