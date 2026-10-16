@AGENTS.md

# Daily Report Holding — Aturan Proyek

Spesifikasi lengkap: `BRIEF_APLIKASI.md`. Database: `schema_daily_report.sql` (sumber kebenaran).
Kemajuan & langkah berikutnya: `STATUS.md` — baca di awal setiap sesi, perbarui di akhir setiap tahap.

## Cara bekerja dengan pemilik (WAJIB)
- Pemilik BUKAN programmer. Bahasa Indonesia sederhana; setiap istilah teknis diberi penjelasan satu kalimat.
- Kerjakan per milestone kecil (M0–M6). Setelah tiap tahap jelaskan: apa yang dibuat, cara mencoba (klik apa), apa yang seharusnya terlihat. Jangan lanjut ke milestone berikutnya sebelum pemilik setuju.
- TANYA DULU sebelum: mengubah skema database, menghapus file/data, memasang layanan berbayar, atau mengubah keputusan di brief.
- JANGAN PERNAH meminta kunci rahasia ditempel di chat. Pemilik mengisi sendiri `.env.local`; tunjukkan caranya langkah demi langkah.
- Commit git kecil dengan pesan jelas. Perbarui `STATUS.md` setelah tiap tahap.
- PDF di `referensi-form/` adalah acuan VISUAL wajib untuk form. Buka dan LIHAT PDF-nya, bukan hanya teksnya.

## Teknologi
- Next.js (App Router) + TypeScript + Tailwind CSS. Versi Next.js di proyek ini baru (lihat AGENTS.md): cek dokumen di `node_modules/next/dist/docs/` sebelum menulis kode.
- Supabase Auth + PostgreSQL via `@supabase/supabase-js` dan `@supabase/ssr` (`src/lib/supabase/client.ts` untuk browser, `server.ts` untuk server).
- Hosting Vercel. Mobile-first. Antarmuka Bahasa Indonesia. Zona waktu Asia/Jakarta (WIB).
- Node.js dipasang via Homebrew (`/opt/homebrew/bin`).
- Ganti teknologi hanya dengan alasan kuat + persetujuan pemilik.

## Database (jangan diubah tanpa izin)
- Tabel: `companies`, `roles_config` (jabatan + `form_template` JSON), `users` (role = hak akses, position_id = jabatan), `daily_reports`, `user_invites`.
- Notulensi: `meetings` (visibility `company`/`holding`), `meeting_attendees`, `meeting_action_items` (status `open`/`in_progress`/`done`).
- RPC/View: `get_missing_reports`, `get_weekly_report_compliance`, `get_weekly_team_reports`, `v_weekly_team_reports`.
- **Keamanan ada di RLS.** Aplikasi memakai kunci publik (publishable/anon) + sesi login. DILARANG service role key di kode browser/komponen client. Tidak ada jalan pintas melewati RLS.
- Pengecualian yang DISETUJUI pemilik (6 Okt): kirim email undangan dan membuat link undangan (`generateLink`, tanpa email, untuk dibagikan lewat WhatsApp) (dan `generateLink` recovery untuk akun yang belum punya password, serta membaca `last_sign_in_at` via `listUsers` di halaman undangan Owner) lewat Auth Admin API dengan `SUPABASE_SECRET_KEY` — HANYA di `src/lib/supabase/admin.ts` (server-only) dan HANYA setelah `requireOwnerAction()`. Jangan pakai client admin untuk hal lain tanpa izin.
- Satu laporan per karyawan per hari. Buat/edit hanya untuk hari ini (WIB); laporan lampau read-only (tampilkan "Terkunci"). Hanya Owner bisa mengoreksi laporan lampau. Database yang menegakkan.
- Kolom yang boleh di-update: `activities`, `performance_metrics`, `obstacles`, `insights`, `next_plan`, `evidence_links`. `report_date`, `company_id`, `user_id`, `position_id` tidak bisa diubah.
- Insert: `user_id` = pengguna login, `company_id` = company-nya; `report_date` default hari ini, `position_id` terisi otomatis oleh trigger.
- Pendaftaran publik dimatikan; akun hanya dari undangan (`user_invites` → profil `users` otomatis saat email terkonfirmasi). Login tanpa profil → "Akun Anda belum terdaftar. Hubungi admin."
- Tidak ada review harian oleh manager.

## Peran & hak akses
| Aksi | Owner | Manager | Employee |
|---|---|---|---|
| Isi/edit laporan sendiri hari ini | Ya | Ya | Ya |
| Lihat laporan | Semua company | Se-company | Milik sendiri |
| Edit laporan lampau | Ya | Tidak | Tidak |
| Dashboard belum mengisi & kepatuhan | Ya | Ya (company-nya) | Tidak |
| Kelola company, undangan, pengguna | Ya | Tidak | Tidak |
| Tarikan mingguan | Ya | Tidak | Tidak |
| Buat notulensi | Ya | Ya | Ya |
| Lihat notulensi (draft & submit) | Semua | Company-nya saja | Buatannya sendiri saja |
| Edit notulensi | Selalu (koreksi) | Miliknya, selama draft | Miliknya, selama draft |
| Hapus notulensi | Langsung / setujui permintaan | Ajukan permintaan | Ajukan permintaan |
| Tindak lanjut sebagai PIC | Ya | Ya | Hanya tugasnya di "Tugas saya" |

Jabatan (SPV, ADV, ADV_MH, CC, AM, RND) menentukan ISI FORM; role (owner/manager/employee) menentukan AKSES.

## Form harian (WAJIB meniru PDF di `referensi-form/`)
- SATU form renderer generik yang membaca `roles_config.form_template`. Jangan menulis form per jabatan.
- Jabatan pengguna menentukan form; pengguna tidak memilih.
- Judul besar, tebal, KAPITAL, warna `title_color`. Lalu baris identitas: "Nama ...:" (dari profil; `name_label`, `show_name`), "Hari, Tanggal:" (WIB), lalu `header_fields`.
- Judul bagian tebal warna `primary_color`. Header tabel latar `primary_color`, teks putih tebal; garis hitam tipis; sel isian putih.
- Status = dropdown kecil di tengah sel, awalnya belum dipilih.
- Bagian III: tabel 2 kolom, label kiri tebal berlatar `label_bg`, isian kanan.
- Font sans-serif (Arial). Di ponsel tabel boleh jadi kartu bertumpuk, tapi urutan & label kolom tetap.
- Warna: ADV biru, ADV_MH hijau, RND teal, AM ungu, CC emas, SPV hitam-putih polos.
- Penyimpanan: `activities` → kolom `activities`; header_fields/checklist/table/matrix → `performance_metrics[key]`; checklist bernilai `{value, note}`; `label_rows` → `insights`/`obstacles`/`next_plan` sesuai `column`; `evidence` → `evidence_links` (maks 20).
- CC: "Insight / kendala hari ini" → `obstacles`. SPV: Bukti → `evidence_links`.
- Validasi ramah berbahasa Indonesia; simpan sebagian boleh; field `required` kosong ditandai "Belum lengkap" tanpa memblokir simpan.
- Bila hari berganti dan simpan ditolak: "Hari sudah berganti, laporan ini terkunci" — JANGAN hapus teks yang sudah diketik.

## Peta kode
- Form harian: `src/lib/report/` (tipe + konversi) dan `src/components/report/` (FormRenderer, ReportForm). Pratinjau lokal tanpa login: `npm run dev` lalu `/dev/pratinjau/ADV` (dst.).
- Menu per role: `src/lib/menu.ts`. Profil login: `src/lib/profile.ts`. Tanggal WIB: `src/lib/date.ts`.

## Tautan penting (inventaris link) — keputusan pemilik 9 Okt 2026
- Tabel `resource_links` (`supabase/005_tautan_penting.sql`, bagian 15 schema): `company_id` kosong = semua company (hanya Owner), `position_id` kosong = semua divisi, kategori tetap `tracker|aset|sop|lainnya`, URL harus http/https.
- Lihat: Owner semua; Manager link company-nya + "semua company"; Karyawan link company-nya/semua company yang untuk jabatannya/semua divisi. Kelola: Owner semua; Manager semua link company-nya. Pembuat diisi trigger.
- UI: bagian "Tautan penting" di Beranda (`LinkGroups`), halaman `/tautan` (Owner/Manager). Fungsi `public.current_position_id()`.

## Dashboard utama (Beranda) — disederhanakan 11 Okt 2026
- Keputusan pemilik: dashboard HANYA untuk Owner & Manager (karyawan tidak punya); hanya data yang diisi SEMUA divisi: kepatuhan laporan, kendala ditulis, presensi (dari tabel `presensi`, bukan "presensi mandiri" di form), tugas lewat tenggat. Proyeksi dari spreadsheet mitra DITUNDA. Bagian ADV (GMV/ads/CAC/toko/checklist) dan omzet-vs-target disembunyikan dari dashboard (kode `aggregateAdv`, `target.ts`, halaman `/target` tetap ada untuk dipakai lagi).
- Kode: `src/lib/dashboard.ts` (hitungan murni), `src/components/dashboard/` (`DashboardSection` ambil data bersamaan; `DashboardView` tampilan; `charts.tsx` grafik SVG). Pratinjau lokal `/dev/dashboard` sudah dihapus (bentuk datanya berubah).
- Definisi: kepatuhan = laporan masuk ÷ wajib (employee & manager aktif, Senin–Sabtu, mulai hari akun dibuat); kehadiran = Check-In ÷ wajib (aturan sama).
- Target omzet (tetap disimpan): ditetapkan Owner di `/target` (tabel `omzet_targets`, bagian 16).

## Presensi harian — 11 Okt 2026
- Tabel `presensi` + bucket privat `presensi` (`supabase/008`–`010`, bagian 17 schema). Status: `wfo`, `tugas_luar`, `izin`, `sakit`. Catatan wajib untuk tugas_luar/izin/sakit; foto bukti WAJIB untuk tugas_luar; Izin/Sakit otomatis Check-Out; Check-Out wajib foto selfie, sekali saja; hari lampau terkunci. Foto dikompres di browser (<200 KB, `src/lib/image-compress.ts`).
- UI: `/presensi` (karyawan, semua peran), `/presensi/rekap` + `/presensi/rekap/unduh` (CSV bulanan; Owner/Manager).

## Cuti / izin — keputusan pemilik 14 Okt 2026
- Tabel `leave_requests` (`supabase/011`, `012`, bagian 18–19 schema). Jenis `cuti`/`izin`; rentang tanggal + alasan; status pending/approved/rejected/cancelled. Mengajukan: karyawan & manager (Owner tidak). Memutuskan lewat RPC `decide_leave`: Owner semua; Manager hanya pengajuan KARYAWAN di company-nya; tidak boleh milik sendiri (pengajuan Manager hanya Owner). Batal langsung (`cancel_leave`) hanya saat pending; yang sudah disetujui lewat `request_leave_cancel` + `decide_leave_cancel` (selama menunggu cuti TETAP berlaku; belum mulai → batal, sudah berjalan → end_date = kemarin; ditolak → boleh ajukan lagi).
- Laporan harian GUGUR untuk Izin/Sakit (presensi) dan cuti/izin disetujui (`excused_kind`, `leave_on`; hari Minggu tidak dihitung); Tugas Luar tetap wajib. `get_missing_reports` & `get_weekly_report_compliance` mengabaikan yang gugur; di aplikasi `complianceByDay(..., excused)` di `src/lib/dashboard.ts`. Check-In ditolak (trigger) pada hari cuti disetujui.
- KUOTA (16 Okt): maksimal 2 pengajuan (cuti+izin) per bulan menurut bulan tanggal mulai; hanya yang pending/approved dihitung; dijaga trigger `leave_requests_prepare` (`supabase/015`), pesan "Kuota pengajuan cuti/izin bulan ini telah habis". Izin/Sakit lewat Check-In tidak dihitung. UI menampilkan sisa kuota dan menonaktifkan tombol kirim.
- Kalender cuti tim `/cuti/kalender` (Owner semua+filter company, Manager company-nya, Lead divisinya; hanya baca; disetujui solid, menunggu bergaris putus).
- UI: `/cuti` (ajukan, lihat, batalkan, ajukan pembatalan), `/cuti/persetujuan` (Owner/Manager); kartu di Beranda; Presensi, Laporan, Rekap Presensi, CSV, dan dashboard ikut menyesuaikan. Kode: `src/lib/leave.ts`, `src/components/cuti/`, `src/app/(app)/cuti/`.

## Role Lead — keputusan pemilik 15 Okt 2026
- Urutan: Owner > Manager > Lead > Karyawan (enum `user_role` + 'lead', `supabase/013`, `014`, bagian 20 schema). Mentor = Lead berjabatan ADV yang membimbing anak Magang Hub (ADV MH); boleh >1 Lead per divisi.
- Lead HANYA MELIHAT laporan, presensi (lokasi+foto), cuti/izin, daftar belum mengisi milik KARYAWAN BIASA di company sama dengan jabatan SAMA atau divisi tambahan `users.lead_position_ids` (diatur Owner di menu Pengguna). Fungsi `lead_can_view(user)`. Tidak melihat Manager/sesama Lead/company lain; tidak mengubah atau menyetujui apa pun (cuti Lead diputuskan Manager/Owner). Lead tetap wajib lapor/presensi sendiri dan memakai tautan/notulensi seperti karyawan.
- Kode: `isManagerial()`, `canViewTeam()`, `leadPositionIds()` di `src/lib/profile.ts`. Dashboard Beranda, Kelola Tautan, Persetujuan Cuti hanya Owner/Manager; Dashboard Tim dan Rekap Presensi juga untuk Lead (dibatasi divisinya).

## Brand (Bahtera Binar Group) — dari pemilik, 7 Okt 2026
- Warna: Navy `#012C4E` (primer → `--accent`/`bg-accent`/`text-accent`), Gold `#C4A251` (sekunder → `--gold`/`text-gold`/`border-gold`). Font: **Lora** (`next/font`, variabel `--font-lora`) untuk seluruh antarmuka.
- PENGECUALIAN: form harian per jabatan tetap Arial dan berwarna per jabatan (meniru PDF referensi). Notulensi memakai Lora + navy brand (menggantikan "aksen biru #2E75B6" di brief).
- Logo di `public/brand/`: `logo-utama.png` (vertikal navy+emas; halaman Masuk/Atur password), `logo-horizontal.png` (tulisan ke kanan; header aplikasi), `logo-2warna.png` (ubin navy putih; cadangan, mis. cetak/OG). Ikon tab/ponsel: `src/app/icon.png` & `apple-icon.png` (hanya gambar layar perahu di latar navy).
- Referensi brand (tidak ditayangkan): `aset-brand/warna-brand.webp`, `aset-brand/tipografi-brand.webp`. Jika pemilik punya file logo asli beresolusi tinggi/SVG, ganti file di `public/brand/` dengan nama yang sama.

## Notulensi Meeting (milestone M3b — setelah M2)
KEPUTUSAN PEMILIK 6 Okt 2026 MENGGANTIKAN brief 5b di poin-poin berikut (database: bagian 13 schema / `supabase/002_...sql`):
- Visibilitas: Owner semua; Manager company-nya saja; karyawan hanya notulensi buatannya. Opsi "Seluruh holding" TIDAK dipakai (sembunyikan di UI; kolom visibility tetap 'company').
- Semua peran boleh membuat. Penulis = pembuat (otomatis, `created_by_name`).
- Draft → Submit: draft disimpan manual + AUTO SAVE (mulai setelah judul diisi; judul wajib di DB). Tombol "Submit" (dengan konfirmasi) mengunci notulensi (`submitted_at`, waktu dari server). Setelah submit hanya Owner yang bisa mengoreksi. PIC tetap bisa ubah STATUS tindak lanjut.
- Lokasi: dropdown "Kantor 1" / "Kantor 2" / "Online" di `location`; link meeting di `meeting_link` bila Online.
- Hapus: pembuat MENGAJUKAN lewat RPC `request_meeting_deletion(id, alasan)`, bisa batal `cancel_meeting_deletion(id)`. Notulensi tetap ada sampai Owner Setujui (= delete) atau Tolak (= cancel_meeting_deletion). Owner juga bisa hapus langsung. Kolom `delete_requested_at`, `delete_request_reason`.
- PIC karyawan: halaman "Tugas saya" lewat RPC `get_my_action_items()` (judul & tanggal meeting, tugas, tenggat, status) — tidak bisa membuka isi notulensi. Status bisa diubah langsung.
- Tombol "Download PDF" notulensi (dibuat di aplikasi, tanpa layanan berbayar).
- Tetap dari brief: peserta (karyawan se-company atau tamu; nama disalin trigger), PIC se-company (kecuali Owner), jam selesai ≥ mulai, lampiran link maks 20, agenda/pembahasan/keputusan/rapat berikutnya, daftar (terbaru dulu, cari judul, filter tanggal, filter company khusus Owner, jumlah tindak lanjut belum selesai), desain aksen biru `#2E75B6`.

## Di luar cakupan
Review harian manager, notifikasi, unggah file (hanya link), analisis AI dalam aplikasi, aplikasi native, tarikan otomatis Sabtu. Notulensi: unggah file, pengingat tenggat, rekaman/transkripsi, persetujuan/tanda tangan peserta.
