-- =====================================================================
-- 001 HAK AKSES TABEL (sama dengan bagian 12 schema_daily_report.sql)
-- Jalankan sekali di Supabase SQL Editor pada proyek yang sudah terpasang.
-- =====================================================================

-- Proyek Supabase baru tidak otomatis memberi hak akses tabel ke peran API
-- (anon, authenticated). Bagian ini memberikannya secara eksplisit.
-- RLS (bagian 5, 6, 8, 11) tetap menentukan BARIS mana yang boleh disentuh.
-- Aman dijalankan ulang.

-- Pengunjung yang belum login: tidak punya hak tabel apa pun.
revoke all on all tables in schema public from anon;

-- Pengguna login: cabut hak yang tidak dipakai aplikasi.
revoke truncate, trigger, references on all tables in schema public from authenticated;

grant select on public.companies, public.roles_config, public.users,
  public.daily_reports, public.user_invites,
  public.meetings, public.meeting_attendees, public.meeting_action_items
  to authenticated;
grant select on public.v_weekly_team_reports to authenticated;

grant insert on public.companies, public.daily_reports, public.user_invites,
  public.meetings, public.meeting_attendees, public.meeting_action_items
  to authenticated;

-- Hanya Owner yang lolos RLS untuk tiga tabel ini.
grant update on public.companies, public.users, public.user_invites to authenticated;

-- Kolom yang boleh diedit (sama dengan bagian 6 dan 11f).
grant update (activities, performance_metrics, obstacles, insights, next_plan, evidence_links)
  on public.daily_reports to authenticated;
grant update (title, meeting_date, start_time, end_time, location, agenda, discussion,
              decisions, next_meeting_date, attachment_links, visibility)
  on public.meetings to authenticated;
grant update (user_id, name) on public.meeting_attendees to authenticated;
grant update (description, assignee_id, assignee_name, due_date, status)
  on public.meeting_action_items to authenticated;

-- Hapus: batalkan undangan, hapus notulensi (Owner), edit daftar
-- peserta/tindak lanjut (pembuat atau Owner).
grant delete on public.user_invites, public.meetings,
  public.meeting_attendees, public.meeting_action_items to authenticated;
