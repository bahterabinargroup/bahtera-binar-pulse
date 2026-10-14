"use client";

import { useActionState, useEffect, useRef } from "react";
import { cancelLeave, decideLeave, decideLeaveCancel, requestLeaveCancel, submitLeave } from "@/app/(app)/cuti/actions";
import { Result } from "@/components/owner/ActionForm";
import { cardCls, inputCls, labelCls } from "@/components/owner/ui";
import { LEAVE_KINDS } from "@/lib/leave";

const btn = "rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-60";

// Form pengajuan baru (karyawan dan manager).
export function LeaveRequestForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(submitLeave, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className={`${cardCls} mt-4 space-y-3`}>
      <h2 className="text-lg font-bold text-accent">Ajukan cuti atau izin</h2>
      <label className={labelCls}>
        Jenis
        <select name="kind" required defaultValue="" className={inputCls}>
          <option value="" disabled>— Pilih —</option>
          {LEAVE_KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          Tanggal mulai
          <input type="date" name="start_date" required min={today} className={inputCls} />
        </label>
        <label className={labelCls}>
          Tanggal selesai
          <input type="date" name="end_date" required min={today} className={inputCls} />
        </label>
      </div>
      <label className={labelCls}>
        Alasan <span className="text-red-700">(wajib)</span>
        <textarea name="reason" required rows={3} maxLength={1000} className={inputCls} />
      </label>
      <p className="text-xs text-zinc-600">Boleh diajukan jauh-jauh hari. Hari Minggu tidak dihitung. Setelah disetujui, pada hari itu Anda tidak perlu presensi maupun mengisi daily report.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${btn} bg-accent text-white hover:brightness-110`}>
          {pending ? "Mengirim…" : "Kirim pengajuan"}
        </button>
        {state && <Result result={state} />}
      </div>
    </form>
  );
}

// Batalkan pengajuan yang masih menunggu keputusan (langsung, tanpa persetujuan).
export function CancelPendingForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(cancelLeave, null);
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={`${btn} border border-red-300 bg-white text-red-700`}>
        {pending ? "…" : "Batalkan pengajuan"}
      </button>
      {state && <Result result={state} />}
    </form>
  );
}

// Ajukan pembatalan cuti/izin yang sudah disetujui (menunggu keputusan atasan).
export function CancelRequestForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(requestLeaveCancel, null);
  return (
    <details className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
      <summary className="cursor-pointer text-sm font-bold text-accent">Ajukan pembatalan (tidak jadi cuti/izin)</summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="id" value={id} />
        <label className={labelCls}>
          Alasan pembatalan <span className="text-red-700">(wajib)</span>
          <textarea name="reason" required rows={2} maxLength={1000} className={inputCls} />
        </label>
        <p className="text-xs text-zinc-600">Selama belum disetujui, cuti/izin Anda tetap berlaku.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending} className={`${btn} bg-accent text-white`}>
            {pending ? "Mengirim…" : "Kirim pengajuan pembatalan"}
          </button>
          {state && <Result result={state} />}
        </div>
      </form>
    </details>
  );
}

// Setujui / Tolak dengan catatan opsional. mode: pengajuan cuti atau pengajuan pembatalan.
export function DecideForm({ id, mode }: { id: string; mode: "leave" | "cancel" }) {
  const [state, action, pending] = useActionState(mode === "leave" ? decideLeave : decideLeaveCancel, null);
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className={labelCls}>
        Catatan <span className="font-normal text-zinc-500">(opsional)</span>
        <input type="text" name="note" maxLength={500} className={inputCls} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" name="decision" value="approve" disabled={pending} className={`${btn} bg-green-700 text-white`}>
          Setujui
        </button>
        <button type="submit" name="decision" value="reject" disabled={pending} className={`${btn} border border-red-300 bg-white text-red-700`}>
          Tolak
        </button>
        {state && <Result result={state} />}
      </div>
    </form>
  );
}
