-- =====================================================================
-- 023 TANGGAL MULAI KERJA + KUOTA CUTI/IZIN PER PERIODE (sama dengan bagian 27 schema_daily_report.sql)
--
-- Keputusan pemilik (24 Nov 2026): kuota cuti/izin (maks 2 pengajuan) tidak lagi di-reset tanggal 1,
-- melainkan mengikuti TANGGAL MULAI KERJA tiap karyawan. Contoh: masuk tanggal 21 -> periodenya
-- 21 Nov-20 Des, 21 Des-20 Jan, dst. (anak Magang Hub rata-rata masuk tanggal 21).
-- - Kolom baru users.work_start_date (diisi Owner di menu Pengguna). KOSONG = tetap per bulan kalender (tanggal 1).
-- - Tanggal dasar 29/30/31: di bulan yang lebih pendek, periode mulai di hari terakhir bulan itu.
-- - Pengajuan dihitung ke periode tempat TANGGAL MULAI cuti jatuh. Yang pending/approved dihitung.
-- - Aturan lain (maks 2 hari berturut-turut, tumpang tindih, tanggal mulai >= hari ini) tidak berubah.
-- - Pengajuan lama tidak diubah. Aman dijalankan ulang.
-- =====================================================================

alter table public.users add column if not exists work_start_date date;
comment on column public.users.work_start_date is 'Tanggal mulai kerja. Hari dalam bulannya menjadi tanggal reset kuota cuti/izin bulanan (kosong = reset tanggal 1). Diubah Owner.';

-- Awal periode kuota yang memuat p_date. p_anchor = tanggal mulai kerja (kosong = bulan kalender).
create or replace function public.leave_period_start(p_anchor date, p_date date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_anchor is null then date_trunc('month', p_date::timestamp)::date
    else (
      select case when c.cur <= p_date then c.cur else c.prev end
      from (
        select
          (date_trunc('month', p_date::timestamp)::date
            + (least(extract(day from p_anchor)::int, extract(day from (date_trunc('month', p_date::timestamp) + interval '1 month - 1 day'))::int) - 1)) as cur,
          (date_trunc('month', p_date::timestamp - interval '1 month')::date
            + (least(extract(day from p_anchor)::int, extract(day from (date_trunc('month', p_date::timestamp - interval '1 month') + interval '1 month - 1 day'))::int) - 1)) as prev
      ) c
    )
  end
$$;

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
    -- Kuota: maksimal 2 pengajuan (cuti dan izin digabung) per PERIODE, menurut periode tempat tanggal mulai jatuh.
    -- Periode mengikuti tanggal mulai kerja karyawan (kosong = bulan kalender). Yang ditolak atau dibatalkan tidak dihitung.
    select u.work_start_date into v_anchor from public.users u where u.id = new.user_id;
    if (
      select count(*) from public.leave_requests x
      where x.user_id = new.user_id
        and x.status in ('pending', 'approved')
        and public.leave_period_start(v_anchor, x.start_date) = public.leave_period_start(v_anchor, new.start_date)
    ) >= 2 then
      raise exception 'Kuota pengajuan cuti/izin periode ini telah habis (maksimal 2 kali per periode).' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.leave_requests_prepare() from public, anon, authenticated;
