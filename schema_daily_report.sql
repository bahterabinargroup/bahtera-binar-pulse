-- =====================================================================
-- DAILY REPORT - HOLDING SYSTEM
-- Skema PostgreSQL untuk Supabase
-- Urutan: 0 Enum & Helper -> 1 companies -> 2 roles_config -> 3 users
--         -> 4 daily_reports -> 5 RLS -> 6 Column privilege -> 7 Seed
--         -> 8 Undangan karyawan & auto-profil -> 9 View/RPC tarikan mingguan -> 10 Kepatuhan pengisian -> 11 Notulensi meeting -> 12 Hak akses tabel -> 13 Notulensi: submit & hapus -> 14 Batasi roles_config -> 15 Tautan penting -> 16 Target omzet
-- Aman dijalankan di Supabase SQL Editor (jalankan sekali, berurutan).
-- =====================================================================


-- =====================================================================
-- 0. ENUM & FUNGSI UMUM
-- =====================================================================

create type public.user_role as enum ('owner', 'manager', 'employee');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tanggal "hari ini" menurut WIB. Dipakai untuk aturan kunci laporan harian:
-- laporan hanya bisa dibuat & diedit pada tanggalnya sendiri.
create or replace function public.today_jakarta()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Jakarta')::date
$$;


-- =====================================================================
-- 1. COMPANIES  (holding + anak usaha / unit bisnis)
-- =====================================================================

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.companies (id) on delete set null,
  code        text not null,
  name        text not null,
  description text,
  is_holding  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint companies_not_self_parent check (parent_id is null or parent_id <> id)
);

create unique index companies_code_uidx on public.companies (lower(code));
create index companies_parent_id_idx    on public.companies (parent_id);

create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

comment on table public.companies is 'Holding dan anak usaha/unit bisnis. parent_id membentuk hierarki.';


-- =====================================================================
-- 2. ROLES_CONFIG  (konfigurasi jabatan & bentuk form: SPV, ADV, ADV MH, CC, AM, RND)
--    Berbeda dengan users.role (hak akses). Ini adalah JABATAN/posisi kerja.
-- =====================================================================

create table public.roles_config (
  id            smallint generated always as identity primary key,
  code          text not null,
  name          text not null,
  description   text,
  -- Definisi form laporan harian untuk jabatan ini (judul, tema warna, header,
  -- bagian & blok isian). Spesifikasi lengkap ada di bagian 7 file ini.
  form_template jsonb not null default '{}'::jsonb,
  sort_order    smallint not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint roles_config_code_key unique (code),
  constraint roles_config_code_format check (code ~ '^[A-Z][A-Z0-9_]*$'),
  constraint roles_config_form_template_object check (jsonb_typeof(form_template) = 'object')
);

create trigger trg_roles_config_updated_at
  before update on public.roles_config
  for each row execute function public.set_updated_at();

comment on table public.roles_config is 'Master jabatan kerja. form_template mendefinisikan bentuk form laporan harian per jabatan.';
comment on column public.roles_config.form_template is 'Definisi form laporan harian untuk jabatan ini (judul, tema warna, header, bagian & blok isian). Spesifikasi struktur ada di komentar seed roles_config.';


-- =====================================================================
-- 3. USERS  (profil karyawan, 1:1 dengan auth.users milik Supabase)
--    Setiap user WAJIB punya company_id (company induknya).
--    Owner tetap punya company_id (mis. holding), tetapi RLS memberinya
--    akses ke semua company.
-- =====================================================================

create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  company_id    uuid not null references public.companies (id) on delete restrict,
  position_id   smallint references public.roles_config (id) on delete restrict,
  role          public.user_role not null default 'employee',
  employee_code text,
  full_name     text not null,
  email         text not null,
  phone         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Dibutuhkan untuk composite FK dari daily_reports (isolasi antar company)
  constraint users_id_company_uk unique (id, company_id)
);

create unique index users_email_uidx          on public.users (lower(email));
create unique index users_company_empcode_uidx on public.users (company_id, employee_code)
  where employee_code is not null;
create index users_company_role_idx           on public.users (company_id, role);
create index users_position_id_idx            on public.users (position_id);

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

comment on table public.users is 'Profil karyawan. role = hak akses (owner/manager/employee); position_id = jabatan kerja (roles_config).';


-- =====================================================================
-- 4. DAILY_REPORTS
--    Isolasi data antar anak usaha dijamin di level database lewat
--    composite FK (user_id, company_id) -> users(id, company_id):
--    laporan TIDAK BISA menunjuk company yang berbeda dari company user-nya.
-- =====================================================================

create table public.daily_reports (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null,
  user_id             uuid not null,
  position_id         smallint references public.roles_config (id) on delete restrict,
  report_date         date not null default public.today_jakarta(),

  activities          jsonb not null default '[]'::jsonb,
  performance_metrics jsonb not null default '{}'::jsonb,
  obstacles           text,
  insights            text,
  next_plan           text,
  evidence_links      text[] not null default '{}',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Satu laporan per user per hari
  constraint daily_reports_user_date_uk unique (user_id, report_date),

  -- Isolasi company: user harus berada di company yang sama dengan laporan
  constraint daily_reports_user_company_fk
    foreign key (user_id, company_id)
    references public.users (id, company_id) on delete restrict,

  constraint daily_reports_company_fk
    foreign key (company_id) references public.companies (id) on delete restrict,

  constraint daily_reports_metrics_object check (jsonb_typeof(performance_metrics) = 'object'),
  constraint daily_reports_activities_array check (jsonb_typeof(activities) = 'array'),
  constraint daily_reports_evidence_max   check (cardinality(evidence_links) <= 20)
);

-- Indeks utama untuk dashboard & filter
create index daily_reports_company_date_idx on public.daily_reports (company_id, report_date desc);
create index daily_reports_user_date_idx    on public.daily_reports (user_id, report_date desc);
create index daily_reports_position_idx     on public.daily_reports (position_id, report_date desc);
create index daily_reports_date_idx         on public.daily_reports (report_date desc);  -- tarik semua tim per rentang tanggal
create index daily_reports_metrics_gin      on public.daily_reports using gin (performance_metrics jsonb_path_ops);

create trigger trg_daily_reports_updated_at
  before update on public.daily_reports
  for each row execute function public.set_updated_at();

-- Isi otomatis position_id dari jabatan user saat laporan dibuat (snapshot historis)
create or replace function public.daily_reports_fill_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.position_id is null then
    select u.position_id into new.position_id
    from public.users u
    where u.id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger trg_daily_reports_fill_position
  before insert on public.daily_reports
  for each row execute function public.daily_reports_fill_position();

comment on column public.daily_reports.position_id is 'Snapshot jabatan saat laporan dibuat, agar riwayat tetap akurat jika user pindah jabatan.';
comment on column public.daily_reports.activities is 'Array baris aktivitas Bagian I: [{jam, kegiatan, deskripsi, bukti}]. Kosong untuk jabatan tanpa Bagian Aktivitas (mis. SPV).';
comment on column public.daily_reports.performance_metrics is 'JSON object isian Bagian II dan field header (toko, mentor, dst), mengikuti roles_config.form_template.';
comment on column public.daily_reports.evidence_links is 'Array URL bukti umum (Drive, screenshot, dsb), mis. Bukti pada form SPV. Maks. 20 link. Bukti per aktivitas ada di activities[].bukti.';
comment on column public.daily_reports.insights is 'Insight dari data. Tulis juga sumber datanya (mis. "CTR turun 2% - sumber: Meta Ads Manager").';
comment on column public.daily_reports.next_plan is 'Rencana kerja hari berikutnya.';


-- =====================================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================================

-- Helper (security definer agar tidak rekursif saat membaca public.users)
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.users where id = (select auth.uid()) and is_active
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select company_id from public.users where id = (select auth.uid()) and is_active
$$;

revoke all on function public.current_user_role()  from public, anon;
revoke all on function public.current_company_id() from public, anon;
grant execute on function public.current_user_role()  to authenticated;
grant execute on function public.current_company_id() to authenticated;

alter table public.companies     enable row level security;
alter table public.roles_config  enable row level security;
alter table public.users         enable row level security;
alter table public.daily_reports enable row level security;

-- ---------- companies ----------
create policy companies_select on public.companies
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or id = (select public.current_company_id())
  );

create policy companies_owner_write on public.companies
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

-- ---------- roles_config ----------
create policy roles_config_select on public.roles_config
  for select to authenticated
  using (true);

create policy roles_config_owner_write on public.roles_config
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

-- ---------- users ----------
create policy users_select on public.users
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or company_id = (select public.current_company_id())
  );

create policy users_owner_write on public.users
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

-- ---------- daily_reports ----------
-- Lihat: owner (semua), manager (se-company), employee (milik sendiri)
create policy daily_reports_select on public.daily_reports
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or (
      company_id = (select public.current_company_id())
      and (
        (select public.current_user_role()) = 'manager'
        or user_id = (select auth.uid())
      )
    )
  );

-- Buat: hanya untuk diri sendiri, di company sendiri, dan HANYA untuk hari ini.
-- (Setiap hari = "lembar baru"; tidak bisa membuat laporan untuk tanggal lain.)
create policy daily_reports_insert_own on public.daily_reports
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_id = (select public.current_company_id())
    and report_date = (select public.today_jakarta())
  );

-- Edit: hanya laporan milik sendiri DAN hanya selama masih hari yang sama.
-- Begitu tanggal berganti (WIB), laporan sebelumnya otomatis terkunci.
create policy daily_reports_update_own on public.daily_reports
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and report_date = (select public.today_jakarta())
  )
  with check (
    user_id = (select auth.uid())
    and company_id = (select public.current_company_id())
    and report_date = (select public.today_jakarta())
  );

-- Owner: akses penuh
create policy daily_reports_owner_all on public.daily_reports
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');


-- =====================================================================
-- 6. PEMBATASAN KOLOM (daily_reports)
--    Kolom identitas (id, company_id, user_id, position_id, created_at)
--    dan report_date tidak bisa diubah lewat API Supabase, siapa pun rolenya
--    (report_date terkunci agar laporan tidak bisa "dipindah" ke hari lain).
--    (service_role / SQL Editor tetap bisa untuk keperluan migrasi.)
--
--    Catatan:
--    - Kunci harian: karyawan hanya bisa membuat/mengedit laporan bertanggal
--      hari ini (WIB). Mulai besok laporan tsb read-only untuk karyawan.
--      Hanya Owner (policy daily_reports_owner_all) yang bisa mengoreksi
--      laporan lama, mis. jika karyawan lupa mengisi.
--    - Alur review harian oleh Manager sengaja TIDAK dimasukkan untuk saat ini.
--      Review dilakukan Owner secara mingguan di luar aplikasi. Manager hanya
--      dapat MELIHAT laporan se-company (lihat policy daily_reports_select).
-- =====================================================================

revoke update on public.daily_reports from anon, authenticated;
grant update (
  activities, performance_metrics, obstacles, insights, next_plan, evidence_links
) on public.daily_reports to authenticated;


-- =====================================================================
-- 7. SEED: roles_config + FORM TEMPLATE PER JABATAN
--
--    form_template disusun dari PDF contoh form tiap divisi. Struktur:
--
--    {
--      "title": judul form,
--      "theme": {title_color, primary_color, label_bg, table_header_text, font},
--      "name_label": label "Nama ..." (default "Nama"),   "show_name": false jika tanpa nama,
--      "header_fields": [ {key, label, type, required} ]  -- mis. Toko, Mentor, ADV / Tim
--      "sections": [ {key, title, blocks:[...]} ]
--    }
--
--    Jenis blok (blocks[].type) dan tempat penyimpanan nilainya:
--      activities  : tabel aktivitas (Jam, Kegiatan, Deskripsi, Bukti)  -> daily_reports.activities
--      checklist   : tabel "Metrik Wajib | Status | Keterangan"          -> performance_metrics[item.key]
--                    item.kind = status | text | number; nilai {value, note}
--                    item.note.mode = none | static (teks tetap) | input
--      table       : tabel baris berulang (columns[], initial_rows,       -> performance_metrics[key] = array objek
--                    show_index, fixed_rows)
--      matrix      : metrik x entitas (mis. Toko 1, Toko 2)               -> performance_metrics[key] = array objek
--      label_rows  : tabel 2 kolom (label | isian) untuk Bagian III       -> kolom daily_reports sesuai row.column
--                    (insights | obstacles | next_plan)
--      evidence    : daftar link bukti                                    -> daily_reports.evidence_links
--    header_fields disimpan di performance_metrics[field.key].
--    "Nama" dan "Hari, Tanggal" tidak disimpan: diambil dari users.full_name dan report_date.
-- =====================================================================

insert into public.roles_config (code, name, description, sort_order, form_template) values
  ('SPV', 'Supervisor', 'Supervisor / manager tim. Mengisi catatan Daily Meeting Digital Advertiser.', 1,
   $json${
  "title": "DAILY MEETING DIGITAL ADVERTISER - TERA DIGILAB",
  "theme": {
    "title_color": "#000000",
    "primary_color": "#000000",
    "label_bg": "#FFFFFF",
    "table_header_text": "#000000",
    "font": "Arial",
    "plain": true
  },
  "show_name": false,
  "header_fields": [],
  "sections": [
    {
      "key": "meeting",
      "title": null,
      "blocks": [
        {
          "type": "table",
          "key": "agenda_meeting",
          "show_index": true,
          "index_label": "No",
          "fixed_rows": [
            {
              "kegiatan": "Review Kegiatan Kemarin"
            },
            {
              "kegiatan": "Target Harian Individu"
            },
            {
              "kegiatan": "SOP (absensi, daily report, data transaksi)"
            },
            {
              "kegiatan": "Fakta lain2"
            }
          ],
          "columns": [
            {
              "key": "kegiatan",
              "label": "Kegiatan",
              "type": "fixed_text"
            },
            {
              "key": "review",
              "label": "Review",
              "type": "textarea"
            },
            {
              "key": "catatan",
              "label": "",
              "type": "textarea",
              "optional_column": true
            }
          ]
        },
        {
          "type": "evidence",
          "title": "Bukti"
        }
      ]
    }
  ]
}$json$::jsonb),
  ('ADV', 'Advertiser', 'Advertiser (Digital ADV) Tera Digilab', 2,
   $json$
{
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
}$json$::jsonb),
  ('ADV_MH', 'Advertiser Magang Hub', 'Advertiser pada program Magang Hub (MH)', 3,
   $json${
  "title": "DAILY REPORT ADV MAGANGHUB - TERA DIGILAB",
  "theme": {
    "title_color": "#385723",
    "primary_color": "#538135",
    "label_bg": "#E2EFD9",
    "table_header_text": "#FFFFFF",
    "font": "Arial"
  },
  "header_fields": [
    {
      "key": "toko_akun",
      "label": "Toko / Akun",
      "type": "text",
      "required": true
    },
    {
      "key": "mentor",
      "label": "Mentor",
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
            },
            {
              "key": "bukti",
              "label": "Bukti Realisasi",
              "type": "url"
            }
          ]
        }
      ]
    },
    {
      "key": "wajib",
      "title": "Bagian II: Input Wajib Harian",
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
                "mode": "input",
                "type": "text"
              }
            },
            {
              "key": "belajar_hari_ini",
              "label": "Belajar apa hari ini",
              "kind": "text",
              "required": true,
              "note": {
                "mode": "none"
              }
            },
            {
              "key": "upload_konten",
              "label": "Upload konten apa & ke akun mana",
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
            },
            {
              "key": "jumlah_pesanan",
              "label": "Jumlah pesanan",
              "kind": "number",
              "required": true,
              "note": {
                "mode": "none"
              }
            },
            {
              "key": "omset_harian",
              "label": "Omset harian",
              "kind": "number",
              "unit": "Rp",
              "required": true,
              "note": {
                "mode": "none"
              }
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
              "key": "kendala",
              "label": "Yang belum dipahami / kendala",
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
}$json$::jsonb),
  ('CC', 'Content Creator', 'Content Creator Tera Digilab', 4,
   $json${
  "title": "DAILY REPORT CONTENT CREATOR (CC) TERA DIGILAB",
  "theme": {
    "title_color": "#7F6000",
    "primary_color": "#BF8F00",
    "label_bg": "#FFF2CC",
    "table_header_text": "#FFFFFF",
    "font": "Arial"
  },
  "name_label": "Nama CC",
  "header_fields": [
    {
      "key": "adv_tim",
      "label": "ADV / Tim",
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
          "initial_rows": 3,
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
            },
            {
              "key": "bukti",
              "label": "Bukti Realisasi",
              "type": "url"
            }
          ]
        }
      ]
    },
    {
      "key": "wajib",
      "title": "Bagian II: Input Wajib Harian",
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
                "mode": "input",
                "type": "text"
              }
            }
          ]
        },
        {
          "type": "table",
          "key": "konten_dibuat",
          "title": "Konten dibuat hari ini",
          "initial_rows": 3,
          "show_index": true,
          "columns": [
            {
              "key": "akun_tujuan",
              "label": "Akun tujuan",
              "type": "text"
            },
            {
              "key": "jenis_konten",
              "label": "Jenis konten",
              "type": "text"
            },
            {
              "key": "link",
              "label": "Link",
              "type": "url"
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
              "key": "insight_kendala",
              "label": "Insight / kendala hari ini",
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
}$json$::jsonb),
  ('AM', 'Affiliate Manajemen', 'Affiliate Management Tera Digilab', 5,
   $json${
  "title": "DAILY REPORT AFFILIATE MANAGEMENT (AM) - TERA DIGILAB",
  "theme": {
    "title_color": "#4B1C6E",
    "primary_color": "#7030A0",
    "label_bg": "#EADCF4",
    "table_header_text": "#FFFFFF",
    "font": "Arial"
  },
  "name_label": "Nama AM",
  "header_fields": [
    {
      "key": "adv_tim",
      "label": "ADV / Tim",
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
            },
            {
              "key": "bukti",
              "label": "Bukti Realisasi",
              "type": "url"
            }
          ]
        }
      ]
    },
    {
      "key": "wajib",
      "title": "Bagian II: Input Wajib Harian",
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
                "mode": "input",
                "type": "text"
              }
            }
          ]
        },
        {
          "type": "table",
          "key": "ringkasan_akun",
          "title": "Ringkasan akun hari ini",
          "initial_rows": 2,
          "columns": [
            {
              "key": "akun",
              "label": "Akun",
              "type": "text"
            },
            {
              "key": "followers",
              "label": "Followers",
              "type": "number"
            },
            {
              "key": "konten_diupload",
              "label": "Konten diupload",
              "type": "text",
              "placeholder": "jumlah atau judul konten"
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
              "label": "Kendala hari ini",
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
}$json$::jsonb),
  ('RND', 'Research & Development', 'Research & Development Tera Digilab', 6,
   $json${
  "title": "DAILY REPORT RESEARCH & DEVELOPMENT (R&D) - TERA DIGILAB",
  "theme": {
    "title_color": "#1F5C5C",
    "primary_color": "#1F7A7A",
    "label_bg": "#DDF0F0",
    "table_header_text": "#FFFFFF",
    "font": "Arial"
  },
  "header_fields": [],
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
            },
            {
              "key": "bukti",
              "label": "Bukti Realisasi",
              "type": "url"
            }
          ]
        }
      ]
    },
    {
      "key": "wajib",
      "title": "Bagian II: Input Wajib Harian",
      "blocks": [
        {
          "type": "checklist",
          "items": [
            {
              "key": "presensi_mandiri",
              "label": "Presensi Mandiri (Form)",
              "kind": "status",
              "options": [
                "Sudah",
                "Belum"
              ],
              "required": true,
              "note": {
                "mode": "input",
                "type": "text"
              }
            }
          ]
        },
        {
          "type": "table",
          "key": "meetings",
          "title": "Meeting hari ini",
          "initial_rows": 2,
          "columns": [
            {
              "key": "meeting",
              "label": "Meeting",
              "type": "text"
            },
            {
              "key": "dengan_siapa",
              "label": "Dengan siapa",
              "type": "text"
            },
            {
              "key": "hasil_keputusan",
              "label": "Hasil / keputusan",
              "type": "textarea"
            }
          ]
        },
        {
          "type": "table",
          "key": "riset",
          "title": "Riset yang sedang berjalan",
          "initial_rows": 2,
          "columns": [
            {
              "key": "topik",
              "label": "Topik riset",
              "type": "text"
            },
            {
              "key": "progres",
              "label": "Progres hari ini",
              "type": "textarea"
            },
            {
              "key": "link",
              "label": "Link",
              "type": "url"
            }
          ]
        },
        {
          "type": "table",
          "key": "output_tracker",
          "title": "Output/Tracker yang sedang dibuat",
          "initial_rows": 2,
          "columns": [
            {
              "key": "produk",
              "label": "Produk",
              "type": "text"
            },
            {
              "key": "tahap",
              "label": "Tahap",
              "type": "text"
            },
            {
              "key": "progres",
              "label": "Progres hari ini",
              "type": "textarea"
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
              "label": "Insight dari data",
              "type": "textarea",
              "column": "insights",
              "sublabel": "sumber datanya apa"
            },
            {
              "key": "kendala",
              "label": "Kendala",
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
}$json$::jsonb)
on conflict (code) do update
  set name          = excluded.name,
      description   = excluded.description,
      sort_order    = excluded.sort_order,
      form_template = excluded.form_template;


-- =====================================================================
-- 8. UNDANGAN KARYAWAN & AUTO-PROFIL (auth.users -> public.users)
--
--    Alur: Owner mendaftarkan email karyawan + company + role + jabatan di
--    tabel user_invites. Saat karyawan itu login/konfirmasi email lewat
--    Supabase Auth, baris public.users dibuat OTOMATIS dari undangan.
--
--    Kenapa lewat tabel undangan, bukan dari metadata signup? Metadata
--    signup bisa diisi sendiri oleh pendaftar (termasuk role & company),
--    sehingga tidak aman. Tanpa undangan, akun Auth tetap terbentuk tetapi
--    TIDAK punya profil, jadi tidak bisa membaca/menulis data apa pun (RLS).
-- =====================================================================

create table public.user_invites (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  company_id    uuid not null references public.companies (id) on delete cascade,
  position_id   smallint references public.roles_config (id) on delete restrict,
  role          public.user_role not null default 'employee',
  full_name     text not null,
  employee_code text,
  claimed_at    timestamptz,
  claimed_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Satu undangan aktif per email
create unique index user_invites_open_email_uidx
  on public.user_invites (lower(email)) where claimed_at is null;
create index user_invites_company_idx on public.user_invites (company_id);

alter table public.user_invites enable row level security;

create policy user_invites_owner_all on public.user_invites
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

revoke all on public.user_invites from anon;

create or replace function public.handle_auth_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.user_invites%rowtype;
  v_new_id uuid;
begin
  -- Hanya untuk email yang sudah terkonfirmasi (mencegah klaim undangan
  -- oleh orang yang mendaftar dengan email milik orang lain).
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;

  -- Profil sudah ada
  if exists (select 1 from public.users where id = new.id) then
    return new;
  end if;

  select * into v_invite
  from public.user_invites
  where lower(email) = lower(new.email)
    and claimed_at is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    return new;  -- tanpa undangan: tidak ada profil, tidak ada akses
  end if;

  insert into public.users (id, company_id, position_id, role, employee_code, full_name, email)
  values (new.id, v_invite.company_id, v_invite.position_id, v_invite.role,
          v_invite.employee_code, v_invite.full_name, new.email)
  on conflict do nothing
  returning id into v_new_id;

  if v_new_id is not null then
    update public.user_invites
    set claimed_at = now(), claimed_by = new.id
    where id = v_invite.id;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_auth_user_confirmed() from public, anon, authenticated;

create trigger on_auth_user_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.handle_auth_user_confirmed();

-- ---------------------------------------------------------------------
-- BOOTSTRAP OWNER PERTAMA (jalankan MANUAL di SQL Editor, ganti nilainya)
-- ---------------------------------------------------------------------
-- 1) Buat company holding & undangan Owner:
--
--   insert into public.companies (code, name, is_holding)
--   values ('HOLDING', 'Nama Holding Anda', true);
--
--   insert into public.user_invites (email, company_id, role, full_name)
--   select 'email-owner@contoh.com', id, 'owner', 'Nama Owner'
--   from public.companies where code = 'HOLDING';
--
-- 2) Login / daftar dengan email tsb di aplikasi dan konfirmasi emailnya.
--    Profil Owner terbentuk otomatis.
--
-- 3) Jika akun Auth email tsb SUDAH terkonfirmasi sebelum undangan dibuat,
--    picu ulang trigger dengan:
--
--   update auth.users set email_confirmed_at = email_confirmed_at
--   where lower(email) = lower('email-owner@contoh.com');
--
-- Setelah itu Owner dapat membuat company anak usaha dan undangan karyawan
-- lain lewat aplikasi (RLS: hanya Owner yang boleh menulis ke companies,
-- users, dan user_invites).


-- =====================================================================
-- 9. VIEW & RPC TARIKAN MINGGUAN (untuk review Owner via Claude)
--
--    security_invoker = true -> view mengikuti RLS pemanggil:
--    Owner melihat semua company, Manager se-company, Employee miliknya.
--    (service_role mem-bypass RLS, cocok untuk job terjadwal di server.)
--    Minggu dihitung Senin-Minggu (week_start = hari Senin).
-- =====================================================================

create or replace view public.v_weekly_team_reports
with (security_invoker = true) as
select
  date_trunc('week', r.report_date::timestamp)::date as week_start,
  r.report_date,
  c.id               as company_id,
  c.code             as company_code,
  c.name             as company_name,
  u.id               as user_id,
  u.employee_code,
  u.full_name,
  p.code             as position_code,
  p.name             as position_name,
  p.sort_order       as position_sort,
  r.activities,
  r.performance_metrics,
  r.obstacles,
  r.insights,
  r.next_plan,
  r.evidence_links,
  r.created_at,
  r.updated_at
from public.daily_reports r
join public.users        u on u.id = r.user_id
join public.companies    c on c.id = r.company_id
left join public.roles_config p on p.id = r.position_id;

revoke all on public.v_weekly_team_reports from anon;
grant select on public.v_weekly_team_reports to authenticated;

-- RPC: tarik laporan satu minggu. Tanpa argumen = minggu berjalan (WIB).
--   select * from public.get_weekly_team_reports();                        -- minggu ini, semua company
--   select * from public.get_weekly_team_reports('2026-10-05');            -- minggu dgn Senin 5 Okt 2026
--   select * from public.get_weekly_team_reports(null, '<company_uuid>');  -- minggu ini, 1 company
create or replace function public.get_weekly_team_reports(
  p_week_start date default null,
  p_company_id uuid default null
)
returns setof public.v_weekly_team_reports
language sql
stable
security invoker
set search_path = ''
as $$
  select v.*
  from public.v_weekly_team_reports v
  where v.week_start = coalesce(
          date_trunc('week', p_week_start::timestamp)::date,
          date_trunc('week', public.today_jakarta()::timestamp)::date
        )
    and (p_company_id is null or v.company_id = p_company_id)
  order by v.company_name, v.position_sort, v.full_name, v.report_date
$$;

revoke all on function public.get_weekly_team_reports(date, uuid) from public, anon;
grant execute on function public.get_weekly_team_reports(date, uuid) to authenticated;


-- =====================================================================
-- 10. KEPATUHAN PENGISIAN LAPORAN
--
--     Siapa yang belum mengisi laporan, harian maupun rekap mingguan.
--     Yang dihitung wajib lapor: user AKTIF dengan role employee atau
--     manager (Owner tidak dihitung). Hari sebelum akun dibuat tidak
--     dihitung. Mengikuti RLS pemanggil (security invoker).
--     Hasil hanya diberikan kepada Owner/Manager (atau service_role pada job
--     server); Employee yang memanggil fungsi ini mendapat hasil kosong.
-- =====================================================================

-- 10a. Siapa yang belum mengisi pada tanggal tertentu (default: hari ini WIB)
--   select * from public.get_missing_reports();
--   select * from public.get_missing_reports('2026-10-02');
--   select * from public.get_missing_reports(null, '<company_uuid>');
create or replace function public.get_missing_reports(
  p_date       date default null,
  p_company_id uuid default null
)
returns table (
  report_date   date,
  company_id    uuid,
  company_code  text,
  company_name  text,
  user_id       uuid,
  employee_code text,
  full_name     text,
  position_code text,
  position_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(p_date, public.today_jakarta()),
    c.id, c.code, c.name,
    u.id, u.employee_code, u.full_name,
    p.code, p.name
  from public.users u
  join public.companies c on c.id = u.company_id
  left join public.roles_config p on p.id = u.position_id
  where (auth.uid() is null or (select public.current_user_role()) in ('owner', 'manager'))
    and u.is_active
    and u.role in ('employee', 'manager')
    and (p_company_id is null or u.company_id = p_company_id)
    and coalesce(p_date, public.today_jakarta())
          >= (u.created_at at time zone 'Asia/Jakarta')::date
    and not exists (
      select 1
      from public.daily_reports r
      where r.user_id = u.id
        and r.report_date = coalesce(p_date, public.today_jakarta())
    )
  order by c.name, p.sort_order, u.full_name
$$;

revoke all on function public.get_missing_reports(date, uuid) from public, anon;
grant execute on function public.get_missing_reports(date, uuid) to authenticated;

-- 10b. Rekap kepatuhan mingguan per karyawan
--   p_workdays      : hari kerja, ISO (1=Senin ... 7=Minggu). Default Senin-Sabtu.
--   p_include_today : hitung hari ini sebagai hari wajib lapor. Default true;
--                     set false jika job dijalankan sebelum jam kerja berakhir.
--   Hari yang belum tiba tidak dihitung.
--   select * from public.get_weekly_report_compliance();
--   select * from public.get_weekly_report_compliance('2026-10-05', null, '{1,2,3,4,5}');
create or replace function public.get_weekly_report_compliance(
  p_week_start     date       default null,
  p_company_id     uuid       default null,
  p_workdays       smallint[] default '{1,2,3,4,5,6}'::smallint[],
  p_include_today  boolean    default true
)
returns table (
  week_start     date,
  company_id     uuid,
  company_code   text,
  company_name   text,
  user_id        uuid,
  employee_code  text,
  full_name      text,
  position_code  text,
  position_name  text,
  expected_days  integer,
  filled_days    integer,
  missing_dates  date[],
  compliance_pct numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select date_trunc('week',
             coalesce(p_week_start, public.today_jakarta())::timestamp)::date as ws
  ),
  days as (
    select (pr.ws + g)::date as report_date
    from params pr, generate_series(0, 6) g
    where extract(isodow from (pr.ws + g))::smallint = any (p_workdays)
      and (pr.ws + g) < public.today_jakarta() + case when p_include_today then 1 else 0 end
  ),
  expected as (
    select u.id as uid, u.company_id as cid, u.employee_code as ecode,
           u.full_name as fname, u.position_id as pid, dd.report_date as rdate
    from public.users u
    cross join days dd
    where (auth.uid() is null or (select public.current_user_role()) in ('owner', 'manager'))
      and u.is_active
      and u.role in ('employee', 'manager')
      and (p_company_id is null or u.company_id = p_company_id)
      and dd.report_date >= (u.created_at at time zone 'Asia/Jakarta')::date
  )
  select
    (select ws from params),
    c.id, c.code, c.name,
    e.uid, e.ecode, e.fname,
    p.code, p.name,
    count(*)::integer,
    count(r.id)::integer,
    coalesce(array_agg(e.rdate order by e.rdate) filter (where r.id is null), '{}'::date[]),
    round(100.0 * count(r.id) / nullif(count(*), 0), 1)
  from expected e
  join public.companies c on c.id = e.cid
  left join public.roles_config p on p.id = e.pid
  left join public.daily_reports r on r.user_id = e.uid and r.report_date = e.rdate
  group by c.id, c.code, c.name, e.uid, e.ecode, e.fname, p.code, p.name, p.sort_order
  order by c.name, p.sort_order, e.fname
$$;

revoke all on function public.get_weekly_report_compliance(date, uuid, smallint[], boolean) from public, anon;
grant execute on function public.get_weekly_report_compliance(date, uuid, smallint[], boolean) to authenticated;


-- =====================================================================
-- 11. NOTULENSI MEETING
--
--     Semua peran (Owner, Manager, Employee) bisa membuat dan melihat notulensi.
--     Aturan akses:
--     - Notulensi milik company pembuatnya. Dilihat oleh semua user di company
--       itu dan oleh Owner. Company lain tidak bisa melihatnya.
--     - visibility = 'holding': dilihat SEMUA user aktif di seluruh holding.
--       Hanya Owner yang boleh membuat notulensi jenis ini (mis. rapat besar).
--     - Edit: pembuat notulensi dan Owner. Hapus: hanya Owner.
--     - Tindak lanjut (action item): PIC yang ditunjuk boleh mengubah STATUS-nya
--       sendiri; field lain hanya bisa diubah pembuat notulensi atau Owner.
--     - Nama pembuat, peserta, dan PIC disimpan sebagai salinan (snapshot) agar
--       tetap terbaca pada notulensi lintas company, walau profil orang itu
--       tidak terlihat oleh pembaca.
--     Tidak ada kunci harian: notulensi boleh dibuat dan diedit kapan saja,
--     karena sering ditulis setelah rapat selesai.
-- =====================================================================

do $mig$ begin
  create type public.meeting_visibility as enum ('company', 'holding');
exception when duplicate_object then null;
end $mig$;

do $mig$ begin
  create type public.action_item_status as enum ('open', 'in_progress', 'done');
exception when duplicate_object then null;
end $mig$;

-- ---------- 11a. meetings ----------
create table if not exists public.meetings (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null,
  created_by        uuid not null,
  created_by_name   text,
  title             text not null,
  meeting_date      date not null default public.today_jakarta(),
  start_time        time,
  end_time          time,
  location          text,
  agenda            text,
  discussion        text,
  decisions         text,
  next_meeting_date date,
  attachment_links  text[] not null default '{}',
  visibility        public.meeting_visibility not null default 'company',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint meetings_company_fk foreign key (company_id)
    references public.companies (id) on delete restrict,
  -- Isolasi company: pembuat harus berada di company yang sama dengan notulensi
  constraint meetings_creator_company_fk foreign key (created_by, company_id)
    references public.users (id, company_id) on delete restrict,
  constraint meetings_title_not_blank   check (btrim(title) <> ''),
  constraint meetings_time_order        check (end_time is null or start_time is null or end_time >= start_time),
  constraint meetings_attachments_max   check (cardinality(attachment_links) <= 20)
);

create index if not exists meetings_company_date_idx on public.meetings (company_id, meeting_date desc);
create index if not exists meetings_date_idx         on public.meetings (meeting_date desc);
create index if not exists meetings_created_by_idx   on public.meetings (created_by);
create index if not exists meetings_holding_idx      on public.meetings (meeting_date desc) where visibility = 'holding';

comment on table  public.meetings is 'Notulensi meeting. visibility=company: dilihat satu company; holding: dilihat seluruh holding (hanya dibuat Owner).';
comment on column public.meetings.location is 'Tempat atau link meeting online.';
comment on column public.meetings.attachment_links is 'Link lampiran (Drive, dokumen, dsb). Maks. 20.';

-- ---------- 11b. meeting_attendees ----------
create table if not exists public.meeting_attendees (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id    uuid references public.users (id) on delete set null,
  name       text not null,
  created_at timestamptz not null default now(),

  constraint meeting_attendees_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists meeting_attendees_user_uidx
  on public.meeting_attendees (meeting_id, user_id) where user_id is not null;
create index if not exists meeting_attendees_meeting_idx on public.meeting_attendees (meeting_id);

comment on table  public.meeting_attendees is 'Peserta meeting. user_id terisi untuk karyawan; kosong untuk tamu (isi name saja).';
comment on column public.meeting_attendees.name is 'Salinan nama. Untuk karyawan, diisi otomatis dari profil dan tidak bisa dipalsukan.';

-- ---------- 11c. meeting_action_items ----------
create table if not exists public.meeting_action_items (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references public.meetings (id) on delete cascade,
  description   text not null,
  assignee_id   uuid references public.users (id) on delete set null,
  assignee_name text,
  due_date      date,
  status        public.action_item_status not null default 'open',
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint meeting_action_items_desc_not_blank check (btrim(description) <> '')
);

create index if not exists meeting_action_items_meeting_idx  on public.meeting_action_items (meeting_id);
create index if not exists meeting_action_items_assignee_idx on public.meeting_action_items (assignee_id, status) where status <> 'done';
create index if not exists meeting_action_items_due_idx      on public.meeting_action_items (due_date) where status <> 'done';

comment on table  public.meeting_action_items is 'Tindak lanjut hasil meeting. PIC boleh mengubah status-nya sendiri.';
comment on column public.meeting_action_items.completed_at is 'Terisi otomatis saat status menjadi done.';

-- ---------- 11d. Trigger ----------
create or replace function public.meetings_fill_creator_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select u.full_name into new.created_by_name
  from public.users u where u.id = new.created_by;
  return new;
end;
$$;

create or replace function public.meeting_attendees_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text; v_cid uuid; v_mcid uuid;
begin
  if new.user_id is not null then
    select u.full_name, u.company_id into v_name, v_cid
    from public.users u where u.id = new.user_id;
    if not found then
      raise exception 'Peserta tidak ditemukan.' using errcode = '23503';
    end if;

    select m.company_id into v_mcid from public.meetings m where m.id = new.meeting_id;
    if v_cid is distinct from v_mcid
       and auth.uid() is not null
       and public.current_user_role() is distinct from 'owner' then
      raise exception 'Peserta harus berasal dari company yang sama dengan meeting.'
        using errcode = '42501';
    end if;

    new.name := v_name;  -- selalu dari profil, tidak bisa dipalsukan
  end if;
  return new;
end;
$$;

-- Dijalankan PERTAMA (nama berawalan a_): pembatas hak ubah untuk PIC
create or replace function public.meeting_action_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_creator uuid;
begin
  if v_uid is null then
    return new;                                   -- service_role / SQL Editor
  end if;
  if public.current_user_role() = 'owner' then
    return new;
  end if;

  select m.created_by into v_creator from public.meetings m where m.id = old.meeting_id;
  if v_creator = v_uid then
    return new;                                   -- pembuat notulensi
  end if;

  -- Selain pembuat dan Owner (yaitu PIC): hanya status yang boleh berubah
  if new.meeting_id    is distinct from old.meeting_id
     or new.description   is distinct from old.description
     or new.assignee_id   is distinct from old.assignee_id
     or new.assignee_name is distinct from old.assignee_name
     or new.due_date      is distinct from old.due_date then
    raise exception 'PIC hanya boleh mengubah status tindak lanjut.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.meeting_action_items_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text; v_cid uuid; v_mcid uuid; v_check boolean := false;
begin
  if new.assignee_id is not null then
    select u.full_name, u.company_id into v_name, v_cid
    from public.users u where u.id = new.assignee_id;
    if not found then
      raise exception 'PIC tidak ditemukan.' using errcode = '23503';
    end if;

    if tg_op = 'INSERT' then
      v_check := true;
    elsif new.assignee_id is distinct from old.assignee_id then
      v_check := true;
    end if;

    if v_check then
      select m.company_id into v_mcid from public.meetings m where m.id = new.meeting_id;
      if v_cid is distinct from v_mcid
         and auth.uid() is not null
         and public.current_user_role() is distinct from 'owner' then
        raise exception 'PIC harus berasal dari company yang sama dengan meeting.'
          using errcode = '42501';
      end if;
    end if;

    new.assignee_name := v_name;
  end if;

  -- completed_at mengikuti status
  if new.status = 'done' then
    if tg_op = 'UPDATE' then
      if old.status = 'done' then
        new.completed_at := old.completed_at;
      else
        new.completed_at := now();
      end if;
    else
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.meetings_fill_creator_name()        from public, anon, authenticated;
revoke all on function public.meeting_attendees_prepare()         from public, anon, authenticated;
revoke all on function public.meeting_action_items_guard()        from public, anon, authenticated;
revoke all on function public.meeting_action_items_prepare()      from public, anon, authenticated;

drop trigger if exists trg_meetings_a_creator_name on public.meetings;
create trigger trg_meetings_a_creator_name
  before insert on public.meetings
  for each row execute function public.meetings_fill_creator_name();

drop trigger if exists trg_meetings_b_updated_at on public.meetings;
create trigger trg_meetings_b_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_meeting_attendees_prepare on public.meeting_attendees;
create trigger trg_meeting_attendees_prepare
  before insert or update on public.meeting_attendees
  for each row execute function public.meeting_attendees_prepare();

drop trigger if exists trg_meeting_action_items_a_guard on public.meeting_action_items;
create trigger trg_meeting_action_items_a_guard
  before update on public.meeting_action_items
  for each row execute function public.meeting_action_items_guard();

drop trigger if exists trg_meeting_action_items_b_prepare on public.meeting_action_items;
create trigger trg_meeting_action_items_b_prepare
  before insert or update on public.meeting_action_items
  for each row execute function public.meeting_action_items_prepare();

drop trigger if exists trg_meeting_action_items_c_updated_at on public.meeting_action_items;
create trigger trg_meeting_action_items_c_updated_at
  before update on public.meeting_action_items
  for each row execute function public.set_updated_at();

-- ---------- 11e. Row Level Security ----------
alter table public.meetings             enable row level security;
alter table public.meeting_attendees    enable row level security;
alter table public.meeting_action_items enable row level security;

-- meetings
drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or company_id = (select public.current_company_id())
    or (visibility = 'holding' and (select public.current_user_role()) is not null)
  );

drop policy if exists meetings_insert_own on public.meetings;
create policy meetings_insert_own on public.meetings
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and company_id = (select public.current_company_id())
    and visibility = 'company'
  );

drop policy if exists meetings_update_own on public.meetings;
create policy meetings_update_own on public.meetings
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (
    created_by = (select auth.uid())
    and company_id = (select public.current_company_id())
    and visibility = 'company'
  );

drop policy if exists meetings_owner_all on public.meetings;
create policy meetings_owner_all on public.meetings
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

-- meeting_attendees
drop policy if exists meeting_attendees_select on public.meeting_attendees;
create policy meeting_attendees_select on public.meeting_attendees
  for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_attendees.meeting_id));

drop policy if exists meeting_attendees_creator_write on public.meeting_attendees;
create policy meeting_attendees_creator_write on public.meeting_attendees
  for all to authenticated
  using (exists (select 1 from public.meetings m
                 where m.id = meeting_attendees.meeting_id and m.created_by = (select auth.uid())))
  with check (exists (select 1 from public.meetings m
                      where m.id = meeting_attendees.meeting_id and m.created_by = (select auth.uid())));

drop policy if exists meeting_attendees_owner_all on public.meeting_attendees;
create policy meeting_attendees_owner_all on public.meeting_attendees
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

-- meeting_action_items
drop policy if exists meeting_action_items_select on public.meeting_action_items;
create policy meeting_action_items_select on public.meeting_action_items
  for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_action_items.meeting_id));

drop policy if exists meeting_action_items_creator_write on public.meeting_action_items;
create policy meeting_action_items_creator_write on public.meeting_action_items
  for all to authenticated
  using (exists (select 1 from public.meetings m
                 where m.id = meeting_action_items.meeting_id and m.created_by = (select auth.uid())))
  with check (exists (select 1 from public.meetings m
                      where m.id = meeting_action_items.meeting_id and m.created_by = (select auth.uid())));

drop policy if exists meeting_action_items_assignee_update on public.meeting_action_items;
create policy meeting_action_items_assignee_update on public.meeting_action_items
  for update to authenticated
  using (assignee_id = (select auth.uid()))
  with check (assignee_id = (select auth.uid()));

drop policy if exists meeting_action_items_owner_all on public.meeting_action_items;
create policy meeting_action_items_owner_all on public.meeting_action_items
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

-- ---------- 11f. Pembatasan kolom ----------
-- Kolom identitas (id, company_id, created_by, created_by_name, created_at, meeting_id)
-- tidak bisa diubah lewat API. Hapus notulensi hanya lewat policy Owner.
revoke all on public.meetings, public.meeting_attendees, public.meeting_action_items from anon;

revoke update on public.meetings             from authenticated;
revoke update on public.meeting_attendees    from authenticated;
revoke update on public.meeting_action_items from authenticated;

grant update (title, meeting_date, start_time, end_time, location, agenda, discussion,
              decisions, next_meeting_date, attachment_links, visibility)
  on public.meetings to authenticated;
grant update (user_id, name)
  on public.meeting_attendees to authenticated;
grant update (description, assignee_id, assignee_name, due_date, status)
  on public.meeting_action_items to authenticated;


-- =====================================================================
-- 12. HAK AKSES TABEL (GRANT)
-- =====================================================================

-- Proyek Supabase baru tidak otomatis memberi hak akses tabel ke peran API
-- (anon, authenticated). Bagian ini memberikannya secara eksplisit.
-- RLS (bagian 5, 6, 8, 11) tetap menentukan BARIS mana yang boleh disentuh.
-- Aman dijalankan ulang.

-- Pengunjung yang belum login: tidak punya hak tabel apa pun.
revoke all on all tables in schema public from anon;

-- Pengguna login: cabut hak yang tidak dipakai aplikasi.
revoke truncate, trigger, references on all tables in schema public from authenticated;

grant select on public.companies, public.roles_config, public.users,
  public.daily_reports, public.user_invites,
  public.meetings, public.meeting_attendees, public.meeting_action_items
  to authenticated;
grant select on public.v_weekly_team_reports to authenticated;

grant insert on public.companies, public.daily_reports, public.user_invites,
  public.meetings, public.meeting_attendees, public.meeting_action_items
  to authenticated;

-- Hanya Owner yang lolos RLS untuk tiga tabel ini.
grant update on public.companies, public.users, public.user_invites to authenticated;

-- Kolom yang boleh diedit (sama dengan bagian 6 dan 11f).
grant update (activities, performance_metrics, obstacles, insights, next_plan, evidence_links)
  on public.daily_reports to authenticated;
grant update (title, meeting_date, start_time, end_time, location, agenda, discussion,
              decisions, next_meeting_date, attachment_links, visibility)
  on public.meetings to authenticated;
grant update (user_id, name) on public.meeting_attendees to authenticated;
grant update (description, assignee_id, assignee_name, due_date, status)
  on public.meeting_action_items to authenticated;

-- Hapus: batalkan undangan, hapus notulensi (Owner), edit daftar
-- peserta/tindak lanjut (pembuat atau Owner).
grant delete on public.user_invites, public.meetings,
  public.meeting_attendees, public.meeting_action_items to authenticated;


-- =====================================================================
-- 13. NOTULENSI: VISIBILITAS, DRAFT -> SUBMIT, LOKASI, PERMINTAAN HAPUS
--     (sama dengan supabase/002_notulensi_submit_dan_hapus.sql)
-- =====================================================================
-- Keputusan pemilik (6 Okt 2026):
-- - SIAPA YANG MELIHAT (draft maupun submit): Owner (semua), Manager (company-nya
--   saja), dan pembuatnya sendiri. Karyawan lain TIDAK melihat notulensi.
--   Semua peran boleh membuat. Opsi "Seluruh holding" tidak dipakai lagi.
-- - Karyawan yang ditunjuk sebagai PIC hanya melihat TUGASNYA sendiri
--   (lewat get_my_action_items), bukan isi notulensinya.
-- - Notulensi berstatus DRAFT (submitted_at kosong) bisa disimpan berkali-kali
--   (manual & otomatis) oleh pembuatnya.
-- - Setelah SUBMIT, notulensi terkunci untuk pembuat. Hanya Owner yang masih
--   bisa mengoreksi. PIC tetap bisa mengubah STATUS tindak lanjutnya.
-- - Lokasi: "Kantor 1", "Kantor 2", atau "Online" (+ link di meeting_link).
-- - Pembuat tidak menghapus langsung: ia MENGAJUKAN hapus. Notulensi tetap ada
--   sampai Owner menyetujui (menghapus) atau menolak (mengosongkan permintaan).
-- =====================================================================

-- ---------- Kolom baru ----------
alter table public.meetings
  add column if not exists submitted_at          timestamptz,
  add column if not exists meeting_link          text,
  add column if not exists delete_requested_at   timestamptz,
  add column if not exists delete_request_reason text;

comment on column public.meetings.submitted_at is
  'Kosong = draft (masih bisa diedit pembuat). Terisi = sudah di-submit dan terkunci (kecuali Owner).';
comment on column public.meetings.location is
  'Lokasi meeting: Kantor 1, Kantor 2, atau Online.';
comment on column public.meetings.meeting_link is
  'Link meeting online (Zoom/Meet) bila lokasi = Online.';
comment on column public.meetings.delete_requested_at is
  'Permintaan hapus dari pembuat. Notulensi tetap ada sampai Owner menyetujui atau menolak.';

-- ---------- Siapa yang boleh melihat ----------
drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or (
      (select public.current_user_role()) = 'manager'
      and company_id = (select public.current_company_id())
    )
    or (
      created_by = (select auth.uid())
      and (select public.current_user_role()) is not null
    )
  );

-- Peserta: mengikuti notulensinya (policy meeting_attendees_select tidak berubah).
-- Tindak lanjut: mengikuti notulensinya, ditambah PIC melihat tugasnya sendiri.
drop policy if exists meeting_action_items_select on public.meeting_action_items;
create policy meeting_action_items_select on public.meeting_action_items
  for select to authenticated
  using (
    exists (select 1 from public.meetings m where m.id = meeting_action_items.meeting_id)
    or (
      assignee_id = (select auth.uid())
      and (select public.current_user_role()) is not null
    )
  );

-- Daftar "Tugas saya": tindak lanjut milik pengguna + judul & tanggal meeting,
-- tanpa membuka isi notulensi.
create or replace function public.get_my_action_items(p_include_done boolean default false)
returns table (
  id            uuid,
  meeting_id    uuid,
  meeting_title text,
  meeting_date  date,
  description   text,
  due_date      date,
  status        public.action_item_status,
  completed_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.meeting_id, m.title, m.meeting_date,
         a.description, a.due_date, a.status, a.completed_at
  from public.meeting_action_items a
  join public.meetings m on m.id = a.meeting_id
  where a.assignee_id = auth.uid()
    and public.current_user_role() is not null
    and (p_include_done or a.status <> 'done')
  order by a.due_date nulls last, m.meeting_date desc
$$;

revoke all on function public.get_my_action_items(boolean) from public, anon;
grant execute on function public.get_my_action_items(boolean) to authenticated;

-- ---------- Waktu submit selalu dari server, dan tidak bisa dibatalkan ----------
create or replace function public.meetings_submit_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.submitted_at is not null then
      new.submitted_at := now();
    end if;
    return new;
  end if;

  if new.submitted_at is distinct from old.submitted_at then
    if old.submitted_at is null then
      new.submitted_at := now();                       -- submit
    elsif auth.uid() is not null
          and public.current_user_role() is distinct from 'owner' then
      raise exception 'Notulensi yang sudah di-submit tidak bisa dibuka kembali.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.meetings_submit_guard() from public, anon, authenticated;

drop trigger if exists trg_meetings_c_submit_guard on public.meetings;
create trigger trg_meetings_c_submit_guard
  before insert or update on public.meetings
  for each row execute function public.meetings_submit_guard();

-- ---------- Pembuat hanya boleh mengubah selama masih draft ----------
drop policy if exists meetings_update_own on public.meetings;
create policy meetings_update_own on public.meetings
  for update to authenticated
  using (created_by = (select auth.uid()) and submitted_at is null)
  with check (
    created_by = (select auth.uid())
    and company_id = (select public.current_company_id())
    and visibility = 'company'
  );

drop policy if exists meeting_attendees_creator_write on public.meeting_attendees;
create policy meeting_attendees_creator_write on public.meeting_attendees
  for all to authenticated
  using (exists (select 1 from public.meetings m
                 where m.id = meeting_attendees.meeting_id
                   and m.created_by = (select auth.uid())
                   and m.submitted_at is null))
  with check (exists (select 1 from public.meetings m
                      where m.id = meeting_attendees.meeting_id
                        and m.created_by = (select auth.uid())
                        and m.submitted_at is null));

drop policy if exists meeting_action_items_creator_write on public.meeting_action_items;
create policy meeting_action_items_creator_write on public.meeting_action_items
  for all to authenticated
  using (exists (select 1 from public.meetings m
                 where m.id = meeting_action_items.meeting_id
                   and m.created_by = (select auth.uid())
                   and m.submitted_at is null))
  with check (exists (select 1 from public.meetings m
                      where m.id = meeting_action_items.meeting_id
                        and m.created_by = (select auth.uid())
                        and m.submitted_at is null));

-- Pembatas tindak lanjut: pembuat bebas mengubah hanya selama draft.
-- Setelah submit, pembuat yang juga PIC hanya boleh mengubah status.
create or replace function public.meeting_action_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_creator uuid;
  v_submitted timestamptz;
begin
  if v_uid is null then
    return new;                                   -- service_role / SQL Editor
  end if;
  if public.current_user_role() = 'owner' then
    return new;
  end if;

  select m.created_by, m.submitted_at into v_creator, v_submitted
  from public.meetings m where m.id = old.meeting_id;
  if v_creator = v_uid and v_submitted is null then
    return new;                                   -- pembuat, masih draft
  end if;

  if new.meeting_id    is distinct from old.meeting_id
     or new.description   is distinct from old.description
     or new.assignee_id   is distinct from old.assignee_id
     or new.assignee_name is distinct from old.assignee_name
     or new.due_date      is distinct from old.due_date then
    raise exception 'PIC hanya boleh mengubah status tindak lanjut.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.meeting_action_items_guard() from public, anon, authenticated;

-- ---------- Permintaan hapus (berlaku juga setelah submit) ----------
create or replace function public.request_meeting_deletion(p_meeting_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() is null then
    raise exception 'Akun tidak aktif.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Alasan permintaan hapus wajib diisi.' using errcode = '22023';
  end if;

  update public.meetings
  set delete_requested_at = now(), delete_request_reason = btrim(p_reason)
  where id = p_meeting_id and created_by = auth.uid();

  if not found then
    raise exception 'Hanya pembuat notulensi yang bisa mengajukan hapus.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.cancel_meeting_deletion(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.meetings
  set delete_requested_at = null, delete_request_reason = null
  where id = p_meeting_id
    and (created_by = auth.uid() or public.current_user_role() = 'owner');

  if not found then
    raise exception 'Permintaan hapus tidak dapat dibatalkan.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.request_meeting_deletion(uuid, text) from public, anon;
revoke all on function public.cancel_meeting_deletion(uuid) from public, anon;
grant execute on function public.request_meeting_deletion(uuid, text) to authenticated;
grant execute on function public.cancel_meeting_deletion(uuid) to authenticated;

-- ---------- Hak kolom ----------
-- delete_requested_at / delete_request_reason sengaja TIDAK dibuka untuk
-- update langsung: hanya lewat fungsi di atas (atau Owner lewat fungsi batal).
grant update (submitted_at, meeting_link) on public.meetings to authenticated;


-- =====================================================================
-- 14. BATASI AKSES BACA roles_config (hanya pengguna berprofil aktif)
--     (sama dengan supabase/003_batasi_roles_config.sql)
-- =====================================================================

drop policy if exists roles_config_select on public.roles_config;
create policy roles_config_select on public.roles_config
  for select to authenticated
  using ((select public.current_user_role()) is not null);


-- =====================================================================
-- 15. TAUTAN PENTING (inventaris link kerja per company dan divisi)
--     (sama dengan supabase/005_tautan_penting.sql)
-- =====================================================================
do $mig$ begin
  create type public.link_category as enum ('tracker', 'aset', 'sop', 'lainnya');
exception when duplicate_object then null;
end $mig$;

create table if not exists public.resource_links (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references public.companies (id) on delete cascade,
  position_ids    smallint[] not null default '{}',
  category        public.link_category not null default 'lainnya',
  title           text not null,
  url             text not null,
  description     text,
  created_by      uuid references public.users (id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint resource_links_title_ok check (btrim(title) <> '' and char_length(title) <= 120),
  constraint resource_links_url_ok   check (url ~* '^https?://[^[:space:]]+$' and char_length(url) <= 2000),
  constraint resource_links_desc_ok  check (description is null or char_length(description) <= 300),
  constraint resource_links_positions_ok check (cardinality(position_ids) <= 20)
);

create index if not exists resource_links_company_idx  on public.resource_links (company_id);

comment on table  public.resource_links is 'Inventaris tautan kerja. company_id kosong = semua company; position_ids kosong = semua divisi (bisa beberapa divisi).';
comment on column public.resource_links.company_id is 'Kosong = semua company (hanya Owner yang boleh membuat).';

-- Jabatan pengguna yang sedang login (null bila tanpa profil aktif)
create or replace function public.current_position_id()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select position_id from public.users where id = (select auth.uid()) and is_active
$$;

revoke all on function public.current_position_id() from public, anon;
grant execute on function public.current_position_id() to authenticated;

-- Pembuat dan waktu ubah diisi server (tidak bisa dipalsukan)
create or replace function public.resource_links_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
      select u.full_name into new.created_by_name from public.users u where u.id = auth.uid();
    end if;
  else
    new.created_by      := old.created_by;
    new.created_by_name := old.created_by_name;
    new.created_at      := old.created_at;
    new.updated_at      := now();
  end if;
  return new;
end;
$$;

revoke all on function public.resource_links_prepare() from public, anon, authenticated;

drop trigger if exists trg_resource_links_prepare on public.resource_links;
create trigger trg_resource_links_prepare
  before insert or update on public.resource_links
  for each row execute function public.resource_links_prepare();

-- ---------- RLS ----------
alter table public.resource_links enable row level security;

drop policy if exists resource_links_select on public.resource_links;
create policy resource_links_select on public.resource_links
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or (
      (select public.current_user_role()) = 'manager'
      and (company_id is null or company_id = (select public.current_company_id()))
    )
    or (
      (select public.current_user_role()) = 'employee'
      and (company_id is null or company_id = (select public.current_company_id()))
      and (cardinality(position_ids) = 0 or (select public.current_position_id()) = any (position_ids))
    )
  );

drop policy if exists resource_links_owner_all on public.resource_links;
create policy resource_links_owner_all on public.resource_links
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

drop policy if exists resource_links_manager_insert on public.resource_links;
create policy resource_links_manager_insert on public.resource_links
  for insert to authenticated
  with check (
    (select public.current_user_role()) = 'manager'
    and company_id = (select public.current_company_id())
  );

drop policy if exists resource_links_manager_update on public.resource_links;
create policy resource_links_manager_update on public.resource_links
  for update to authenticated
  using (
    (select public.current_user_role()) = 'manager'
    and company_id = (select public.current_company_id())
  )
  with check (
    (select public.current_user_role()) = 'manager'
    and company_id = (select public.current_company_id())
  );

drop policy if exists resource_links_manager_delete on public.resource_links;
create policy resource_links_manager_delete on public.resource_links
  for delete to authenticated
  using (
    (select public.current_user_role()) = 'manager'
    and company_id = (select public.current_company_id())
  );

-- ---------- Hak akses tabel ----------
revoke all on public.resource_links from anon;
grant select, insert, delete on public.resource_links to authenticated;
revoke update on public.resource_links from authenticated;
grant update (company_id, position_ids, category, title, url, description)
  on public.resource_links to authenticated;

-- (Instalasi lama yang memakai position_id: jalankan supabase/006_tautan_banyak_divisi.sql)


-- =====================================================================
-- 16. TARGET OMZET (per ADV, bulanan; ditetapkan Owner)
--     (sama dengan supabase/007_target_omzet.sql)
-- =====================================================================

create table if not exists public.omzet_targets (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id    uuid not null,
  month      date not null,
  amount     numeric(16, 0) not null,
  set_by     uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint omzet_targets_user_month_uk unique (user_id, month),
  -- Isolasi company: target tidak bisa menunjuk company yang berbeda dari company pemiliknya
  constraint omzet_targets_user_company_fk
    foreign key (user_id, company_id) references public.users (id, company_id) on delete cascade,
  constraint omzet_targets_month_first check (extract(day from month) = 1),
  constraint omzet_targets_amount_ok check (amount >= 0 and amount <= 1000000000000)
);

create index if not exists omzet_targets_company_month_idx on public.omzet_targets (company_id, month);

comment on table public.omzet_targets is 'Target omzet bulanan per ADV (month = tanggal 1 bulan itu). Total company dihitung dari jumlahnya.';

create or replace function public.omzet_targets_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.set_by := auth.uid(); end if;
  else
    new.set_by := coalesce(auth.uid(), old.set_by);
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.omzet_targets_prepare() from public, anon, authenticated;

drop trigger if exists trg_omzet_targets_prepare on public.omzet_targets;
create trigger trg_omzet_targets_prepare
  before insert or update on public.omzet_targets
  for each row execute function public.omzet_targets_prepare();

alter table public.omzet_targets enable row level security;

drop policy if exists omzet_targets_select on public.omzet_targets;
create policy omzet_targets_select on public.omzet_targets
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or (
      (select public.current_user_role()) = 'manager'
      and company_id = (select public.current_company_id())
    )
    or user_id = (select auth.uid())
  );

drop policy if exists omzet_targets_owner_write on public.omzet_targets;
create policy omzet_targets_owner_write on public.omzet_targets
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

revoke all on public.omzet_targets from anon;
grant select, insert, delete on public.omzet_targets to authenticated;
revoke update on public.omzet_targets from authenticated;
grant update (amount) on public.omzet_targets to authenticated;
