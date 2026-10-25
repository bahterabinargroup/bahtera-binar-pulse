import Link from "next/link";
import type { ReactNode } from "react";

const Chevron = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true">
    <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 7v5l3.2 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const DocIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
    <path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M14 3v5h5M9 13h6M9 17h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 12.5l2.8 2.8L16.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Kartu aksi utama (Presensi, Laporan): keadaan jelas dan satu tombol ajakan.
// todo = masih perlu dikerjakan (tombol biru tua); selain itu tampil tenang (hijau, tombol garis).
export function ActionCard({
  href,
  icon,
  title,
  status,
  detail,
  cta,
  todo,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  status: string;
  detail?: string;
  cta: string;
  todo: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${todo ? "border-accent/30" : "border-green-200"}`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${todo ? "bg-accent/10 text-accent" : "bg-green-50 text-green-700"}`}>{icon}</span>
        <p className="text-sm font-semibold text-zinc-600">{title}</p>
      </div>
      <p className={`mt-3 text-lg font-bold ${todo ? "text-zinc-900" : "text-green-800"}`}>{status}</p>
      {detail && <p className="mt-0.5 text-sm text-zinc-600">{detail}</p>}
      <span
        className={`mt-4 inline-flex w-fit items-center rounded-lg px-4 py-2 text-sm font-bold ${todo ? "bg-accent text-white group-hover:brightness-110" : "border border-zinc-300 text-zinc-700 group-hover:bg-zinc-50"}`}
      >
        {cta}
      </span>
    </Link>
  );
}

export type Attention = { key: string; href: string; text: string; detail?: string; tone: "warn" | "danger" | "info"; count?: number };

// "Perlu perhatian Anda": hanya yang butuh tindakan, dengan urutan prioritas (merah lebih dulu).
export function AttentionList({ items }: { items: Attention[] }) {
  const rank = { danger: 0, warn: 1, info: 2 } as const;
  const sorted = [...items].sort((a, b) => rank[a.tone] - rank[b.tone]);
  const dot = { danger: "bg-red-600", warn: "bg-amber-500", info: "bg-sky-600" } as const;
  return (
    <section aria-labelledby="perhatian" className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <h2 id="perhatian" className="border-b border-zinc-100 px-5 py-3 text-base font-bold text-accent">
        Perlu perhatian Anda
      </h2>
      {sorted.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-green-800">
          <CheckIcon /> Tidak ada yang perlu ditindaklanjuti sekarang.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {sorted.map((it) => (
            <li key={it.key}>
              <Link href={it.href} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot[it.tone]}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-900">{it.text}</span>
                  {it.detail && <span className="block text-xs text-zinc-600">{it.detail}</span>}
                </span>
                {it.count !== undefined && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white ${it.tone === "danger" ? "bg-red-600" : it.tone === "warn" ? "bg-amber-600" : "bg-sky-700"}`}>{it.count}</span>
                )}
                <Chevron />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
