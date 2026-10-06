import { MEETING_COLUMNS, type ActionRow, type AttendeeRow, type MeetingRow } from "@/lib/meetings";
import type { Profile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { CompanyOption, Person } from "@/components/meetings/MeetingEditor";

// Notulensi + peserta + tindak lanjut. null = tidak ada / tidak boleh dilihat (RLS).
export async function loadMeeting(id: string) {
  const supabase = await createClient();
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select(`${MEETING_COLUMNS}, company:companies(name)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat notulensi: ${error.message}`);
  if (!meeting) return null;

  const [att, act] = await Promise.all([
    supabase.from("meeting_attendees").select("id, user_id, name").eq("meeting_id", id).order("created_at"),
    supabase
      .from("meeting_action_items")
      .select("id, description, assignee_id, assignee_name, due_date, status")
      .eq("meeting_id", id)
      .order("created_at"),
  ]);
  if (att.error) throw new Error(`Gagal memuat peserta: ${att.error.message}`);
  if (act.error) throw new Error(`Gagal memuat tindak lanjut: ${act.error.message}`);

  return {
    meeting: meeting as unknown as MeetingRow & { company: { name: string } | null },
    attendees: (att.data ?? []) as AttendeeRow[],
    actions: (act.data ?? []) as ActionRow[],
  };
}

// Karyawan aktif yang bisa dipilih sebagai peserta/PIC (RLS: Owner semua, lainnya se-company).
export async function loadPeople(): Promise<Person[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, company_id, position:roles_config(name)")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw new Error(`Gagal memuat daftar karyawan: ${error.message}`);
  return (data ?? []).map((u) => ({
    id: u.id,
    full_name: u.full_name,
    company_id: u.company_id,
    position: (u.position as unknown as { name: string } | null)?.name ?? null,
  }));
}

export async function loadCompaniesForOwner(profile: Profile): Promise<CompanyOption[] | null> {
  if (profile.role !== "owner") return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").select("id, name").eq("is_active", true).order("name");
  if (error) throw new Error(`Gagal memuat company: ${error.message}`);
  return data ?? [];
}
