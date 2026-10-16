"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/(app)/owner/actions";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function dbError(error: { code?: string; message: string }): string {
  if (error.code === "42883" || error.code === "PGRST202") return "Fitur penanda belum aktif di database. Jalankan supabase/016_tindak_lanjut_kendala.sql.";
  if (error.code === "42501") return "Hanya Owner dan Manager yang bisa menandai.";
  if (["P0002", "22023"].includes(error.code ?? "")) return error.message;
  return `Gagal: ${error.message}`;
}

export async function markHandled(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  if (!isUuid(id)) return { ok: false, error: "Laporan tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_report_handled", { p_report: id, p_note: str(f, "note") || null });
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath("/pantauan");
  return { ok: true, message: "Ditandai sudah ditangani." };
}

export async function unmarkHandled(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  if (!isUuid(id)) return { ok: false, error: "Laporan tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("unmark_report_handled", { p_report: id });
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath("/pantauan");
  return { ok: true, message: "Tanda dibatalkan." };
}
