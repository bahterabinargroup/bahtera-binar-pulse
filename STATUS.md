# STATUS Proyek

_Terakhir diperbarui: 6 Oktober 2026 — M1 dibangun, menunggu uji pemilik_

## Milestone
| | Tahap | Status |
|---|---|---|
| M0 | Persiapan | ✅ Selesai (6 Okt 2026) |
| M1 | Login dan profil | 🟡 Kode selesai; menunggu pemilik mengatur Supabase & menguji |
| M2 | Laporan hari ini (form per jabatan) | ⬜ Belum |
| M3 | Riwayat laporan saya | ⬜ Belum |
| M3b | Notulensi Meeting (setelah M2) | ⬜ Belum — tabel database sudah terpasang |
| M4 | Dashboard Manager/SPV dan Owner | ⬜ Belum |
| M5 | Panel Owner | ⬜ Belum |
| M6 | Tayang (Vercel) | ⬜ Belum |

## Sudah selesai (M0)
- Node.js dipasang di Mac (via Homebrew).
- Proyek Next.js 16 + TypeScript + Tailwind dibuat; paket `@supabase/supabase-js` dan `@supabase/ssr` terpasang.
- `.env.example` (template kunci publik). `.env.local` diabaikan git.
- Helper Supabase: `src/lib/supabase/client.ts` (browser), `server.ts` (server), `env.ts`.
- Halaman sementara `/` = "Cek Persiapan": memeriksa kunci di `.env.local`, koneksi, dan apakah skema sudah dijalankan.
- `CLAUDE.md` (ringkasan aturan) dan `STATUS.md`. Git diinisialisasi.

## Langkah Supabase oleh pemilik (M0) — semua selesai
1. ✅ Buat proyek Supabase (region Singapore).
2. ✅ Jalankan `schema_daily_report.sql` di SQL Editor (menurut pemilik, termasuk bagian 11 Notulensi).
3. ✅ Isi `.env.local` dengan URL + publishable key. Halaman Cek Persiapan semua ✅ (5 Okt).
4. ✅ Matikan pendaftaran publik (Authentication > Sign In / Providers).
5. ✅ Bootstrap Owner (2 akun owner terdaftar: Admin Bahtera Binar Abadi, Raka Ghani Irsyadi Binar): company HOLDING + undangan Owner + buat user Owner (Add user, Auto Confirm).
6. ✅ Halaman Cek Persiapan semua centang hijau.
7. ✅ `supabase/001_hak_akses.sql` dijalankan; hasil cek hak akses sesuai (anon tanpa hak; authenticated sesuai rencana).

## Berikutnya
- Menunggu kata "lanjut" dari pemilik untuk M1.
- M1: login, atur password, lupa password, proxy penyegar sesi, tampilan profil & menu per role, pesan akun tanpa profil.

## Masalah / catatan terbuka
- Layanan email bawaan Supabase dibatasi beberapa email per jam (cukup untuk uji). Untuk banyak karyawan nanti perlu SMTP sendiri (mungkin berbayar → tanya pemilik dulu). Saat M6, Site URL & template diganti ke alamat Vercel.
- 2 akun Owner (Admin Bahtera Binar Abadi, Raka Ghani Irsyadi Binar) — disengaja, dikonfirmasi pemilik 6 Okt.
- ✅ **Hak akses tabel — sudah diperbaiki 6 Okt.** Hasil cek: `authenticated` tidak punya SELECT/INSERT di tabel mana pun; `anon` punya TRUNCATE. Perbaikan: `supabase/001_hak_akses.sql` (juga bagian 12 file skema). Tanpa login, Supabase menjawab "permission denied" (kode 42501), bukan 0 baris. Artinya proyek Supabase ini tidak otomatis memberi hak akses tabel ke peran `anon`. Itu aman. Yang perlu dipastikan: apakah peran `authenticated` (pengguna yang sudah login) diberi hak SELECT/INSERT. File SQL tidak memberikannya secara eksplisit karena mengandalkan bawaan Supabase. Kalau ternyata tidak ada, perlu tambahan GRANT. Itu perubahan database, jadi harus seizin pemilik.
- Keputusan terbuka notulensi (tanyakan saat M3b): Manager boleh edit notulensi anggota timnya? Pembuat boleh hapus notulensinya sendiri? Manager boleh buat notulensi lintas company?
- Bagian 8 file SQL menyebut "daftar dengan email tsb di aplikasi", tetapi pendaftaran publik dimatikan. Untuk Owner pertama dipakai Supabase dashboard > Add user (Auto Confirm) — trigger tetap membuat profil.
- Keputusan terbuka dari brief bagian 9 (opsi Status, kolom ke-4 SPV, field wajib, format Penjualan/Konten, nama/logo/warna, domain, batas edit) — tanyakan saat relevan.
- PDF di `referensi-form/` belum dilihat; wajib dilihat sebelum M2.

## Cara menjalankan di komputer
```
cd ~/Desktop/daily-report-app
npm run dev
```
Lalu buka http://localhost:3000 (halaman cek koneksi: http://localhost:3000/cek-persiapan)
