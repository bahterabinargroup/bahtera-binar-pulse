-- =====================================================================
-- 011 CUTI / IZIN (pengajuan + persetujuan) dan "LAPORAN HARIAN GUGUR"
-- (sama dengan bagian 18 schema_daily_report.sql)
--
-- Keputusan pemilik (14 Okt 2026):
-- - Izin, Sakit, dan Cuti membuat daily report GUGUR: orang itu tidak wajib
--   lapor pada hari itu dan tidak dihitung "belum mengisi"/tidak patuh.
--   (Tugas Luar tetap wajib lapor.)
-- - Pengajuan cuti/izin bisa jauh hari: jenis (cuti/izin), tanggal mulai,
--   tanggal selesai, alasan. Karyawan dan Manager boleh mengajukan.
-- - Yang menyetujui/menolak: Owner (semua); Manager hanya pengajuan KARYAWAN
--   di company-nya. Tidak boleh menyetujui pengajuan sendiri, jadi pengajuan
--   Manager hanya bisa disetujui Owner. Pemberi keputusan boleh menulis catatan.
-- - Pengajuan disetujui = di tanggal itu orang tidak perlu presensi (Check-In
--   ditolak), tercatat Cuti/Izin di rekap. Hari Minggu tidak dihitung.
-- - Pemohon bisa membatalkan selama belum disetujui, atau yang sudah disetujui
--   asal belum mulai.
-- Aman dijalankan ulang.
-- =====================================================================

create table if not exists public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  user_id       uuid not null,
  kind          text not null,
  start_date    date not null,
  end_date      date not null,
  reason        text not null,
  status        text not null default 'pending',
  decided_by    uuid references public.users (id) on delete set null,
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Isolasi company: company harus sama dengan company pemohon
  constraint leave_requests_user_company_fk
    foreign key (user_id, company_id) references public.users (id, company_id) on delete cascade,
  constraint leave_requests_kind_ok check (kind in ('cuti', 'izin')),
  constraint leave_requests_status_ok check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint leave_requests_dates_ok check (end_date >= start_date and end_date - start_date <= 90),
  constraint leave_requests_reason_ok check (length(btrim(reason)) > 0 and length(reason) <= 1000),
  constraint leave_requests_note_len check (decision_note is null or length(decision_note) <= 500)
);

create index if not exists leave_requests_user_idx on public.leave_requests (user_id, start_date);
create index if not exists leave_requests_company_status_idx on public.leave_requests (company_id, status);

comment on table public.leave_requests is 'Pengajuan cuti/izin. Yang sudah disetujui membuat hari itu bebas presensi dan daily report. Keputusan lewat decide_leave(), pembatalan lewat cancel_leave().';

create or replace function public.leave_requests_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.decided_by := null;
    new.decided_at := null;
    new.decision_note := null;
    if new.end_date < new.start_date then
      raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai.' using errcode = '23514';
    end if;
    if new.start_date < public.today_jakarta() then
      raise exception 'Tanggal mulai tidak boleh sebelum hari ini.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.leave_requests x
      where x.user_id = new.user_id
        and x.status in ('pending', 'approved')
        and daterange(x.start_date, x.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
    ) then
      raise exception 'Sudah ada pengajuan lain pada tanggal tersebut.' using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.leave_requests_prepare() from public, anon, authenticated;

drop trigger if exists trg_leave_requests_prepare on public.leave_requests;
create trigger trg_leave_requests_prepare
  before insert on public.leave_requests
  for each row execute function public.leave_requests_prepare();

alter table public.leave_requests enable row level security;

drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or (
      (select public.current_user_role()) = 'manager'
      and company_id = (select public.current_company_id())
    )
    or user_id = (select auth.uid())
  );

-- Mengajukan: hanya untuk diri sendiri (karyawan dan manager; Owner tidak wajib presensi)
drop policy if exists leave_requests_insert on public.leave_requests;
create policy leave_requests_insert on public.leave_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_id = (select public.current_company_id())
    and (select public.current_user_role()) in ('employee', 'manager')
  );

revoke all on public.leave_requests from anon;
revoke all on public.leave_requests from authenticated;
grant select on public.leave_requests to authenticated;
grant insert (company_id, user_id, kind, start_date, end_date, reason) on public.leave_requests to authenticated;

-- Keputusan: Owner (semua); Manager hanya pengajuan KARYAWAN di company-nya; bukan miliknya sendiri
create or replace function public.decide_leave(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.leave_requests;
  me_role public.user_role := (select public.current_user_role());
  me_company uuid := (select public.current_company_id());
  owner_role public.user_role;
begin
  if auth.uid() is null or me_role is null then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  select * into r from public.leave_requests where id = p_id for update;
  if not found then
    raise exception 'Pengajuan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'Pengajuan ini sudah diproses.' using errcode = '22023';
  end if;
  if r.user_id = auth.uid() then
    raise exception 'Tidak boleh memutuskan pengajuan sendiri.' using errcode = '42501';
  end if;
  select u.role into owner_role from public.users u where u.id = r.user_id;
  if not (
    me_role = 'owner'
    or (me_role = 'manager' and r.company_id = me_company and owner_role = 'employee')
  ) then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  if r.end_date < public.today_jakarta() then
    raise exception 'Tanggal pengajuan sudah lewat.' using errcode = '22023';
  end if;
  update public.leave_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(),
         decided_at = now(),
         decision_note = nullif(btrim(coalesce(p_note, '')), ''),
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.decide_leave(uuid, boolean, text) from public, anon;
grant execute on function public.decide_leave(uuid, boolean, text) to authenticated;

-- Pembatalan oleh pemohon: selama pending, atau sudah disetujui tetapi belum mulai
create or replace function public.cancel_leave(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.leave_requests;
begin
  select * into r from public.leave_requests where id = p_id for update;
  if not found or r.user_id is distinct from auth.uid() then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  if not (r.status = 'pending' or (r.status = 'approved' and r.start_date > public.today_jakarta())) then
    raise exception 'Pengajuan ini tidak bisa dibatalkan lagi.' using errcode = '22023';
  end if;
  update public.leave_requests set status = 'cancelled', updated_at = now() where id = p_id;
end;
$$;

revoke all on function public.cancel_leave(uuid) from public, anon;
grant execute on function public.cancel_leave(uuid) to authenticated;

-- Cuti/izin disetujui pada tanggal tertentu ('cuti' / 'izin', atau kosong). Hari Minggu tidak dihitung.
-- security invoker: yang bertanya hanya mendapat jawaban untuk orang yang boleh dilihatnya (RLS).
create or replace function public.leave_on(p_user uuid, p_date date)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select lr.kind
  from public.leave_requests lr
  where lr.user_id = p_user
    and lr.status = 'approved'
    and p_date between lr.start_date and lr.end_date
    and extract(isodow from p_date) <> 7
  order by lr.decided_at desc
  limit 1
$$;

-- "Gugur" laporan harian: Izin/Sakit lewat presensi, atau cuti/izin yang disetujui. Kosong = tetap wajib.
create or replace function public.excused_kind(p_user uuid, p_date date)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select pr.status from public.presensi pr
      where pr.user_id = p_user and pr.attendance_date = p_date and pr.status in ('izin', 'sakit')
      limit 1),
    public.leave_on(p_user, p_date)
  )
$$;

revoke all on function public.leave_on(uuid, date) from public, anon;
revoke all on function public.excused_kind(uuid, date) from public, anon;
grant execute on function public.leave_on(uuid, date) to authenticated;
grant execute on function public.excused_kind(uuid, date) to authenticated;

-- Presensi: tidak bisa Check-In pada hari cuti/izin yang sudah disetujui
create or replace function public.presensi_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if public.leave_on(new.user_id, new.attendance_date) is not null then
      raise exception 'Anda sedang cuti/izin yang sudah disetujui pada tanggal ini, tidak perlu presensi.' using errcode = '22023';
    end if;
    -- Jam masuk selalu dari server; pulang belum boleh terisi saat masuk
    new.check_in_at := now();
    -- Izin/Sakit: Check-Out otomatis saat itu juga (tidak masuk kerja)
    new.check_out_at := case when new.status in ('izin', 'sakit') then now() end;
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

-- Daftar "belum mengisi" dan kepatuhan mingguan: orang yang gugur tidak dihitung
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
    and public.excused_kind(u.id, coalesce(p_date, public.today_jakarta())) is null
  order by c.name, p.sort_order, u.full_name
$$;

revoke all on function public.get_missing_reports(date, uuid) from public, anon;
grant execute on function public.get_missing_reports(date, uuid) to authenticated;

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
      and public.excused_kind(u.id, dd.report_date) is null
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
