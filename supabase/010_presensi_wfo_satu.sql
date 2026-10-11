-- =====================================================================
-- 010 PRESENSI: WFO cukup satu pilihan "WFO" (tanpa Bahtera/Depkes/Redigma)
-- (sudah tercermin di bagian 17 schema_daily_report.sql dan 008_presensi.sql)
--
-- Keputusan pemilik (11 Okt 2026): status menjadi WFO, Tugas Luar, Izin, Sakit.
-- Baris lama wfo_bahtera / wfo_depkes / wfo_redigma diubah menjadi "wfo"
-- (hanya kolom status; jam masuk/pulang dan data lain tidak disentuh).
-- Aman dijalankan ulang.
-- =====================================================================

alter table public.presensi drop constraint if exists presensi_status_ok;
alter table public.presensi drop constraint if exists presensi_note_required;

-- Trigger dimatikan sebentar agar jam pulang baris lama tidak ikut tertimpa
alter table public.presensi disable trigger trg_presensi_prepare;
update public.presensi set status = 'wfo' where status in ('wfo_bahtera', 'wfo_depkes', 'wfo_redigma');
alter table public.presensi enable trigger trg_presensi_prepare;

alter table public.presensi add constraint presensi_status_ok
  check (status in ('wfo', 'tugas_luar', 'izin', 'sakit'));
alter table public.presensi add constraint presensi_note_required
  check (status = 'wfo' or length(btrim(coalesce(note, ''))) > 0);
