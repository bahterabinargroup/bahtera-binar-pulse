"use client";

import { useState, useTransition } from "react";
import { createBotKey, revokeBotKey } from "@/app/(app)/owner/api-bot/actions";

// Form membuat kunci baru. Kunci asli tampil SEKALI di sini; setelah halaman ditutup tidak bisa dilihat lagi.
export function CreateBotKey() {
  const [name, setName] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setCopied(false);
          start(async () => {
            const r = await createBotKey(name);
            if (r.ok) {
              setKey(r.key);
              setName("");
            } else setError(r.error);
          });
        }}
      >
        <label className="block text-xs font-bold">
          Nama kunci (misalnya nama bot)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Rakazo"
            className="mt-1 block w-64 max-w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm font-normal"
          />
        </label>
        <button type="submit" disabled={pending || !name.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {pending ? "Membuat…" : "Buat kunci baru"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {key && (
        <div role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-bold">Salin kunci ini sekarang. Kunci hanya ditampilkan SEKALI.</p>
          <p className="mt-1">Tempel di pengaturan bot (Rakazo). Jangan kirim lewat chat atau WhatsApp.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="block max-w-full break-all rounded bg-white px-2 py-1 font-mono text-xs">{key}</code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(key);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-sm font-bold"
            >
              {copied ? "Tersalin" : "Salin"}
            </button>
            <button type="button" onClick={() => setKey(null)} className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-sm font-bold">
              Sudah saya simpan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Tombol cabut kunci (dengan konfirmasi).
export function RevokeBotKey({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Cabut kunci "${name}"? Bot yang memakai kunci ini langsung tidak bisa mengambil data lagi.`)) return;
          start(async () => {
            const r = await revokeBotKey(id);
            setError(r.ok ? null : r.error);
          });
        }}
        className="rounded-lg border border-red-300 px-3 py-1 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
      >
        {pending ? "…" : "Cabut"}
      </button>
      {error && <span className="ml-2 text-xs text-red-700">{error}</span>}
    </span>
  );
}
