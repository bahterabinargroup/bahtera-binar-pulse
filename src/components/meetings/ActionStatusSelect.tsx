"use client";

import { useState, useTransition } from "react";
import { updateActionStatus } from "@/app/(app)/notulensi/actions";
import { ACTION_STATUS_LABEL, type ActionStatus } from "@/lib/meetings";

const COLOR: Record<ActionStatus, string> = {
  open: "bg-zinc-100 text-zinc-800",
  in_progress: "bg-sky-100 text-sky-900",
  done: "bg-green-100 text-green-800",
};

// Status tindak lanjut: dropdown bila boleh diubah, label bila tidak.
export function ActionStatusSelect({
  itemId,
  status,
  editable,
}: {
  itemId: string;
  status: ActionStatus;
  editable: boolean;
}) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!editable) {
    return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${COLOR[value]}`}>{ACTION_STATUS_LABEL[value]}</span>;
  }
  return (
    <div>
      <select
        value={value}
        disabled={pending}
        aria-label="Status tindak lanjut"
        onChange={(e) => {
          const next = e.target.value as ActionStatus;
          const prev = value;
          setValue(next);
          setError(null);
          start(async () => {
            const res = await updateActionStatus(itemId, next);
            if (!res.ok) {
              setValue(prev);
              setError(res.error);
            }
          });
        }}
        className={`rounded-full border-0 px-2.5 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-400 ${COLOR[value]}`}
      >
        {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((s) => (
          <option key={s} value={s}>
            {ACTION_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {pending && <span className="ml-2 text-xs text-zinc-500">menyimpan…</span>}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
