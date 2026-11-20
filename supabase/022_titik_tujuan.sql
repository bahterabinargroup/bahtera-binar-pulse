-- =====================================================================
-- 022 TITIK TUJUAN TUGAS LUAR (sama dengan bagian 26 schema_daily_report.sql)
--
-- Keputusan pemilik (20 Nov 2026): Tugas Luar juga dibatasi lokasi. Check-In dan Check-Out
-- Tugas Luar hanya bisa dalam radius dari "titik tujuan" yang SUDAH didaftarkan (mis. "Redigma").
-- - Memakai tabel presensi_locations dengan kolom baru kind: 'kantor' (WFO) atau 'tujuan' (Tugas Luar).
-- - Titik kantor: hanya Owner yang mengelola (tetap). Titik tujuan: Owner dan Manager company-nya.
-- - Radius bawaan tujuan 50 m (diatur di aplikasi), boleh 5-500 m per titik.
-- - Tujuan belum terdaftar = Tugas Luar ditolak ("daftarkan dulu"), KECUALI company belum punya
--   satu pun titik tujuan aktif (belum dibatasi, agar tidak ada yang terkunci sebelum diisi).
-- - Akurasi GPS <= 25 m, sama seperti WFO. Izin dan Sakit tetap bebas lokasi.
-- - Data presensi lama tidak diubah. Titik lama otomatis berjenis 'kantor'.
-- Aman dijalankan ulang.
-- =====================================================================

alter table public.presensi_locations
  add column if not exists kind text not null default 'kantor';

alter table public.presensi_locations drop constraint if exists presensi_locations_kind_ok;
alter table public.presensi_locations
  add constraint presensi_locations_kind_ok check (kind in ('kantor', 'tujuan'));

drop index if exists public.presensi_locations_company_idx;
create index if not exists presensi_locations_company_idx on public.presensi_locations (company_id, kind) where is_active;

comment on column public.presensi_locations.kind is 'kantor = titik absen WFO (Owner saja yang mengelola); tujuan = titik tujuan Tugas Luar (Owner dan Manager company-nya).';

-- Dikelola: Owner semua jenis; Manager hanya jenis 'tujuan' di company-nya.
drop policy if exists presensi_locations_insert on public.presensi_locations;
create policy presensi_locations_insert on public.presensi_locations
  for insert to authenticated
  with check (
    (select public.current_user_role()) = 'owner'
    or ((select public.current_user_role()) = 'manager' and kind = 'tujuan' and company_id = (select public.current_company_id()))
  );

drop policy if exists presensi_locations_update on public.presensi_locations;
create policy presensi_locations_update on public.presensi_locations
  for update to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or ((select public.current_user_role()) = 'manager' and kind = 'tujuan' and company_id = (select public.current_company_id()))
  )
  with check (
    (select public.current_user_role()) = 'owner'
    or ((select public.current_user_role()) = 'manager' and kind = 'tujuan' and company_id = (select public.current_company_id()))
  );

drop policy if exists presensi_locations_delete on public.presensi_locations;
create policy presensi_locations_delete on public.presensi_locations
  for delete to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or ((select public.current_user_role()) = 'manager' and kind = 'tujuan' and company_id = (select public.current_company_id()))
  );

-- kind boleh diisi saat membuat titik, tidak bisa diubah sesudahnya.
revoke insert on public.presensi_locations from authenticated;
grant insert (company_id, name, lat, lng, radius_m, is_active, kind) on public.presensi_locations to authenticated;

-- Penjaga lokasi: WFO terhadap titik 'kantor', Tugas Luar terhadap titik 'tujuan'.
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
  v_kind text;
  v_label text;
begin
  if new.status = 'wfo' then
    v_kind := 'kantor'; v_label := 'titik absen kantor';
  elsif new.status = 'tugas_luar' then
    v_kind := 'tujuan'; v_label := 'titik tujuan Tugas Luar';
  else
    return new;
  end if;
  if not exists (select 1 from public.presensi_locations l where l.company_id = new.company_id and l.is_active and l.kind = v_kind) then
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
    raise exception 'Lokasi belum terbaca. Aktifkan GPS dan izin lokasi, lalu coba lagi. Absen % wajib di lokasi yang ditentukan.', case when v_kind = 'kantor' then 'WFO' else 'Tugas Luar' end using errcode = '22023';
  end if;
  if v_acc is null or v_acc > 25 then
    raise exception 'Akurasi GPS kurang tepat (lebih dari 25 m). Tunggu sebentar atau pindah ke tempat terbuka, lalu ambil lokasi ulang.' using errcode = '22023';
  end if;

  select d, r into v_dist, v_radius
  from (
    select public.distance_m(v_lat::double precision, v_lng::double precision, l.lat::double precision, l.lng::double precision) as d, l.radius_m as r
    from public.presensi_locations l
    where l.company_id = new.company_id and l.is_active and l.kind = v_kind
  ) x
  order by (d <= r) desc, d
  limit 1;

  if v_dist > v_radius then
    if v_kind = 'kantor' then
      raise exception 'Anda berada sekitar % m dari titik absen terdekat. Absen WFO hanya bisa dalam radius % m.', round(v_dist)::int, v_radius using errcode = '22023';
    else
      raise exception 'Anda berada sekitar % m dari titik tujuan terdekat. Tugas Luar hanya bisa dalam radius % m dari tujuan yang sudah didaftarkan. Minta Owner atau Manager mendaftarkan tujuan Anda dulu.', round(v_dist)::int, v_radius using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.presensi_check_lokasi() from public, anon, authenticated;
