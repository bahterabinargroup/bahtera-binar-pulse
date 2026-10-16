-- =====================================================================
-- 016 TANDA "SUDAH DITANGANI" UNTUK KENDALA/INSIGHT (sama dengan bagian 21 schema)
--
-- Keputusan pemilik (17 Okt 2026): halaman Pantauan Kendala dan Insight bisa
-- menandai laporan yang kendalanya sudah ditindaklanjuti, dengan catatan singkat.
-- - Satu tanda per laporan (mencakup kendala dan insight laporan itu).
-- - Yang menandai: Owner (semua company) dan Manager (company-nya). Lead dan
--   karyawan tidak bisa menandai.
-- - Yang melihat tanda: siapa pun yang boleh melihat laporannya (pemilik laporan,
--   Lead divisinya, Manager company-nya, Owner).
-- - Menandai dan membatalkan tanda hanya lewat fungsi resmi di bawah.
-- Aman dijalankan ulang.
-- =====================================================================

create table if not exists public.report_followups (
  report_id  uuid primary key references public.daily_reports (id) on delete cascade,
  company_id uuid not null,
  handled_by uuid references public.users (id) on delete set null,
  handled_at timestamptz not null default now(),
  note       text,
  constraint report_followups_note_len check (note is null or length(note) <= 500)
);

create index if not exists report_followups_company_idx on public.report_followups (company_id, handled_at desc);

comment on table public.report_followups is 'Tanda "sudah ditangani" untuk kendala/insight sebuah laporan harian. Baris ada = sudah ditangani.';

alter table public.report_followups enable row level security;

-- Boleh melihat tanda bila boleh melihat laporannya (aturan akses laporan dipakai ulang)
drop policy if exists report_followups_select on public.report_followups;
create policy report_followups_select on public.report_followups
  for select to authenticated
  using (exists (select 1 from public.daily_reports r where r.id = report_id));

revoke all on public.report_followups from anon;
revoke all on public.report_followups from authenticated;
grant select on public.report_followups to authenticated;

create or replace function public.mark_report_handled(p_report uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rc uuid;
  me_role public.user_role := (select public.current_user_role());
  me_company uuid := (select public.current_company_id());
begin
  if auth.uid() is null or me_role is null then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  select company_id into rc from public.daily_reports where id = p_report;
  if not found then
    raise exception 'Laporan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if not (me_role = 'owner' or (me_role = 'manager' and rc = me_company)) then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  if length(coalesce(p_note, '')) > 500 then
    raise exception 'Catatan terlalu panjang (maksimal 500 huruf).' using errcode = '22023';
  end if;
  insert into public.report_followups (report_id, company_id, handled_by, handled_at, note)
  values (p_report, rc, auth.uid(), now(), nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (report_id) do update
    set handled_by = excluded.handled_by, handled_at = excluded.handled_at, note = excluded.note;
end;
$$;

create or replace function public.unmark_report_handled(p_report uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rc uuid;
  me_role public.user_role := (select public.current_user_role());
  me_company uuid := (select public.current_company_id());
begin
  if auth.uid() is null or me_role is null then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  select company_id into rc from public.daily_reports where id = p_report;
  if not found then
    raise exception 'Laporan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if not (me_role = 'owner' or (me_role = 'manager' and rc = me_company)) then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  delete from public.report_followups where report_id = p_report;
end;
$$;

revoke all on function public.mark_report_handled(uuid, text) from public, anon;
revoke all on function public.unmark_report_handled(uuid) from public, anon;
grant execute on function public.mark_report_handled(uuid, text) to authenticated;
grant execute on function public.unmark_report_handled(uuid) to authenticated;
