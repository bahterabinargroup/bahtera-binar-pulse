-- =====================================================================
-- 015 KUOTA PENGAJUAN CUTI / IZIN
-- (sudah tercermin di 011_cuti_izin.sql dan bagian 18 schema_daily_report.sql)
--
-- Keputusan pemilik (16 Okt 2026): maksimal 2 pengajuan cuti/izin per bulan.
-- Pengajuan ke-3 pada bulan yang sama ditolak dengan pesan
-- "Kuota pengajuan cuti/izin bulan ini telah habis".
-- - Cuti dan izin digabung dalam satu kuota.
-- - Bulan dihitung dari TANGGAL MULAI pengajuan (cuti lintas bulan dihitung ke bulan mulainya).
-- - Yang masih menunggu atau sudah disetujui dihitung; yang ditolak atau dibatalkan
--   (termasuk pembatalan yang disetujui) tidak dihitung, jadi kuotanya kembali.
-- - Izin/Sakit yang dipilih langsung saat Check-In di menu Presensi tidak ikut dihitung.
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
