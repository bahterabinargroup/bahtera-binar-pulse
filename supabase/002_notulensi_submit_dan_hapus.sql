-- =====================================================================
-- 002 NOTULENSI: DRAFT -> SUBMIT, LOKASI ONLINE, PERMINTAAN HAPUS
-- (sama dengan bagian 13 schema_daily_report.sql)
-- Jalankan sekali di Supabase SQL Editor. Aman dijalankan ulang.
--
-- Keputusan pemilik (6 Okt 2026):
-- - SIAPA YANG MELIHAT (draft maupun submit): Owner (semua), Manager (company-nya
--   saja), dan pembuatnya sendiri. Karyawan lain TIDAK melihat notulensi.
--   Semua peran boleh membuat. Opsi "Seluruh holding" tidak dipakai lagi.
-- - Karyawan yang ditunjuk sebagai PIC hanya melihat TUGASNYA sendiri
--   (lewat get_my_action_items), bukan isi notulensinya.
-- - Notulensi berstatus DRAFT (submitted_at kosong) bisa disimpan berkali-kali
--   (manual & otomatis) oleh pembuatnya.
-- - Setelah SUBMIT, notulensi terkunci untuk pembuat. Hanya Owner yang masih
--   bisa mengoreksi. PIC tetap bisa mengubah STATUS tindak lanjutnya.
-- - Lokasi: "Kantor 1", "Kantor 2", atau "Online" (+ link di meeting_link).
-- - Pembuat tidak menghapus langsung: ia MENGAJUKAN hapus. Notulensi tetap ada
--   sampai Owner menyetujui (menghapus) atau menolak (mengosongkan permintaan).
-- =====================================================================

-- ---------- Kolom baru ----------
alter table public.meetings
  add column if not exists submitted_at          timestamptz,
  add column if not exists meeting_link          text,
  add column if not exists delete_requested_at   timestamptz,
  add column if not exists delete_request_reason text;

comment on column public.meetings.submitted_at is
  'Kosong = draft (masih bisa diedit pembuat). Terisi = sudah di-submit dan terkunci (kecuali Owner).';
comment on column public.meetings.location is
  'Lokasi meeting: Kantor 1, Kantor 2, atau Online.';
comment on column public.meetings.meeting_link is
  'Link meeting online (Zoom/Meet) bila lokasi = Online.';
comment on column public.meetings.delete_requested_at is
  'Permintaan hapus dari pembuat. Notulensi tetap ada sampai Owner menyetujui atau menolak.';

-- ---------- Siapa yang boleh melihat ----------
drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated
  using (
    (select public.current_user_role()) = 'owner'
    or (
      (select public.current_user_role()) = 'manager'
      and company_id = (select public.current_company_id())
    )
    or (
      created_by = (select auth.uid())
      and (select public.current_user_role()) is not null
    )
  );

-- Peserta: mengikuti notulensinya (policy meeting_attendees_select tidak berubah).
-- Tindak lanjut: mengikuti notulensinya, ditambah PIC melihat tugasnya sendiri.
drop policy if exists meeting_action_items_select on public.meeting_action_items;
create policy meeting_action_items_select on public.meeting_action_items
  for select to authenticated
  using (
    exists (select 1 from public.meetings m where m.id = meeting_action_items.meeting_id)
    or (
      assignee_id = (select auth.uid())
      and (select public.current_user_role()) is not null
    )
  );

-- Daftar "Tugas saya": tindak lanjut milik pengguna + judul & tanggal meeting,
-- tanpa membuka isi notulensi.
create or replace function public.get_my_action_items(p_include_done boolean default false)
returns table (
  id            uuid,
  meeting_id    uuid,
  meeting_title text,
  meeting_date  date,
  description   text,
  due_date      date,
  status        public.action_item_status,
  completed_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.meeting_id, m.title, m.meeting_date,
         a.description, a.due_date, a.status, a.completed_at
  from public.meeting_action_items a
  join public.meetings m on m.id = a.meeting_id
  where a.assignee_id = auth.uid()
    and public.current_user_role() is not null
    and (p_include_done or a.status <> 'done')
  order by a.due_date nulls last, m.meeting_date desc
$$;

revoke all on function public.get_my_action_items(boolean) from public, anon;
grant execute on function public.get_my_action_items(boolean) to authenticated;

-- ---------- Waktu submit selalu dari server, dan tidak bisa dibatalkan ----------
create or replace function public.meetings_submit_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.submitted_at is not null then
      new.submitted_at := now();
    end if;
    return new;
  end if;

  if new.submitted_at is distinct from old.submitted_at then
    if old.submitted_at is null then
      new.submitted_at := now();                       -- submit
    elsif auth.uid() is not null
          and public.current_user_role() is distinct from 'owner' then
      raise exception 'Notulensi yang sudah di-submit tidak bisa dibuka kembali.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.meetings_submit_guard() from public, anon, authenticated;

drop trigger if exists trg_meetings_c_submit_guard on public.meetings;
create trigger trg_meetings_c_submit_guard
  before insert or update on public.meetings
  for each row execute function public.meetings_submit_guard();

-- ---------- Pembuat hanya boleh mengubah selama masih draft ----------
drop policy if exists meetings_update_own on public.meetings;
create policy meetings_update_own on public.meetings
  for update to authenticated
  using (created_by = (select auth.uid()) and submitted_at is null)
  with check (
    created_by = (select auth.uid())
    and company_id = (select public.current_company_id())
    and visibility = 'company'
  );

drop policy if exists meeting_attendees_creator_write on public.meeting_attendees;
create policy meeting_attendees_creator_write on public.meeting_attendees
  for all to authenticated
  using (exists (select 1 from public.meetings m
                 where m.id = meeting_attendees.meeting_id
                   and m.created_by = (select auth.uid())
                   and m.submitted_at is null))
  with check (exists (select 1 from public.meetings m
                      where m.id = meeting_attendees.meeting_id
                        and m.created_by = (select auth.uid())
                        and m.submitted_at is null));

drop policy if exists meeting_action_items_creator_write on public.meeting_action_items;
create policy meeting_action_items_creator_write on public.meeting_action_items
  for all to authenticated
  using (exists (select 1 from public.meetings m
                 where m.id = meeting_action_items.meeting_id
                   and m.created_by = (select auth.uid())
                   and m.submitted_at is null))
  with check (exists (select 1 from public.meetings m
                      where m.id = meeting_action_items.meeting_id
                        and m.created_by = (select auth.uid())
                        and m.submitted_at is null));

-- Pembatas tindak lanjut: pembuat bebas mengubah hanya selama draft.
-- Setelah submit, pembuat yang juga PIC hanya boleh mengubah status.
create or replace function public.meeting_action_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_creator uuid;
  v_submitted timestamptz;
begin
  if v_uid is null then
    return new;                                   -- service_role / SQL Editor
  end if;
  if public.current_user_role() = 'owner' then
    return new;
  end if;

  select m.created_by, m.submitted_at into v_creator, v_submitted
  from public.meetings m where m.id = old.meeting_id;
  if v_creator = v_uid and v_submitted is null then
    return new;                                   -- pembuat, masih draft
  end if;

  if new.meeting_id    is distinct from old.meeting_id
     or new.description   is distinct from old.description
     or new.assignee_id   is distinct from old.assignee_id
     or new.assignee_name is distinct from old.assignee_name
     or new.due_date      is distinct from old.due_date then
    raise exception 'PIC hanya boleh mengubah status tindak lanjut.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.meeting_action_items_guard() from public, anon, authenticated;

-- ---------- Permintaan hapus (berlaku juga setelah submit) ----------
create or replace function public.request_meeting_deletion(p_meeting_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() is null then
    raise exception 'Akun tidak aktif.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Alasan permintaan hapus wajib diisi.' using errcode = '22023';
  end if;

  update public.meetings
  set delete_requested_at = now(), delete_request_reason = btrim(p_reason)
  where id = p_meeting_id and created_by = auth.uid();

  if not found then
    raise exception 'Hanya pembuat notulensi yang bisa mengajukan hapus.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.cancel_meeting_deletion(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.meetings
  set delete_requested_at = null, delete_request_reason = null
  where id = p_meeting_id
    and (created_by = auth.uid() or public.current_user_role() = 'owner');

  if not found then
    raise exception 'Permintaan hapus tidak dapat dibatalkan.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.request_meeting_deletion(uuid, text) from public, anon;
revoke all on function public.cancel_meeting_deletion(uuid) from public, anon;
grant execute on function public.request_meeting_deletion(uuid, text) to authenticated;
grant execute on function public.cancel_meeting_deletion(uuid) to authenticated;

-- ---------- Hak kolom ----------
-- delete_requested_at / delete_request_reason sengaja TIDAK dibuka untuk
-- update langsung: hanya lewat fungsi di atas (atau Owner lewat fungsi batal).
grant update (submitted_at, meeting_link) on public.meetings to authenticated;
