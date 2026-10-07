# STATUS Proyek

_Terakhir diperbarui: 7 Oktober 2026 — M5 selesai, M6 dimulai_

## Milestone
| | Tahap | Status |
|---|---|---|
| M0 | Persiapan | ✅ Selesai (6 Okt 2026) |
| M1 | Login dan profil | ✅ Selesai (6 Okt 2026) |
| M2 | Laporan hari ini (form per jabatan) | ✅ Selesai (6 Okt 2026); uji "terkunci besok" menyusul |
| M3 | Riwayat laporan saya | ✅ Selesai (6 Okt 2026) |
| M3b | Notulensi Meeting | 🟡 Kode selesai; menunggu uji pemilik |
| M4 | Dashboard Manager/SPV dan Owner | 🟡 Kode selesai; menunggu uji pemilik |
| M5 | Panel Owner | ✅ Selesai (7 Okt 2026): undangan terkirim, link → Buat password, status Diklaim, muncul di Pengguna |
| M6 | Tayang (Vercel) | 🟡 Dimulai; menunggu keputusan hosting & domain |

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

## Sudah selesai (M2, kode)
- Keenam PDF di `referensi-form/` sudah dilihat dan dicocokkan (6 Okt).
- `src/lib/report/template.ts`: tipe form_template. `src/lib/report/form-state.ts`: FormState <-> kolom daily_reports, validasi (angka gaya Indonesia "1.500.000"/"Rp", link boleh tanpa https), penanda wajib, konversi simpan.
- `src/components/report/FormRenderer.tsx`: SATU renderer generik semua jabatan (tema warna dari template, SPV polos, tabel → kartu di ponsel, chip Status "?", baris tetap, matrix Toko 1/2, label_rows, bukti).
- `src/components/report/ReportForm.tsx`: status simpan, tombol Simpan menempel di bawah, peringatan saat menutup halaman sebelum simpan, mode terkunci (teks tetap ada & bisa disalin), mode pratinjau.
- `src/app/(app)/laporan/page.tsx` + `actions.ts` (`saveReport`): insert/update; cek tanggal WIB; 0 baris ter-update = terkunci; 23505 = laporan hari ini sudah ada (pesan jelas). Jabatan diambil dari laporan yang sudah ada (snapshot) atau profil.
- `/laporan/pratinjau` (khusus Owner): lihat form tiap jabatan tanpa menyimpan. Ditambah ke menu Owner.
- `/dev/pratinjau/[KODE]`: HANYA saat `npm run dev`, tanpa login, template dibaca langsung dari schema SQL — untuk mencocokkan tampilan dengan PDF.
- Uji logika (30 kasus, skrip sementara) lolos. Tampilan desktop & ponsel keenam form sudah dicek terhadap PDF.

## Uji & keputusan pemilik (M2)
- ✅ Simpan laporan sungguhan berhasil (akun rakaghani.business@gmail.com diberi jabatan ADV, role tetap owner).
- Keputusan 6 Okt: Status "Belum" TETAP boleh disimpan, tampil merah dan dihitung "Belum lengkap" (`NEGATIVE_STATUS` di `form-state.ts`).
- Keputusan 6 Okt: nama toko (Toko 1, dan Toko 2 bila dipakai) wajib → penanda "Belum lengkap" (di kode `missingRequired`, bukan di template database).
- Ditambahkan tombol "← Kembali ke Beranda" di semua halaman (permintaan pemilik).
- ⏳ Sisa uji: validasi angka (ketik `abc` di Ads spent), muat ulang halaman, dan besok: laporan kemarin terkunci.

## Sudah selesai (M3, kode)
- `/riwayat`: laporan milik sendiri, terbaru dulu, 30 per halaman (Lebih baru/Lebih lama). Lencana "Hari ini · bisa diedit" atau "🔒 Terkunci".
- `/riwayat/[id]`: detail hanya-baca memakai ReportForm `mode="view"` (renderer sama; tanpa tombol, penanda, atau placeholder). Query dibatasi `user_id` = pengguna login → laporan orang lain = 404 (RLS juga menolak). Tombol "Edit laporan hari ini" hanya untuk laporan hari ini (menuju /laporan).
- Template diambil dari jabatan saat laporan dibuat (`daily_reports.position_id`).
- Pratinjau lokal hanya-baca: `/dev/pratinjau/ADV?mode=view`.

## M3b Notulensi — keputusan & persiapan
- Keputusan pemilik 6 Okt (lihat CLAUDE.md bagian Notulensi): hanya Owner/Manager(company-nya)/pembuat yang melihat; draft→submit terkunci; auto save; lokasi Kantor 1/Kantor 2/Online; permintaan hapus perlu persetujuan Owner; PIC karyawan lewat "Tugas saya"; Download PDF.
- ✅ `supabase/002_notulensi_submit_dan_hapus.sql` (= bagian 13 schema) sudah dijalankan pemilik (4 kolom baru terverifikasi).

## Sudah selesai (M3b, kode)
- `src/lib/meetings.ts` (tipe, form↔DB, validasi, diff baris anak agar status PIC tak tertimpa), `src/lib/meetings-server.ts` (loadMeeting, loadPeople, loadCompaniesForOwner).
- `src/app/(app)/notulensi/actions.ts`: saveMeeting (insert/update + peserta/tindak lanjut; hasil parsial dikembalikan agar tak ganda), submitMeeting, updateActionStatus, requestDeletion/cancelDeletion (RPC), deleteMeeting (Owner).
- `src/components/meetings/MeetingEditor.tsx`: form + AUTO SAVE 2,5 detik setelah berhenti mengetik (mulai setelah judul diisi), tombol Simpan & Submit (konfirmasi), Owner pilih company saat membuat. Halaman `/notulensi/baru`, `/notulensi/[id]/edit` (yang tak berhak → dialihkan ke detail).
- `/notulensi`: daftar + cari judul, rentang tanggal, status (draft/submit/permintaan hapus), filter company (Owner), jumlah tindak lanjut terbuka.
- `/notulensi/[id]`: detail baca; tombol Lanjutkan menulis/Koreksi (Owner), Download PDF, Ajukan hapus (+alasan)/Batalkan, Owner: Setujui hapus/Tolak/Hapus. Status tindak lanjut bisa diubah langsung (PIC/pembuat-draft/Owner).
- `/notulensi/[id]/pdf`: unduh PDF (@react-pdf/renderer, MIT, gratis) — data via sesi pengguna (RLS).
- `/tugas` (Tugas saya): RPC get_my_action_items, lewat tenggat merah, ubah status langsung, opsi tampilkan yang selesai.
- Menu: Notulensi & Tugas Saya untuk semua role.
- Pratinjau lokal tanpa login: `/dev/notulensi` (form), `/dev/pdf` (contoh PDF). Auto save terbukti berjalan (ditolak karena tak login, sesuai harapan).

## Sudah selesai (M4, kode)
- `/dashboard` (Owner & Manager; karyawan dialihkan ke Beranda): pilih tanggal (maks. hari ini, tombol Kemarin/Besok/Hari ini), filter company khusus Owner. Isi: angka Laporan masuk / Belum mengisi, daftar `get_missing_reports`, daftar laporan masuk (daily_reports, RLS), tabel kepatuhan minggu dari tanggal terpilih (`get_weekly_report_compliance`, Senin–Sabtu) dengan % berwarna dan tanggal bolong.
- `/dashboard/laporan/[id]`: detail laporan anggota, hanya baca (ReportForm mode view), label Terkunci.
- Helper tanggal: `mondayOf`, `addDays`, `formatTanggalPendek` di `src/lib/date.ts`.
- Relasi embed (users/roles_config/companies) terverifikasi lewat API (tidak ada PGRST200/201).

## Sudah selesai (M5, kode)
- Keputusan pemilik 6 Okt: email undangan dikirim OTOMATIS dari aplikasi (Supabase Auth Admin API) → disetujui memakai secret key, HANYA di server.
  - `src/lib/supabase/admin.ts` (`import "server-only"`), env `SUPABASE_SECRET_KEY` (tanpa NEXT_PUBLIC_). Setiap pemakaian didahului `requireOwnerAction()` (`src/lib/owner.ts`, profil via getUser + RLS).
  - Dicek: kunci tidak ada di `.next/static` maupun di git (hanya kode pustaka yang memeriksa awalan `sb_secret_`).
- Link undangan → `/login#access_token...&type=invite` → EmailLinkHandler → `/atur-password?jenis=undangan` (judul "Buat password", tanpa perlu Lupa password).
- Server actions Owner: `src/app/(app)/owner/actions.ts` (saveCompany, setCompanyActive, createInvite [insert user_invites lalu kirim email], resendInvite, cancelInvite, updateUser [tak bisa menurunkan/menonaktifkan diri sendiri]).
- Halaman: `/owner/company` (tambah, ubah, nonaktifkan), `/owner/undangan` (form + daftar terbuka/diklaim, kirim ulang, batalkan), `/owner/pengguna` (role, jabatan, aktif; filter company), `/owner/tarikan` (+ `/owner/tarikan/unduh?format=csv|json`, CSV UTF-8 BOM untuk Excel).
- Koreksi laporan lampau: tombol "Koreksi (Owner)" di `/dashboard/laporan/[id]` → ReportForm `mode="correct"` → `correctReport`.

## Menunggu pemilik (M5)
1. Isi `SUPABASE_SECRET_KEY` di `.env.local` (Project Settings > API Keys > Secret keys).
2. Uji: company baru, undangan ke alamat Gmail "+" (mis. nama+karyawan1@gmail.com), klik link → Buat password, pengguna, koreksi, tarikan.

## M6 Tayang — keputusan pemilik (7 Okt)
- Hosting: Vercel **Hobby (gratis)**, dipilih pemilik dengan sadar bahwa syaratnya non-komersial (risiko akun ditutup; bisa naik ke Pro tanpa mengubah aplikasi). Alamat: bawaan `*.vercel.app` dulu; domain sendiri nanti.
- Rencana: deploy via Vercel CLI dari folder lokal (tanpa GitHub). Pemilik: daftar Vercel + `npx vercel login`; env var diisi pemilik sendiri di dashboard Vercel (3 nilai dari .env.local; secret key TIDAK lewat chat). Lalu Supabase > URL Configuration: tambahkan alamat Vercel (Site URL + Redirect URLs). Lalu pengujian akhir brief bagian 7 di alamat sungguhan.
- Rute `/dev/*` mati di produksi (NODE_ENV). Build produksi lolos.

## Berikutnya
- M6 Tayang (Vercel) + pengujian akhir bagian 7 (setelah pemilik setuju).

## Masalah / catatan terbuka
- Email undangan & reset password berbahasa Inggris (template bawaan). Bisa diubah ke bahasa Indonesia jika SMTP sendiri dipasang — keputusan pemilik.
- Layanan email bawaan Supabase dibatasi beberapa email per jam (cukup untuk uji). Untuk banyak karyawan nanti perlu SMTP sendiri (mungkin berbayar → tanya pemilik dulu). Saat M6, Site URL & template diganti ke alamat Vercel.
- 2 akun Owner (Admin Bahtera Binar Abadi, Raka Ghani Irsyadi Binar) — disengaja, dikonfirmasi pemilik 6 Okt.
- ✅ **Hak akses tabel — sudah diperbaiki 6 Okt.** Hasil cek: `authenticated` tidak punya SELECT/INSERT di tabel mana pun; `anon` punya TRUNCATE. Perbaikan: `supabase/001_hak_akses.sql` (juga bagian 12 file skema). Tanpa login, Supabase menjawab "permission denied" (kode 42501), bukan 0 baris. Artinya proyek Supabase ini tidak otomatis memberi hak akses tabel ke peran `anon`. Itu aman. Yang perlu dipastikan: apakah peran `authenticated` (pengguna yang sudah login) diberi hak SELECT/INSERT. File SQL tidak memberikannya secara eksplisit karena mengandalkan bawaan Supabase. Kalau ternyata tidak ada, perlu tambahan GRANT. Itu perubahan database, jadi harus seizin pemilik.
- ✅ Keputusan terbuka notulensi sudah dijawab 6 Okt (Manager tidak edit milik orang lain; hapus lewat permintaan + persetujuan Owner; tidak ada notulensi lintas company selain Owner).
- Bagian 8 file SQL menyebut "daftar dengan email tsb di aplikasi", tetapi pendaftaran publik dimatikan. Untuk Owner pertama dipakai Supabase dashboard > Add user (Auto Confirm) — trigger tetap membuat profil.
- Keputusan terbuka dari brief bagian 9 (opsi Status, kolom ke-4 SPV, field wajib, format Penjualan/Konten, nama/logo/warna, domain, batas edit) — tanyakan saat relevan.
- PDF di `referensi-form/` belum dilihat; wajib dilihat sebelum M2.

## Cara menjalankan di komputer
```
cd ~/Desktop/daily-report-app
npm run dev
```
Lalu buka http://localhost:3000 (halaman cek koneksi: http://localhost:3000/cek-persiapan)
