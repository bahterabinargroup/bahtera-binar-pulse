-- =====================================================================
-- 018 PESERTA BISA MELIHAT NOTULENSI (sama dengan bagian 23 schema_daily_report.sql)
--
-- Keputusan pemilik (17 Okt 2026): karyawan yang disebut di "Peserta" sebuah
-- notulensi bisa melihat notulensi itu di akunnya sendiri (menggantikan aturan
-- 6 Okt "karyawan hanya melihat notulensi buatannya").
-- - Hanya peserta yang punya akun (bukan tamu), dan hanya SETELAH notulensi di-Submit
--   (draft masih bahan kerja penulisnya).
-- - Hanya melihat: tidak bisa mengubah, menambah peserta, atau menghapus. Peserta
--   ikut melihat daftar peserta dan tindak lanjut notulensi itu.
-- - Aturan lain tidak berubah (Owner semua, Manager company-nya, pembuat miliknya).
-- Aman dijalankan ulang.
-- =====================================================================

-- Fungsi ini membaca tabel tanpa melewati aturan akses (security definer) agar tidak
-- terjadi putaran tak berujung antara aturan notulensi dan aturan peserta.
create or replace function public.is_meeting_participant(p_meeting uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.meeting_id = p_meeting
      and a.user_id = (select auth.uid())
      and m.submitted_at is not null
      and (select public.current_user_role()) is not null
  )
$$;

revoke all on function public.is_meeting_participant(uuid) from public, anon;
grant execute on function public.is_meeting_participant(uuid) to authenticated;

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
    or public.is_meeting_participant(id)
  );
