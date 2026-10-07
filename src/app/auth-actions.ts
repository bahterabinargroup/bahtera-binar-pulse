"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath, translateAuthError } from "@/lib/auth-errors";
import { requireSupabaseEnv } from "@/lib/supabase/env";

export type FormState = { error?: string; success?: string; email?: string } | null;

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) return { error: "Email dan password wajib diisi.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translateAuthError(error.message), email };

  redirect(next);
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email wajib diisi." };

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  // Alur "implicit": tautan di email membawa sesi di bagian # URL dan
  // ditangani EmailLinkHandler, sehingga tautan bisa dibuka di browser/HP
  // mana pun (alur PKCE hanya berhasil di browser tempat meminta reset).
  const { url, key } = requireSupabaseEnv();
  const supabase = createPlainClient(url, key, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/login`,
  });
  // Pesan sama untuk email terdaftar maupun tidak, agar daftar email karyawan
  // tidak bisa ditebak orang lain. Hanya batas percobaan yang diberitahukan.
  if (error && /rate limit|security purposes|too many/i.test(error.message)) {
    return { error: translateAuthError(error.message), email };
  }
  return {
    success:
      "Jika email tersebut terdaftar, tautan untuk mengatur password baru sudah dikirim. Periksa kotak masuk dan folder spam.",
  };
}

export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Password minimal 8 karakter." };
  if (password !== confirm) return { error: "Kedua password tidak sama. Ketik ulang." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translateAuthError(error.message) };

  redirect("/?pesan=password-tersimpan");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Menerima undangan: baru di sini token sekali-pakai dari link dipakai (setelah tombol diklik),
// sehingga pratinjau link (WhatsApp, dll.) dan pemindai email tidak menghabiskannya.
export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(tokenHash)) {
    return { error: "Link tidak lengkap. Minta admin mengirim link undangan baru." };
  }
  // Hanya dua jenis yang diizinkan: undangan baru, atau atur password untuk akun yang sudah terbentuk.
  const type = String(formData.get("jenis") ?? "") === "pemulihan" ? "recovery" : "invite";
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return {
      error:
        "Link sudah kedaluwarsa atau sudah pernah dipakai. Minta admin membuat link baru.",
    };
  }
  redirect("/atur-password?jenis=undangan");
}
