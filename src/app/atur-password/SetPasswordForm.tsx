"use client";

import { useActionState } from "react";
import { setPassword } from "@/app/auth-actions";
import { buttonClass, FormMessage, inputClass } from "@/components/AuthCard";

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage type="error">{state.error}</FormMessage>}
      <label className="block text-sm font-bold">
        Password baru
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClass}
        />
        <span className="mt-1 block text-xs font-normal text-zinc-500">Minimal 8 karakter.</span>
      </label>
      <label className="block text-sm font-bold">
        Ulangi password baru
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClass}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Menyimpan..." : "Simpan password"}
      </button>
    </form>
  );
}
