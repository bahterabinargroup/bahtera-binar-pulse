"use client";

import { useEffect, useState } from "react";
import { compressImage, formatKb } from "@/lib/image-compress";

// Pilih/ambil foto: area besar yang jelas, dikecilkan otomatis (<200 KB), lalu tampil pratinjau.
// onChange(null) bila belum ada foto valid.
export function PhotoField({
  label,
  required,
  camera,
  buttonText,
  onChange,
}: {
  label: string;
  required?: boolean;
  camera?: "user";
  buttonText: string;
  onChange: (blob: Blob | null) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setUrl(null);
    onChange(null);
    setMsg("");
    setFailed(false);
    if (!file) return;
    setMsg("Mengecilkan foto…");
    try {
      const blob = await compressImage(file);
      setUrl(URL.createObjectURL(blob));
      onChange(blob);
      setMsg(`Foto siap (${formatKb(file.size)} → ${formatKb(blob.size)}).`);
    } catch (err) {
      setFailed(true);
      setMsg(err instanceof Error ? err.message : "Foto tidak bisa diproses.");
      e.target.value = "";
    }
  }

  return (
    <div>
      <p className="text-sm font-bold">
        {label} {required ? <span className="text-red-700">(wajib)</span> : <span className="font-normal text-zinc-500">(opsional)</span>}
      </p>
      <label
        className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center focus-within:ring-2 focus-within:ring-accent ${
          url ? "border-green-400 bg-green-50" : "border-accent bg-blue-50/40 hover:bg-blue-50"
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Pratinjau foto" className="max-h-56 rounded-lg border border-zinc-200" />
        ) : (
          <span aria-hidden="true" className="text-4xl">📷</span>
        )}
        <span className="text-base font-bold text-accent">{url ? "Ganti foto" : buttonText}</span>
        <input type="file" accept="image/*" capture={camera} onChange={onFile} className="sr-only" />
      </label>
      {msg && <p className={`mt-1 text-xs ${failed ? "text-red-700" : "text-zinc-600"}`}>{msg}</p>}
    </div>
  );
}
