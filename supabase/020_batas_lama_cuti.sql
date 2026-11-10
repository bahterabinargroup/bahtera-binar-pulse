-- =====================================================================
-- 020 BATAS LAMA PENGAJUAN CUTI / IZIN: MAKSIMAL 2 HARI BERTURUT-TURUT
-- (sama dengan bagian 18 schema_daily_report.sql, fungsi leave_requests_prepare)
--
-- Keputusan pemilik (10 Nov 2026): satu pengajuan cuti/izin tidak boleh lebih dari
-- 2 hari berturut-turut; kuota 2 pengajuan per bulan (015) tetap berlaku.
-- - Yang dihitung hari kerja Senin–Sabtu; hari Minggu tidak dihitung.
-- - Hanya berlaku untuk pengajuan BARU. Pengajuan lama tidak berubah. Pemotongan
--   tanggal saat pembatalan cuti yang sudah berjalan tidak terpengaruh.
-- Aman dijalankan ulang.
-- =====================================================================

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
    -- Lama maksimal 2 hari kerja berturut-turut (Senin–Sabtu; hari Minggu tidak dihitung).
    if (
      select count(*) from generate_series(new.start_date, new.end_date, interval '1 day') g(d)
      where extract(isodow from g.d) <> 7
    ) > 2 then
      raise exception 'Pengajuan cuti/izin maksimal 2 hari berturut-turut (hari Minggu tidak dihitung).' using errcode = '22023';
    end if;
    -- Kuota: maksimal 2 pengajuan (cuti dan izin digabung) per bulan, menurut bulan tanggal mulai.
    -- Yang ditolak atau dibatalkan tidak dihitung.
    if (
      select count(*) from public.leave_requests x
      where x.user_id = new.user_id
        and x.status in ('pending', 'approved')
        and date_trunc('month', x.start_date) = date_trunc('month', new.start_date)
    ) >= 2 then
      raise exception 'Kuota pengajuan cuti/izin bulan ini telah habis (maksimal 2 kali per bulan).' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.leave_requests_prepare() from public, anon, authenticated;
