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
- RPC/View: `get_missing_reports`, `get_weekly_report_compliance`, `get_weekly_team_reports`, `v_weekly_team_reports`.
- **Keamanan ada di RLS.** Aplikasi hanya memakai kunci publik (publishable/anon) + sesi login. DILARANG service role key di kode browser/komponen client. Tidak ada jalan pintas melewati RLS.
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

## Di luar cakupan
Review harian manager, notifikasi, unggah file (hanya link), analisis AI dalam aplikasi, aplikasi native, tarikan otomatis Sabtu.
