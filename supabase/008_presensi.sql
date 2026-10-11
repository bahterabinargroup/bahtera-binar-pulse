-- =====================================================================
-- 008 PRESENSI HARIAN (sama dengan bagian 17 schema_daily_report.sql)
-- Check-In pagi + Check-Out sore. Nama, company, jabatan, tanggal, dan jam
-- TIDAK diinput karyawan: diambil dari akun login dan jam server (WIB).
--
-- Keputusan pemilik (11 Okt 2026):
-- - Status: WFO Bahtera, WFO Depkes, WFO Redigma, Tugas Luar, Izin, Sakit.
-- - Catatan wajib bila Tugas Luar / Izin / Sakit.
-- - Lokasi GPS dan foto hanya TERCATAT (tidak menolak berdasarkan jarak).
-- - Check-Out wajib foto; hanya bisa setelah Check-In hari yang sama.
-- - Yang melihat: Owner semua; Manager company-nya; Karyawan miliknya.
-- - Hari lampau terkunci (tidak ada koreksi di tahap ini). Tidak ada hapus.
-- Foto disimpan di bucket privat "presensi" (Supabase Storage), sudah
-- dikompres di ponsel (< 200 KB). Aman dijalankan ulang.
-- =====================================================================

create table if not exists public.presensi (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null,
  user_id          uuid not null,
  position_id      smallint references public.roles_config (id),
  attendance_date  date not null default public.today_jakarta(),

  status           text not null,
  note             text,

  check_in_at          timestamptz not null default now(),
  check_in_lat         numeric(9, 6),
  check_in_lng         numeric(9, 6),
  check_in_accuracy_m  integer,
  check_in_photo_path  text,

  check_out_at          timestamptz,
  check_out_lat         numeric(9, 6),
  check_out_lng         numeric(9, 6),
  check_out_accuracy_m  integer,
  check_out_photo_path  text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint presensi_user_date_uk unique (user_id, attendance_date),
  -- Isolasi company: company harus sama dengan company pemilik presensi
  constraint presensi_user_company_fk
    foreign key (user_id, company_id) references public.users (id, company_id) on delete cascade,
  constraint presensi_status_ok check (status in ('wfo_bahtera', 'wfo_depkes', 'wfo_redigma', 'tugas_luar', 'izin', 'sakit')),
  constraint presensi_note_required check (
    status in ('wfo_bahtera', 'wfo_depkes', 'wfo_redigma') or length(btrim(coalesce(note, ''))) > 0
  ),
  constraint presensi_note_len check (note is null or length(note) <= 1000),
  constraint presensi_in_gps_ok check (
    (check_in_lat is null) = (check_in_lng is null)
    and (check_in_lat is null or (check_in_lat between -90 and 90 and check_in_lng between -180 and 180))
  ),
  constraint presensi_out_gps_ok check (
    (check_out_lat is null) = (check_out_lng is null)
    and (check_out_lat is null or (check_out_lat between -90 and 90 and check_out_lng between -180 and 180))
  ),
  -- Pulang wajib foto
  constraint presensi_out_photo_required check (check_out_at is null or check_out_photo_path is not null),
  constraint presensi_paths_len check (
    length(coalesce(check_in_photo_path, '')) <= 300 and length(coalesce(check_out_photo_path, '')) <= 300
  )
);

create index if not exists presensi_company_date_idx on public.presensi (company_id, attendance_date);

comment on table public.presensi is 'Presensi harian: satu baris per karyawan per hari (check-in pagi, check-out sore). Link peta dibuat aplikasi dari lat/lng.';
comment on column public.presensi.check_in_photo_path is 'Alamat berkas foto di bucket privat "presensi": {company_id}/{user_id}/{nama-berkas}.';

create or replace function public.presensi_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Jam masuk selalu dari server; pulang belum boleh terisi saat masuk
    new.check_in_at := now();
    new.check_out_at := null;
    if new.position_id is null then
      select u.position_id into new.position_id from public.users u where u.id = new.user_id;
    end if;
  else
    -- Hanya kolom pulang yang bisa berubah (dijaga juga oleh hak kolom); jam pulang dari server
    new.check_out_at := case when new.check_out_photo_path is not null then now() end;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.presensi_prepare() from public, anon, authenticated;

drop trigger if exists trg_presensi_prepare on public.presensi;
create trigger trg_presensi_prepare
  before insert or update on public.presensi
  for each row execute function public.presensi_prepare();

alter table public.presensi enable row level security;

drop policy if exists presensi_select on public.presensi;
create policy presensi_select on public.presensi
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or (
      (select public.current_user_role()) = 'manager'
      and company_id = (select public.current_company_id())
    )
    or user_id = (select auth.uid())
  );

-- Check-In: hanya untuk diri sendiri, company sendiri, HARI INI (WIB)
drop policy if exists presensi_insert on public.presensi;
create policy presensi_insert on public.presensi
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_id = (select public.current_company_id())
    and attendance_date = public.today_jakarta()
  );

-- Check-Out: baris sendiri, hari ini, dan belum pulang (sekali saja)
drop policy if exists presensi_update on public.presensi;
create policy presensi_update on public.presensi
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and attendance_date = public.today_jakarta()
    and check_out_at is null
  )
  with check (user_id = (select auth.uid()));

revoke all on public.presensi from anon;
revoke all on public.presensi from authenticated;
grant select on public.presensi to authenticated;
grant insert (company_id, user_id, status, note, check_in_lat, check_in_lng, check_in_accuracy_m, check_in_photo_path)
  on public.presensi to authenticated;
grant update (check_out_lat, check_out_lng, check_out_accuracy_m, check_out_photo_path)
  on public.presensi to authenticated;

-- ---------------------------------------------------------------------
-- Bucket foto presensi (privat). Batas 512 KB per berkas sebagai pengaman
-- (aplikasi mengompres ke < 200 KB). Nama berkas: {company_id}/{user_id}/...
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('presensi', 'presensi', false, 524288, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = 524288, allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png'];

drop policy if exists presensi_foto_select on storage.objects;
create policy presensi_foto_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'presensi'
    and (
      (select public.current_user_role()) = 'owner'
      or (
        (select public.current_user_role()) = 'manager'
        and (storage.foldername(name))[1] = (select public.current_company_id())::text
      )
      or (storage.foldername(name))[2] = (select auth.uid())::text
    )
  );

-- Unggah hanya ke folder sendiri. Tidak ada ubah/hapus (nama berkas selalu baru).
drop policy if exists presensi_foto_insert on storage.objects;
create policy presensi_foto_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'presensi'
    and (storage.foldername(name))[1] = (select public.current_company_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
