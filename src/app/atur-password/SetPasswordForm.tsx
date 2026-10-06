"use client";

import { useActionState } from "react";
import { setPassword } from "@/app/auth-actions";
import { buttonClass, FormMessage } from "@/components/AuthCard";
import { PasswordInput } from "@/components/PasswordInput";

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage type="error">{state.error}</FormMessage>}
      <label className="block text-sm font-bold">
        Password baru
        <PasswordInput
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="mt-1 block text-xs font-normal text-zinc-500">Minimal 8 karakter.</span>
      </label>
      <label className="block text-sm font-bold">
        Ulangi password baru
        <PasswordInput
          name="confirm"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Menyimpan..." : "Simpan password"}
      </button>
    </form>
  );
}
