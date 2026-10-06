import { redirect } from "next/navigation";
import { getCurrentUser, type Profile } from "@/lib/profile";

// Halaman khusus Owner: selain Owner dialihkan ke Beranda.
// (Database tetap penentu akhir lewat RLS.)
export async function requireOwnerPage(): Promise<Profile> {
  const { profile } = await getCurrentUser();
  if (profile?.role !== "owner") redirect("/");
  return profile;
}

// Untuk server action khusus Owner. Pemeriksaan ini WAJIB sebelum memakai client admin.
export async function requireOwnerAction(): Promise<Profile | null> {
  const { profile } = await getCurrentUser();
  return profile?.role === "owner" ? profile : null;
}
