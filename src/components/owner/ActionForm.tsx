"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionResult } from "@/app/(app)/owner/actions";

// Form yang menjalankan server action dan menampilkan hasilnya.
export function ActionForm({
  action,
  children,
  submitLabel,
  resetOnSuccess = false,
  className = "",
}: {
  action: (prev: ActionResult | null, f: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel: string;
  resetOnSuccess?: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Memproses…" : submitLabel}
        </button>
        {state && <Result result={state} />}
      </div>
    </form>
  );
}

export function Result({ result }: { result: ActionResult }) {
  return result.ok ? (
    <p role="status" className="text-sm text-green-700">✓ {result.message ?? "Tersimpan."}</p>
  ) : (
    <p role="alert" className="text-sm text-red-700">{result.error}</p>
  );
}
