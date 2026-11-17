"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/(app)/owner/actions";
import { DEFAULT_RADIUS_M } from "@/lib/geo";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

function dbError(error: { code?: string; message: string }): string {
  if (error.code === "23514") return "Isian tidak memenuhi aturan (nama 1–80 huruf, radius 5–500 meter, koordinat harus valid).";
  if (error.code === "42501" || /row-level security/i.test(error.message)) return "Hanya Owner yang bisa mengelola titik absen.";
  if (error.code === "42P01" || error.code === "PGRST205") return "Tabel titik absen belum dibuat. Jalankan supabase/021_titik_absen.sql.";
  return `Gagal menyimpan: ${error.message}`;
}

async function ownerOnly() {
  const { profile } = await getCurrentUser();
  return profile?.role === "owner" ? profile : null;
}

export async function addPoint(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  if (!(await ownerOnly())) return { ok: false, error: "Hanya Owner yang bisa mengelola titik absen." };
  const company = String(f.get("company_id") ?? "");
  const name = String(f.get("name") ?? "").trim();
  const lat = Number(String(f.get("lat") ?? "").replace(",", "."));
  const lng = Number(String(f.get("lng") ?? "").replace(",", "."));
  const radius = Number(f.get("radius_m") ?? DEFAULT_RADIUS_M);
  if (!isUuid(company)) return { ok: false, error: "Pilih company." };
  if (!name) return { ok: false, error: "Nama titik wajib diisi, mis. Kantor 1." };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: "Koordinat belum valid. Tekan \"Pakai lokasi saya sekarang\" atau tempel tautan Google Maps." };
  if (!Number.isInteger(radius) || radius < 5 || radius > 500) return { ok: false, error: "Radius harus antara 5 dan 500 meter." };
  const supabase = await createClient();
  const { error } = await supabase.from("presensi_locations").insert({ company_id: company, name, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), radius_m: radius });
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath("/presensi/titik");
  revalidatePath("/presensi");
  return { ok: true, message: "Titik absen ditambahkan. Aturan radius langsung berlaku untuk company ini." };
}

export async function setRadius(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  if (!(await ownerOnly())) return { ok: false, error: "Hanya Owner yang bisa mengelola titik absen." };
  const id = String(f.get("id") ?? "");
  const radius = Number(f.get("radius_m"));
  if (!isUuid(id)) return { ok: false, error: "Titik tidak valid." };
  if (!Number.isInteger(radius) || radius < 5 || radius > 500) return { ok: false, error: "Radius harus antara 5 dan 500 meter." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("presensi_locations").update({ radius_m: radius }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data?.length) return { ok: false, error: "Titik tidak ditemukan." };
  revalidatePath("/presensi/titik");
  return { ok: true, message: "Radius diperbarui." };
}

export async function deletePoint(id: string): Promise<ActionResult> {
  if (!(await ownerOnly())) return { ok: false, error: "Hanya Owner yang bisa mengelola titik absen." };
  if (!isUuid(id)) return { ok: false, error: "Titik tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("presensi_locations").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data?.length) return { ok: false, error: "Titik tidak ditemukan." };
  revalidatePath("/presensi/titik");
  revalidatePath("/presensi");
  return { ok: true, message: "Titik dihapus." };
}
