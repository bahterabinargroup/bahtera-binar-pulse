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

## Tahap 1 (tersedia)

| Endpoint | Isi | Parameter |
| --- | --- | --- |
| `GET /health` | `{ "ok": true, "versi": "v1" }` untuk cek koneksi (tetap butuh kunci) | — |
| `GET /laporan` | Laporan harian, 1 baris = laporan 1 orang 1 hari (15 kolom) | `from`, `to`, `company`, `position` (ADV, ADV_MH, CC, AM, RND, SPV), `employee` (kode karyawan), `fields=ringkas`, `limit` (1–200, bawaan 50), `cursor` |
| `GET /notulensi` | Notulensi meeting termasuk Draft, peserta, tindak lanjut | `from`, `to`, `company`, `limit`, `cursor` |

`company` memakai **kode** company (bukan nama), tidak peka huruf besar/kecil.
`fields=ringkas` hanya mengirim identitas + `insights`, `obstacles`, `next_plan` (tanpa aktivitas dan angka) agar hemat karakter.

### Halaman (cursor)

Respons data selalu berbentuk:

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
| 400 | Parameter salah (format tanggal, rentang > 93 hari, company/jabatan tidak dikenal, limit di luar 1–200, cursor rusak). Pesan di `error`. |
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
  Kunci dicocokkan lewat hash, bukan kunci asli.
- Uji: `supabase/tests/uji_keamanan.sql` bagian 43; HTTP: `node scripts/uji-api-bot.mjs <alamat>`
  (opsional `BOT_KEY=<kunci>` untuk uji isi data).

## Tahap berikutnya (belum tersedia)

- Tahap 2: `/presensi`, `/cuti`, `/kendala`, `/hari-libur`, `/pengguna`, `/target`.
- Tahap 3: `/ringkasan/kepatuhan`, `/ringkasan/adv`, `/ringkasan/tindak-lanjut`, `/ringkasan/magang`, `/ringkasan/konten`.
