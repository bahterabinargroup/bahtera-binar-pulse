-- =====================================================================
-- 019 HARI LIBUR (sama dengan bagian 24 schema_daily_report.sql)
--
-- Keputusan pemilik (4 Nov 2026): Owner mengisi daftar hari libur (tanggal merah /
-- libur kantor). Hari libur berlaku untuk SEMUA company. Dipakai Ringkasan Presensi
-- agar hari libur tidak dihitung "tanpa keterangan".
-- - Dibaca semua pengguna yang login; ditambah dan dihapus hanya Owner.
-- - Tidak ada ubah: salah tanggal/nama = hapus lalu tambah lagi.
-- Aman dijalankan ulang.
-- =====================================================================

create table if not exists public.holidays (
  holiday_date date primary key,
  name         text not null,
  created_by   uuid default auth.uid() references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint holidays_name_len check (length(btrim(name)) between 1 and 100)
);

comment on table public.holidays is 'Hari libur (tanggal merah / libur kantor) yang berlaku untuk semua company. Dikelola Owner; dibaca semua pengguna login.';

alter table public.holidays enable row level security;

drop policy if exists holidays_select on public.holidays;
create policy holidays_select on public.holidays
  for select to authenticated
  using ((select public.current_user_role()) is not null);

drop policy if exists holidays_insert on public.holidays;
create policy holidays_insert on public.holidays
  for insert to authenticated
  with check ((select public.current_user_role()) = 'owner');

drop policy if exists holidays_delete on public.holidays;
create policy holidays_delete on public.holidays
  for delete to authenticated
  using ((select public.current_user_role()) = 'owner');

revoke all on public.holidays from anon;
revoke all on public.holidays from authenticated;
grant select on public.holidays to authenticated;
grant insert (holiday_date, name) on public.holidays to authenticated;
grant delete on public.holidays to authenticated;
