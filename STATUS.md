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

## Target omzet (10 Okt 2026)
- Klarifikasi pemilik: target omzet ditetapkan Owner di aplikasi; spreadsheet mitra hanya proyeksi. Keputusan: target per ADV (+total company otomatis), bulanan dengan target harian = bulan ÷ hari kerja, realisasi = GMV form ADV.
- Kode: `src/lib/target.ts` (15 uji lolos), `/target` (Atur Target, Owner: isi per ADV, salin bulan lalu), dashboard: kartu "Omzet hari ini" & "Omzet bulan ini", grafik kumulatif vs target, pencapaian per ADV, petunjuk bagi Owner bila target kosong. Skrip uji bagian 18–19 ditambahkan.
- Database: `supabase/007_target_omzet.sql` (= bagian 16 schema). ✅ Dijalankan pemilik 10 Okt (Success). Uji keamanan diulang: 87 pemeriksaan (termasuk bagian 18–19 target), **0 GAGAL**. Berikutnya: Owner mengisi target Oktober di Atur Target.
- Tahap 2 (nanti): proyeksi omzet dari spreadsheet mitra dapat ditampilkan berdampingan.

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

## Presensi harian (Check-In / Check-Out) — mulai 11 Okt 2026
Keputusan pemilik: presensi dicatat lewat fitur/form baru ini; kolom "presensi mandiri" di form harian TETAP hanya sebagai pengingat (bukan pencatatan). "Departemen" = jabatan. Lokasi & foto hanya tercatat (tanpa tolak berdasarkan jarak). Status: WFO Bahtera, WFO Depkes, WFO Redigma, Tugas Luar, Izin, Sakit (catatan wajib untuk Tugas Luar/Izin/Sakit). Check-Out wajib foto. Foto dikompres di ponsel (<200 KB), disimpan di bucket privat `presensi`.
- Tahap: P1 database + bucket + uji (✅ selesai 11 Okt: 008 dijalankan, uji keamanan 0 GAGAL, bagian 20–23 lulus semua) → P2 halaman Check-In (✅ kode selesai 11 Okt, belum ditayangkan/diuji pemilik) → P3 Check-Out (✅ kode selesai 11 Okt, belum ditayangkan; P2 sudah tayang) → P4 rekap Owner/Manager.
- P1: `supabase/008_presensi.sql` (= bagian 17 schema) dan uji keamanan bagian 20–23 di `supabase/tests/uji_keamanan.sql` (dijalankan 11 Okt, 0 GAGAL).
- P2: menu "Presensi" (`/presensi`), `src/app/(app)/presensi/{page,actions}`, `src/components/presensi/CheckInForm.tsx`, `src/lib/presensi.ts`, `src/lib/image-compress.ts` (kompres foto pakai canvas, tanpa pustaka tambahan; target <200 KB). Foto diunggah dari browser langsung ke bucket `presensi`; GPS diminta otomatis, tidak memblokir bila gagal.
- P3: `CheckOutForm.tsx` + aksi `checkOut` (foto selfie wajib, kamera depan di ponsel, GPS terbaru, jam pulang dari server, sekali saja). Izin/Sakit tidak diminta Check-Out. Komponen bersama: `useGps.ts`, `GpsBox.tsx`, `PhotoField.tsx`.
- Revisi 11 Okt (masukan pemilik): WFO tanpa foto; Izin/Sakit foto opsional + Check-Out otomatis; Tugas Luar foto bukti WAJIB ("Bukti diminta tugas luar"); form Check-Out dibuat lebih jelas (area foto besar, 2 langkah). Database: `supabase/009_presensi_izin_tugas_luar.sql` (✅ dijalankan pemilik 11 Okt; juga sudah di 008/schema bagian 17) + 4 uji baru di bagian 20. Uji keamanan penuh setelah 009: **0 GAGAL** (bagian 20–23 presensi lulus). Revisi sudah TAYANG. Berikutnya: P4 rekap Owner/Manager.
- Revisi 2 (11 Okt): status WFO disatukan jadi "WFO" (tanpa tempat) → `supabase/010_presensi_wfo_satu.sql` (✅ dijalankan pemilik 11 Okt; juga di 008/schema; uji keamanan penuh 0 GAGAL). P4 ✅ TAYANG: `/presensi/rekap` (Owner semua company + filter, Manager company-nya): kartu hitung, tabel status/jam/peta/foto, daftar belum Check-In; menu "Rekap Presensi". Presensi harian P1–P4 selesai.
- Tambahan 11 Okt: kartu "Presensi hari ini" (pribadi, karyawan/manager) dan "Presensi tim hari ini" (Owner/Manager) di Beranda; unduh CSV bulanan di `/presensi/rekap` (`/presensi/rekap/unduh`, sel diberi tanda ' bila diawali = + - @). Belum dilakukan: kolom "presensi mandiri" dihitung otomatis (menunggu keputusan pemilik).
- Poin "Daftar Undangan Pending + Salin Link" sudah ada di Owner → Undangan (`InviteLinkButton`); tidak dibangun ulang.

## Cara menjalankan di komputer
```
cd ~/Desktop/daily-report-app
npm run dev
```
Lalu buka http://localhost:3000 (halaman cek koneksi: http://localhost:3000/cek-persiapan)

## Dashboard disederhanakan — 11 Okt 2026
Keputusan pemilik: dashboard hanya Owner/Manager, hanya data semua divisi (kepatuhan laporan, presensi dari tabel `presensi`, kendala, tugas lewat tenggat); proyeksi spreadsheet ditunda; bagian ADV/target disembunyikan (kode tetap). Poin "presensi mandiri" = opsi A (angka presensi dari data Check-In; kolom form dibiarkan). `/dev/dashboard` dihapus. Detail di CLAUDE.md.

## Cuti / Izin + laporan gugur — mulai 14 Okt 2026
Keputusan pemilik: (1) Izin, Sakit, dan Cuti membuat daily report GUGUR (tidak wajib lapor, tidak dihitung tidak patuh; Tugas Luar tetap wajib). (2) Pengajuan cuti/izin jauh hari: jenis (cuti/izin), tanggal mulai-selesai, alasan; disetujui/ditolak oleh Owner, atau Manager untuk pengajuan KARYAWAN di company-nya (pengajuan Manager hanya Owner; tidak boleh memutuskan milik sendiri); catatan keputusan; pemohon bisa membatalkan. (3) Disetujui = di hari itu Check-In ditolak, rekap tertulis Cuti/Izin; hari Minggu tidak dihitung.
- Tahap: K1 database (✅ dijalankan pemilik 14 Okt): `supabase/011_cuti_izin.sql` (= bagian 18 schema; tabel `leave_requests`, fungsi `decide_leave`/`cancel_leave`/`leave_on`/`excused_kind`, `get_missing_reports` & `get_weekly_report_compliance` mengabaikan yang gugur, Check-In ditolak saat cuti) + uji bagian 24–27. → K2 halaman pengajuan & persetujuan → K3 sambungan ke presensi/laporan/dashboard/rekap → K4 perbarui dokumen panduan.
- Tambahan 14 Okt: PEMBATALAN cuti/izin yang sudah disetujui — karyawan mengajukan pembatalan (alasan wajib), diputuskan atasan dengan aturan sama; selama menunggu cuti tetap berlaku; disetujui: belum mulai → batal, sudah berjalan → dipotong sampai kemarin; ditolak → tetap berlaku, boleh ajukan lagi. Yang masih "menunggu" tetap bisa dibatalkan langsung. Database: `supabase/012_pembatalan_cuti.sql` (= bagian 19 schema; ✅ dijalankan 14 Okt) + uji bagian 28. Uji keamanan penuh bagian 1–28: **0 GAGAL**. UI-nya masuk K2.
- K2 + K3 ✅ kode selesai 15 Okt (belum ditayangkan): halaman `/cuti` dan `/cuti/persetujuan`, menu, kartu Beranda, Presensi (kartu "Hari ini Anda cuti"), Laporan (banner gugur), Rekap Presensi + CSV (baris cuti/izin), dashboard (gugur dikeluarkan dari hitungan; komposisi ada "Cuti"), Panduan. Berikutnya: K4 perbarui dokumen panduan (Google Docs) setelah pemilik mencoba.
- K4 ✅ 15 Okt: keempat dokumen panduan (Claude Docs) diperbarui dengan bagian cuti/izin dan laporan gugur. Fitur cuti/izin sudah TAYANG dan dicoba pemilik ("sudah cocok").

## Role Lead — mulai 15 Okt 2026
Keputusan pemilik: urutan wewenang Owner > Manager > Lead > Karyawan. Mentor (ADV MH) = Lead berjabatan ADV MH; anak Magang Hub = karyawan biasa; boleh >1 Lead per divisi. Lead HANYA MELIHAT laporan, presensi (lokasi+foto), cuti/izin, dan daftar belum mengisi milik KARYAWAN BIASA berjabatan sama di company sama (bukan Manager, sesama Lead, divisi/company lain); tidak menyetujui cuti; tetap wajib lapor/presensi sendiri; Manager boleh memutuskan cuti Lead.
- Tahap: L1 database (✅ 013 dan 014 dijalankan 15 Okt; uji bagian 29–32 lulus setelah satu koreksi skrip uji): `supabase/013_role_lead.sql` (jalankan DULU, hanya menambah nilai role) lalu `014_wewenang_lead.sql` (= bagian 20 schema; Lead punya `users.lead_position_ids` = divisi tambahan yang dipantau, diatur Owner; mis. Lead ADV memantau ADV MH) + uji bagian 29–32 → L2 aplikasi (✅ kode selesai 15 Okt, belum ditayangkan) (menu/halaman untuk Lead, pilihan role "Lead" di Undangan & Pengguna, Dashboard Tim dan Rekap Presensi terbatas divisi) → L3 dokumen panduan.

## Kuota cuti/izin — 16 Okt 2026
Keputusan pemilik: maksimal 2 pengajuan cuti/izin per bulan; yang ke-3 ditolak dengan peringatan "kuota pengajuan telah habis". Aturan saya: cuti+izin digabung, bulan menurut tanggal mulai, hanya pending/approved dihitung (ditolak/dibatalkan mengembalikan kuota), Izin/Sakit lewat Check-In tidak dihitung. Database: `supabase/015_kuota_cuti.sql` (✅ dijalankan 16 Okt; juga sudah di 011/schema bagian 18) + uji bagian 33. UI: `/cuti` menampilkan sisa kuota, peringatan merah, dan tombol Kirim nonaktif bila habis (✅ TAYANG). Uji keamanan penuh bagian 1–33: **0 GAGAL**.
- L3 ✅ 16 Okt: dokumen panduan (Claude Docs) diperbarui: peran Lead (Owner/Manager dan presensi), kuota 2 pengajuan per bulan di keempat dokumen. Role Lead sudah TAYANG.

## Kalender cuti tim — 16 Okt 2026
Halaman `/cuti/kalender` (menu "Kalender Cuti" untuk Owner/Manager/Lead): kalender sebulan (Senin–Minggu) berisi nama yang cuti/izin tiap tanggal (disetujui solid, menunggu bergaris putus), navigasi bulan, filter company untuk Owner, dan daftar pengajuan bulan itu. Tanpa perubahan database (memakai RLS yang ada). Kode ✅, belum ditayangkan.

## Pantauan Kendala & Daftar Tindak Lanjut — 17 Okt 2026
Dibuat: `/pantauan` (kendala+insight semua divisi, filter, ringkasan per divisi, CSV, tanda sudah ditangani) dan `/tindak-lanjut` (semua tugas notulensi untuk Owner/Manager), menu, tab Tindak lanjut di Notulensi/Tugas, dua kartu Beranda untuk pengelola, bagian Panduan. Database: `supabase/016_tindak_lanjut_kendala.sql` (tabel `report_followups` + RPC; = bagian 21 schema; ✅ dijalankan 17 Okt) + uji bagian 34. Kode ✅ TAYANG. Uji keamanan penuh bagian 1–34: **0 GAGAL**.

## Perbaikan kolom link di form harian — 17 Okt 2026
Masukan pemilik: kolom Keterangan/Link (mis. "Upload konten apa & ke akun mana", "Brief Konten, QC, Upload") hanya satu baris dan link tidak bisa diklik. Sekarang kolom bertipe link dan keterangan checklist berbentuk kotak banyak baris (Enter = baris baru; beberapa link, satu per baris), dan link yang valid tampil sebagai tautan yang bisa diklik (juga di laporan yang dibuka hanya-baca). Link bukti umum (Bukti SPV) tetap satu link per kolom tetapi juga bisa diklik. Kode: `src/components/report/FormRenderer.tsx` (`LinkChips`), `src/lib/report/form-state.ts` (`splitLinks`, `normalizeLinks`). Tanpa perubahan database. Kode ✅, belum ditayangkan.

## Owner membuat notulensi di company lain — 17 Okt 2026
Bug: Owner yang memilih company lain di form Notulensi Baru gagal simpan (`meetings_creator_company_fk` mewajibkan pembuat se-company). Keputusan pemilik: pilihan A, Owner boleh membuat notulensi untuk company mana pun. Database: `supabase/017_owner_notulensi_semua_company.sql` (= bagian 22 schema; ganti FK dengan FK pembuat biasa + pemicu "pembuat se-company kecuali Owner"; ✅ dijalankan 17 Okt) + uji bagian 35. Tanpa perubahan kode aplikasi. Pemicu menolak lebih dulu (23503) sebelum aturan akses (42501); uji disesuaikan, hasil tetap ditolak.

## Peserta melihat notulensi — 17 Okt 2026
Masukan pemilik: peserta yang disebut di notulensi harus bisa melihatnya di akunnya (kasus: Alfian membuat, Alam peserta tidak bisa membuka). Keputusan: peserta (yang punya akun, bukan tamu) melihat notulensi SETELAH Submit, hanya melihat (tidak mengubah/menambah peserta/menghapus), termasuk daftar peserta dan tindak lanjutnya. Menggantikan aturan 6 Okt "karyawan hanya melihat buatannya". Database: `supabase/018_peserta_lihat_notulensi.sql` (= bagian 23 schema; ✅ dijalankan 17 Okt) + uji bagian 36. Tanpa perubahan kode aplikasi selain teks Panduan (⏳ teks Panduan belum ditayangkan). Uji keamanan penuh bagian 1–36: **0 GAGAL**.

## Sidebar navigasi dua tingkat — 20 Okt 2026
Permintaan pemilik: sidebar dengan folder yang bisa dibuka/ditutup (Laporan, Kehadiran, Meeting, Kinerja Tim, Pusat Informasi, Administrasi) di bawah satu link "Beranda". Menu yang tampil memakai aturan akses MENU yang sudah ada (tidak ada aturan baru; keamanan tetap di database); menu terlarang dan folder tanpa menu terlihat disembunyikan; folder berisi halaman aktif otomatis terbuka; penanda angka: pengajuan cuti/izin menunggu (Persetujuan Cuti/Izin; untuk Manager hanya karyawan dan Lead) dan tugas lewat tenggat (Tugas Saya; folder tertutup menampilkan total). Di ponsel: tombol menu di header membuka panel geser. Penyesuaian di luar daftar pemilik: menu "Cuti / Izin" (pengajuan karyawan) ditambahkan ke folder Kehadiran karena tanpa itu karyawan tidak punya jalan ke pengajuan cuti; tombol "Kembali ke Beranda" disembunyikan di layar lebar (sudah ada di sidebar); lebar bingkai diperlebar untuk sidebar, isi halaman tetap maks. lebar sebelumnya. Kode: `src/lib/menu.ts`, `src/lib/nav-badges.ts`, `src/components/nav/`, `src/app/(app)/layout.tsx`. Tanpa perubahan database. Kode ✅, belum ditayangkan.
- Penyempurnaan tampilan sidebar (20 Okt, permintaan pemilik "buat jadi full" seperti contoh Facebook): kepala halaman menempel di atas dan selebar layar (satu baris: logo, nama/jabatan/role, Keluar), sidebar menempel di tepi kiri setinggi layar (tetap saat halaman digulir), isi halaman memenuhi sisanya (dipusatkan, lebar maks. `max-w-6xl`). Kode: `src/components/nav/AppShell.tsx` (dipakai `src/app/(app)/layout.tsx`). Kode ✅, belum ditayangkan.
- Tautan penting di Beranda: 3 kolom di layar lebar (`xl`), 2 kolom di layar sedang, 1 kolom di ponsel (`LinkGroups.tsx`). Kode ✅, belum ditayangkan.

## Desain ulang tahap 1 — 26 Okt 2026 (skill ui-ux-pro-max)
Masukan pemilik: tampilan terasa jelek dan membingungkan. Yang dipilih pemilik: masalah = Beranda terlalu penuh + menu ganda; huruf = Lora hanya untuk judul, huruf polos (Inter) untuk isi; Beranda = fokus tindakan hari ini. Dikerjakan: (1) huruf: judul h1–h4 Lora, sisanya Inter (`layout.tsx`, `globals.css`); form laporan harian tetap Arial; (2) Beranda disusun ulang: dua kartu aksi besar (Presensi, Laporan) dengan keadaan jelas dan satu tombol ajakan, lalu blok "Perlu perhatian Anda" berisi hanya yang butuh tindakan (merah → kuning → biru, dengan angka), dashboard dan Tautan penting tetap; (3) kartu daftar menu di Beranda dihapus (sudah ada di sidebar); (4) ikon SVG menggantikan emoji di sidebar dan area foto. Palet yang disarankan skill (teal) TIDAK dipakai: brand navy #012C4E dan emas #C4A251 tetap. Kode: `src/components/home/HomeBlocks.tsx`, `src/app/(app)/page.tsx`. Tanpa perubahan database. Kode ✅, belum ditayangkan. Tahap berikutnya (menunggu persetujuan): seragamkan halaman tabel/daftar/form (Rekap, Pantauan, Cuti, Notulensi, Pengguna), ukuran huruf dan kontras, emoji tersisa.

## Diagnosa "sisa memori sedikit" di ponsel karyawan — 27 Okt 2026
Laporan: salah satu karyawan (Android, Chrome dengan 22 tab terbuka) melihat pesan sistem "Tidak dapat menyelesaikan operasi sebelumnya karena sisa memori sedikit" di halaman Presensi (Check-Out). Pesan itu dari sistem Android, bukan aplikasi. Penyebab utama: RAM ponsel hampir habis (banyak tab + kamera). Faktor dari aplikasi: pengecilan foto membuka foto kamera PENUH (50–200 megapiksel = ratusan MB) di memori. Perbaikan: foto dikecilkan saat dibaca (`createImageBitmap(... resizeWidth: 1600)`) di `src/lib/image-compress.ts`, dengan cadangan untuk peramban lama. Kode ✅, belum ditayangkan.

## Ringkasan Presensi per karyawan — 4 Nov 2026
Permintaan pemilik: tarik data absensi karyawan: waktu Check-In, Check-Out, lama di kantor, dan hitungan status (WFO, Tugas Luar, Izin, Sakit, Cuti). Dibuat halaman `/presensi/ringkasan` (Owner semua company + filter, Manager company-nya, Lead divisinya; hanya melihat) dan unduhan CSV `/presensi/ringkasan/unduh`: per karyawan sebulan = hari WFO/Tugas Luar/Izin/Sakit/Cuti, rata-rata jam masuk dan pulang (WIB), total dan rata-rata lama di kantor, jumlah hari lupa Check-Out. Aturan hitung: lama di kantor = selisih Check-In–Check-Out hanya pada hari WFO yang sudah Check-Out; Izin/Cuti termasuk yang disetujui lewat menu Cuti/Izin (hari yang sudah punya presensi tidak dihitung ganda, Minggu tidak dihitung, dihitung sampai hari ini); hari ini tidak dihitung "lupa Check-Out". CSV harian bulanan (`/presensi/rekap/unduh`) ditambah kolom "Lama di kantor (menit)". Menu "Ringkasan Presensi" di folder Kehadiran + tautan dari Rekap Presensi. Kode: `src/lib/presensi-ringkasan.ts`, `src/app/(app)/presensi/ringkasan/`. Tanpa perubahan database. Kode ✅ (tsc + eslint bersih), belum diuji dengan data nyata dan belum ditayangkan.
- Rincian per tanggal (4 Nov, lanjutan permintaan pemilik): di Ringkasan Presensi, klik nama karyawan → tabel tiap tanggal (status, jam masuk, jam pulang, lama di kantor) dengan baris Rata-rata di bawahnya. Tombol "Unduh per tanggal (CSV)" = semua karyawan, satu baris per tanggal + baris RATA-RATA per karyawan. Cuti/izin disetujui tampil sebagai baris tanpa jam. Kode ✅ (tsc + eslint bersih), belum diuji data nyata, belum ditayangkan.
- Insight kedisiplinan (4 Nov, permintaan pemilik): Ringkasan Presensi menampilkan dua kotak di atas tabel — "Tanpa keterangan" (hari kerja Senin–Sabtu sejak akun dibuat sampai KEMARIN tanpa presensi dan tanpa cuti/izin disetujui) dan "Tidak Check-Out" (WFO/Tugas Luar sudah Check-In tapi tidak Check-Out, hari ini belum dihitung) — berisi nama, jumlah hari, dan tanggalnya, urut terbanyak; kolom "Tanpa keterangan" di tabel; baris "Tanpa keterangan" di rincian per tanggal; kolom baru di kedua CSV. Keterbatasan: hari libur nasional belum dikenali sistem (tanggal merah ikut terhitung tanpa keterangan). Kode ✅ (tsc + eslint bersih), belum diuji data nyata, belum ditayangkan.

## Hari Libur — 4 Nov 2026
Keputusan pemilik: tambahkan hari libur (tanggal merah/libur kantor) supaya tidak terhitung "tanpa keterangan". Dibuat: tabel `holidays` (satu daftar untuk SEMUA company; dibaca semua pengguna login, tambah/hapus hanya Owner; tidak ada ubah — salah = hapus lalu tambah) di `supabase/019_hari_libur.sql` (= bagian 24 schema) + uji bagian 37; halaman Owner `/libur` (menu Administrasi → Hari Libur: tambah, daftar per tahun, hapus); Ringkasan Presensi tidak lagi menghitung tanggal libur sebagai "tanpa keterangan" (dan menampilkan daftar libur bulan itu). Ringkasan tetap jalan bila 019 belum dijalankan (dianggap tanpa hari libur). ✅ 019 dijalankan pemilik 4 Nov; uji keamanan penuh bagian 1–37: **0 GAGAL**. Belum memengaruhi: dashboard kepatuhan laporan dan `get_missing_reports` (hari libur masih dihitung wajib lapor di sana) — usulan lanjutan bila pemilik mau.

## Kalkulator Budget Iklan — 10 Nov 2026
Permintaan pemilik: kalkulator pengajuan budget ADV (dari percakapan Claude sebelumnya) masuk ke Bahtera Binar Pulse; tampil untuk jabatan ADV, SPV, dan Owner. Dibuat halaman `/budget` (folder baru "Iklan" di sidebar). Akses menurut JABATAN (bukan role): menu punya field `positions` di `src/lib/menu.ts` (`BUDGET_POSITIONS` = ADV, ADV_MH, SPV; Owner selalu); halaman juga menolak jabatan lain. ADV_MH ditambahkan atas permintaan pemilik (10 Nov); Manager dan Lead non-ADV tidak melihatnya.
- Isian: nama ADV (terisi dari profil), toko, cap harian, tanggal mulai (selesai otomatis hari Minggu), spesial event (cap event otomatis 2×; tanggal harus di dalam periode), target CAC pribadi, hasil pengajuan sebelumnya (tanggal, budget, omset; CAC otomatis; tanggal selesai > mulai, dan sebelum tanggal mulai budget), dana cadangan (Rendah 5% / Sedang 10% / Tinggi 20%, wajib alasan, dikunci bila CAC sebelumnya > 30%, ada saran bila ada event). PPN 11% otomatis.
- Penyesuaian rahasia fase bulan (push +9,2–10,9%, steady −6,1–7,7%, angka tidak bulat tapi stabil) dihitung di SERVER (`src/lib/budget-hitung.ts`, `server-only`, lewat server action `hitungPengajuan`), jadi tidak terbaca di browser ADV. Tidak ada tulisan soal ini di layar.
- Teks WhatsApp "Salin ringkasan" aktif hanya bila semua isian wajib lengkap; formatnya sama dengan yang dibaca script tracker Google Sheets (baris "ADV:", "Budget iklan:", "Total diajukan (netto):", dst.).
- Kode: `src/lib/budget.ts` (aturan + teks), `src/components/budget/BudgetCalculator.tsx`, `src/app/(app)/budget/`. Tanpa perubahan database. Kode ✅ (tsc, eslint, build bersih; hitungan diuji dengan angka contoh), BELUM dilihat di browser dengan akun asli dan belum ditayangkan. Daftar toko masih ketik bebas (belum ada daftar toko resmi).
