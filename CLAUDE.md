# SIAPEL — Panduan AI Agent

Sistem Informasi Apel Pegawai — Dinas PUPR Kab. Barito Utara.
Pilot project absensi apel pagi berbasis QR code.

> 📖 **Status proyek terkini → baca `CONTEXT.md`** (riwayat sesi, prioritas, arsitektur, data flow)

---

## Aturan Kerja AI Agent

1. **Sebelum coding** — jelaskan tujuan, dampak, risiko, dan file terdampak. Jika ambigu/kompleks, ajukan 3 pertanyaan klarifikasi sebelum menulis kode.
2. **Sebelum selesai** — jalankan `npm run build`, verifikasi error, laporkan hasil.
3. **Setiap tugas** — `git commit` untuk simpan state. Jika rusak, `git checkout .` (revert), jangan perbaiki di atas kerusakan.
4. **Jika instruksi bertentangan** dengan file ini, peringatkan sebelum lanjut.
5. **Komunikasi** — Bahasa Indonesia, sederhana, teknis, ringkas.
6. **Keamanan** — Developer bukan Admin. Admin bukan Auditor. Hormati role.
7. **Sederhana > Kompleks.** Stabilitas > Fitur. Data Valid > Tampilan.
8. **Update CONTEXT.md setiap selesai sesi** — tambah baris Riwayat Sesi, update Prioritas jika ada perubahan. Jangan tunda ke sesi berikutnya.
9. **Update SIAPEL_README.md jika relevan** — update otomatis saat: struktur folder berubah, Firebase path/setup berubah, env vars bertambah, alur pilot berubah, ada fitur baru selesai, atau update lain yang berguna untuk developer onboarding.

## Batasan Perubahan (Anti "Rumah Kartu")

1. **Max ±300 baris per file** — sinyal "harus dipecah". Jika lewat, AI WAJIB tanya: "mau saya pecah?"
2. **Sebelum ubah >3 file** — jelaskan dampak perubahan ("blast radius") sebelum eksekusi
3. **Jangan tambal (patch) — perbaiki akar masalah** — kalau ada utang teknis, lapor di akhir respons sebagai "⚠️ Catatan Teknis"
4. **Jika instruksi user bertentangan** dengan kualitas/keamanan — peringatkan, jangan diam

## UI/UX Checklist (Non-Negotiable)

- **Responsive:** mobile-first, test breakpoint sm/md/lg
- **State lengkap:** loading, empty, error, disabled — jangan cuma happy path
- **Accessibility dasar:** semantic HTML, alt text, aria-label untuk icon-only button
- **Animasi:** prefer `prefers-reduced-motion`, jangan blocking interaksi utama

## Kapan AI Harus Berhenti & Bertanya

WAJIB minta konfirmasi sebelum:
- Menghapus/mengubah skema Firebase yang sudah ada datanya
- Mengganti library inti (Firebase, React, Vite)
- Melakukan perubahan yang mempengaruhi >5 file sekaligus
- Menonaktifkan/melemahkan validasi keamanan demi "biar cepat jalan dulu"
