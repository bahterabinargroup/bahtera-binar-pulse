"use client";

import { useActionState } from "react";
import { markHandled, unmarkHandled } from "@/app/(app)/pantauan/actions";
import { Result } from "@/components/owner/ActionForm";
import { inputCls, labelCls } from "@/components/owner/ui";

const btn = "rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-60";

export function MarkForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(markHandled, null);
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className={labelCls}>
        Catatan penanganan <span className="font-normal text-zinc-500">(opsional)</span>
        <input type="text" name="note" maxLength={500} placeholder="Mis. sudah dibahas di meeting, dibantu oleh …" className={inputCls} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={`${btn} bg-green-700 text-white`}>
          {pending ? "…" : "Tandai sudah ditangani"}
        </button>
        {state && <Result result={state} />}
      </div>
    </form>
  );
}

export function UnmarkForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(unmarkHandled, null);
  return (
    <form action={action} className="mt-2 inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={`${btn} border border-zinc-300 bg-white text-zinc-700`}>
        {pending ? "…" : "Batalkan tanda"}
      </button>
      {state && <Result result={state} />}
    </form>
  );
}
