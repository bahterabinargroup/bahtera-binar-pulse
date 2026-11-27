-- =====================================================================
-- 025 API TARIKAN UNTUK BOT (TAHAP 1) — sama dengan bagian 29 schema_daily_report.sql
--
-- Keputusan pemilik (28 Nov 2026): bot analisis AI (server terpisah) boleh MEMBACA data
-- lewat /api/bot/v1 dengan kunci di header "Authorization: Bearer <kunci>".
-- - Jalur akses: fungsi database security definer (BUKAN kunci admin/service role).
--   Setiap fungsi bot: memeriksa kunci (hash SHA-256), membatasi laju 60 permintaan/menit/kunci,
--   mencatat pemakaian ke log audit, lalu hanya mengembalikan kolom yang diizinkan.
-- - Kunci setara Owner tetapi BACA-SAJA: semua company, filter company tersedia.
-- - Kunci asli hanya ditampilkan sekali saat dibuat; yang disimpan hanya hash-nya.
-- - Owner membuat/mencabut kunci dan melihat log di aplikasi (/owner/api-bot).
-- Tahap 1: bot_health, bot_laporan, bot_notulensi. Aman dijalankan ulang.
-- =====================================================================

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  key_prefix   text not null,
  key_hash     bytea not null unique,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.users (id) on delete set null,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  constraint api_keys_name_not_blank check (btrim(name) <> '')
);
comment on table public.api_keys is 'Kunci API bot (baca-saja). Hanya hash SHA-256 yang disimpan. Dikelola Owner lewat create_api_key/revoke_api_key.';

create table if not exists public.api_audit_log (
  id         bigint generated always as identity primary key,
  key_id     uuid references public.api_keys (id) on delete set null,
  key_name   text,
  endpoint   text not null,
  filters    jsonb not null default '{}'::jsonb,
  row_count  int,
  created_at timestamptz not null default now()
);
create index if not exists api_audit_log_key_time_idx on public.api_audit_log (key_id, created_at desc);
create index if not exists api_audit_log_time_idx on public.api_audit_log (created_at desc);
comment on table public.api_audit_log is 'Log setiap pemakaian API bot: kunci, endpoint, filter, jumlah baris, waktu.';

alter table public.api_keys enable row level security;
alter table public.api_audit_log enable row level security;

revoke all on public.api_keys, public.api_audit_log from anon, authenticated;
grant select (id, name, key_prefix, active, created_at, created_by, revoked_at, last_used_at) on public.api_keys to authenticated;
grant select on public.api_audit_log to authenticated;

drop policy if exists api_keys_owner_select on public.api_keys;
create policy api_keys_owner_select on public.api_keys
  for select to authenticated using ((select public.current_user_role()) = 'owner');

drop policy if exists api_audit_log_owner_select on public.api_audit_log;
create policy api_audit_log_owner_select on public.api_audit_log
  for select to authenticated using ((select public.current_user_role()) = 'owner');

-- ---------- Kelola kunci (Owner) ----------

create or replace function public.create_api_key(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  if auth.uid() is null or (select public.current_user_role()) is distinct from 'owner' then
    raise exception 'Hanya Owner yang bisa membuat kunci API.' using errcode = '42501';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Nama kunci wajib diisi.' using errcode = '22023';
  end if;
  v_key := 'bbp_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.api_keys (name, key_prefix, key_hash, created_by)
  values (btrim(p_name), left(v_key, 12), extensions.digest(v_key, 'sha256'), auth.uid());
  return v_key; -- ditampilkan sekali; tidak disimpan
end;
$$;

create or replace function public.revoke_api_key(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or (select public.current_user_role()) is distinct from 'owner' then
    raise exception 'Hanya Owner yang bisa mencabut kunci API.' using errcode = '42501';
  end if;
  update public.api_keys set active = false, revoked_at = coalesce(revoked_at, now()) where id = p_id;
  if not found then
    raise exception 'Kunci tidak ditemukan.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.create_api_key(text) from public, anon;
revoke all on function public.revoke_api_key(uuid) from public, anon;
grant execute on function public.create_api_key(text) to authenticated;
grant execute on function public.revoke_api_key(uuid) to authenticated;

-- ---------- Pembantu internal (tidak bisa dipanggil dari luar) ----------

-- Periksa kunci + batas laju, catat pemakaian. Mengembalikan id baris log.
-- Kunci dicocokkan lewat hash SHA-256 (yang dibandingkan hash, bukan kunci asli).
create or replace function public.bot_begin(p_key text, p_endpoint text, p_filters jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
  v_log bigint;
begin
  if p_key is null or length(p_key) < 20 or length(p_key) > 200 then
    raise exception 'Kunci API tidak valid.' using errcode = '28000';
  end if;
  select k.id, k.name into v_id, v_name
  from public.api_keys k
  where k.key_hash = extensions.digest(p_key, 'sha256') and k.active;
  if v_id is null then
    raise exception 'Kunci API tidak valid.' using errcode = '28000';
  end if;
  if (select count(*) from public.api_audit_log l where l.key_id = v_id and l.created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Terlalu banyak permintaan. Maksimal 60 per menit per kunci.' using errcode = 'P0429';
  end if;
  insert into public.api_audit_log (key_id, key_name, endpoint, filters)
  values (v_id, v_name, p_endpoint, coalesce(p_filters, '{}'::jsonb))
  returning id into v_log;
  update public.api_keys set last_used_at = now() where id = v_id;
  return v_log;
end;
$$;

-- Rentang tanggal: kosong = 7 hari terakhir (WIB); maksimal 93 hari.
create or replace function public.bot_range(p_from date, p_to date, out r_from date, out r_to date)
language plpgsql
stable
set search_path = ''
as $$
begin
  r_to := coalesce(p_to, public.today_jakarta());
  r_from := coalesce(p_from, r_to - 6);
  if r_from > r_to then
    raise exception 'Tanggal from tidak boleh setelah to.' using errcode = '22023';
  end if;
  if r_to - r_from + 1 > 93 then
    raise exception 'Rentang tanggal maksimal 93 hari per permintaan.' using errcode = '22023';
  end if;
end;
$$;

-- Kode company -> id (kosong = semua). Kode tidak dikenal = ditolak.
create or replace function public.bot_company(p_code text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  if p_code is null or btrim(p_code) = '' then
    return null;
  end if;
  select c.id into v from public.companies c where lower(c.code) = lower(btrim(p_code));
  if v is null then
    raise exception 'Company dengan kode % tidak ditemukan.', p_code using errcode = '22023';
  end if;
  return v;
end;
$$;

-- Cursor "YYYY-MM-DD|uuid" -> (tanggal, id). Kosong = dari awal.
create or replace function public.bot_cursor(p_cursor text, out c_date date, out c_id uuid)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_cursor is null or p_cursor = '' then
    c_date := null; c_id := null; return;
  end if;
  begin
    c_date := split_part(p_cursor, '|', 1)::date;
    c_id := split_part(p_cursor, '|', 2)::uuid;
  exception when others then
    raise exception 'Cursor tidak valid.' using errcode = '22023';
  end;
end;
$$;

revoke all on function public.bot_begin(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.bot_range(date, date) from public, anon, authenticated;
revoke all on function public.bot_company(text) from public, anon, authenticated;
revoke all on function public.bot_cursor(text) from public, anon, authenticated;

-- ---------- Endpoint bot ----------

create or replace function public.bot_health(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint := public.bot_begin(p_key, 'health', '{}'::jsonb);
begin
  update public.api_audit_log set row_count = 0 where id = v_log;
  return jsonb_build_object('ok', true, 'versi', 'v1');
end;
$$;

-- Laporan harian: isi sama dengan tarikan laporan JSON (15 kolom). p_fields='ringkas' = identitas + teks bebas.
create or replace function public.bot_laporan(
  p_key text,
  p_from date default null,
  p_to date default null,
  p_company text default null,
  p_position text default null,
  p_employee text default null,
  p_fields text default null,
  p_cursor text default null,
  p_limit int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint;
  v_from date; v_to date;
  v_company uuid;
  v_pos int;
  c_date date; c_id uuid;
  v_limit int := coalesce(p_limit, 50);
  v_total bigint;
  v_rows jsonb;
  v_n int;
  v_next text;
begin
  v_log := public.bot_begin(p_key, 'laporan', jsonb_strip_nulls(jsonb_build_object(
    'from', p_from, 'to', p_to, 'company', p_company, 'position', p_position,
    'employee', p_employee, 'fields', p_fields, 'cursor', p_cursor, 'limit', p_limit)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  v_company := public.bot_company(p_company);
  if v_limit < 1 or v_limit > 200 then
    raise exception 'limit harus 1 sampai 200.' using errcode = '22023';
  end if;
  if p_fields is not null and p_fields not in ('lengkap', 'ringkas') then
    raise exception 'fields hanya boleh ringkas atau lengkap.' using errcode = '22023';
  end if;
  if p_position is not null and btrim(p_position) <> '' then
    select p.id into v_pos from public.roles_config p where upper(p.code) = upper(btrim(p_position));
    if v_pos is null then
      raise exception 'Jabatan % tidak dikenal.', p_position using errcode = '22023';
    end if;
  end if;
  select x.c_date, x.c_id into c_date, c_id from public.bot_cursor(p_cursor) x;

  with base as (
    select r.id, r.report_date,
      case when p_fields = 'ringkas' then jsonb_build_object(
        'report_date', r.report_date, 'company_code', c.code, 'company_name', c.name,
        'employee_code', u.employee_code, 'full_name', u.full_name,
        'position_code', p.code, 'position_name', p.name,
        'insights', r.insights, 'obstacles', r.obstacles, 'next_plan', r.next_plan)
      else jsonb_build_object(
        'week_start', date_trunc('week', r.report_date::timestamp)::date, 'report_date', r.report_date,
        'company_code', c.code, 'company_name', c.name,
        'employee_code', u.employee_code, 'full_name', u.full_name,
        'position_code', p.code, 'position_name', p.name,
        'activities', r.activities, 'performance_metrics', r.performance_metrics,
        'insights', r.insights, 'obstacles', r.obstacles, 'next_plan', r.next_plan,
        'evidence_links', r.evidence_links, 'updated_at', r.updated_at)
      end as obj
    from public.daily_reports r
    join public.users u on u.id = r.user_id
    join public.companies c on c.id = r.company_id
    left join public.roles_config p on p.id = r.position_id
    where r.report_date between v_from and v_to
      and (v_company is null or r.company_id = v_company)
      and (v_pos is null or r.position_id = v_pos)
      and (p_employee is null or btrim(p_employee) = '' or lower(u.employee_code) = lower(btrim(p_employee)))
  ), page as (
    select b.* from base b
    where c_date is null or (b.report_date, b.id) > (c_date, c_id)
    order by b.report_date, b.id
    limit v_limit + 1
  ), numbered as (
    select page.*, row_number() over (order by report_date, id) rn from page
  )
  select (select count(*) from base),
         coalesce(jsonb_agg(obj order by rn) filter (where rn <= v_limit), '[]'::jsonb),
         count(*) filter (where rn <= v_limit),
         case when count(*) > v_limit then
           (select n2.report_date::text || '|' || n2.id::text from numbered n2 where n2.rn = v_limit)
         end
    into v_total, v_rows, v_n, v_next
  from numbered;

  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object('data', v_rows, 'next_cursor', v_next, 'total', v_total,
                            'from', v_from, 'to', v_to);
end;
$$;

-- Notulensi: isi sama dengan tarikan notulensi JSON (termasuk Draft, peserta, tindak lanjut).
create or replace function public.bot_notulensi(
  p_key text,
  p_from date default null,
  p_to date default null,
  p_company text default null,
  p_cursor text default null,
  p_limit int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint;
  v_from date; v_to date;
  v_company uuid;
  c_date date; c_id uuid;
  v_limit int := coalesce(p_limit, 50);
  v_total bigint;
  v_rows jsonb;
  v_n int;
  v_next text;
begin
  v_log := public.bot_begin(p_key, 'notulensi', jsonb_strip_nulls(jsonb_build_object(
    'from', p_from, 'to', p_to, 'company', p_company, 'cursor', p_cursor, 'limit', p_limit)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  v_company := public.bot_company(p_company);
  if v_limit < 1 or v_limit > 200 then
    raise exception 'limit harus 1 sampai 200.' using errcode = '22023';
  end if;
  select x.c_date, x.c_id into c_date, c_id from public.bot_cursor(p_cursor) x;

  select count(*) into v_total from public.meetings m
  where m.meeting_date between v_from and v_to and (v_company is null or m.company_id = v_company);

  with page as (
    select m.* from public.meetings m
    where m.meeting_date between v_from and v_to
      and (v_company is null or m.company_id = v_company)
      and (c_date is null or (m.meeting_date, m.id) > (c_date, c_id))
    order by m.meeting_date, m.id
    limit v_limit + 1
  ), numbered as (
    select page.*, row_number() over (order by meeting_date, id) rn from page
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'meeting_date', n.meeting_date,
           'company_name', c.name,
           'title', n.title,
           'status', case when n.submitted_at is null then 'Draft' else 'Submit' end,
           'created_by_name', n.created_by_name,
           'start_time', to_char(n.start_time, 'HH24:MI'),
           'end_time', to_char(n.end_time, 'HH24:MI'),
           'location', n.location,
           'meeting_link', n.meeting_link,
           'agenda', n.agenda,
           'discussion', n.discussion,
           'decisions', n.decisions,
           'next_meeting_date', n.next_meeting_date,
           'attendees', coalesce((select jsonb_agg(a.name order by a.created_at) from public.meeting_attendees a where a.meeting_id = n.id), '[]'::jsonb),
           'action_items', coalesce((select jsonb_agg(jsonb_build_object(
               'description', ai.description, 'pic', ai.assignee_name, 'due_date', ai.due_date,
               'status', case ai.status when 'open' then 'Open' when 'in_progress' then 'Sedang dikerjakan' else 'Selesai' end)
               order by ai.created_at) from public.meeting_action_items ai where ai.meeting_id = n.id), '[]'::jsonb),
           'attachment_links', coalesce(to_jsonb(n.attachment_links), '[]'::jsonb),
           'submitted_at', n.submitted_at,
           'updated_at', n.updated_at
         ) order by n.rn) filter (where n.rn <= v_limit), '[]'::jsonb),
         count(*) filter (where n.rn <= v_limit),
         case when count(*) > v_limit then
           (select n2.meeting_date::text || '|' || n2.id::text from numbered n2 where n2.rn = v_limit)
         end
    into v_rows, v_n, v_next
  from numbered n
  join public.companies c on c.id = n.company_id;

  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object('data', v_rows, 'next_cursor', v_next, 'total', v_total,
                            'from', v_from, 'to', v_to);
end;
$$;

revoke all on function public.bot_health(text) from public;
revoke all on function public.bot_laporan(text, date, date, text, text, text, text, text, int) from public;
revoke all on function public.bot_notulensi(text, date, date, text, text, int) from public;
grant execute on function public.bot_health(text) to anon, authenticated;
grant execute on function public.bot_laporan(text, date, date, text, text, text, text, text, int) to anon, authenticated;
grant execute on function public.bot_notulensi(text, date, date, text, text, int) to anon, authenticated;
