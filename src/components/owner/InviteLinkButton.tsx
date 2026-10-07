"use client";

import { useState, useTransition } from "react";
import { getInviteLink, getPasswordLink } from "@/app/(app)/owner/actions";

// Membuat link undangan lalu menyalinnya agar bisa ditempel ke WhatsApp.
export function InviteLinkButton({
  inviteId,
  name,
  kind = "invite",
}: {
  inviteId: string;
  name: string;
  kind?: "invite" | "password";
}) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "pesan" | null>(null);

  const whatsappText = (l: string) =>
    `Halo ${name}, ${kind === "password" ? "ini link untuk membuat password" : "Anda diundang memakai aplikasi Daily Report. Buka link ini untuk membuat password"} dan mulai memakai aplikasi:\n${l}\n\nLink hanya bisa dipakai sekali dan ada batas waktunya.`;

  async function copy(text: string, kind: "link" | "pesan") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      setCopied(null); // clipboard diblokir browser: pakai kotak di bawah untuk menyalin manual
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            setCopied(null);
            const res = kind === "password" ? await getPasswordLink(inviteId) : await getInviteLink(inviteId);
            if (!res.ok) {
              setLink(null);
              setMessage(null);
              setError(res.error);
              return;
            }
            setLink(res.link);
            setMessage(whatsappText(res.link));
            await copy(res.link, "link");
          })
        }
        className="rounded-lg border border-accent bg-white px-3 py-1 text-xs font-bold text-accent hover:bg-sky-50 disabled:opacity-60"
      >
        {pending ? "Membuat link…" : link ? "Buat link baru" : kind === "password" ? "🔑 Salin link atur password" : "🔗 Salin link undangan"}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
      {link && message && (
        <div className="mt-2 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          <p className="text-xs text-green-700">
            {copied === "link" ? "✓ Link sudah disalin." : copied === "pesan" ? "✓ Pesan sudah disalin." : "Link siap. Salin dari kotak di bawah."}
          </p>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Link undangan"
            className="block w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(link, "link")} className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-bold">
              Salin link
            </button>
            <button type="button" onClick={() => copy(message, "pesan")} className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-bold">
              Salin pesan siap kirim (WhatsApp)
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Kirim hanya ke orang yang bersangkutan: siapa pun yang membuka link ini bisa membuat password untuk akun tersebut.
            Link berlaku sekali dan terbatas waktunya; membuat link baru membuat link lama tidak berlaku.
          </p>
        </div>
      )}
    </div>
  );
}
