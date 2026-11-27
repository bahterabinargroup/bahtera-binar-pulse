-- =====================================================================
-- 026 API BOT TAHAP 2 + 3 — sama dengan bagian 30 schema_daily_report.sql
--
-- Lanjutan 025 (permintaan pemilik 28 Nov 2026). Pola keamanan SAMA: setiap fungsi memanggil bot_begin
-- (cek hash kunci, batas laju 60/menit, log audit), security definer, hanya kolom yang diizinkan.
-- TIDAK PERNAH dikirim: foto/selfie (check_in_photo_path, check_out_photo_path), koordinat & akurasi GPS,
-- email, no. HP, password, token.
-- Data mentah: bot_hari_libur, bot_cuti, bot_presensi, bot_kendala, bot_pengguna, bot_target.
-- Ringkasan (dihitung di database): bot_ringkasan_kepatuhan, bot_ringkasan_tindak_lanjut,
--   bot_ringkasan_magang, bot_ringkasan_konten, bot_ringkasan_adv.
-- Aman dijalankan ulang.
-- =====================================================================

-- Angka dari isian form: angka JSON apa adanya; teks "1.736.279" / "Rp 785.300" / "12,5" diubah ke angka;
-- selain itu (kosong, teks bebas) = null (BUKAN 0).
create or replace function public.bot_num(v jsonb)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text;
begin
  if v is null or jsonb_typeof(v) = 'null' then return null; end if;
  if jsonb_typeof(v) = 'number' then return (v #>> '{}')::numeric; end if;
  if jsonb_typeof(v) <> 'string' then return null; end if;
  t := regexp_replace(lower(v #>> '{}'), '(rp|\s)', '', 'g');
  if t ~ '^-?\d{1,3}(\.\d{3})+(,\d+)?$' then
    t := replace(t, '.', '');
  end if;
  t := replace(t, ',', '.');
  if t ~ '^-?\d+(\.\d+)?$' then return t::numeric; end if;
  return null;
end;
$$;

-- Nilai checklist {"value": ..., "note": ...} -> angka (atau null).
create or replace function public.bot_check_num(v jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) = 'object' then public.bot_num(v -> 'value') else public.bot_num(v) end
$$;

revoke all on function public.bot_num(jsonb) from public, anon, authenticated;
revoke all on function public.bot_check_num(jsonb) from public, anon, authenticated;

-- Label status presensi & cuti untuk dibaca bot.
create or replace function public.bot_presensi_label(s text)
returns text language sql immutable set search_path = '' as $$
  select case s when 'wfo' then 'WFO' when 'tugas_luar' then 'Tugas Luar' when 'izin' then 'Izin' when 'sakit' then 'Sakit' else s end
$$;
revoke all on function public.bot_presensi_label(text) from public, anon, authenticated;

-- ---------- Hari libur ----------
create or replace function public.bot_hari_libur(p_key text, p_from date default null, p_to date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint; v_from date; v_to date; v_rows jsonb; v_n int;
begin
  v_log := public.bot_begin(p_key, 'hari-libur', jsonb_strip_nulls(jsonb_build_object('from', p_from, 'to', p_to)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  select coalesce(jsonb_agg(jsonb_build_object('tanggal', h.holiday_date, 'nama', h.name) order by h.holiday_date), '[]'::jsonb), count(*)
    into v_rows, v_n
  from public.holidays h where h.holiday_date between v_from and v_to;
  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object('data', v_rows, 'next_cursor', null, 'total', v_n, 'from', v_from, 'to', v_to);
end;
$$;

-- ---------- Cuti / izin (pengajuan yang tumpang tindih dengan rentang) ----------
create or replace function public.bot_cuti(
  p_key text, p_from date default null, p_to date default null, p_company text default null,
  p_employee text default null, p_cursor text default null, p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint; v_from date; v_to date; v_company uuid; c_date date; c_id uuid;
  v_limit int := coalesce(p_limit, 50); v_total bigint; v_rows jsonb; v_n int; v_next text;
  v_today date := public.today_jakarta();
begin
  v_log := public.bot_begin(p_key, 'cuti', jsonb_strip_nulls(jsonb_build_object(
    'from', p_from, 'to', p_to, 'company', p_company, 'employee', p_employee, 'cursor', p_cursor, 'limit', p_limit)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  v_company := public.bot_company(p_company);
  if v_limit < 1 or v_limit > 200 then raise exception 'limit harus 1 sampai 200.' using errcode = '22023'; end if;
  select x.c_date, x.c_id into c_date, c_id from public.bot_cursor(p_cursor) x;

  with base as (
    select lr.id, lr.start_date as sd, jsonb_build_object(
      'full_name', u.full_name, 'employee_code', u.employee_code, 'company_code', c.code, 'company_name', c.name,
      'position_code', p.code, 'jenis', initcap(lr.kind), 'start_date', lr.start_date, 'end_date', lr.end_date,
      'alasan', lr.reason,
      'status', case
        when lr.status = 'pending' and lr.end_date < v_today then 'Kedaluwarsa'
        when lr.status = 'pending' then 'Menunggu'
        when lr.status = 'approved' then 'Disetujui'
        when lr.status = 'rejected' then 'Ditolak'
        else 'Dibatalkan' end,
      'diputuskan_pada', lr.decided_at, 'catatan_keputusan', lr.decision_note,
      'pembatalan_diajukan', lr.cancel_requested_at is not null, 'hasil_pembatalan', lr.cancel_outcome) as obj
    from public.leave_requests lr
    join public.users u on u.id = lr.user_id
    join public.companies c on c.id = lr.company_id
    left join public.roles_config p on p.id = u.position_id
    where lr.start_date <= v_to and lr.end_date >= v_from
      and (v_company is null or lr.company_id = v_company)
      and (p_employee is null or btrim(p_employee) = '' or lower(u.employee_code) = lower(btrim(p_employee)))
  ), page as (
    select * from base b where c_date is null or (b.sd, b.id) > (c_date, c_id) order by b.sd, b.id limit v_limit + 1
  ), numbered as (select page.*, row_number() over (order by sd, id) rn from page)
  select (select count(*) from base),
         coalesce(jsonb_agg(obj order by rn) filter (where rn <= v_limit), '[]'::jsonb),
         count(*) filter (where rn <= v_limit),
         case when count(*) > v_limit then (select n2.sd::text || '|' || n2.id::text from numbered n2 where n2.rn = v_limit) end
    into v_total, v_rows, v_n, v_next
  from numbered;
  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object('data', v_rows, 'next_cursor', v_next, 'total', v_total, 'from', v_from, 'to', v_to);
end;
$$;

-- ---------- Presensi (TANPA foto dan GPS) ----------
create or replace function public.bot_presensi(
  p_key text, p_from date default null, p_to date default null, p_company text default null,
  p_employee text default null, p_cursor text default null, p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint; v_from date; v_to date; v_company uuid; c_date date; c_id uuid;
  v_limit int := coalesce(p_limit, 50); v_total bigint; v_rows jsonb; v_n int; v_next text;
begin
  v_log := public.bot_begin(p_key, 'presensi', jsonb_strip_nulls(jsonb_build_object(
    'from', p_from, 'to', p_to, 'company', p_company, 'employee', p_employee, 'cursor', p_cursor, 'limit', p_limit)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  v_company := public.bot_company(p_company);
  if v_limit < 1 or v_limit > 200 then raise exception 'limit harus 1 sampai 200.' using errcode = '22023'; end if;
  select x.c_date, x.c_id into c_date, c_id from public.bot_cursor(p_cursor) x;

  with base as (
    select pr.id, pr.attendance_date as sd, jsonb_build_object(
      'tanggal', pr.attendance_date, 'full_name', u.full_name, 'employee_code', u.employee_code,
      'company_code', c.code, 'company_name', c.name, 'position_code', p.code,
      'status', public.bot_presensi_label(pr.status), 'catatan', pr.note,
      'check_in', to_char(pr.check_in_at at time zone 'Asia/Jakarta', 'HH24:MI'),
      'check_out', to_char(pr.check_out_at at time zone 'Asia/Jakarta', 'HH24:MI')) as obj
    from public.presensi pr
    join public.users u on u.id = pr.user_id
    join public.companies c on c.id = pr.company_id
    left join public.roles_config p on p.id = pr.position_id
    where pr.attendance_date between v_from and v_to
      and (v_company is null or pr.company_id = v_company)
      and (p_employee is null or btrim(p_employee) = '' or lower(u.employee_code) = lower(btrim(p_employee)))
  ), page as (
    select * from base b where c_date is null or (b.sd, b.id) > (c_date, c_id) order by b.sd, b.id limit v_limit + 1
  ), numbered as (select page.*, row_number() over (order by sd, id) rn from page)
  select (select count(*) from base),
         coalesce(jsonb_agg(obj order by rn) filter (where rn <= v_limit), '[]'::jsonb),
         count(*) filter (where rn <= v_limit),
         case when count(*) > v_limit then (select n2.sd::text || '|' || n2.id::text from numbered n2 where n2.rn = v_limit) end
    into v_total, v_rows, v_n, v_next
  from numbered;
  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object('data', v_rows, 'next_cursor', v_next, 'total', v_total, 'from', v_from, 'to', v_to);
end;
$$;

-- ---------- Kendala (laporan berkendala + tanda "sudah ditangani") ----------
create or replace function public.bot_kendala(
  p_key text, p_from date default null, p_to date default null, p_company text default null,
  p_position text default null, p_status text default null, p_cursor text default null, p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint; v_from date; v_to date; v_company uuid; v_pos int; c_date date; c_id uuid;
  v_limit int := coalesce(p_limit, 50); v_total bigint; v_rows jsonb; v_n int; v_next text;
begin
  v_log := public.bot_begin(p_key, 'kendala', jsonb_strip_nulls(jsonb_build_object(
    'from', p_from, 'to', p_to, 'company', p_company, 'position', p_position, 'status', p_status, 'cursor', p_cursor, 'limit', p_limit)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  v_company := public.bot_company(p_company);
  if v_limit < 1 or v_limit > 200 then raise exception 'limit harus 1 sampai 200.' using errcode = '22023'; end if;
  if p_status is not null and p_status not in ('belum', 'sudah') then
    raise exception 'status hanya boleh belum atau sudah.' using errcode = '22023';
  end if;
  if p_position is not null and btrim(p_position) <> '' then
    select p.id into v_pos from public.roles_config p where upper(p.code) = upper(btrim(p_position));
    if v_pos is null then raise exception 'Jabatan % tidak dikenal.', p_position using errcode = '22023'; end if;
  end if;
  select x.c_date, x.c_id into c_date, c_id from public.bot_cursor(p_cursor) x;

  with base as (
    select r.id, r.report_date as sd, jsonb_build_object(
      'report_date', r.report_date, 'full_name', u.full_name, 'employee_code', u.employee_code,
      'company_code', c.code, 'company_name', c.name, 'position_code', p.code,
      'kendala', r.obstacles, 'sudah_ditangani', f.report_id is not null,
      'ditangani_oleh', hb.full_name, 'ditangani_pada', f.handled_at, 'catatan_penanganan', f.note) as obj
    from public.daily_reports r
    join public.users u on u.id = r.user_id
    join public.companies c on c.id = r.company_id
    left join public.roles_config p on p.id = r.position_id
    left join public.report_followups f on f.report_id = r.id
    left join public.users hb on hb.id = f.handled_by
    where r.report_date between v_from and v_to
      and r.obstacles is not null and btrim(r.obstacles) <> ''
      and (v_company is null or r.company_id = v_company)
      and (v_pos is null or r.position_id = v_pos)
      and (p_status is null or (p_status = 'sudah') = (f.report_id is not null))
  ), page as (
    select * from base b where c_date is null or (b.sd, b.id) > (c_date, c_id) order by b.sd, b.id limit v_limit + 1
  ), numbered as (select page.*, row_number() over (order by sd, id) rn from page)
  select (select count(*) from base),
         coalesce(jsonb_agg(obj order by rn) filter (where rn <= v_limit), '[]'::jsonb),
         count(*) filter (where rn <= v_limit),
         case when count(*) > v_limit then (select n2.sd::text || '|' || n2.id::text from numbered n2 where n2.rn = v_limit) end
    into v_total, v_rows, v_n, v_next
  from numbered;
  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object('data', v_rows, 'next_cursor', v_next, 'total', v_total, 'from', v_from, 'to', v_to);
end;
$$;

-- ---------- Pengguna (tanpa email/no. HP) ----------
create or replace function public.bot_pengguna(p_key text, p_company text default null, p_aktif boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint; v_company uuid; v_rows jsonb; v_n int;
begin
  v_log := public.bot_begin(p_key, 'pengguna', jsonb_strip_nulls(jsonb_build_object('company', p_company, 'aktif', p_aktif)));
  v_company := public.bot_company(p_company);
  select coalesce(jsonb_agg(jsonb_build_object(
           'full_name', u.full_name, 'employee_code', u.employee_code,
           'company_code', c.code, 'company_name', c.name,
           'role', u.role, 'position_code', p.code, 'position_name', p.name,
           'tanggal_mulai_kerja', u.work_start_date,
           'akun_dibuat', (u.created_at at time zone 'Asia/Jakarta')::date,
           'aktif', u.is_active) order by c.name, p.sort_order nulls first, u.full_name), '[]'::jsonb),
         count(*)
    into v_rows, v_n
  from public.users u
  join public.companies c on c.id = u.company_id
  left join public.roles_config p on p.id = u.position_id
  where (v_company is null or u.company_id = v_company)
    and (p_aktif is null or u.is_active = p_aktif);
  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object('data', v_rows, 'next_cursor', null, 'total', v_n);
end;
$$;

-- ---------- Target omzet bulanan (bulan yang bersinggungan dengan rentang) ----------
create or replace function public.bot_target(p_key text, p_from date default null, p_to date default null, p_company text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint; v_from date; v_to date; v_company uuid; v_rows jsonb; v_n int;
begin
  v_log := public.bot_begin(p_key, 'target', jsonb_strip_nulls(jsonb_build_object('from', p_from, 'to', p_to, 'company', p_company)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  v_company := public.bot_company(p_company);
  select coalesce(jsonb_agg(jsonb_build_object(
           'bulan', to_char(t.month, 'YYYY-MM'), 'full_name', u.full_name, 'employee_code', u.employee_code,
           'company_code', c.code, 'position_code', p.code, 'target_omzet', t.amount) order by t.month, u.full_name), '[]'::jsonb),
         count(*)
    into v_rows, v_n
  from public.omzet_targets t
  join public.users u on u.id = t.user_id
  join public.companies c on c.id = t.company_id
  left join public.roles_config p on p.id = u.position_id
  where t.month between date_trunc('month', v_from::timestamp)::date and v_to
    and (v_company is null or t.company_id = v_company);
  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object('data', v_rows, 'next_cursor', null, 'total', v_n, 'from', v_from, 'to', v_to);
end;
$$;

-- ---------- RINGKASAN: kepatuhan laporan ----------
-- Wajib lapor: user AKTIF role employee/lead/manager, Senin–Sabtu, bukan hari libur (tabel holidays),
-- sejak hari akun dibuat, sebelum HARI INI (hari ini belum selesai), dan tidak gugur
-- (Izin/Sakit di presensi atau cuti/izin disetujui). Hanya pengecualian yang dirinci per orang.
create or replace function public.bot_ringkasan_kepatuhan(p_key text, p_from date default null, p_to date default null, p_company text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint; v_from date; v_to date; v_company uuid; v_today date := public.today_jakarta();
  v_people jsonb; v_comp jsonb; v_pos jsonb; v_hol jsonb; v_days jsonb; v_n int;
begin
  v_log := public.bot_begin(p_key, 'ringkasan/kepatuhan', jsonb_strip_nulls(jsonb_build_object('from', p_from, 'to', p_to, 'company', p_company)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  v_company := public.bot_company(p_company);

  create temporary table if not exists pg_temp.bot_kp (
    uid uuid, nama text, kode text, ccode text, pcode text, peran text, d date, gugur text, lapor boolean
  ) on commit drop;
  truncate pg_temp.bot_kp;

  insert into pg_temp.bot_kp
  with days as (
    select g::date as d from generate_series(v_from, least(v_to, v_today - 1), interval '1 day') g
    where extract(isodow from g) <> 7
      and not exists (select 1 from public.holidays h where h.holiday_date = g::date)
  )
  select u.id, u.full_name, u.employee_code, c.code, p.code, u.role::text, dd.d,
         public.excused_kind(u.id, dd.d),
         exists (select 1 from public.daily_reports r where r.user_id = u.id and r.report_date = dd.d)
  from public.users u
  join public.companies c on c.id = u.company_id
  left join public.roles_config p on p.id = u.position_id
  cross join days dd
  where u.is_active and u.role in ('employee', 'lead', 'manager')
    and (v_company is null or u.company_id = v_company)
    and dd.d >= (u.created_at at time zone 'Asia/Jakarta')::date;

  select coalesce(jsonb_agg(x.o order by x.ccode, x.pcode nulls first, x.nama), '[]'::jsonb), count(*)
    into v_people, v_n
  from (
    select k.ccode, k.pcode, k.nama, jsonb_strip_nulls(jsonb_build_object(
      'nama', k.nama, 'kode', k.kode, 'company', k.ccode, 'jabatan', k.pcode, 'role', k.peran,
      'hari_wajib', count(*) filter (where k.gugur is null),
      'hari_lapor', count(*) filter (where k.gugur is null and k.lapor),
      'persen', round(100.0 * count(*) filter (where k.gugur is null and k.lapor) / nullif(count(*) filter (where k.gugur is null), 0), 1),
      'tidak_lapor', nullif(jsonb_agg(to_char(k.d, 'YYYY-MM-DD') order by k.d) filter (where k.gugur is null and not k.lapor), '[]'::jsonb),
      'gugur', nullif(jsonb_agg(jsonb_build_object('tanggal', k.d, 'alasan', initcap(k.gugur)) order by k.d) filter (where k.gugur is not null), '[]'::jsonb)
    )) as o
    from pg_temp.bot_kp k group by k.uid, k.nama, k.kode, k.ccode, k.pcode, k.peran
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('company', y.ccode, 'orang', y.orang, 'hari_wajib', y.w, 'hari_lapor', y.l,
           'persen', round(100.0 * y.l / nullif(y.w, 0), 1)) order by y.ccode), '[]'::jsonb)
    into v_comp
  from (select k.ccode, count(distinct k.uid) orang, count(*) filter (where k.gugur is null) w,
               count(*) filter (where k.gugur is null and k.lapor) l from pg_temp.bot_kp k group by k.ccode) y;

  select coalesce(jsonb_agg(jsonb_build_object('jabatan', y.pcode, 'orang', y.orang, 'hari_wajib', y.w, 'hari_lapor', y.l,
           'persen', round(100.0 * y.l / nullif(y.w, 0), 1)) order by y.pcode nulls first), '[]'::jsonb)
    into v_pos
  from (select k.pcode, count(distinct k.uid) orang, count(*) filter (where k.gugur is null) w,
               count(*) filter (where k.gugur is null and k.lapor) l from pg_temp.bot_kp k group by k.pcode) y;

  select coalesce(jsonb_agg(jsonb_build_object('tanggal', h.holiday_date, 'nama', h.name) order by h.holiday_date), '[]'::jsonb)
    into v_hol from public.holidays h where h.holiday_date between v_from and v_to;

  select coalesce(jsonb_agg(to_char(g, 'YYYY-MM-DD') order by g), '[]'::jsonb) into v_days
  from generate_series(v_from, least(v_to, v_today - 1), interval '1 day') g
  where extract(isodow from g) <> 7 and not exists (select 1 from public.holidays h where h.holiday_date = g::date);

  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object(
    'from', v_from, 'to', v_to,
    'aturan', 'Wajib lapor: karyawan/Lead/Manager aktif, Senin-Sabtu, bukan hari libur, sejak akun dibuat, sebelum hari ini. Gugur (tidak wajib): Izin/Sakit di presensi atau cuti/izin disetujui. Hari ini dan hari Minggu tidak dihitung.',
    'hari_dihitung', v_days, 'hari_libur', v_hol,
    'per_company', v_comp, 'per_jabatan', v_pos, 'per_orang', v_people);
end;
$$;

-- ---------- RINGKASAN: tindak lanjut notulensi per PIC ----------
create or replace function public.bot_ringkasan_tindak_lanjut(p_key text, p_from date default null, p_to date default null, p_company text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint; v_from date; v_to date; v_company uuid; v_today date := public.today_jakarta();
  v_rows jsonb; v_tot jsonb; v_n int;
begin
  v_log := public.bot_begin(p_key, 'ringkasan/tindak-lanjut', jsonb_strip_nulls(jsonb_build_object('from', p_from, 'to', p_to, 'company', p_company)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  v_company := public.bot_company(p_company);

  with items as (
    select coalesce(nullif(btrim(ai.assignee_name), ''), 'Tanpa PIC') as pic, ai.status, ai.due_date, ai.description,
           m.title, m.meeting_date, c.code as ccode,
           (ai.status <> 'done' and ai.due_date is not null and ai.due_date < v_today) as lewat
    from public.meeting_action_items ai
    join public.meetings m on m.id = ai.meeting_id
    join public.companies c on c.id = m.company_id
    where m.meeting_date between v_from and v_to
      and (v_company is null or m.company_id = v_company)
  )
  select coalesce(jsonb_agg(x.o order by x.belum desc, x.pic), '[]'::jsonb), count(*),
         jsonb_build_object('total', coalesce(sum(x.total), 0), 'open', coalesce(sum(x.op), 0), 'sedang_dikerjakan', coalesce(sum(x.ip), 0),
                            'selesai', coalesce(sum(x.dn), 0), 'lewat_tenggat', coalesce(sum(x.lt), 0))
    into v_rows, v_n, v_tot
  from (
    select i.pic, count(*) total, count(*) filter (where i.status = 'open') op, count(*) filter (where i.status = 'in_progress') ip,
           count(*) filter (where i.status = 'done') dn, count(*) filter (where i.lewat) lt, count(*) filter (where i.status <> 'done') belum,
           jsonb_strip_nulls(jsonb_build_object(
             'pic', i.pic, 'total', count(*),
             'open', count(*) filter (where i.status = 'open'),
             'sedang_dikerjakan', count(*) filter (where i.status = 'in_progress'),
             'selesai', count(*) filter (where i.status = 'done'),
             'lewat_tenggat', count(*) filter (where i.lewat),
             'belum_selesai', nullif(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'tugas', left(i.description, 200), 'status', case i.status when 'open' then 'Open' else 'Sedang dikerjakan' end,
                 'tenggat', i.due_date, 'lewat_tenggat', i.lewat, 'meeting', i.title, 'tanggal_meeting', i.meeting_date, 'company', i.ccode))
               order by i.due_date nulls last, i.meeting_date) filter (where i.status <> 'done'), '[]'::jsonb))) as o
    from items i group by i.pic
  ) x;

  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object('from', v_from, 'to', v_to, 'hari_ini', v_today,
    'catatan', 'Tindak lanjut dari meeting bertanggal dalam rentang. Lewat tenggat = belum Selesai dan tenggat sebelum hari ini.',
    'total', v_tot, 'per_pic', v_rows);
end;
$$;

-- ---------- RINGKASAN: Magang Hub (ADV_MH) ----------
create or replace function public.bot_ringkasan_magang(p_key text, p_from date default null, p_to date default null, p_company text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint; v_from date; v_to date; v_company uuid; v_orang jsonb; v_mentor jsonb; v_n int;
begin
  v_log := public.bot_begin(p_key, 'ringkasan/magang', jsonb_strip_nulls(jsonb_build_object('from', p_from, 'to', p_to, 'company', p_company)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  v_company := public.bot_company(p_company);

  with rep as (
    select r.user_id, u.full_name, u.employee_code, c.code as ccode, r.report_date,
           nullif(btrim(r.performance_metrics ->> 'mentor'), '') as mentor,
           public.bot_check_num(r.performance_metrics -> 'jumlah_pesanan') as pesanan,
           public.bot_check_num(r.performance_metrics -> 'omset_harian') as omset
    from public.daily_reports r
    join public.users u on u.id = r.user_id
    join public.companies c on c.id = r.company_id
    join public.roles_config p on p.id = r.position_id and p.code = 'ADV_MH'
    where r.report_date between v_from and v_to and (v_company is null or r.company_id = v_company)
  ), per_orang as (
    select rp.user_id, rp.full_name, rp.employee_code, rp.ccode,
           (array_agg(rp.mentor order by rp.report_date desc) filter (where rp.mentor is not null))[1] as mentor,
           count(*) hari_lapor, count(rp.pesanan) hari_isi_pesanan, sum(rp.pesanan) pesanan,
           count(rp.omset) hari_isi_omset, sum(rp.omset) omset
    from rep rp group by rp.user_id, rp.full_name, rp.employee_code, rp.ccode
  )
  select coalesce(jsonb_agg(jsonb_build_object('nama', o.full_name, 'kode', o.employee_code, 'company', o.ccode, 'mentor', o.mentor,
           'hari_lapor', o.hari_lapor, 'pesanan', o.pesanan, 'hari_isi_pesanan', o.hari_isi_pesanan,
           'omset', o.omset, 'hari_isi_omset', o.hari_isi_omset) order by o.omset desc nulls last, o.full_name), '[]'::jsonb),
         count(*),
         (select coalesce(jsonb_agg(jsonb_build_object('mentor', m.mentor, 'jumlah_magang', m.orang, 'hari_lapor', m.hari,
                  'pesanan', m.pesanan, 'omset', m.omset) order by m.mentor), '[]'::jsonb)
          from (select coalesce(initcap(o2.mentor), 'Tanpa mentor') mentor, count(*) orang, sum(o2.hari_lapor) hari,
                       sum(o2.pesanan) pesanan, sum(o2.omset) omset
                from per_orang o2 group by 1) m)
    into v_orang, v_n, v_mentor
  from per_orang o;

  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object('from', v_from, 'to', v_to,
    'catatan', 'Dari laporan ADV_MH. pesanan/omset = jumlah dari hari yang diisi angka; null = tidak pernah diisi. Omset dalam Rupiah.',
    'per_orang', v_orang, 'per_mentor', v_mentor);
end;
$$;

-- ---------- RINGKASAN: konten CC & AM ----------
create or replace function public.bot_ringkasan_konten(p_key text, p_from date default null, p_to date default null, p_company text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint; v_from date; v_to date; v_company uuid;
  v_cc_akun jsonb; v_cc_orang jsonb; v_am_akun jsonb; v_am_orang jsonb;
begin
  v_log := public.bot_begin(p_key, 'ringkasan/konten', jsonb_strip_nulls(jsonb_build_object('from', p_from, 'to', p_to, 'company', p_company)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  v_company := public.bot_company(p_company);

  -- CC: tiap baris "Konten dibuat hari ini" = 1 konten
  with cc as (
    select u.full_name, r.report_date, coalesce(nullif(btrim(x ->> 'akun_tujuan'), ''), '(tanpa akun)') as akun
    from public.daily_reports r
    join public.users u on u.id = r.user_id
    join public.roles_config p on p.id = r.position_id and p.code = 'CC'
    cross join lateral jsonb_array_elements(case when jsonb_typeof(r.performance_metrics -> 'konten_dibuat') = 'array'
                                                 then r.performance_metrics -> 'konten_dibuat' else '[]'::jsonb end) x
    where r.report_date between v_from and v_to and (v_company is null or r.company_id = v_company)
      and (coalesce(btrim(x ->> 'akun_tujuan'), '') <> '' or coalesce(btrim(x ->> 'link'), '') <> '' or coalesce(btrim(x ->> 'jenis_konten'), '') <> '')
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object('akun', a.akun, 'jumlah_konten', a.n) order by a.n desc, a.akun), '[]'::jsonb)
       from (select upper(akun) akun, count(*) n from cc group by 1) a),
    (select coalesce(jsonb_agg(jsonb_build_object('nama', o.full_name, 'jumlah_konten', o.n, 'hari_ada_konten', o.h) order by o.n desc, o.full_name), '[]'::jsonb)
       from (select full_name, count(*) n, count(distinct report_date) h from cc group by 1) o)
    into v_cc_akun, v_cc_orang;

  -- AM: "Ringkasan akun hari ini": konten diupload dijumlah; followers awal = isian pertama, akhir = isian terakhir dalam rentang
  with am as (
    select u.full_name, r.report_date, lower(coalesce(nullif(btrim(x ->> 'akun'), ''), '(tanpa akun)')) as akun,
           public.bot_num(x -> 'followers') as followers, public.bot_num(x -> 'konten_diupload') as konten
    from public.daily_reports r
    join public.users u on u.id = r.user_id
    join public.roles_config p on p.id = r.position_id and p.code = 'AM'
    cross join lateral jsonb_array_elements(case when jsonb_typeof(r.performance_metrics -> 'ringkasan_akun') = 'array'
                                                 then r.performance_metrics -> 'ringkasan_akun' else '[]'::jsonb end) x
    where r.report_date between v_from and v_to and (v_company is null or r.company_id = v_company)
      and coalesce(btrim(x ->> 'akun'), '') <> ''
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object('akun', a.akun, 'konten_diupload', a.konten, 'followers_awal', a.f_awal,
              'followers_akhir', a.f_akhir, 'selisih_followers', a.f_akhir - a.f_awal, 'dipegang', a.orang) order by a.konten desc nulls last, a.akun), '[]'::jsonb)
       from (select akun, sum(konten) konten,
                    (array_agg(followers order by report_date) filter (where followers is not null))[1] f_awal,
                    (array_agg(followers order by report_date desc) filter (where followers is not null))[1] f_akhir,
                    string_agg(distinct full_name, ', ') orang
             from am group by akun) a),
    (select coalesce(jsonb_agg(jsonb_build_object('nama', o.full_name, 'jumlah_akun', o.akun, 'konten_diupload', o.konten, 'hari_lapor', o.h) order by o.full_name), '[]'::jsonb)
       from (select full_name, count(distinct akun) akun, sum(konten) konten, count(distinct report_date) h from am group by 1) o)
    into v_am_akun, v_am_orang;

  update public.api_audit_log set row_count = jsonb_array_length(v_cc_akun) + jsonb_array_length(v_am_akun) where id = v_log;
  return jsonb_build_object('from', v_from, 'to', v_to,
    'cc', jsonb_build_object('catatan', 'Content Creator: tiap baris "Konten dibuat hari ini" dihitung 1 konten.', 'per_akun', v_cc_akun, 'per_orang', v_cc_orang),
    'am', jsonb_build_object('catatan', 'Affiliate Manajemen: konten_diupload dijumlah; followers awal/akhir = isian pertama/terakhir dalam rentang (null bila tidak diisi).', 'per_akun', v_am_akun, 'per_orang', v_am_orang));
end;
$$;

-- ---------- RINGKASAN: ADV per toko + dibanding target ----------
create or replace function public.bot_ringkasan_adv(p_key text, p_from date default null, p_to date default null, p_company text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint; v_from date; v_to date; v_company uuid; v_mstart date;
  v_harian jsonb; v_toko jsonb; v_orang jsonb; v_n int;
begin
  v_log := public.bot_begin(p_key, 'ringkasan/adv', jsonb_strip_nulls(jsonb_build_object('from', p_from, 'to', p_to, 'company', p_company)));
  select r_from, r_to into v_from, v_to from public.bot_range(p_from, p_to);
  v_company := public.bot_company(p_company);
  v_mstart := date_trunc('month', v_to::timestamp)::date;

  create temporary table if not exists pg_temp.bot_adv (
    uid uuid, nama text, ccode text, d date, toko text, impresi numeric, pesanan numeric, gmv numeric, ads numeric
  ) on commit drop;
  truncate pg_temp.bot_adv;
  -- Diambil dari awal bulan "to" (untuk GMV bulan berjalan) atau dari "from" bila lebih awal.
  insert into pg_temp.bot_adv
  select r.user_id, u.full_name, c.code, r.report_date,
         coalesce(nullif(btrim(x ->> 'nama'), ''), nullif(btrim(r.performance_metrics ->> 'toko'), ''), '(tanpa nama toko)'),
         public.bot_num(x -> 'impresi_harian'), public.bot_num(x -> 'jumlah_pesanan'), public.bot_num(x -> 'gmv'), public.bot_num(x -> 'ads_spent')
  from public.daily_reports r
  join public.users u on u.id = r.user_id
  join public.companies c on c.id = r.company_id
  join public.roles_config p on p.id = r.position_id and p.code = 'ADV'
  cross join lateral jsonb_array_elements(case when jsonb_typeof(r.performance_metrics -> 'data_toko') = 'array'
                                               then r.performance_metrics -> 'data_toko' else '[]'::jsonb end) x
  where r.report_date between least(v_from, v_mstart) and v_to
    and (v_company is null or r.company_id = v_company);

  select coalesce(jsonb_agg(jsonb_build_object('tanggal', h.d, 'toko', h.toko, 'adv', h.nama, 'impresi', h.impresi, 'pesanan', h.pesanan,
           'gmv', h.gmv, 'ads_spent', h.ads, 'efisiensi', case when h.ads > 0 then round(h.gmv / h.ads, 2) end) order by h.toko, h.d), '[]'::jsonb),
         count(*)
    into v_harian, v_n
  from (select d, toko, string_agg(distinct nama, ', ') nama, sum(impresi) impresi, sum(pesanan) pesanan, sum(gmv) gmv, sum(ads) ads
        from pg_temp.bot_adv where d between v_from and v_to group by d, toko) h;

  select coalesce(jsonb_agg(jsonb_build_object('toko', t.toko, 'adv', t.nama, 'hari_ada_data', t.hari, 'impresi', t.impresi, 'pesanan', t.pesanan,
           'gmv', t.gmv, 'ads_spent', t.ads, 'efisiensi', case when t.ads > 0 then round(t.gmv / t.ads, 2) end) order by t.gmv desc nulls last, t.toko), '[]'::jsonb)
    into v_toko
  from (select toko, string_agg(distinct nama, ', ') nama, count(distinct d) hari, sum(impresi) impresi, sum(pesanan) pesanan, sum(gmv) gmv, sum(ads) ads
        from pg_temp.bot_adv where d between v_from and v_to group by toko) t;

  select coalesce(jsonb_agg(jsonb_build_object('nama', o.nama, 'company', o.ccode, 'gmv_periode', o.gmv_p, 'ads_spent_periode', o.ads_p,
           'efisiensi_periode', case when o.ads_p > 0 then round(o.gmv_p / o.ads_p, 2) end,
           'bulan_target', to_char(v_mstart, 'YYYY-MM'), 'target_omzet_bulan', t.amount, 'gmv_bulan_berjalan', o.gmv_m,
           'persen_target', case when t.amount > 0 then round(100.0 * o.gmv_m / t.amount, 1) end) order by o.nama), '[]'::jsonb)
    into v_orang
  from (select uid, nama, ccode,
               sum(gmv) filter (where d between v_from and v_to) gmv_p, sum(ads) filter (where d between v_from and v_to) ads_p,
               sum(gmv) filter (where d between v_mstart and v_to) gmv_m
        from pg_temp.bot_adv group by uid, nama, ccode) o
  left join public.omzet_targets t on t.user_id = o.uid and t.month = v_mstart;

  update public.api_audit_log set row_count = v_n where id = v_log;
  return jsonb_build_object('from', v_from, 'to', v_to,
    'catatan', 'Dari "Data Harian per Toko" laporan ADV. Uang dalam Rupiah. efisiensi = GMV dibagi ads spent (null bila ads spent kosong/0). Jumlah hanya dari isian yang ada; null = tidak diisi. Target omzet per ADV per bulan; gmv_bulan_berjalan = awal bulan "to" s.d. "to".',
    'per_toko', v_toko, 'per_adv', v_orang, 'per_toko_per_hari', v_harian);
end;
$$;

-- ---------- Hak akses ----------
revoke all on function public.bot_hari_libur(text, date, date) from public;
revoke all on function public.bot_cuti(text, date, date, text, text, text, int) from public;
revoke all on function public.bot_presensi(text, date, date, text, text, text, int) from public;
revoke all on function public.bot_kendala(text, date, date, text, text, text, text, int) from public;
revoke all on function public.bot_pengguna(text, text, boolean) from public;
revoke all on function public.bot_target(text, date, date, text) from public;
revoke all on function public.bot_ringkasan_kepatuhan(text, date, date, text) from public;
revoke all on function public.bot_ringkasan_tindak_lanjut(text, date, date, text) from public;
revoke all on function public.bot_ringkasan_magang(text, date, date, text) from public;
revoke all on function public.bot_ringkasan_konten(text, date, date, text) from public;
revoke all on function public.bot_ringkasan_adv(text, date, date, text) from public;

grant execute on function public.bot_hari_libur(text, date, date) to anon, authenticated;
grant execute on function public.bot_cuti(text, date, date, text, text, text, int) to anon, authenticated;
grant execute on function public.bot_presensi(text, date, date, text, text, text, int) to anon, authenticated;
grant execute on function public.bot_kendala(text, date, date, text, text, text, text, int) to anon, authenticated;
grant execute on function public.bot_pengguna(text, text, boolean) to anon, authenticated;
grant execute on function public.bot_target(text, date, date, text) to anon, authenticated;
grant execute on function public.bot_ringkasan_kepatuhan(text, date, date, text) to anon, authenticated;
grant execute on function public.bot_ringkasan_tindak_lanjut(text, date, date, text) to anon, authenticated;
grant execute on function public.bot_ringkasan_magang(text, date, date, text) to anon, authenticated;
grant execute on function public.bot_ringkasan_konten(text, date, date, text) to anon, authenticated;
grant execute on function public.bot_ringkasan_adv(text, date, date, text) to anon, authenticated;
