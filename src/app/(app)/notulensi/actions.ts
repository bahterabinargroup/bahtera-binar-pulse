"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionStatus, ChildDiff, MeetingFields } from "@/lib/meetings";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

type Fail = { ok: false; error: string };

type Saved = {
  id: string;
  updatedAt: string;
  attendeeIds: Record<string, string>;
  actionIds: Record<string, string>;
};

// Saat gagal di tengah jalan, bagian yang sudah tersimpan tetap dikembalikan
// (partial) agar penyimpanan berikutnya tidak membuat data ganda.
export type SaveMeetingResult = ({ ok: true } & Saved) | (Fail & { partial?: Saved });

const NOT_ALLOWED =
  "Notulensi tidak dapat diubah: sudah di-submit, sudah dihapus, atau Anda bukan penulisnya.";

function describe(error: { code?: string; message: string }): string {
  // Pesan dari trigger database sudah berbahasa Indonesia.
  if (/Peserta|PIC|Notulensi|Alasan|pembuat|tidak aktif/.test(error.message)) return error.message;
  if (error.code === "23505") return "Peserta yang sama sudah ada di daftar.";
  if (error.code === "23514") {
    if (error.message.includes("time_order")) return "Jam selesai tidak boleh lebih awal dari jam mulai.";
    if (error.message.includes("attachments")) return "Maksimal 20 link lampiran.";
    if (error.message.includes("title")) return "Nama meeting wajib diisi.";
  }
  if (error.code === "42501" || /row-level security/i.test(error.message)) return NOT_ALLOWED;
  if (/fetch|network/i.test(error.message)) return "Tidak dapat terhubung ke server. Periksa koneksi internet.";
  return `Gagal menyimpan. Coba lagi. (${error.message})`;
}

// Simpan draft (manual maupun otomatis). Membuat notulensi baru bila id kosong.
export async function saveMeeting(input: {
  id: string | null;
  companyId: string;
  fields: MeetingFields;
  children: ChildDiff;
}): Promise<SaveMeetingResult> {
  const { profile } = await getCurrentUser();
  if (!profile) return { ok: false, error: "Sesi Anda sudah berakhir. Silakan masuk lagi." };
  const supabase = await createClient();

  let id = input.id;
  let updatedAt: string;
  if (!id) {
    const companyId = profile.role === "owner" ? input.companyId : profile.company?.id;
    const { data, error } = await supabase
      .from("meetings")
      .insert({ ...input.fields, company_id: companyId, created_by: profile.id })
      .select("id, updated_at")
      .single();
    if (error) return { ok: false, error: describe(error) };
    id = data.id as string;
    updatedAt = data.updated_at;
  } else {
    const { data, error } = await supabase
      .from("meetings")
      .update(input.fields)
      .eq("id", id)
      .select("id, updated_at");
    if (error) return { ok: false, error: describe(error) };
    if (!data?.length) return { ok: false, error: NOT_ALLOWED };
    updatedAt = data[0].updated_at;
  }

  const { attendees, actions } = input.children;
  const attendeeIds: Record<string, string> = {};
  const actionIds: Record<string, string> = {};
  const fail = (error: { code?: string; message: string }): SaveMeetingResult => ({
    ok: false,
    error: describe(error),
    partial: { id: id!, updatedAt, attendeeIds, actionIds },
  });

  if (attendees.delete.length) {
    const { error } = await supabase.from("meeting_attendees").delete().in("id", attendees.delete);
    if (error) return fail(error);
  }
  for (const a of attendees.insert) {
    const { data, error } = await supabase
      .from("meeting_attendees")
      .insert({ meeting_id: id, user_id: a.user_id, name: a.name })
      .select("id")
      .single();
    if (error) return fail(error);
    attendeeIds[a.key] = data.id;
  }

  if (actions.delete.length) {
    const { error } = await supabase.from("meeting_action_items").delete().in("id", actions.delete);
    if (error) return fail(error);
  }
  for (const { id: itemId, ...changes } of actions.update) {
    const { error } = await supabase.from("meeting_action_items").update(changes).eq("id", itemId);
    if (error) return fail(error);
  }
  for (const { key, ...row } of actions.insert) {
    const { data, error } = await supabase
      .from("meeting_action_items")
      .insert({ ...row, meeting_id: id })
      .select("id")
      .single();
    if (error) return fail(error);
    actionIds[key] = data.id;
  }

  revalidatePath("/notulensi");
  return { ok: true, id, updatedAt, attendeeIds, actionIds };
}

// Kunci notulensi. Waktu submit diisi server (trigger).
export async function submitMeeting(id: string): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", id)
    .is("submitted_at", null)
    .select("id");
  if (error) return { ok: false, error: describe(error) };
  if (!data?.length) return { ok: false, error: NOT_ALLOWED };
  revalidatePath("/notulensi");
  return { ok: true };
}

export async function updateActionStatus(itemId: string, status: ActionStatus): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meeting_action_items")
    .update({ status })
    .eq("id", itemId)
    .select("id");
  if (error) return { ok: false, error: describe(error) };
  if (!data?.length) return { ok: false, error: "Anda tidak berhak mengubah status tindak lanjut ini." };
  revalidatePath("/notulensi");
  revalidatePath("/tugas");
  return { ok: true };
}

export async function requestDeletion(id: string, reason: string): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_meeting_deletion", { p_meeting_id: id, p_reason: reason });
  if (error) return { ok: false, error: describe(error) };
  revalidatePath("/notulensi");
  return { ok: true };
}

// Pembuat membatalkan permintaannya, atau Owner menolak permintaan.
export async function cancelDeletion(id: string): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_meeting_deletion", { p_meeting_id: id });
  if (error) return { ok: false, error: describe(error) };
  revalidatePath("/notulensi");
  return { ok: true };
}

// Owner: hapus (langsung atau menyetujui permintaan). Peserta & tindak lanjut ikut terhapus.
export async function deleteMeeting(id: string): Promise<Fail> {
  const { profile } = await getCurrentUser();
  if (profile?.role !== "owner") return { ok: false, error: "Hanya Owner yang bisa menghapus notulensi." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("meetings").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: describe(error) };
  if (!data?.length) return { ok: false, error: "Notulensi tidak ditemukan atau sudah dihapus." };
  revalidatePath("/notulensi");
  redirect("/notulensi?pesan=terhapus");
}
