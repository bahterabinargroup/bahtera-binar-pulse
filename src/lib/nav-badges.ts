// Penanda angka di sidebar: pengajuan cuti/izin yang menunggu keputusan Anda, dan tugas Anda yang lewat tenggat.
// Gagal membaca = tanpa angka (sidebar tetap tampil).
import { todayJakarta } from "@/lib/date";
import type { Profile } from "@/lib/profile";
import { isManagerial } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type NavBadges = Record<string, number>; // kunci = href menu

// Jumlah pengajuan cuti/izin yang bisa diputuskan pengguna ini (sama dengan isi halaman Persetujuan):
// tanpa milik sendiri, tanpa yang kedaluwarsa, dan Manager hanya untuk karyawan/Lead.
export async function countLeaveWaiting(sb: Awaited<ReturnType<typeof createClient>>, profile: Profile, today: string): Promise<number | null> {
  const { data, error } = await sb
    .from("leave_requests")
    .select("user_id")
    .or(`and(status.eq.pending,end_date.gte.${today}),and(status.eq.approved,cancel_requested_at.not.is.null,cancel_outcome.is.null)`)
    .neq("user_id", profile.id)
    .limit(500);
  if (error) return null;
  let ids = ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
  if (profile.role === "manager" && ids.length) {
    const { data: ppl } = await sb.from("users").select("id, role").in("id", [...new Set(ids)]);
    const ok = new Set(((ppl ?? []) as { id: string; role: string }[]).filter((p) => p.role === "employee" || p.role === "lead").map((p) => p.id));
    ids = ids.filter((i) => ok.has(i));
  }
  return ids.length;
}

export async function getNavBadges(profile: Profile): Promise<NavBadges> {
  const badges: NavBadges = {};
  try {
    const sb = await createClient();
    const today = todayJakarta();
    const [tasksRes, leaveCount] = await Promise.all([
      sb.rpc("get_my_action_items"),
      isManagerial(profile.role) ? countLeaveWaiting(sb, profile, today) : Promise.resolve(null),
    ]);

    if (!tasksRes.error) {
      const late = ((tasksRes.data ?? []) as { due_date: string | null }[]).filter((t) => t.due_date && t.due_date < today).length;
      if (late > 0) badges["/tugas"] = late;
    }

    if (leaveCount && leaveCount > 0) badges["/cuti/persetujuan"] = leaveCount;
  } catch {
    // tanpa angka
  }
  return badges;
}
