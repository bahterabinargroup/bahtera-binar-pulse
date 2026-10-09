# STATUS Proyek

_Terakhir diperbarui: 7 Oktober 2026 — Semua milestone M0–M6 selesai; tinggal uji akun asli & keputusan terbuka_

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
| M6 | Tayang (Vercel) | ✅ Tayang di https://daily-report-app-roan-seven.vercel.app; uji keamanan RLS 58/58 lulus + roles_config dibatasi (7 Okt); tinggal uji akun asli |

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

## M6 progres (7 Okt)
- Akun Vercel Hobby (tim "Bahtera Binar"); proyek `daily-report-app` terhubung lewat Vercel CLI (`.vercel/` di-ignore git). 3 env var Production diisi pemilik: 2 `NEXT_PUBLIC_*` bertipe Config, `SUPABASE_SECRET_KEY` bertipe Secret (aturan Vercel: NEXT_PUBLIC tidak boleh Secret).
- `.vercelignore` memakai jalur berawalan `/` (awal tanpa `/` ikut mengecualikan `src/lib/supabase`, deploy pertama gagal karenanya).
- Deploy produksi: `npx vercel@62.7.0 deploy --prod --yes` dari folder proyek. Alamat: https://daily-report-app-roan-seven.vercel.app
- Terverifikasi: /login 200, /cek-persiapan semua ✅ (kunci terbaca, database tersambung), /dev/* diarahkan ke login (mati di produksi).
- ⏳ Pemilik: Supabase > Authentication > URL Configuration: Site URL = alamat Vercel; Redirect URLs tambah `https://daily-report-app-roan-seven.vercel.app/**` (pertahankan localhost untuk pengembangan).
- Setelah itu: pengujian akhir brief bagian 7 di alamat sungguhan (butuh akun uji: 2 company, Owner, 1 Manager/company, 2 Employee/company termasuk RND). Pertimbangkan menutup `/cek-persiapan` untuk publik.

## Tambahan permintaan pemilik (7 Okt)
- Batas kirim email Supabase per jam tercapai saat mengundang banyak orang → `/owner/undangan` kini punya tombol "🔗 Salin link undangan" per undangan terbuka (`getInviteLink` di `owner/actions.ts`, Auth Admin `generateLink` type invite, hanya Owner, hanya undangan terbuka) + "Salin pesan siap kirim (WhatsApp)". Daftar dipisah: "Undangan menunggu" (di atas) dan "Sudah diklaim". Link berlaku sekali & terbatas waktu; link baru membatalkan link lama.
- Temuan 7 Okt: link yang ditempel ke WhatsApp "kedaluwarsa/sudah dipakai" sebelum diklik karena pratinjau link WhatsApp (dan pemindai email) membuka link Supabase sekali-pakai. Perbaikan: link yang dibagikan kini `/terima-undangan?token_hash=...` (halaman aplikasi, publik) dengan tombol "Lanjutkan & buat password"; `verifyOtp(type invite)` baru dijalankan saat tombol diklik (`acceptInvite` di `auth-actions.ts`). Masa berlaku token mengikuti Supabase (bawaan 1 jam; disarankan 24 jam: Authentication > Sign In / Providers > Email > Email OTP Expiration).

- Temuan 7 Okt (lanjutan): trigger `handle_auth_user_confirmed` membuat profil & menandai undangan "diklaim" saat email TERKONFIRMASI (link dibuka), bukan saat password dibuat. Akun yang link-nya dihabiskan pratinjau WhatsApp (Kevin, Indah, Berdikari Koffee, dll.) jadi "diklaim" tanpa password, dan link undangan tak bisa dibuat ulang (email sudah terdaftar). Perbaikan: bagian "Akun sudah terbentuk" di `/owner/undangan` menampilkan "Belum pernah masuk"/"Sudah pernah masuk" (admin `listUsers` → `last_sign_in_at`, hanya dibaca, hanya Owner) + tombol "Salin link atur password" (`getPasswordLink`: generateLink recovery → `/terima-undangan?token_hash=...&jenis=pemulihan` → verifyOtp recovery → /atur-password). Pilihan desain: tidak mengubah trigger database.

## Pengujian akhir (7 Okt)
- Uji ponsel di alamat Vercel: undangan → Buat password → Beranda karyawan (AM) berhasil.
- Data asli saat uji: 1 company (HOLDING = PT Bahtera Binar Abadi), 3 Owner (Admin, Masithoh Meita [RND], Raka), 2 karyawan (CC, AM), belum ada Manager.
- `supabase/tests/uji_keamanan.sql`: satu blok DO yang membuat company/akun REKAAN (2 company, Owner, 2 Manager, 4 karyawan, akun tanpa undangan), meniru tiap peran via `set local role authenticated` + klaim JWT, memeriksa ±58 skenario (brief bagian 7 poin 1–7 + aturan notulensi baru), lalu berakhir dengan `raise exception` agar semuanya dibatalkan otomatis. Hasil tampil sebagai pesan error berisi daftar LULUS/GAGAL.
- Temuan awal (INFO): akun tanpa undangan masih bisa membaca `roles_config` (daftar jabatan/template form) karena policy `using (true)` untuk authenticated — bukan data karyawan; tunggu keputusan pemilik.
- Belum diuji otomatis: poin 8 (kecocokan form dengan PDF — sudah dicek visual di M2) dan poin 9 (secret key tidak di browser/git — sudah dicek saat M5; ulangi pada build produksi).

## Dashboard utama tahap 1 (10 Okt 2026)
- Keputusan pemilik: (1) kepatuhan semua divisi + ADV dulu; (2) target/omset di spreadsheet mitra (link berganti tiap bulan), ADV mengisi di sana; (3) form tidak dibakukan, pelajari pola dulu; (4) Owner semua, Manager company-nya, karyawan angkanya sendiri. ADV tetap mengisi GMV/pesanan/ads di aplikasi (dua tempat). Sambungan live ke spreadsheet = tahap 2.
- Temuan spreadsheet mitra (lembar TRACKER ADV): laporan bulanan per bulan (Jan–Okt 2026): jumlah toko aktif, omset, rata-rata omset harian, budget, CAC TikTok (= budget ÷ omset) untuk semua toko dan per ADV (Alvian, Alam, Tian, Rina, Laras); baris Link berisi file per bulan. Lembar lain: DASHBOARD, Target, ALL ADV, lembar per ADV, ORDER/FO TIKTOK, INPUT MP, AFFILIATE, LIVE, VARIABEL, SheetLink — isinya belum terbaca (konektor hanya memberi lembar pertama); minta tangkapan layar lembar Target & ALL ADV untuk tahap 2.
- Dibangun: kolom kiri 6 kartu angka bergradasi gold→navy + grafik kepatuhan harian, kepatuhan per divisi, GMV vs ads harian, CAC harian, peringkat & porsi toko, checklist ADV, presensi; filter periode (Hari ini/7/30/Bulan ini) dan company (Owner). Karyawan: versi pribadi (riwayat pengisian per hari). Letak: Beranda, di bawah kartu hari ini dan di atas Tautan penting & menu. 18 uji hitungan lolos; 4 bentuk query tervalidasi terhadap API.

## Tautan penting (9 Okt 2026)
- Permintaan pemilik: inventaris link (tracker spreadsheet semua divisi, aset CC, dll.) di dashboard awal; Owner/Manager yang mengelola. Keputusan: visibilitas per company + per divisi, kategori tetap, Manager kelola semua link company-nya.
- Kode: `src/lib/links.ts`, `src/components/links/LinkGroups.tsx`, `src/app/(app)/tautan/{page,actions}.ts(x)`, bagian di Beranda, menu "Kelola Tautan", panduan diperbarui, `/dev/tautan` (pratinjau lokal). Skrip uji: bagian 16–17 di `supabase/tests/uji_keamanan.sql` — dijalankan pemilik 9 Okt: seluruh skrip 77 pemeriksaan, **0 GAGAL** (termasuk pemeriksaan tautan; diulang setelah migrasi 006 multi-divisi: tetap 0 GAGAL).
- Database: `supabase/005_tautan_penting.sql` (= bagian 15 schema). ✅ Dijalankan pemilik 9 Okt (Success). Sebelum itu Beranda tetap normal (bagian tautan disembunyikan) dan `/tautan` menampilkan pesan.

- Perubahan 9 Okt (permintaan pemilik): satu tautan bisa untuk BEBERAPA divisi → kolom `position_id` diganti `position_ids smallint[]` (kosong = semua divisi), form memakai kotak centang. Migrasi `supabase/006_tautan_banyak_divisi.sql` (link lama dipindahkan otomatis); bagian 15 schema sudah memuat bentuk akhir. ✅ 006 dijalankan pemilik & kode ditayangkan (9 Okt).

## Penyempurnaan kelompok A (8 Okt 2026)
- **Auto save laporan harian** (`ReportForm`): 3 detik setelah berhenti mengetik, hanya mode isi hari ini (bukan koreksi Owner), menunggu sampai format valid, satu permintaan per waktu. Catatan: laporan kini bisa terbentuk begitu mulai mengetik (dihitung "sudah mengisi" di kepatuhan seperti Simpan manual).
- **Isi otomatis dari laporan terakhir** (`extractPrefill` di `form-state.ts`, dipakai `laporan/page.tsx`): kolom header (Toko, Mentor, ADV/Tim) dan nama toko per kolom; angka/status/aktivitas tidak ikut. Diuji (10 kasus).
- **Beranda**: kartu Laporan hari ini (sudah/belum), Tugas saya (+lewat tenggat), Tim hari ini (belum mengisi; Manager/Owner), Permintaan hapus notulensi (Owner).
- **Bisa dipasang di ponsel**: `src/app/manifest.ts` (nama, warna, ikon 192/512/maskable di `public/icons/`), `manifest.webmanifest` dikecualikan dari proxy login. Tanpa mode offline.
- Panduan (`/panduan`) diperbarui.
- Belum dipilih pemilik: B (analisis Owner: CSV rata, ringkasan GMV), C (pantauan manajemen), D (notulensi).

## Status 8 Okt 2026 (sore)
- ✅ Uji dengan akun asli selesai (dikonfirmasi pemilik). ✅ Akun uji (Dummy, Dummy 2, dll.) sudah dibersihkan.
- Domain sendiri & SMTP: DITUNDA (keputusan pemilik) — pakai `bahterapulse.vercel.app` dulu.
- Fokus berikutnya (keputusan pemilik): memaksimalkan fitur yang sudah ada.

## Alamat aplikasi (8 Okt 2026)
- Alamat produksi sekarang **https://bahterapulse.vercel.app** (alias diganti di Vercel; alamat lama `daily-report-app-roan-seven.vercel.app` dialihkan ke sini). Nama proyek Vercel tetap `daily-report-app` (internal).
- ⏳ Pemilik: tambahkan `https://bahterapulse.vercel.app/**` ke Supabase > Authentication > URL Configuration > Redirect URLs, dan ganti Site URL ke `https://bahterapulse.vercel.app` (email undangan & lupa password memakai alamat ini; link WhatsApp lewat /terima-undangan tidak bergantung padanya).

## Poin 8 & 9 (8 Okt 2026)
- PDF notulensi kini berlogo (logo horizontal tertanam sebagai data URI di `src/lib/brand-logo.ts`, dipotong ruang kosongnya; perbarui file itu bila logo diganti), garis emas, dan kaki halaman "Bahtera Binar Pulse".
- `/cek-persiapan` tidak lagi publik: hanya Owner yang sudah login (dihapus dari PUBLIC_PATHS; `requireOwnerPage`).
- Keputusan domain: belum perlu untuk mulai; dikerjakan bersamaan dengan SMTP (email Indonesia, tanpa batas kirim) karena penyedia email butuh domain terverifikasi.

## Panduan pemakaian (8 Okt 2026)
- Halaman publik `/panduan` (`src/app/panduan/page.tsx`, tanpa login agar bisa dibagikan bersama link undangan) + kotak menu "Panduan" di Beranda untuk semua role. Isi: pertama kali masuk, laporan harian, riwayat, notulensi, tugas saya, dashboard Manager, panel Owner, FAQ. Teks saja (tangkapan layar otomatis tidak layak; tambahkan nanti dari ponsel sungguhan bila perlu).

## Nama aplikasi & form ADV (7 Okt 2026)
- Nama aplikasi resmi: **Bahtera Binar Pulse** (judul tab, halaman Masuk/undangan, pesan WhatsApp undangan, README, template email cadangan). Judul form harian per jabatan (mis. "DAILY REPORT DIGITAL ADV - TERA DIGILAB") TIDAK diubah karena meniru PDF. Nama proyek Vercel/folder (`daily-report-app`) tetap internal.
- Form ADV: baris "Penjualan (pesanan / GMV)" dipecah jadi **"Jumlah pesanan"** dan **"GMV (nilai penjualan)"** (keduanya angka, wajib). Perubahan di data `roles_config.form_template` (bukan skema): `supabase/004_form_adv_pecah_penjualan.sql` (= seed ADV di bagian 7 schema). ✅ Dijalankan pemilik & form ADV terverifikasi cocok (7 Okt). Isian "Penjualan" teks lama pada laporan yang sudah tersimpan tidak hilang di database, tetapi tidak tampil lagi dan terbuang bila laporan diedit ulang.

## Penerapan brand (7 Okt 2026)
- Logo, warna navy/gold, font Lora diterapkan (lihat CLAUDE.md bagian Brand): halaman Masuk/Lupa/Atur password (logo vertikal + garis emas), header aplikasi (logo horizontal + garis emas + nama/jabatan/role), ikon tab & ponsel, judul tab "Daily Report · Bahtera Binar Group", tombol & tabel navy. Form harian tetap Arial & warna per jabatan.
- Belum: logo di PDF notulensi; domain sendiri; email undangan berbahasa Indonesia (butuh SMTP).

## HASIL PENGUJIAN AKHIR (7 Okt 2026)
- `supabase/tests/uji_keamanan.sql`: **58 pemeriksaan, 0 GAGAL**. Mencakup brief bagian 7 poin 1–7 dan aturan notulensi (visibilitas, draft→submit→terkunci, hapus dengan persetujuan Owner, PIC, peserta/PIC lintas company, nama tak bisa dipalsukan, akun tanpa undangan, kenaikan role, penghapusan laporan).
- Poin 9 (secret key tidak di browser/git/log): git tidak melacak .env.local; nilai kunci rahasia tidak ada di riwayat git, file terlacak, bundel browser lokal, maupun JS produksi Vercel; admin.ts tidak diimpor komponen client. Log Vercel belum diperiksa (aplikasi tidak mencetak kunci).
- Poin 8 (form = PDF): dicek visual saat M2 (desktop & ponsel).
- ✅ Temuan INFO (akun tanpa undangan bisa membaca `roles_config`) ditutup: `supabase/003_batasi_roles_config.sql` (= bagian 14 schema) dijalankan pemilik 7 Okt; uji ulang: 0 GAGAL, baris 06 kini LULUS (terbaca=0).
- Belum: uji akun asli (Manager Septian/Berdikari, karyawan Indah/Kevin) setelah mereka membuat password.

## Berikutnya
- Uji akun asli (Manager Septian/Berdikari, karyawan Indah/Kevin) setelah mereka membuat password.
- Keputusan terbuka brief bagian 9 (opsi Status, kolom ke-4 SPV, format Penjualan/Konten, nama/logo/warna, domain sendiri, SMTP sendiri untuk email berbahasa Indonesia & tanpa batas kirim).
- (Arsip) M6 Tayang (Vercel) + pengujian akhir bagian 7 (setelah pemilik setuju).

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
