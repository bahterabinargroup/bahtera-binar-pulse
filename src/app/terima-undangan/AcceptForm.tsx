"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/app/auth-actions";
import { buttonClass, FormMessage } from "@/components/AuthCard";

export function AcceptForm({ tokenHash }: { tokenHash: string }) {
  const [state, action, pending] = useActionState(acceptInvite, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage type="error">{state.error}</FormMessage>}
      <input type="hidden" name="token_hash" value={tokenHash} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Memproses..." : "Lanjutkan & buat password"}
      </button>
    </form>
  );
}
