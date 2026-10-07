-- =====================================================================
-- 004 FORM ADV: PECAH "Penjualan (pesanan / GMV)" MENJADI DUA ANGKA
-- (sama dengan seed ADV di bagian 7 schema_daily_report.sql)
-- Keputusan pemilik 7 Okt 2026: "Jumlah pesanan" dan "GMV (nilai penjualan)"
-- menjadi dua angka terpisah agar mudah dianalisis.
-- Yang berubah hanya bentuk form ADV. Laporan lama TIDAK dihapus: isian
-- "Penjualan" teks lama tetap tersimpan di database, tetapi tidak tampil
-- lagi di form dan hilang dari laporan yang diedit ulang.
-- Aman dijalankan ulang.
-- =====================================================================

update public.roles_config
set form_template = $json${
  "title": "DAILY REPORT DIGITAL ADV - TERA DIGILAB",
  "theme": {
    "title_color": "#1F3864",
    "primary_color": "#2E75B6",
    "label_bg": "#DEEAF6",
    "table_header_text": "#FFFFFF",
    "font": "Arial"
  },
  "name_label": "Nama ADV",
  "header_fields": [
    {
      "key": "toko",
      "label": "Toko",
      "type": "text",
      "required": true
    }
  ],
  "sections": [
    {
      "key": "aktivitas",
      "title": "Bagian I: Aktivitas",
      "blocks": [
        {
          "type": "activities",
          "initial_rows": 4,
          "columns": [
            {
              "key": "jam",
              "label": "Jam",
              "type": "text"
            },
            {
              "key": "kegiatan",
              "label": "Kegiatan",
              "type": "text"
            },
            {
              "key": "deskripsi",
              "label": "Deskripsi Kegiatan",
              "type": "textarea"
            }
          ]
        }
      ]
    },
    {
      "key": "wajib",
      "title": "Bagian II: Input Wajib Harian (Metrik Performa)",
      "blocks": [
        {
          "type": "checklist",
          "items": [
            {
              "key": "presensi_mandiri",
              "label": "Presensi Mandiri",
              "kind": "status",
              "options": [
                "Sudah",
                "Belum"
              ],
              "required": true,
              "note": {
                "mode": "static",
                "text": "bit.ly/bahteraisreadytowork"
              }
            },
            {
              "key": "tarik_data_penjualan",
              "label": "Tarik Data Penjualan",
              "kind": "status",
              "options": [
                "Sudah",
                "Belum"
              ],
              "required": true,
              "note": {
                "mode": "static",
                "text": "Maksimal jam 10 pagi"
              }
            },
            {
              "key": "input_tracker_ads",
              "label": "Input Tracker H+1 & Ads Spent",
              "kind": "status",
              "options": [
                "Sudah",
                "Belum"
              ],
              "required": true,
              "note": {
                "mode": "static",
                "text": "Maks H+1"
              }
            },
            {
              "key": "brief_qc_upload",
              "label": "Brief Konten, QC, Upload",
              "kind": "status",
              "options": [
                "Sudah",
                "Belum"
              ],
              "required": true,
              "note": {
                "mode": "input",
                "type": "url",
                "placeholder": "Link:"
              }
            }
          ]
        },
        {
          "type": "matrix",
          "key": "data_toko",
          "title": "Data Harian per Toko",
          "entity_label": "Toko",
          "initial_entities": 2,
          "max_entities": 2,
          "rows": [
            {
              "key": "impresi_harian",
              "label": "Impresi harian",
              "type": "number",
              "required": true
            },
            {
              "key": "jumlah_pesanan",
              "label": "Jumlah pesanan",
              "type": "number",
              "required": true
            },
            {
              "key": "gmv",
              "label": "GMV (nilai penjualan)",
              "type": "number",
              "unit": "Rp",
              "required": true
            },
            {
              "key": "ads_spent",
              "label": "Ads spent",
              "type": "number",
              "unit": "Rp",
              "required": true
            },
            {
              "key": "campaign",
              "label": "Campaign (status / perubahan hari ini)",
              "type": "textarea",
              "required": true
            },
            {
              "key": "kendala",
              "label": "Kendala (retur, cancel, dll.)",
              "type": "textarea",
              "required": false
            }
          ]
        }
      ]
    },
    {
      "key": "review",
      "title": "Bagian III: Review dan Kendala",
      "blocks": [
        {
          "type": "label_rows",
          "rows": [
            {
              "key": "insight",
              "label": "Insight hari ini",
              "type": "textarea",
              "column": "insights"
            },
            {
              "key": "kendala",
              "label": "Kendala & butuh bantuan siapa",
              "type": "textarea",
              "column": "obstacles"
            },
            {
              "key": "rencana_besok",
              "label": "Rencana besok",
              "type": "textarea",
              "column": "next_plan"
            }
          ]
        }
      ]
    }
  ]
}$json$::jsonb
where code = 'ADV';
