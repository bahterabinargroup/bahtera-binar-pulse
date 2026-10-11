-- =====================================================================
-- 009 PRESENSI: Izin/Sakit otomatis Check-Out; Tugas Luar wajib foto bukti
-- (sudah tercermin di bagian 17 schema_daily_report.sql dan 008_presensi.sql)
--
-- Keputusan pemilik (11 Okt 2026):
-- - Izin / Sakit: saat Check-In, Check-Out tercatat otomatis (jam yang sama, tanpa foto pulang).
-- - Tugas Luar: foto bukti ("bukti diminta tugas luar") wajib saat Check-In.
-- - WFO: tidak ada foto.
-- Baris lama tidak diperiksa ulang (NOT VALID); aturan berlaku untuk data baru. Aman dijalankan ulang.
-- =====================================================================

alter table public.presensi drop constraint if exists presensi_out_photo_required;
alter table public.presensi add constraint presensi_out_photo_required
  check (check_out_at is null or check_out_photo_path is not null or status in ('izin', 'sakit')) not valid;

alter table public.presensi drop constraint if exists presensi_tugas_luar_photo;
alter table public.presensi add constraint presensi_tugas_luar_photo
  check (status <> 'tugas_luar' or check_in_photo_path is not null) not valid;

create or replace function public.presensi_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
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
