# SECURE DATA SOURCING — SIAPEL

**Status:** Penting untuk production. File `src/data/pegawai_master.json` berisi password plaintext dan harus dijaga keamanannya.

---

## ⚠️ Masalah Keamanan (Password Plaintext)

File `pegawai_master.json` sekarang **sudah di-exclude dari git** (.gitignore updated).

### Asal Masalah:
- Password 6 digit disimpan plaintext di JSON
- Sebelumnya: ada di git history (risk selamanya)
- Akibat: siapa saja dengan akses repo bisa lihat semua password

---

## ✅ Cara Sourcing Aman (Post-Production)

### Untuk Developer/QA (Local Development)

1. **Minta dari admin/security team** via:
   - ✅ Encrypted email attachment
   - ✅ Password-protected ZIP
   - ✅ Secure file share (Google Drive/OneDrive private)
   - ✅ **JANGAN:** Slack, email biasa, GitHub, public link

2. **Simpan local saja:**
   ```bash
   # File ada di: src/data/pegawai_master.json
   # JANGAN commit ke git
   # JANGAN share ke orang lain
   # DESTROY setelah development selesai
   ```

3. **Rebuild app:**
   ```bash
   npm run build
   npm run dev
   ```

### Untuk Production Deploy

1. **Admin/DevOps team:**
   - Jangan store file di git
   - Store di **secure vault** (AWS Secrets Manager / HashiCorp Vault)
   - Deploy via CI/CD secret injection
   - File di-download saat build → app bundled

2. **Contoh GitHub Actions:**
   ```yaml
   - name: Restore pegawai_master.json
     env:
       PEGAWAI_JSON: ${{ secrets.PEGAWAI_MASTER_JSON }}
     run: |
       echo "$PEGAWAI_JSON" > src/data/pegawai_master.json
   ```

3. **Vercel (jika pakai):**
   - Upload `pegawai_master.json` via Vercel Web UI → Project Settings → Code
   - Deploy → File auto-inject ke build folder
   - (Or use environment variable + parse di build script)

---

## 🔄 Password Reset (Required)

Semua password saat ini sudah di-expose di git history. **Action required:**

1. **Generate password baru** untuk semua 302 pegawai
2. **Update di Firebase** (`/pegawai_passwords` path)
3. **DeveloperConsole** → Kelola Pegawai → Set new password per person
4. **Notify semua user** → password reset

---

## 🛡️ Best Practice Checklist

- [ ] `src/data/pegawai_master.json` di `.gitignore`
- [ ] Git history cleaned (old passwords removed) — `git filter-branch` atau `git-filter-repo`
- [ ] All passwords rotated (generate 302 new passwords)
- [ ] Firebase Rules `auth !== null` untuk semua path
- [ ] Password Overrides di Firebase prioritized (bukan JSON)
- [ ] CI/CD configured untuk secret injection
- [ ] Team training: **never commit sensitive data**

---

## 📞 Contacts

- **Data security issue?** → Contact DevSecOps team
- **Lost pegawai_master.json?** → Request from admin (encrypted)
- **Deploy process unclear?** → Refer to CI/CD documentation

---

Last Updated: 2026-07-06
