# Brief Aplikasi: Daily Report Holding

Dokumen ini adalah spesifikasi untuk Claude Code. Baca seluruhnya sebelum mulai bekerja, dan baca juga `schema_daily_report.sql` di folder yang sama.

## 1. Tujuan

Aplikasi web tempat karyawan mengisi laporan harian, manager/SPV melihat laporan timnya, dan Owner melihat seluruh holding serta menarik data mingguan untuk dianalisis.

Database dan aturan keamanannya sudah selesai di `schema_daily_report.sql` (Supabase / PostgreSQL). Tugasmu adalah membangun aplikasi web di atas database itu.

## 2. Cara bekerja dengan pemilik (WAJIB)

Pemilik proyek bukan programmer.

- Jelaskan dalam bahasa Indonesia sederhana. Setiap istilah teknis diberi penjelasan satu kalimat.
- Kerjakan per tahap kecil (lihat bagian 6). Setiap selesai satu tahap, jelaskan apa yang dibuat, cara mencobanya (klik apa), dan apa yang seharusnya terlihat.
- Tanyakan dulu sebelum: mengubah skema database, menghapus file atau data, memasang layanan berbayar, atau mengubah keputusan di brief ini.
- Jangan pernah meminta pemilik menempelkan kunci rahasia ke chat. Minta pemilik mengisinya sendiri di file `.env.local`, dan tunjukkan caranya langkah demi langkah.
- Simpan kemajuan dengan git (commit kecil dengan pesan yang jelas).
- Setelah tiap tahap, perbarui `STATUS.md`: yang sudah selesai, yang berikutnya, masalah terbuka. Tujuannya agar sesi berikutnya bisa lanjut tanpa mengulang.
- Buat file `CLAUDE.md` berisi ringkasan aturan penting dari brief ini (bagian 2, 3, 4, 5, dan 5a).
- Enam PDF contoh form dari pemilik berada di folder `referensi-form/`. Itu acuan VISUAL wajib untuk semua form (lihat bagian 5a). Buka dan lihat PDF-nya, jangan hanya membaca teksnya.

## 3. Teknologi (keputusan awal)

- Next.js (App Router) + TypeScript + Tailwind CSS.
- Supabase: Auth dan PostgreSQL lewat `@supabase/supabase-js` dan `@supabase/ssr`.
- Hosting: Vercel.
- Tampilan mobile-first (karyawan kemungkinan besar mengisi dari ponsel).
- Bahasa antarmuka: Indonesia. Zona waktu: Asia/Jakarta (WIB).
- Jika ada alasan kuat memilih teknologi lain, jelaskan dengan bahasa sederhana dan minta persetujuan dulu.

## 4. Database (sudah ada, jangan diubah tanpa izin)

Sumber kebenaran: `schema_daily_report.sql`.

| Objek | Fungsi |
|---|---|
| `companies` | Holding dan anak usaha (hierarki lewat `parent_id`) |
| `roles_config` | Jabatan: SPV, ADV, ADV_MH, CC, AM, RND. `form_template` (JSON) mendefinisikan bentuk, isi, dan warna form laporan tiap jabatan; spesifikasi strukturnya ada di komentar bagian 7 file SQL |
| `users` | Profil karyawan (1:1 dengan akun Supabase Auth). `role` = hak akses, `position_id` = jabatan |
| `daily_reports` | Laporan harian: `activities` (array baris aktivitas: jam, kegiatan, deskripsi, bukti), `performance_metrics` (JSON isian Bagian II dan field header), `obstacles`, `insights`, `next_plan`, `evidence_links` (array URL umum, maks. 20) |
| `user_invites` | Undangan karyawan; profil `users` dibuat otomatis saat email terkonfirmasi |
| `get_missing_reports(tanggal, company)` | Siapa yang belum mengisi pada tanggal tertentu |
| `get_weekly_report_compliance(...)` | Rekap kepatuhan mingguan per karyawan |
| `get_weekly_team_reports(minggu, company)` | Tarikan laporan satu minggu |
| `v_weekly_team_reports` | View gabungan laporan + company + karyawan + jabatan |

Aturan penting:

- **Keamanan ada di database (RLS).** Aplikasi memakai kunci publik (anon/publishable) dan sesi login pengguna. DILARANG memakai service role key di kode browser atau komponen client. Jangan membuat jalan pintas yang melewati RLS.
- **Satu laporan per karyawan per hari.** Laporan hanya bisa dibuat dan diedit pada tanggal hari ini (WIB). Mulai besok laporan itu read-only untuk karyawan. Hanya Owner yang bisa mengoreksi laporan lampau. Database yang menegakkan aturan ini; aplikasi cukup menampilkan status "Terkunci" dengan jelas.
- Kolom yang boleh diedit lewat API: `activities`, `performance_metrics`, `obstacles`, `insights`, `next_plan`, `evidence_links`. Kolom `report_date`, `company_id`, `user_id`, `position_id` tidak bisa diubah setelah dibuat.
- Saat membuat laporan, `user_id` harus sama dengan pengguna yang login dan `company_id` sama dengan company-nya. `report_date` otomatis hari ini dan `position_id` terisi otomatis.
- Pendaftaran publik dimatikan. Akun hanya lahir dari undangan. Pengguna yang berhasil login tetapi belum punya profil harus melihat pesan ramah: "Akun Anda belum terdaftar. Hubungi admin."
- Tidak ada alur review harian oleh manager (sengaja dihapus untuk saat ini).

## 5. Peran dan hak akses

Jabatan (SPV, ADV, ...) dan hak akses (role) adalah dua hal berbeda. Jabatan menentukan isi form. Role menentukan apa yang boleh dilihat dan dilakukan.

| Aksi | Owner | Manager | Employee |
|---|---|---|---|
| Isi/edit laporan miliknya, hari ini | Ya | Ya | Ya |
| Lihat laporan | Semua company | Se-company | Milik sendiri |
| Edit laporan hari lampau | Ya | Tidak | Tidak |
| Dashboard "belum mengisi" dan kepatuhan | Ya | Ya (company-nya) | Tidak |
| Kelola company, undangan, pengguna | Ya | Tidak | Tidak |
| Tarikan mingguan (tabel/unduh) | Ya | Tidak | Tidak |

## 5a. Bentuk dan desain form harian (WAJIB meniru PDF contoh)

Enam PDF contoh dari pemilik (form R&D, ADV MH, ADV, AM, CC, dan Daily Meeting SPV) ada di `referensi-form/`. Form di aplikasi harus sama dengan PDF itu dalam **bentuk, urutan bagian, nama kolom, dan desain**.

Prinsip desain (berlaku untuk semua form):

- Jabatan pengguna menentukan form yang tampil. Pengguna tidak memilih form.
- Judul form besar, tebal, huruf kapital, berwarna `title_color`. Di bawahnya baris identitas: "Nama ...:" (otomatis dari profil), "Hari, Tanggal:" (otomatis, WIB), lalu field header jabatan yang diisi pengguna (Toko, Mentor, ADV / Tim, dst.).
- Judul bagian ("Bagian I: Aktivitas", dst.) tebal, berwarna `primary_color`.
- Tabel: baris header berlatar `primary_color` dengan teks putih tebal, garis tabel hitam tipis, sel isian putih.
- Kolom "Status" berupa dropdown kecil di tengah sel (di PDF tampil sebagai chip abu-abu dengan tanda "?" dan panah), awalnya belum dipilih.
- Bagian III: tabel dua kolom. Sel label di kiri, tebal, berlatar `label_bg`. Sel isian di kanan.
- Font sans-serif seperti Arial. Di ponsel, tabel lebar boleh menjadi kartu bertumpuk, tetapi urutan dan label kolom tidak boleh berubah.
- Warna tiap jabatan (diambil dari PDF, tersimpan di `form_template.theme`): ADV biru, ADV MH hijau, R&D teal, AM ungu, CC emas. Form SPV hitam-putih polos tanpa warna.

Isi form per jabatan. Sumber kebenaran tetap `roles_config.form_template`; tabel ini ringkasan untuk memudahkan pengecekan.

| Jabatan | Header tambahan | Bagian I: Aktivitas | Bagian II | Bagian III |
|---|---|---|---|---|
| RND | (tidak ada) | Jam, Kegiatan, Deskripsi Kegiatan, Bukti Realisasi | Presensi Mandiri (Form); tabel Meeting (Meeting, Dengan siapa, Hasil/keputusan); Riset (Topik riset, Progres hari ini, Link); Output/Tracker (Produk, Tahap, Progres hari ini) | Insight dari data (sumber datanya apa); Kendala; Rencana besok |
| ADV_MH | Toko / Akun, Mentor | 4 kolom seperti RND | Presensi Mandiri; Belajar apa hari ini; Upload konten apa & ke akun mana (+ link); Jumlah pesanan; Omset harian | Yang belum dipahami / kendala; Rencana besok |
| ADV | Toko | Jam, Kegiatan, Deskripsi Kegiatan (tanpa Bukti) | Presensi Mandiri (keterangan tetap: bit.ly/bahteraisreadytowork); Tarik Data Penjualan (Maksimal jam 10 pagi); Input Tracker H+1 & Ads Spent (Maks H+1); Brief Konten, QC, Upload (+ link); Data Harian per Toko, kolom Toko 1 dan Toko 2 (Impresi harian, Penjualan (pesanan / GMV), Ads spent, Campaign, Kendala) | Insight hari ini; Kendala & butuh bantuan siapa; Rencana besok |
| AM | ADV / Tim | 4 kolom seperti RND | Presensi Mandiri; Ringkasan akun hari ini (Akun, Followers, Konten diupload) | Insight hari ini; Kendala hari ini; Rencana besok |
| CC | ADV / Tim | 4 kolom, awalnya 3 baris | Presensi Mandiri; Konten dibuat hari ini (No otomatis, Akun tujuan, Jenis konten, Link) | Insight / kendala hari ini; Rencana besok |
| SPV | (tanpa Nama) | Tidak ada | Tabel Daily Meeting: No, Kegiatan (baris tetap: Review Kegiatan Kemarin; Target Harian Individu; SOP (absensi, daily report, data transaksi); Fakta lain2), Review, dan satu kolom keempat tanpa judul; di bawahnya "Bukti" (link) | Tidak ada |

Catatan penyimpanan: form CC hanya punya satu kotak "Insight / kendala hari ini"; isinya disimpan di kolom `obstacles`. Bukti pada form SPV disimpan di `evidence_links`.

## 6. Tahapan pembangunan (satu per satu, minta persetujuan sebelum lanjut)

**M0. Persiapan.** Buat proyek Next.js, siapkan `.env.example`, hubungkan ke Supabase lewat `.env.local` (diisi sendiri oleh pemilik), inisialisasi git, buat `STATUS.md` dan `CLAUDE.md`. Pandu pemilik menyelesaikan langkah di Supabase bila belum: menjalankan skema dan membuat Owner pertama (lihat panduan bootstrap di bagian 8 file SQL).

**M1. Login dan profil.**
- Login email + password. Undangan dikirim dari Supabase Auth; sediakan halaman "Atur password" untuk tautan undangan, serta "Lupa password".
- Setelah login: tampilkan nama, company, jabatan. Menu menyesuaikan role. Tombol keluar.
- Tangani akun tanpa profil (lihat bagian 4).

**M2. Laporan hari ini (form per jabatan).**
- Halaman "Laporan Hari Ini" membangun form dari `roles_config.form_template` milik jabatan pengguna, dengan tampilan sesuai bagian 5a. Buat SATU form renderer generik yang membaca template. Jangan menulis form tiap jabatan secara terpisah, supaya jabatan baru cukup ditambahkan sebagai baris di `roles_config`.
- Jika laporan hari ini belum ada: form kosong (jumlah baris awal sesuai `initial_rows`). Jika sudah ada: mode edit. Tombol Simpan dapat dipakai berulang kali selama hari ini.
- Penyimpanan (lihat komentar bagian 7 file SQL): blok `activities` ke kolom `activities`; field header, `checklist`, `table`, dan `matrix` ke `performance_metrics` per key; blok `label_rows` ke kolom `insights`, `obstacles`, atau `next_plan` sesuai `column`; blok `evidence` ke `evidence_links`.
- Perilaku blok:
  - `activities` dan `table`: tombol "Tambah baris" dan hapus baris. Baris yang seluruhnya kosong tidak disimpan. `show_index` memberi nomor urut otomatis. `fixed_rows` adalah baris tetap yang tidak bisa dihapus.
  - `checklist`: kolom Status berupa dropdown sesuai `options` (atau kolom isian untuk `kind` text/number). Kolom Keterangan mengikuti `note.mode`: `none` kosong, `static` teks tetap yang tidak diisi pengguna, `input` isian teks atau URL. Nilai disimpan sebagai `{"value": ..., "note": ...}`.
  - `matrix` (Data Harian per Toko pada form ADV): satu kolom per entitas ("Toko 1: ____", "Toko 2: ____"). Nama toko diisi pengguna pada judul kolomnya dan disimpan sebagai `nama` pada tiap entitas.
- Validasi: URL harus valid, angka harus numerik, pesan kesalahan berbahasa Indonesia yang ramah. Penyimpanan sebagian diperbolehkan. Field `required` yang masih kosong ditandai "Belum lengkap" di form, tanpa memblokir penyimpanan.
- Jika tanggal berganti saat form terbuka dan penyimpanan ditolak, tampilkan pesan ramah ("Hari sudah berganti, laporan ini terkunci") dan JANGAN menghapus teks yang sudah diketik agar bisa disalin.

**M3. Riwayat laporan saya.** Daftar laporan sendiri (terbaru dulu), detail read-only (pakai form renderer yang sama dalam mode baca), penanda "Terkunci" untuk laporan lampau, dan tombol edit hanya untuk laporan hari ini.

**M4. Dashboard Manager/SPV dan Owner.** Pilih tanggal (default hari ini). Tampilkan: daftar yang belum mengisi (`get_missing_reports`), laporan yang sudah masuk, dan rekap kepatuhan minggu berjalan (`get_weekly_report_compliance`). Detail laporan anggota bersifat read-only. Owner mendapat filter company.

**M5. Panel Owner.**
- Kelola company (tambah, ubah, nonaktifkan).
- Undangan karyawan: catat di `user_invites` (email, nama, company, role, jabatan, kode karyawan) dan tampilkan statusnya (terbuka/diklaim). Tahap awal: email undangan dikirim manual lewat dashboard Supabase (Authentication > Users > Invite). Otomatisasi lewat server (Supabase Admin API) hanya boleh ditambahkan atas persetujuan pemilik, dengan service role key HANYA di sisi server dan setelah memastikan pemanggilnya Owner.
- Kelola pengguna (aktifkan/nonaktifkan, ubah role dan jabatan).
- Koreksi laporan lampau.
- Tarikan mingguan: tabel dan tombol unduh CSV/JSON dari `get_weekly_team_reports`.

**M6. Tayang.** Deploy ke Vercel, isi environment variable di Vercel, daftarkan alamat web di Supabase (Authentication > URL Configuration), dan lakukan pengujian akhir (bagian 7) pada alamat sungguhan.

## 7. Pengujian wajib sebelum dinyatakan selesai

Buat panduan membuat akun uji: 2 company, 1 Owner, 1 Manager per company, minimal 2 Employee per company dengan jabatan berbeda (salah satunya RND). Lalu pastikan:

1. Employee tidak bisa melihat laporan karyawan lain, bahkan dengan memanipulasi alamat/URL.
2. Manager hanya melihat laporan dan karyawan di company-nya, tidak bisa membuka company lain.
3. Owner melihat semua company dan bisa mengoreksi laporan lampau.
4. Laporan kemarin tidak bisa diedit oleh Employee maupun Manager; laporan untuk tanggal selain hari ini tidak bisa dibuat.
5. Satu karyawan tidak bisa membuat dua laporan pada hari yang sama (aplikasi menampilkan pesan yang jelas).
6. Email tanpa undangan tidak punya akses ke data apa pun.
7. Employee tidak melihat dashboard kepatuhan.
8. Untuk setiap jabatan (RND, ADV_MH, ADV, AM, CC, SPV), form yang tampil sama dengan PDF contoh di `referensi-form/`: judul, warna, urutan bagian, nama dan urutan kolom. Data tersimpan ke kolom yang benar (aktivitas, metrik, insight/kendala/rencana, bukti) dan tampil kembali dengan benar saat dibuka lagi.
9. Service role key tidak muncul di kode browser, repositori git, atau log.

## 8. Di luar cakupan (jangan dikerjakan dulu)

- Review atau persetujuan harian oleh manager.
- Notifikasi (email, WhatsApp) dan pengingat pengisian.
- Unggah file (hanya link bukti).
- Analisis AI di dalam aplikasi (analisis dilakukan di luar, lewat prompt mingguan).
- Aplikasi mobile native.
- Tarikan otomatis hari Sabtu (dikerjakan terpisah setelah aplikasi stabil).

## 9. Keputusan yang masih terbuka (tanyakan ke pemilik saat relevan)

- Pilihan dropdown Status. Di PDF hanya tampil "?"; saat ini diisi Sudah/Belum.
- Kolom keempat tanpa judul pada tabel Daily Meeting SPV. Saat ini disediakan sebagai kolom isian opsional tanpa judul.
- Field wajib dan opsional. Saat ini: semua baris checklist Bagian II wajib; Data Harian per Toko wajib kecuali Kendala; Bagian I dan III opsional.
- "Penjualan (pesanan / GMV)" pada form ADV saat ini teks bebas; bisa dipecah menjadi dua angka agar lebih mudah dianalisis. "Konten diupload" pada form AM juga teks bebas (jumlah atau judul).
- Nama, logo, dan warna aplikasi.
- Domain sendiri atau alamat bawaan Vercel.
- Batas waktu edit: saat ini hanya pada hari yang sama.
