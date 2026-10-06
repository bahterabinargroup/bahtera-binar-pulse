"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth-actions";
import { buttonClass, FormMessage, inputClass } from "@/components/AuthCard";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage type="error">{state.error}</FormMessage>}
      {state?.success ? (
        <FormMessage type="success">{state.success}</FormMessage>
      ) : (
        <>
          <label className="block text-sm font-bold">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state?.email}
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Mengirim..." : "Kirim tautan"}
          </button>
        </>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="font-bold text-accent hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </form>
  );
}
