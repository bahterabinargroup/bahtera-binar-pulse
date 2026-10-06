"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/auth-actions";
import { buttonClass, FormMessage, inputClass } from "@/components/AuthCard";
import { PasswordInput } from "@/components/PasswordInput";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  const error = state?.error ?? (state ? undefined : initialError);

  return (
    <form action={action} className="space-y-4">
      {error && <FormMessage type="error">{error}</FormMessage>}
      <input type="hidden" name="next" value={next ?? ""} />
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
      <label className="block text-sm font-bold">
        Password
        <PasswordInput
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Memproses..." : "Masuk"}
      </button>
      <p className="text-center text-sm">
        <Link href="/lupa-password" className="font-bold text-accent hover:underline">
          Lupa password?
        </Link>
      </p>
    </form>
  );
}
