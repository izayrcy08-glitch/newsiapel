# RENCANA IMPLEMENTASI: PERUBAHAN DATA PEGAWAI BERSIFAT PERMANEN

## TUJUAN
Memastikan semua perubahan data pegawai (unit/bidang, password, dll) yang dilakukan admin/developer bersifat **PERMANEN** dan tidak bisa revert otomatis.

---

## ANALISIS MASALAH

### Penyebab Data Revert:
1. **localStorage tidak reliable**: Hard refresh, clear cache → data hilang
2. **Fallback ke JSON**: Jika localStorage kosong → data kembali ke pegawai_master.json awal
3. **No Firebase sync**: Data pegawai tidak disync ke Firebase (hanya password)
4. **No browser persistence**: Setiap browser punya copy data terpisah

### Status Saat Ini:
- ✅ Password disync ke Firebase: `/pegawai_passwords/{key}`
- ❌ Data pegawai master TIDAK disync ke Firebase
- ❌ Perubahan unit/bidang hanya disimpan di localStorage (tidak permanent)

---

## SOLUSI IMPLEMENTASI

### FASE 1: Setup Firebase Sync untuk Data Pegawai Master

#### 1.1 Update Firebase Rules
**File:** `firebase-rules.json`

Tambah path untuk master pegawai:
```json
{
  "rules": {
    "master_pegawai": {
      ".read": "root.child('adminUsers').child(auth.uid).exists()",
      ".write": "root.child('adminUsers').child(auth.uid).exists()",
      "$uid": {
        ".validate": "newData.hasChildren(['id', 'nama', 'nip', 'nik', 'jabatan', 'bidang', 'unit', 'role', 'password', 'isActive'])"
      }
    }
  }
}
```

#### 1.2 Buat Helper Function untuk Sync Data
**File Baru:** `src/utils/firebase-sync-pegawai.js`

Functions:
- `syncPegawaiToFirebase()` - Upload perubahan ke Firebase
- `loadPegawaiFromFirebase()` - Load data dari Firebase
- `mergePegawaiData()` - Merge local + remote data

#### 1.3 Update FirebaseDataContext
**File:** `src/contexts/FirebaseDataContext.jsx`

Add:
- Setup realtime listener untuk `/master_pegawai`
- Load pegawai data dari Firebase saat app startup
- Auto-sync ketika ada perubahan di `masterPegawaiData`

---

### FASE 2: Update SessionContext untuk Firebase Sync

#### 2.1 Modify CRUD Handlers
**File:** `src/contexts/SessionContext.jsx`

Update `handleAddPegawai`, `handleUpdatePegawai`, `handleDeletePegawai`:
```javascript
// Sebelum: hanya update state + localStorage
// Sesudah: update state + localStorage + Firebase sync
```

Flow:
1. Update state React (optimistic update)
2. Persist ke localStorage
3. Sync ke Firebase (async)
4. Rollback jika Firebase sync gagal

#### 2.2 Add Loading State untuk Firebase Sync
- Tampilkan loading indicator saat sync ke Firebase
- Show error message jika sync gagal
- Allow retry sync

---

### FASE 3: Update UI Pages

#### 3.1 Update PanelKelolaPegawai
**File:** `src/panels/PanelKelolaPegawai.jsx`

- Tampilkan field `unit` dan `bidang` (readonly, show current value)
- Add dropdown `ubahUnit` untuk change bidang
- Show sync status (loading, success, error) untuk setiap perubahan
- Add confirmation dialog sebelum perubahan unit

#### 3.2 Update Employee Detail Pages
**File:** Admin & Developer dashboard

- Tambah section untuk "Info Unit/Bidang" di employee detail
- Show current unit
- Add dropdown untuk change unit
- Show change history (tanggal, user, perubahan apa)

---

### FASE 4: Data Integrity & Validation

#### 4.1 Validation Rules
Sebelum sync ke Firebase:
- ✓ Check id, nama, nip tidak kosong
- ✓ Check unit valid (dari organization.json)
- ✓ Check bidang match dengan unit yang dipilih
- ✓ Check password format (6 digit)

#### 4.2 Conflict Resolution
Jika ada conflict (local ≠ Firebase):
- Firebase version is source of truth (server wins)
- Alert user tentang conflict
- Reload data dari Firebase
- Allow manual resolve

---

### FASE 5: Audit Log untuk Tracking Perubahan

#### 5.1 Create Audit Log Path di Firebase
```
/audit_logs/{timestamp}
  - pegawaiId
  - adminId (siapa yang change)
  - fieldChanged
  - oldValue
  - newValue
  - changedAt
  - syncedAt
```

#### 5.2 Log Setiap Perubahan
Di `handleUpdatePegawai`:
```javascript
// Log ke Firebase
logAuditChange({
  pegawaiId,
  adminId: currentUser.id,
  fieldChanged: Object.keys(updates),
  oldValue: pegawaiSebelum,
  newValue: pegawaiSesudah,
  changedAt: new Date()
})
```

---

## IMPLEMENTASI STEPS

### Step 1: Setup Firebase Sync Infrastructure
- [ ] Update firebase-rules.json
- [ ] Create `src/utils/firebase-sync-pegawai.js`
- [ ] Update FirebaseDataContext dengan Firebase listeners

### Step 2: Update Data Management
- [ ] Modify SessionContext CRUD handlers
- [ ] Add optimistic updates + rollback
- [ ] Add loading/error states

### Step 3: Update UI
- [ ] Update PanelKelolaPegawai untuk show unit + dropdown
- [ ] Update employee detail pages
- [ ] Add sync status indicator

### Step 4: Add Audit Logging
- [ ] Create audit log helper
- [ ] Log setiap perubahan ke Firebase
- [ ] Show change history di UI

### Step 5: Testing & Validation
- [ ] Test: Edit unit → reload browser → data permanent ✓
- [ ] Test: Edit password → reload browser → data permanent ✓
- [ ] Test: Hard refresh → data restore dari Firebase ✓
- [ ] Test: Multi-browser sync (edit di browser A, buka di browser B → sync) ✓

---

## PERKIRAAN WAKTU IMPLEMENTASI

| Phase | Tasks | Estimasi |
|-------|-------|----------|
| 1 | Firebase setup, helpers | 1-2 jam |
| 2 | SessionContext updates | 1-2 jam |
| 3 | UI updates | 2-3 jam |
| 4 | Audit logging | 1 jam |
| 5 | Testing & debugging | 2-3 jam |
| **TOTAL** | | **7-11 jam** |

---

## EXPECTED OUTCOMES

✅ Semua perubahan data pegawai (unit, password, dll) **PERMANENT**
✅ Tidak ada data revert otomatis (bahkan setelah hard refresh)
✅ Data tersync otomatis antar browser (multi-device)
✅ Audit trail lengkap untuk tracking perubahan
✅ Admin/Developer bisa manage pegawai dengan confidence

---

## RISKS & MITIGATION

| Risk | Mitigation |
|------|-----------|
| Firebase quota exceeded | Monitor usage, add daily limits |
| Sync conflict (local ≠ Firebase) | Server wins strategy, manual resolve UI |
| Data inconsistency | Validation rules, test coverage |
| Slow sync (network lag) | Optimistic updates, queue system |
| Browser offline | Queue changes, auto-retry when online |

---

## NOTES

- Data pegawai akan menjadi "source of truth" di Firebase, bukan JSON file
- localStorage tetap digunakan untuk offline-first experience
- Firebase adalah backup untuk disaster recovery
- Recommendation: Backup data pegawai secara berkala (harian/mingguan)
