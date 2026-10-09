-- =====================================================================
-- 005 TAUTAN PENTING (sama dengan bagian 15 schema_daily_report.sql)
-- Inventaris link kerja (tracker spreadsheet, aset, SOP/dokumen, dll.) yang
-- ditampilkan di dashboard awal sesuai company dan divisi/jabatan pengguna.
--
-- Keputusan pemilik (9 Okt 2026):
-- - Tiap link menentukan company (kosong = semua company) dan divisi/jabatan
--   (kosong = semua divisi).
-- - Kategori tetap: tracker, aset, sop, lainnya.
-- - Yang mengelola (tambah/ubah/hapus): Owner (semua) dan Manager (semua link
--   di company-nya sendiri). Karyawan hanya melihat.
-- - Yang melihat: Owner semua; Manager link company-nya + link "semua company";
--   Karyawan link company-nya (atau semua company) yang ditujukan ke
--   jabatannya (atau semua divisi).
-- Aman dijalankan ulang.
-- =====================================================================

do $mig$ begin
  create type public.link_category as enum ('tracker', 'aset', 'sop', 'lainnya');
exception when duplicate_object then null;
end $mig$;

create table if not exists public.resource_links (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references public.companies (id) on delete cascade,
  position_id     smallint references public.roles_config (id) on delete cascade,
  category        public.link_category not null default 'lainnya',
  title           text not null,
  url             text not null,
  description     text,
  created_by      uuid references public.users (id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint resource_links_title_ok check (btrim(title) <> '' and char_length(title) <= 120),
  constraint resource_links_url_ok   check (url ~* '^https?://[^[:space:]]+$' and char_length(url) <= 2000),
  constraint resource_links_desc_ok  check (description is null or char_length(description) <= 300)
);

create index if not exists resource_links_company_idx  on public.resource_links (company_id);
create index if not exists resource_links_position_idx on public.resource_links (position_id);

comment on table  public.resource_links is 'Inventaris tautan kerja. company_id kosong = semua company; position_id kosong = semua divisi.';
comment on column public.resource_links.company_id is 'Kosong = semua company (hanya Owner yang boleh membuat).';

-- Jabatan pengguna yang sedang login (null bila tanpa profil aktif)
create or replace function public.current_position_id()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select position_id from public.users where id = (select auth.uid()) and is_active
$$;

revoke all on function public.current_position_id() from public, anon;
grant execute on function public.current_position_id() to authenticated;

-- Pembuat dan waktu ubah diisi server (tidak bisa dipalsukan)
create or replace function public.resource_links_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
      select u.full_name into new.created_by_name from public.users u where u.id = auth.uid();
    end if;
  else
    new.created_by      := old.created_by;
    new.created_by_name := old.created_by_name;
    new.created_at      := old.created_at;
    new.updated_at      := now();
  end if;
  return new;
end;
$$;

revoke all on function public.resource_links_prepare() from public, anon, authenticated;

drop trigger if exists trg_resource_links_prepare on public.resource_links;
create trigger trg_resource_links_prepare
  before insert or update on public.resource_links
  for each row execute function public.resource_links_prepare();

-- ---------- RLS ----------
alter table public.resource_links enable row level security;

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
      and (position_id is null or position_id = (select public.current_position_id()))
    )
  );

drop policy if exists resource_links_owner_all on public.resource_links;
create policy resource_links_owner_all on public.resource_links
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

drop policy if exists resource_links_manager_insert on public.resource_links;
create policy resource_links_manager_insert on public.resource_links
  for insert to authenticated
  with check (
    (select public.current_user_role()) = 'manager'
    and company_id = (select public.current_company_id())
  );

drop policy if exists resource_links_manager_update on public.resource_links;
create policy resource_links_manager_update on public.resource_links
  for update to authenticated
  using (
    (select public.current_user_role()) = 'manager'
    and company_id = (select public.current_company_id())
  )
  with check (
    (select public.current_user_role()) = 'manager'
    and company_id = (select public.current_company_id())
  );

drop policy if exists resource_links_manager_delete on public.resource_links;
create policy resource_links_manager_delete on public.resource_links
  for delete to authenticated
  using (
    (select public.current_user_role()) = 'manager'
    and company_id = (select public.current_company_id())
  );

-- ---------- Hak akses tabel ----------
revoke all on public.resource_links from anon;
grant select, insert, delete on public.resource_links to authenticated;
revoke update on public.resource_links from authenticated;
grant update (company_id, position_id, category, title, url, description)
  on public.resource_links to authenticated;
