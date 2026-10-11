"use client";

import { useEffect, useState } from "react";
import { labelCls } from "@/components/owner/ui";
import { compressImage, formatKb } from "@/lib/image-compress";

// Pilih foto, kecilkan otomatis (<200 KB), tampilkan pratinjau. onChange(null) bila belum ada foto valid.
export function PhotoField({
  label,
  hint,
  camera,
  onChange,
}: {
  label: string;
  hint: React.ReactNode;
  camera?: "user";
  onChange: (blob: Blob | null) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setUrl(null);
    onChange(null);
    setMsg("");
    if (!file) return;
    setMsg("Mengecilkan foto…");
    try {
      const blob = await compressImage(file);
      setUrl(URL.createObjectURL(blob));
      onChange(blob);
      setMsg(`Foto siap (${formatKb(file.size)} → ${formatKb(blob.size)}).`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Foto tidak bisa diproses.");
      e.target.value = "";
    }
  }

  return (
    <div>
      <label className={labelCls}>
        {label} {hint}
        <input type="file" accept="image/*" capture={camera} onChange={onFile} className="mt-1 block w-full text-sm" />
      </label>
      {msg && <p className="mt-1 text-xs text-zinc-600">{msg}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="Pratinjau foto" className="mt-2 max-h-48 rounded-lg border border-zinc-200" />}
    </div>
  );
}
