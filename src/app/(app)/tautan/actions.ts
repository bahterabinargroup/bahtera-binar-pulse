"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/(app)/owner/actions";
import { LINK_CATEGORIES } from "@/lib/links";
import { getCurrentUser } from "@/lib/profile";
import { normalizeUrl } from "@/lib/report/form-state";
import { createClient } from "@/lib/supabase/server";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function dbError(error: { code?: string; message: string }): string {
  if (error.code === "23514") return "Judul atau alamat link tidak memenuhi aturan (judul maks. 120 huruf, keterangan maks. 300).";
  if (error.code === "42501" || /row-level security/i.test(error.message)) return "Anda tidak berhak mengubah tautan ini.";
  if (error.code === "42P01") return "Tabel tautan belum dibuat di database. Hubungi pengelola aplikasi.";
  return `Gagal menyimpan: ${error.message}`;
}

// Owner & Manager. Database (RLS) tetap penentu akhir: Manager hanya company-nya.
export async function saveLink(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  const { profile } = await getCurrentUser();
  if (!profile || profile.role === "employee") return { ok: false, error: "Hanya Owner dan Manager yang bisa mengelola tautan." };

  const id = str(f, "id");
  const title = str(f, "title");
  const url = normalizeUrl(str(f, "url"));
  const category = str(f, "category");
  const description = str(f, "description");
  // Beberapa divisi dipilih lewat kotak centang; tidak ada yang dicentang = semua divisi.
  const positionIds = [...new Set(f.getAll("position_ids").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  if (positionIds.length > 20) return { ok: false, error: "Terlalu banyak divisi dipilih." };

  if (!title) return { ok: false, error: "Judul wajib diisi." };
  if (!url) return { ok: false, error: "Alamat link tidak valid. Contoh: https://docs.google.com/spreadsheets/..." };
  if (!LINK_CATEGORIES.some((c) => c.value === category)) return { ok: false, error: "Pilih kategori." };

  // Manager selalu untuk company-nya sendiri; Owner boleh memilih company atau "semua company".
  const companyId = profile.role === "owner" ? str(f, "company_id") || null : (profile.company?.id ?? null);
  if (profile.role === "manager" && !companyId) return { ok: false, error: "Company Anda tidak ditemukan." };

  const fields = {
    title,
    url,
    category,
    description: description || null,
    company_id: companyId,
    position_ids: positionIds,
  };

  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("resource_links").update(fields).eq("id", id).select("id");
    if (error) return { ok: false, error: dbError(error) };
    if (!data?.length) return { ok: false, error: "Tautan tidak ditemukan atau bukan hak Anda." };
  } else {
    const { error } = await supabase.from("resource_links").insert(fields);
    if (error) return { ok: false, error: dbError(error) };
  }
  revalidatePath("/");
  revalidatePath("/tautan");
  return { ok: true, message: id ? "Tautan diperbarui." : "Tautan ditambahkan." };
}

export async function deleteLink(id: string): Promise<ActionResult> {
  const { profile } = await getCurrentUser();
  if (!profile || profile.role === "employee") return { ok: false, error: "Hanya Owner dan Manager yang bisa menghapus tautan." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("resource_links").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data?.length) return { ok: false, error: "Tautan tidak ditemukan atau bukan hak Anda." };
  revalidatePath("/");
  revalidatePath("/tautan");
  return { ok: true, message: "Tautan dihapus." };
}
