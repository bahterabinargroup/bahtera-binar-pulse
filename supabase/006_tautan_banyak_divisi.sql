-- =====================================================================
-- 006 TAUTAN PENTING: SATU LINK UNTUK BEBERAPA DIVISI
-- Keputusan pemilik 9 Okt 2026: kolom "divisi" (position_id, satu pilihan)
-- diganti daftar divisi (position_ids). Daftar kosong = semua divisi.
-- Link yang sudah ada dipindahkan otomatis. Aman dijalankan ulang.
-- (bagian 15 schema_daily_report.sql sudah memuat bentuk akhirnya)
-- =====================================================================

alter table public.resource_links
  add column if not exists position_ids smallint[] not null default '{}';

do $mig$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'resource_links' and column_name = 'position_id') then
    update public.resource_links set position_ids = array[position_id] where position_id is not null;
    drop policy if exists resource_links_select on public.resource_links;  -- bergantung pada kolom lama
    alter table public.resource_links drop column position_id;             -- indeks lama ikut terhapus
  end if;
end $mig$;

do $mig$ begin
  alter table public.resource_links
    add constraint resource_links_positions_ok check (cardinality(position_ids) <= 20);
exception when duplicate_object then null;
end $mig$;

comment on column public.resource_links.position_ids is 'Daftar jabatan/divisi yang melihat link ini. Kosong = semua divisi.';

drop policy if exists resource_links_select on public.resource_links;
create policy resource_links_select on public.resource_links
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or (
      (select public.current_user_role()) = 'manager'
      and (company_id is null or company_id = (select public.current_company_id()))
    )
    or (
      (select public.current_user_role()) = 'employee'
      and (company_id is null or company_id = (select public.current_company_id()))
      and (cardinality(position_ids) = 0 or (select public.current_position_id()) = any (position_ids))
    )
  );

revoke update on public.resource_links from authenticated;
grant update (company_id, position_ids, category, title, url, description)
  on public.resource_links to authenticated;
