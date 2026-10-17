-- =====================================================================
-- 017 OWNER BOLEH MEMBUAT NOTULENSI UNTUK COMPANY MANA PUN
-- (sama dengan bagian 22 schema_daily_report.sql)
--
-- Masalah: aturan lama meetings_creator_company_fk mewajibkan pembuat berada di
-- company yang SAMA dengan notulensi, sehingga Owner yang memilih company lain
-- di form gagal ("violates foreign key constraint meetings_creator_company_fk").
-- Keputusan pemilik (17 Okt 2026): Owner boleh membuat notulensi untuk company mana pun.
-- Manager dan karyawan tetap hanya di company sendiri (dijaga RLS dan pemicu di bawah).
-- Aman dijalankan ulang.
-- =====================================================================

alter table public.meetings drop constraint if exists meetings_creator_company_fk;

alter table public.meetings drop constraint if exists meetings_creator_fk;
alter table public.meetings add constraint meetings_creator_fk
  foreign key (created_by) references public.users (id) on delete restrict;

-- Pembuat harus se-company dengan notulensi, KECUALI pembuatnya Owner
create or replace function public.meetings_check_creator_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_cid uuid;
begin
  select u.role, u.company_id into v_role, v_cid from public.users u where u.id = new.created_by;
  if not found then
    raise exception 'Pembuat notulensi tidak ditemukan.' using errcode = '23503';
  end if;
  if v_role is distinct from 'owner' and v_cid is distinct from new.company_id then
    raise exception 'Pembuat notulensi harus berada di company yang sama dengan notulensi.' using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function public.meetings_check_creator_company() from public, anon, authenticated;

drop trigger if exists trg_meetings_check_creator_company on public.meetings;
create trigger trg_meetings_check_creator_company
  before insert or update of created_by, company_id on public.meetings
  for each row execute function public.meetings_check_creator_company();
