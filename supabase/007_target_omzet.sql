-- =====================================================================
-- 007 TARGET OMZET (sama dengan bagian 16 schema_daily_report.sql)
-- Target omzet bulanan per ADV, ditetapkan Owner. Total company = jumlah
-- target ADV di company itu. Realisasi diambil dari GMV laporan harian ADV;
-- target harian = target bulan ÷ jumlah hari kerja (Senin-Sabtu), dihitung aplikasi.
--
-- Keputusan pemilik (10 Okt 2026):
-- - Yang menetapkan/mengubah/menghapus: hanya Owner.
-- - Yang melihat: Owner semua; Manager target ADV di company-nya;
--   Karyawan target milik dirinya sendiri.
-- Aman dijalankan ulang.
-- =====================================================================

create table if not exists public.omzet_targets (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id    uuid not null,
  month      date not null,
  amount     numeric(16, 0) not null,
  set_by     uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint omzet_targets_user_month_uk unique (user_id, month),
  -- Isolasi company: target tidak bisa menunjuk company yang berbeda dari company pemiliknya
  constraint omzet_targets_user_company_fk
    foreign key (user_id, company_id) references public.users (id, company_id) on delete cascade,
  constraint omzet_targets_month_first check (extract(day from month) = 1),
  constraint omzet_targets_amount_ok check (amount >= 0 and amount <= 1000000000000)
);

create index if not exists omzet_targets_company_month_idx on public.omzet_targets (company_id, month);

comment on table public.omzet_targets is 'Target omzet bulanan per ADV (month = tanggal 1 bulan itu). Total company dihitung dari jumlahnya.';

create or replace function public.omzet_targets_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.set_by := auth.uid(); end if;
  else
    new.set_by := coalesce(auth.uid(), old.set_by);
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.omzet_targets_prepare() from public, anon, authenticated;

drop trigger if exists trg_omzet_targets_prepare on public.omzet_targets;
create trigger trg_omzet_targets_prepare
  before insert or update on public.omzet_targets
  for each row execute function public.omzet_targets_prepare();

alter table public.omzet_targets enable row level security;

drop policy if exists omzet_targets_select on public.omzet_targets;
create policy omzet_targets_select on public.omzet_targets
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or (
      (select public.current_user_role()) = 'manager'
      and company_id = (select public.current_company_id())
    )
    or user_id = (select auth.uid())
  );

drop policy if exists omzet_targets_owner_write on public.omzet_targets;
create policy omzet_targets_owner_write on public.omzet_targets
  for all to authenticated
  using ((select public.current_user_role()) = 'owner')
  with check ((select public.current_user_role()) = 'owner');

revoke all on public.omzet_targets from anon;
grant select, insert, delete on public.omzet_targets to authenticated;
revoke update on public.omzet_targets from authenticated;
grant update (amount) on public.omzet_targets to authenticated;
