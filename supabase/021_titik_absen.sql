-- =====================================================================
-- 021 TITIK LOKASI ABSEN + RADIUS (sama dengan bagian 25 schema_daily_report.sql)
--
-- Keputusan pemilik (17 Nov 2026): absen WFO (Check-In dan Check-Out) hanya bisa
-- dalam radius 15 meter dari titik yang ditetapkan Owner.
-- - Titik per company, boleh lebih dari satu (mis. Kantor 1, Kantor 2). Owner mengelola;
--   peran lain hanya membaca titik company-nya.
-- - Berlaku hanya untuk status WFO. Tugas Luar, Izin, Sakit bebas lokasi.
-- - Akurasi GPS harus <= 25 m; tanpa lokasi atau akurasi buruk = ditolak.
-- - Company TANPA titik aktif belum dibatasi (agar tidak ada yang terkunci sebelum titik diisi).
-- - Data presensi lama tidak diubah. Radius disimpan per titik (default 15 m, bisa diubah Owner).
-- Aman dijalankan ulang.
-- =====================================================================

-- Titik absen per company (boleh lebih dari satu). radius_m = jarak maksimal dari titik (meter).
create table if not exists public.presensi_locations (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name       text not null,
  lat        numeric(9, 6) not null,
  lng        numeric(9, 6) not null,
  radius_m   integer not null default 15,
  is_active  boolean not null default true,
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint presensi_locations_name_len check (length(btrim(name)) between 1 and 80),
  constraint presensi_locations_lat_ok check (lat between -90 and 90),
  constraint presensi_locations_lng_ok check (lng between -180 and 180),
  constraint presensi_locations_radius_ok check (radius_m between 5 and 500)
);

create index if not exists presensi_locations_company_idx on public.presensi_locations (company_id) where is_active;

comment on table public.presensi_locations is 'Titik lokasi absen WFO per company. Check-In/Out WFO harus berada dalam radius_m meter dari salah satu titik aktif company-nya. Company tanpa titik aktif belum dibatasi.';

alter table public.presensi_locations enable row level security;

-- Dilihat: Owner semua; peran lain hanya titik company-nya (aplikasi menampilkan jarak ke titik).
drop policy if exists presensi_locations_select on public.presensi_locations;
create policy presensi_locations_select on public.presensi_locations
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or (company_id = (select public.current_company_id()) and (select public.current_user_role()) is not null)
  );

-- Dikelola hanya Owner
drop policy if exists presensi_locations_insert on public.presensi_locations;
create policy presensi_locations_insert on public.presensi_locations
  for insert to authenticated
  with check ((select public.current_user_role()) = 'owner');

drop policy if exists presensi_locations_update on public.presensi_locations;
create policy presensi_locations_update on public.presensi_locations
  for update to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

drop policy if exists presensi_locations_delete on public.presensi_locations;
create policy presensi_locations_delete on public.presensi_locations
  for delete to authenticated
  using ((select public.current_user_role()) = 'owner');

revoke all on public.presensi_locations from anon;
revoke all on public.presensi_locations from authenticated;
grant select on public.presensi_locations to authenticated;
grant insert (company_id, name, lat, lng, radius_m, is_active) on public.presensi_locations to authenticated;
grant update (name, lat, lng, radius_m, is_active) on public.presensi_locations to authenticated;
grant delete on public.presensi_locations to authenticated;

-- Jarak dua titik di bumi (meter), rumus haversine.
create or replace function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

-- Penjaga lokasi untuk WFO: Check-In (INSERT) dan Check-Out (UPDATE yang mengisi foto pulang).
-- Hanya berlaku bila company punya minimal satu titik aktif. Tugas Luar, Izin, Sakit bebas lokasi.
create or replace function public.presensi_check_lokasi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lat numeric;
  v_lng numeric;
  v_acc integer;
  v_dist double precision;
  v_radius integer;
begin
  if new.status <> 'wfo' then
    return new;
  end if;
  if not exists (select 1 from public.presensi_locations l where l.company_id = new.company_id and l.is_active) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_lat := new.check_in_lat; v_lng := new.check_in_lng; v_acc := new.check_in_accuracy_m;
  else
    if new.check_out_photo_path is null then
      return new; -- belum Check-Out
    end if;
    v_lat := new.check_out_lat; v_lng := new.check_out_lng; v_acc := new.check_out_accuracy_m;
  end if;

  if v_lat is null or v_lng is null then
    raise exception 'Lokasi belum terbaca. Aktifkan GPS dan izin lokasi, lalu coba lagi. Absen WFO wajib di lokasi kantor.' using errcode = '22023';
  end if;
  if v_acc is null or v_acc > 25 then
    raise exception 'Akurasi GPS kurang tepat (lebih dari 25 m). Tunggu sebentar atau pindah ke tempat terbuka, lalu ambil lokasi ulang.' using errcode = '22023';
  end if;

  select d, r into v_dist, v_radius
  from (
    select public.distance_m(v_lat::double precision, v_lng::double precision, l.lat::double precision, l.lng::double precision) as d, l.radius_m as r
    from public.presensi_locations l
    where l.company_id = new.company_id and l.is_active
  ) x
  order by (d <= r) desc, d
  limit 1;

  if v_dist > v_radius then
    raise exception 'Anda berada sekitar % m dari titik absen terdekat. Absen WFO hanya bisa dalam radius % m.', round(v_dist)::int, v_radius using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.presensi_check_lokasi() from public, anon, authenticated;

drop trigger if exists trg_presensi_lokasi on public.presensi;
create trigger trg_presensi_lokasi
  before insert or update on public.presensi
  for each row execute function public.presensi_check_lokasi();
