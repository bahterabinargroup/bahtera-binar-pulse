-- =====================================================================
-- 024 PENGAJUAN CUTI KEDALUWARSA + MANAGER BOLEH MENGISI TANGGAL MULAI KERJA
-- (sama dengan bagian 28 schema_daily_report.sql)
--
-- Keputusan pemilik (25 Nov 2026):
-- 1) Pengajuan cuti/izin yang belum diputuskan sampai tanggal selesainya lewat dianggap KEDALUWARSA
--    (decide_leave memang menolak keputusan atas tanggal yang sudah lewat). Kedaluwarsa dihitung dari
--    tanggal (tanpa mengubah status di tabel), jadi tidak butuh jadwal otomatis. Pengajuan kedaluwarsa
--    TIDAK menghabiskan kuota periode.
-- 2) Manager (mis. akun Supervisor) boleh mengisi tanggal mulai kerja karyawan dan Lead di company-nya,
--    hanya lewat fungsi set_work_start_date (tidak bisa mengubah role, jabatan, atau status aktif).
--    Owner bisa untuk semua orang.
-- Aman dijalankan ulang.
-- =====================================================================

-- Kuota: pengajuan menunggu yang sudah kedaluwarsa tidak dihitung.
create or replace function public.leave_requests_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anchor date;
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
    -- Lama maksimal 2 hari kerja berturut-turut (Senin-Sabtu; hari Minggu tidak dihitung).
    if (
      select count(*) from generate_series(new.start_date, new.end_date, interval '1 day') g(d)
      where extract(isodow from g.d) <> 7
    ) > 2 then
      raise exception 'Pengajuan cuti/izin maksimal 2 hari berturut-turut (hari Minggu tidak dihitung).' using errcode = '22023';
    end if;
    -- Kuota: maksimal 2 pengajuan per PERIODE (mengikuti tanggal mulai kerja; kosong = bulan kalender).
    -- Dihitung: yang disetujui, dan yang masih menunggu (belum kedaluwarsa). Ditolak/dibatalkan/kedaluwarsa tidak dihitung.
    select u.work_start_date into v_anchor from public.users u where u.id = new.user_id;
    if (
      select count(*) from public.leave_requests x
      where x.user_id = new.user_id
        and (x.status = 'approved' or (x.status = 'pending' and x.end_date >= public.today_jakarta()))
        and public.leave_period_start(v_anchor, x.start_date) = public.leave_period_start(v_anchor, new.start_date)
    ) >= 2 then
      raise exception 'Kuota pengajuan cuti/izin periode ini telah habis (maksimal 2 kali per periode).' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.leave_requests_prepare() from public, anon, authenticated;

-- Mengisi tanggal mulai kerja: Owner semua; Manager hanya karyawan dan Lead di company-nya.
create or replace function public.set_work_start_date(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me_role public.user_role := (select public.current_user_role());
  me_company uuid := (select public.current_company_id());
  t_role public.user_role;
  t_company uuid;
begin
  if auth.uid() is null or me_role is null then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  select u.role, u.company_id into t_role, t_company from public.users u where u.id = p_user;
  if not found then
    raise exception 'Pengguna tidak ditemukan.' using errcode = 'P0002';
  end if;
  if not (
    me_role = 'owner'
    or (me_role = 'manager' and t_company = me_company and t_role in ('employee', 'lead'))
  ) then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  if p_date is not null and (p_date < date '2000-01-01' or p_date > date '2100-12-31') then
    raise exception 'Tanggal mulai kerja tidak valid.' using errcode = '22023';
  end if;
  update public.users set work_start_date = p_date where id = p_user;
end;
$$;

revoke all on function public.set_work_start_date(uuid, date) from public, anon;
grant execute on function public.set_work_start_date(uuid, date) to authenticated;
