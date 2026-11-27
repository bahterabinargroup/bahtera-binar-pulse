# API Tarikan untuk Bot (v1)

API **baca-saja** supaya bot analisis (mis. Rakazo) bisa mengambil data Bahtera Pulse sendiri secara terjadwal.
Isi datanya sama dengan Tarikan Laporan dan Tarikan Notulensi (JSON). Kamus data lengkap: dokumen
"Data Bahtera Pulse untuk Bot Analisis".

- Alamat dasar: `https://bahterapulse.vercel.app/api/bot/v1`
- Hanya `GET`. `POST`/`PUT`/`PATCH`/`DELETE` selalu ditolak (405).
- Kunci di header: `Authorization: Bearer <kunci>`. Tanpa kunci / kunci salah / kunci dicabut → 401.
- Batas laju: 60 permintaan per menit per kunci (lebih → 429).
- Rentang tanggal per permintaan maksimal 93 hari. Tanpa `from`/`to` = 7 hari terakhir (WIB).
- Tanggal `YYYY-MM-DD`, zona waktu WIB. Uang dalam Rupiah tanpa pemisah. Nilai kosong tetap `null` (bukan 0).
- Setiap pemakaian dicatat (kunci, endpoint, filter, jumlah baris, waktu) dan bisa dilihat Owner.
- Tidak pernah dikirim: foto presensi, bukti foto, koordinat GPS, email, password, token.

## Endpoint yang tersedia

Data mentah (berhalaman bila ada `limit`/`cursor`):

| Endpoint | Isi | Parameter |
| --- | --- | --- |
| `GET /health` | `{ "ok": true, "versi": "v1" }` untuk cek koneksi (tetap butuh kunci) | — |
| `GET /laporan` | Laporan harian, 1 baris = laporan 1 orang 1 hari (15 kolom) | `from`, `to`, `company`, `position` (ADV, ADV_MH, CC, AM, RND, SPV), `employee` (kode karyawan), `fields=ringkas`, `limit` (1–200, bawaan 50), `cursor` |
| `GET /notulensi` | Notulensi meeting termasuk Draft, peserta, tindak lanjut | `from`, `to`, `company`, `limit`, `cursor` |
| `GET /hari-libur` | `tanggal`, `nama` hari libur (berlaku semua company) | `from`, `to` |
| `GET /cuti` | Pengajuan cuti/izin yang bersinggungan dengan rentang: jenis, tanggal, alasan, status (Menunggu/Disetujui/Ditolak/Dibatalkan/Kedaluwarsa), pembatalan | `from`, `to`, `company`, `employee`, `limit`, `cursor` |
| `GET /presensi` | Status (WFO/Tugas Luar/Izin/Sakit), `check_in`/`check_out` (jam WIB), catatan. **Tanpa foto & GPS** | `from`, `to`, `company`, `employee`, `limit`, `cursor` |
| `GET /kendala` | Laporan yang menulis kendala + `sudah_ditangani`, `ditangani_oleh`, `ditangani_pada`, catatan | `from`, `to`, `company`, `position`, `status=belum\|sudah`, `limit`, `cursor` |
| `GET /pengguna` | Nama, kode, company, role, jabatan, tanggal mulai kerja, tanggal akun dibuat, aktif. **Tanpa email/no. HP** | `company`, `aktif=true\|false` |
| `GET /target` | Target omzet bulanan per ADV (bulan yang bersinggungan dengan rentang) | `from`, `to`, `company` |

Ringkasan (dihitung database, tanpa halaman; semua menerima `from`, `to`, `company`):

| Endpoint | Isi |
| --- | --- |
| `GET /ringkasan/kepatuhan` | Per orang: `hari_wajib`, `hari_lapor`, `persen`, `tidak_lapor` (daftar tanggal), `gugur` (tanggal + alasan Izin/Sakit/Cuti); rekap `per_company` dan `per_jabatan`; `hari_dihitung`, `hari_libur`. Wajib lapor = aktif, Senin–Sabtu, bukan hari libur, sejak akun dibuat, **sebelum hari ini**, tidak gugur. **Pakai ini untuk menilai siapa tidak lapor**, jangan menebak dari `/laporan`. |
| `GET /ringkasan/tindak-lanjut` | Per PIC: total, open, sedang dikerjakan, selesai, lewat tenggat + daftar yang belum selesai (tugas, tenggat, judul & tanggal meeting). Dari meeting bertanggal dalam rentang. |
| `GET /ringkasan/magang` | ADV_MH per orang (mentor, hari lapor, pesanan, omset) dan per mentor |
| `GET /ringkasan/konten` | CC: jumlah konten per akun & per orang. AM: konten diupload per akun, followers awal/akhir/selisih, per orang |
| `GET /ringkasan/adv` | Per toko (total periode) dan per toko per hari: impresi, pesanan, GMV, ads spent, efisiensi (GMV ÷ ads spent, `null` bila ads spent kosong/0); per ADV: GMV periode, target bulan, GMV bulan berjalan, persen target |

Ukuran ringkasan untuk 1 minggu (data 28 Nov 2026, semua company): kepatuhan ±4.500 karakter, ADV ±5.100,
konten ±2.500, magang ±1.200, tindak lanjut ±300. Untuk 30 hari, kepatuhan ±6.500.

Angka dari isian form yang berupa teks (mis. `"1.736.279"`, `"Rp 785.300"`) diubah menjadi angka di ringkasan;
teks bebas atau kosong tetap `null`.

`company` memakai **kode** company (bukan nama), tidak peka huruf besar/kecil.
`fields=ringkas` hanya mengirim identitas + `insights`, `obstacles`, `next_plan` (tanpa aktivitas dan angka) agar hemat karakter.

### Halaman (cursor)

Respons data mentah selalu berbentuk (ringkasan punya bentuk sendiri, lihat tabel di atas):

```json
{ "data": [ ... ], "next_cursor": "2026-11-03|8b1e…", "total": 386, "from": "2026-11-01", "to": "2026-11-30" }
```

`total` = jumlah semua baris yang cocok filter. Bila `next_cursor` tidak `null`, panggil lagi dengan
`&cursor=<next_cursor>` (filter lain sama) untuk halaman berikutnya. `null` = sudah halaman terakhir.
Urutan: tanggal lalu id (stabil).

## Contoh panggilan

```bash
curl -H "Authorization: Bearer $BOT_KEY" "https://bahterapulse.vercel.app/api/bot/v1/health"
curl -H "Authorization: Bearer $BOT_KEY" "https://bahterapulse.vercel.app/api/bot/v1/laporan?from=2026-11-01&to=2026-11-30&position=ADV&limit=50"
curl -H "Authorization: Bearer $BOT_KEY" "https://bahterapulse.vercel.app/api/bot/v1/laporan?from=2026-11-24&to=2026-11-29&fields=ringkas&limit=200"
curl -H "Authorization: Bearer $BOT_KEY" "https://bahterapulse.vercel.app/api/bot/v1/notulensi?from=2026-11-01&to=2026-11-30"
curl -H "Authorization: Bearer $BOT_KEY" "https://bahterapulse.vercel.app/api/bot/v1/ringkasan/kepatuhan?from=2026-11-23&to=2026-11-29"
curl -H "Authorization: Bearer $BOT_KEY" "https://bahterapulse.vercel.app/api/bot/v1/kendala?from=2026-11-01&to=2026-11-30&status=belum"
```

### Contoh respons `/laporan` (dipendekkan, data rekaan)

```json
{
  "data": [
    {
      "week_start": "2026-11-23",
      "report_date": "2026-11-24",
      "company_code": "TERA",
      "company_name": "Contoh Company",
      "employee_code": "K001",
      "full_name": "Nama Karyawan",
      "position_code": "ADV",
      "position_name": "Advertiser",
      "activities": [{ "jam": "08.00-10.00", "kegiatan": "Tarik data penjualan", "deskripsi": "..." }],
      "performance_metrics": {
        "toko": "Toko Contoh",
        "presensi_mandiri": { "value": "Sudah", "note": null },
        "data_toko": [{ "nama": "Toko Contoh", "impresi_harian": 9000, "jumlah_pesanan": 16, "gmv": 1700000, "ads_spent": 400000, "campaign": "...", "kendala": null }]
      },
      "insights": "...",
      "obstacles": null,
      "next_plan": "...",
      "evidence_links": [],
      "updated_at": "2026-11-24T10:12:00+00:00"
    }
  ],
  "next_cursor": null,
  "total": 1,
  "from": "2026-11-24",
  "to": "2026-11-24"
}
```

### Contoh respons `/notulensi` (dipendekkan, data rekaan)

```json
{
  "data": [
    {
      "meeting_date": "2026-11-24",
      "company_name": "Contoh Company",
      "title": "Weekly Meeting",
      "status": "Submit",
      "created_by_name": "Nama Penulis",
      "start_time": "09:00",
      "end_time": "10:00",
      "location": "Kantor 1",
      "meeting_link": null,
      "agenda": "...",
      "discussion": "...",
      "decisions": "...",
      "next_meeting_date": null,
      "attendees": ["Nama A", "Nama B"],
      "action_items": [{ "description": "...", "pic": "Nama A", "due_date": "2026-11-28", "status": "Open" }],
      "attachment_links": [],
      "submitted_at": "2026-11-24T04:00:00+00:00",
      "updated_at": "2026-11-24T04:00:00+00:00"
    }
  ],
  "next_cursor": null,
  "total": 1,
  "from": "2026-11-24",
  "to": "2026-11-24"
}
```

### Kode status

| Status | Arti |
| --- | --- |
| 200 | Berhasil |
| 400 | Parameter salah (format tanggal, rentang > 93 hari, company/jabatan tidak dikenal, limit di luar 1–200, cursor rusak, status/aktif salah). Pesan di `error`. |
| 401 | Kunci tidak ada, salah, atau sudah dicabut |
| 404 | Endpoint tidak ada |
| 405 | Metode selain GET |
| 429 | Lebih dari 60 permintaan per menit untuk kunci ini; tunggu 1 menit |
| 500 | Kesalahan server |

## Membuat dan mencabut kunci (Owner)

1. Login sebagai Owner → menu **Administrasi → API Bot**.
2. Isi **Nama kunci** (mis. "Rakazo") → **Buat kunci baru**.
3. Kunci (diawali `bbp_`) tampil **sekali saja**. Klik **Salin**, tempel di pengaturan bot. Jangan kirim lewat chat/WhatsApp.
4. Klik **Sudah saya simpan**. Setelah itu kunci tidak bisa dilihat lagi (database hanya menyimpan hash-nya).
5. Mencabut: di **Daftar kunci**, klik **Cabut** pada kunci itu. Berlaku seketika, tanpa deploy ulang.
   Bila kunci bocor: buat kunci baru, ganti di bot, lalu cabut yang lama.
6. **Log pemakaian** di halaman yang sama menampilkan 200 pemakaian terakhir.

Boleh ada lebih dari satu kunci (mis. satu per bot).

## Cara kerja (untuk pengembang)

- Rute: `src/app/api/bot/v1/*/route.ts`, pembantu `src/lib/bot-api.ts`. Rute hanya meneruskan kunci + filter ke fungsi
  database `bot_*` memakai kunci publik Supabase; **tidak** memakai kunci admin dan **tidak** memakai sesi login.
  `src/proxy.ts` melewati `/api/bot/` (tidak dialihkan ke halaman login).
- Database (`supabase/025_api_bot.sql`, bagian 29 schema): tabel `api_keys` (hash SHA-256, aktif, terakhir dipakai) dan
  `api_audit_log`; fungsi `create_api_key`/`revoke_api_key` (Owner), `bot_begin` (cek kunci + batas laju + log; tidak bisa
  dipanggil dari luar), `bot_health`, `bot_laporan`, `bot_notulensi` (security definer; hanya kolom yang diizinkan).
  Tahap 2–3: `supabase/026_api_bot_tahap2.sql` (bagian 30 schema): `bot_hari_libur`, `bot_cuti`, `bot_presensi`, `bot_kendala`,
  `bot_pengguna`, `bot_target`, `bot_ringkasan_*`; pengubah angka `bot_num`.
  Kunci dicocokkan lewat hash, bukan kunci asli.
- Uji: `supabase/tests/uji_keamanan.sql` bagian 43–44; HTTP: `node scripts/uji-api-bot.mjs <alamat>`
  (opsional `BOT_KEY=<kunci>` untuk uji isi data).

