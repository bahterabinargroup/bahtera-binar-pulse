"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/(app)/owner/actions";
import { Result } from "./ActionForm";

// Tombol yang menjalankan server action (opsional dengan konfirmasi).
export function ActionButton({
  run,
  label,
  confirm,
  tone = "default",
}: {
  run: () => Promise<ActionResult>;
  label: string;
  confirm?: string;
  tone?: "default" | "danger";
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setResult(await run()));
        }}
        className={`rounded-lg border px-3 py-1 text-xs font-bold disabled:opacity-60 ${
          tone === "danger" ? "border-red-300 text-red-700 hover:bg-red-50" : "border-zinc-300 hover:bg-zinc-50"
        }`}
      >
        {pending ? "…" : label}
      </button>
      {result && <Result result={result} />}
    </span>
  );
}
