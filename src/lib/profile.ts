import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "owner" | "manager" | "employee";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  employee_code: string | null;
  company: { id: string; code: string; name: string } | null;
  position: { id: number; code: string; name: string } | null;
};

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  employee: "Karyawan",
};

// Pengguna login + profilnya. profile = null berarti akun Auth ada tetapi
// belum punya profil (tidak diundang) atau dinonaktifkan: RLS menyembunyikannya.
// cache(): dipanggil berkali-kali dalam satu permintaan, query hanya sekali.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data, error } = await supabase
    .from("users")
    .select(
      "id, full_name, email, role, employee_code, company:companies(id, code, name), position:roles_config(id, code, name)",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat profil: ${error.message}`);
  return { user, profile: (data as unknown as Profile | null) ?? null };
});
