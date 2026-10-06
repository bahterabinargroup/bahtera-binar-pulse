"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Template email bawaan Supabase (tanpa SMTP sendiri tidak bisa diubah)
// mengirim tautan undangan yang berakhir di alamat aplikasi dengan sesi di
// bagian "#..." URL, misalnya /login#access_token=...&type=invite.
// Bagian "#" tidak pernah sampai ke server, jadi ditangani di browser:
// simpan sesi ke cookie, lalu buka halaman atur password.
export function EmailLinkHandler() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);

    if (params.get("error") || params.get("error_code")) {
      window.location.replace("/login?error=tautan");
      return;
    }

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    const type = params.get("type");
    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          window.location.replace("/login?error=tautan");
        } else if (type === "invite" || type === "recovery") {
          window.location.replace("/atur-password");
        } else {
          window.location.replace("/");
        }
      });
  }, []);

  return null;
}
