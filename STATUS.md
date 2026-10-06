# STATUS Proyek

_Terakhir diperbarui: 6 Oktober 2026 — M1 selesai, M2 dimulai_

## Milestone
| | Tahap | Status |
|---|---|---|
| M0 | Persiapan | ✅ Selesai (6 Okt 2026) |
| M1 | Login dan profil | ✅ Selesai (6 Okt 2026) |
| M2 | Laporan hari ini (form per jabatan) | 🟡 Sedang dikerjakan |
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
- Halaman sementara "Cek Persiapan" (kini `/cek-persiapan`): memeriksa kunci di `.env.local`, koneksi, dan apakah skema sudah dijalankan.
- `CLAUDE.md` (ringkasan aturan) dan `STATUS.md`. Git diinisialisasi.

## Langkah Supabase oleh pemilik (M0) — semua selesai
1. ✅ Buat proyek Supabase (region Singapore).
2. ✅ Jalankan `schema_daily_report.sql` di SQL Editor (menurut pemilik, termasuk bagian 11 Notulensi).
3. ✅ Isi `.env.local` dengan URL + publishable key. Halaman Cek Persiapan semua ✅ (5 Okt).
4. ✅ Matikan pendaftaran publik (Authentication > Sign In / Providers).
5. ✅ Bootstrap Owner (2 akun owner terdaftar: Admin Bahtera Binar Abadi, Raka Ghani Irsyadi Binar): company HOLDING + undangan Owner + buat user Owner (Add user, Auto Confirm).
6. ✅ Halaman Cek Persiapan semua centang hijau.
7. ✅ `supabase/001_hak_akses.sql` dijalankan; hasil cek hak akses sesuai (anon tanpa hak; authenticated sesuai rencana).

## Sudah selesai (M1, kode)
- `src/proxy.ts` + `src/lib/supabase/proxy.ts`: menyegarkan sesi; yang belum login diarahkan ke `/login?next=...`. Halaman publik: /login, /lupa-password, /auth/*, /cek-persiapan.
- `/login`, `/lupa-password` (pesan sama untuk email terdaftar/tidak), `/atur-password` (min. 8 karakter, diulang), `/auth/confirm` (token_hash/code → sesi; gagal → `/login?error=tautan`).
- Server actions: `src/app/auth-actions.ts`. Pesan error Indonesia: `src/lib/auth-errors.ts`.
- `src/app/(app)/layout.tsx`: kepala halaman (nama, jabatan · company, role, Keluar). Tanpa profil → "Akun Anda belum terdaftar. Hubungi admin."
- Beranda `src/app/(app)/page.tsx`: menu per role dari `src/lib/menu.ts` (semua "Segera hadir"; set `ready: true` saat halamannya dibangun).
- Halaman cek koneksi dipindah ke `/cek-persiapan`.
- Template email Supabase TIDAK bisa diubah tanpa SMTP sendiri (paket Free), jadi aplikasi menangani tautan bawaan:
  - Undangan dari dashboard & lupa password (alur implicit) → tautan `#access_token=...&type=invite|recovery` → `src/components/EmailLinkHandler.tsx` (root layout) menyimpan sesi lalu membuka `/atur-password`. Bisa dibuka di browser/HP mana pun. Error di `#` → `/login?error=tautan`.
  - Template Indonesia di `supabase/email-templates/` disimpan untuk nanti jika SMTP sendiri dipasang.
- Tombol mata (tampilkan/sembunyikan password) di halaman Masuk dan Atur password: `src/components/PasswordInput.tsx` (permintaan pemilik).
- Teruji otomatis: pengalihan ke login, tautan palsu/kedaluwarsa → pesan jelas, `next=//evil.com` diabaikan. Login sungguhan diuji pemilik (Claude tidak mengetik password).

## Uji pemilik (M1) — selesai
1. ✅ URL Configuration: Site URL `http://localhost:3000`, Redirect URLs `http://localhost:3000/**`.
2. ✅ Lupa password → atur password → masuk sebagai Owner (Admin Bahtera Binar Abadi) berhasil (6 Okt).
3. ✅ Akun tanpa undangan (uji-tanpa-undangan@example.com) → hanya melihat pesan terkunci. Akun uji ini boleh dihapus pemilik dari Supabase > Users.

## Berikutnya
- M2 (setelah pemilik setuju): form Laporan Hari Ini. WAJIB lihat PDF di `referensi-form/` dulu.

## Masalah / catatan terbuka
- Email undangan & reset password berbahasa Inggris (template bawaan). Bisa diubah ke bahasa Indonesia jika SMTP sendiri dipasang — keputusan pemilik.
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
