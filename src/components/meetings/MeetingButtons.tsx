"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelDeletion, deleteMeeting, requestDeletion } from "@/app/(app)/notulensi/actions";

const btn = "rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60";

// Tombol di halaman detail notulensi. Tampil sesuai hak; database tetap penentu akhir.
export function MeetingButtons({
  id,
  canEdit,
  isSubmitted,
  isOwner,
  isCreator,
  deleteRequested,
}: {
  id: string;
  canEdit: boolean;
  isSubmitted: boolean;
  isOwner: boolean;
  isCreator: boolean;
  deleteRequested: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res && !res.ok) setError(res.error ?? "Gagal. Coba lagi.");
      else router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Link href={`/notulensi/${id}/edit`} className={`${btn} bg-accent text-white`}>
            {isSubmitted ? "Koreksi (Owner)" : "Lanjutkan menulis"}
          </Link>
        )}
        <a href={`/notulensi/${id}/pdf`} className={`${btn} border border-zinc-300 bg-white`}>
          ⬇ Download PDF
        </a>

        {isCreator && !isOwner && !deleteRequested && !asking && (
          <button type="button" onClick={() => setAsking(true)} className={`${btn} border border-red-300 bg-white text-red-700`}>
            Ajukan hapus
          </button>
        )}
        {deleteRequested && (isCreator || isOwner) && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => cancelDeletion(id))}
            className={`${btn} border border-zinc-300 bg-white`}
          >
            {isOwner ? "Tolak permintaan hapus" : "Batalkan permintaan hapus"}
          </button>
        )}
        {isOwner && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                window.confirm(
                  `${deleteRequested ? "Setujui permintaan hapus?" : "Hapus notulensi ini?"}\n\nNotulensi beserta peserta dan tindak lanjutnya akan dihapus permanen.`,
                )
              )
                run(() => deleteMeeting(id));
            }}
            className={`${btn} bg-red-600 text-white`}
          >
            {deleteRequested ? "Setujui hapus" : "Hapus"}
          </button>
        )}
      </div>

      {asking && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <label className="block text-sm font-bold">
            Alasan ingin menghapus
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded border border-zinc-300 bg-white px-2 py-1.5 font-normal"
            />
          </label>
          <p className="mt-1 text-xs text-zinc-600">Notulensi tetap ada sampai Owner menyetujui.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending || !reason.trim()}
              onClick={() =>
                run(async () => {
                  const res = await requestDeletion(id, reason);
                  if (res.ok) setAsking(false);
                  return res;
                })
              }
              className={`${btn} bg-red-600 text-white`}
            >
              Kirim permintaan
            </button>
            <button type="button" onClick={() => setAsking(false)} className={`${btn} border border-zinc-300 bg-white`}>
              Batal
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
