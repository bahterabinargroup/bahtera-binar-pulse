-- =====================================================================
-- 003 BATASI AKSES BACA roles_config (sama dengan bagian 14 schema_daily_report.sql)
-- Keputusan pemilik 7 Okt 2026: akun yang login tetapi TIDAK punya profil
-- (tanpa undangan / dinonaktifkan) tidak boleh membaca daftar jabatan dan
-- template form. Pengguna berprofil aktif tidak terpengaruh.
-- Aman dijalankan ulang.
-- =====================================================================

drop policy if exists roles_config_select on public.roles_config;
create policy roles_config_select on public.roles_config
  for select to authenticated
  using ((select public.current_user_role()) is not null);
