-- =====================================================================
-- 014 WEWENANG LEAD (sama dengan bagian 20 schema_daily_report.sql)
-- Jalankan SETELAH 013.
--
-- Keputusan pemilik (15 Okt 2026):
-- - Urutan: Owner > Manager > Lead > Karyawan. Di satu divisi boleh ada 1 atau
--   lebih Lead. Mentor (ADV MH) = Lead berjabatan ADV MH.
-- - Lead HANYA MELIHAT (tidak bisa mengubah): daily report, presensi (termasuk
--   lokasi dan foto), pengajuan cuti/izin, dan daftar belum mengisi milik
--   KARYAWAN BIASA berjabatan sama di company yang sama. Lead tidak melihat
--   Manager, sesama Lead, divisi lain, maupun company lain.
-- - Lead tetap wajib lapor dan presensi sendiri, boleh mengajukan cuti/izin
--   (diputuskan Manager atau Owner), dan memakai tautan/notulensi seperti karyawan.
-- - Lead TIDAK menyetujui cuti/izin.
-- Aman dijalankan ulang.
-- =====================================================================

-- Boleh dilihat Lead yang sedang login? (karyawan biasa, jabatan sama, company sama)
create or replace function public.lead_can_view(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users me
    join public.users t on t.company_id = me.company_id and t.position_id = me.position_id
    where me.id = (select auth.uid())
      and me.is_active
      and me.role = 'lead'
      and me.position_id is not null
      and t.id = p_user
      and t.role = 'employee'
  )
$$;

-- Untuk foto presensi: nama berkas {company_id}/{user_id}/... (aman bila bentuknya salah)
create or replace function public.lead_can_view_folder(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (storage.foldername(p_name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then public.lead_can_view(((storage.foldername(p_name))[2])::uuid)
    else false
  end
$$;

revoke all on function public.lead_can_view(uuid) from public, anon;
revoke all on function public.lead_can_view_folder(text) from public, anon;
grant execute on function public.lead_can_view(uuid) to authenticated;
grant execute on function public.lead_can_view_folder(text) to authenticated;

-- Daily report: Lead melihat laporan karyawan biasa di divisinya
drop policy if exists daily_reports_select on public.daily_reports;
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
    or (
      (select public.current_user_role()) = 'lead'
      and public.lead_can_view(user_id)
    )
  );

-- Presensi
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
    or (
      (select public.current_user_role()) = 'lead'
      and public.lead_can_view(user_id)
    )
  );

-- Foto presensi
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
      or (
        (select public.current_user_role()) = 'lead'
        and public.lead_can_view_folder(name)
      )
    )
  );

-- Pengajuan cuti/izin: Lead boleh mengajukan sendiri dan MELIHAT milik karyawan divisinya
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
    or (
      (select public.current_user_role()) = 'lead'
      and public.lead_can_view(user_id)
    )
  );

drop policy if exists leave_requests_insert on public.leave_requests;
create policy leave_requests_insert on public.leave_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_id = (select public.current_company_id())
    and (select public.current_user_role()) in ('employee', 'lead', 'manager')
  );

-- Tautan penting: Lead melihat seperti karyawan (company-nya dan divisinya)
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
      (select public.current_user_role()) in ('employee', 'lead')
      and (company_id is null or company_id = (select public.current_company_id()))
      and (cardinality(position_ids) = 0 or (select public.current_position_id()) = any (position_ids))
    )
  );

-- Keputusan cuti/izin: Manager boleh memutuskan pengajuan karyawan DAN Lead di company-nya
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
    or (me_role = 'manager' and r.company_id = me_company and owner_role in ('employee', 'lead'))
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

create or replace function public.decide_leave_cancel(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.leave_requests;
  me_role public.user_role := (select public.current_user_role());
  me_company uuid := (select public.current_company_id());
  req_role public.user_role;
  today date := public.today_jakarta();
begin
  if auth.uid() is null or me_role is null then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  select * into r from public.leave_requests where id = p_id for update;
  if not found then
    raise exception 'Pengajuan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if r.status <> 'approved' or r.cancel_requested_at is null or r.cancel_outcome is not null then
    raise exception 'Tidak ada pengajuan pembatalan yang menunggu keputusan.' using errcode = '22023';
  end if;
  if r.user_id = auth.uid() then
    raise exception 'Tidak boleh memutuskan pengajuan sendiri.' using errcode = '42501';
  end if;
  select u.role into req_role from public.users u where u.id = r.user_id;
  if not (
    me_role = 'owner'
    or (me_role = 'manager' and r.company_id = me_company and req_role in ('employee', 'lead'))
  ) then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  if r.end_date < today then
    raise exception 'Cuti/izin ini sudah berakhir.' using errcode = '22023';
  end if;

  if p_approve then
    if r.start_date >= today then
      update public.leave_requests
         set status = 'cancelled',
             cancel_outcome = 'approved', cancel_decided_by = auth.uid(), cancel_decided_at = now(),
             cancel_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
       where id = p_id;
    else
      update public.leave_requests
         set end_date = today - 1,
             cancel_outcome = 'approved', cancel_decided_by = auth.uid(), cancel_decided_at = now(),
             cancel_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
       where id = p_id;
    end if;
  else
    update public.leave_requests
       set cancel_outcome = 'rejected', cancel_decided_by = auth.uid(), cancel_decided_at = now(),
           cancel_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
     where id = p_id;
  end if;
end;
$$;

revoke all on function public.decide_leave_cancel(uuid, boolean, text) from public, anon;
grant execute on function public.decide_leave_cancel(uuid, boolean, text) to authenticated;

-- Daftar "belum mengisi" dan kepatuhan mingguan: Lead melihat karyawan biasa di divisinya;
-- Lead ikut dihitung wajib lapor.
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
  where (
      auth.uid() is null
      or (select public.current_user_role()) in ('owner', 'manager')
      or ((select public.current_user_role()) = 'lead' and public.lead_can_view(u.id))
    )
    and u.is_active
    and u.role in ('employee', 'lead', 'manager')
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
    where (
        auth.uid() is null
        or (select public.current_user_role()) in ('owner', 'manager')
        or ((select public.current_user_role()) = 'lead' and public.lead_can_view(u.id))
      )
      and u.is_active
      and u.role in ('employee', 'lead', 'manager')
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
