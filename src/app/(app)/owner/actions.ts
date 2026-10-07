"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireOwnerAction } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const NOT_OWNER: ActionResult = { ok: false, error: "Hanya Owner yang boleh melakukan ini." };
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function dbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    if (/companies_code/.test(error.message)) return "Kode company sudah dipakai.";
    if (/invites_open_email/.test(error.message)) return "Email ini sudah punya undangan yang masih terbuka.";
    if (/empcode/.test(error.message)) return "Kode karyawan sudah dipakai di company ini.";
    return "Data yang sama sudah ada.";
  }
  if (error.code === "23514") return "Isian tidak memenuhi aturan (cek kembali).";
  if (error.code === "42501" || /row-level security/i.test(error.message)) return "Akses ditolak.";
  return `Gagal: ${error.message}`;
}

// ---------- Company ----------

export async function saveCompany(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  if (!(await requireOwnerAction())) return NOT_OWNER;
  const id = str(f, "id");
  const fields = {
    code: str(f, "code").toUpperCase(),
    name: str(f, "name"),
    description: str(f, "description") || null,
    parent_id: str(f, "parent_id") || null,
    is_holding: f.get("is_holding") === "on",
  };
  if (!fields.code || !fields.name) return { ok: false, error: "Kode dan nama company wajib diisi." };
  if (id && fields.parent_id === id) return { ok: false, error: "Company tidak boleh menjadi induk dirinya sendiri." };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("companies").update(fields).eq("id", id)
    : await supabase.from("companies").insert(fields);
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath("/owner/company");
  return { ok: true, message: id ? "Company diperbarui." : "Company ditambahkan." };
}

export async function setCompanyActive(id: string, active: boolean): Promise<ActionResult> {
  if (!(await requireOwnerAction())) return NOT_OWNER;
  const supabase = await createClient();
  const { error } = await supabase.from("companies").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath("/owner/company");
  return { ok: true };
}

// ---------- Undangan ----------

async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

// Kirim email undangan lewat Supabase Auth Admin API (kunci rahasia, server saja).
// Link di email membuka aplikasi lalu langsung ke halaman "Buat password".
async function sendInviteEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) {
    return "Undangan tercatat, tetapi email belum bisa dikirim: SUPABASE_SECRET_KEY belum diisi di .env.local.";
  }
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${await siteOrigin()}/login` });
  if (!error) return null;
  if (/already been registered|already exists/i.test(error.message)) {
    return "Undangan tercatat, tetapi email ini sudah punya akun login. Minta orangnya masuk seperti biasa (atau pakai Lupa password); profilnya terbentuk otomatis saat emailnya terkonfirmasi. Jika tetap tidak bisa, hubungi pengembang.";
  }
  if (/rate limit/i.test(error.message)) {
    return "Undangan tercatat, tetapi batas kirim email Supabase per jam sudah tercapai. Coba Kirim ulang beberapa saat lagi.";
  }
  return `Undangan tercatat, tetapi email gagal dikirim: ${error.message}`;
}

export async function createInvite(_prev: ActionResult | null, f: FormData): Promise<ActionResult> {
  if (!(await requireOwnerAction())) return NOT_OWNER;
  const email = str(f, "email").toLowerCase();
  const row = {
    email,
    full_name: str(f, "full_name"),
    company_id: str(f, "company_id"),
    role: str(f, "role") || "employee",
    position_id: str(f, "position_id") ? Number(str(f, "position_id")) : null,
    employee_code: str(f, "employee_code") || null,
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Email tidak valid." };
  if (!row.full_name || !row.company_id) return { ok: false, error: "Nama dan company wajib diisi." };
  if (!["owner", "manager", "employee"].includes(row.role)) return { ok: false, error: "Role tidak valid." };
  if (row.role !== "owner" && !row.position_id)
    return { ok: false, error: "Jabatan wajib dipilih agar karyawan mendapat form laporan." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("users").select("id").ilike("email", email.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  if (existing) return { ok: false, error: "Email ini sudah terdaftar sebagai pengguna." };

  const { error } = await supabase.from("user_invites").insert(row);
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath("/owner/undangan");

  const mailError = await sendInviteEmail(email);
  if (mailError) return { ok: false, error: mailError };
  return { ok: true, message: `Undangan terkirim ke ${email}.` };
}

export async function resendInvite(inviteId: string): Promise<ActionResult> {
  if (!(await requireOwnerAction())) return NOT_OWNER;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_invites")
    .select("email, claimed_at")
    .eq("id", inviteId)
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: "Undangan tidak ditemukan." };
  if (data.claimed_at) return { ok: false, error: "Undangan ini sudah diklaim." };
  const mailError = await sendInviteEmail(data.email);
  if (mailError) return { ok: false, error: mailError.replace("Undangan tercatat, tetapi e", "E") };
  return { ok: true, message: `Email undangan dikirim ulang ke ${data.email}.` };
}

export type LinkResult = { ok: true; link: string } | { ok: false; error: string };

// Membuat link undangan TANPA mengirim email (untuk dibagikan lewat WhatsApp, dll.).
// Memakai kunci rahasia di server, hanya untuk Owner, dan hanya untuk undangan yang masih terbuka.
// Setiap kali dibuat, link sebelumnya untuk email yang sama tidak berlaku lagi.
export async function getInviteLink(inviteId: string): Promise<LinkResult> {
  if (!(await requireOwnerAction())) return { ok: false, error: "Hanya Owner yang boleh melakukan ini." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_invites")
    .select("email, claimed_at")
    .eq("id", inviteId)
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: "Undangan tidak ditemukan." };
  if (data.claimed_at) return { ok: false, error: "Undangan ini sudah diklaim." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "SUPABASE_SECRET_KEY belum diisi di server." };
  const { data: gen, error: genError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: data.email,
    options: { redirectTo: `${await siteOrigin()}/login` },
  });
  if (!genError && gen?.properties?.hashed_token) {
    // Link ke halaman aplikasi (bukan langsung ke Supabase) agar tidak habis oleh pratinjau link.
    const link = `${await siteOrigin()}/terima-undangan?token_hash=${encodeURIComponent(gen.properties.hashed_token)}`;
    return { ok: true, link };
  }
  if (genError || !gen?.properties?.action_link) {
    if (genError && /already been registered|already exists|email_exists/i.test(genError.message)) {
      return {
        ok: false,
        error: "Email ini sudah punya akun login yang terkonfirmasi. Minta orangnya masuk, atau pakai Lupa password.",
      };
    }
    return { ok: false, error: `Gagal membuat link: ${genError?.message ?? "tidak ada link"}` };
  }
  return { ok: true, link: gen.properties.action_link };
}

export async function cancelInvite(inviteId: string): Promise<ActionResult> {
  if (!(await requireOwnerAction())) return NOT_OWNER;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_invites")
    .delete()
    .eq("id", inviteId)
    .is("claimed_at", null)
    .select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data?.length) return { ok: false, error: "Undangan tidak ditemukan atau sudah diklaim." };
  revalidatePath("/owner/undangan");
  return { ok: true, message: "Undangan dibatalkan." };
}

// ---------- Pengguna ----------

export async function updateUser(input: {
  id: string;
  role: "owner" | "manager" | "employee";
  position_id: number | null;
  is_active: boolean;
}): Promise<ActionResult> {
  const owner = await requireOwnerAction();
  if (!owner) return NOT_OWNER;
  if (input.id === owner.id && (input.role !== "owner" || !input.is_active)) {
    return { ok: false, error: "Anda tidak bisa menonaktifkan atau menurunkan role akun Anda sendiri." };
  }
  if (!["owner", "manager", "employee"].includes(input.role)) return { ok: false, error: "Role tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .update({ role: input.role, position_id: input.position_id, is_active: input.is_active })
    .eq("id", input.id)
    .select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data?.length) return { ok: false, error: "Pengguna tidak ditemukan." };
  revalidatePath("/owner/pengguna");
  return { ok: true, message: "Perubahan disimpan." };
}
