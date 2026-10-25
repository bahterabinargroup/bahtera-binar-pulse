"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { NavGroup } from "@/lib/menu";

const badgeText = (n: number) => (n > 99 ? "99+" : String(n));

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-auto shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] leading-none font-bold text-white" aria-label={`${n} perlu perhatian`}>
      {badgeText(n)}
    </span>
  );
}

// Menu aktif = href terpanjang yang cocok dengan alamat halaman saat ini (mis. /cuti/kalender, bukan /cuti).
function activeHref(pathname: string, groups: NavGroup[]): string | null {
  let best: string | null = null;
  for (const g of groups)
    for (const it of g.items)
      if ((pathname === it.href || pathname.startsWith(`${it.href}/`)) && (!best || it.href.length > best.length)) best = it.href;
  return best;
}

// Daftar navigasi dua tingkat: link Beranda, lalu folder yang bisa dibuka/ditutup. Dipakai di sidebar dan panel ponsel.
export function NavList({ groups, badges, onNavigate }: { groups: NavGroup[]; badges: Record<string, number>; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = activeHref(pathname, groups);
  const activeGroup = groups.find((g) => g.items.some((i) => i.href === active))?.id ?? null;
  // Pilihan buka/tutup manual berlaku untuk halaman ini saja; pindah halaman = folder aktif otomatis terbuka.
  const [manual, setManual] = useState<{ path: string; map: Record<string, boolean> }>({ path: pathname, map: {} });
  const overrides = manual.path === pathname ? manual.map : {};
  const isOpen = (id: string) => overrides[id] ?? id === activeGroup;
  const toggle = (id: string) => setManual({ path: pathname, map: { ...overrides, [id]: !isOpen(id) } });

  const linkCls = (on: boolean) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${on ? "bg-accent font-bold text-white" : "text-zinc-700 hover:bg-zinc-100"}`;

  return (
    <nav aria-label="Navigasi utama" className="space-y-1">
      <Link href="/" onClick={onNavigate} aria-current={pathname === "/" ? "page" : undefined} className={linkCls(pathname === "/")}>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
          <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        <span className="font-bold">Beranda</span>
      </Link>

      {groups.map((g) => {
        const open = isOpen(g.id);
        const total = g.items.reduce((s, i) => s + (badges[i.href] ?? 0), 0);
        const hasActive = g.id === activeGroup;
        return (
          <div key={g.id}>
            <button
              type="button"
              onClick={() => toggle(g.id)}
              aria-expanded={open}
              aria-controls={`nav-${g.id}`}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-zinc-100 ${hasActive ? "text-accent" : "text-zinc-800"}`}
            >
              <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true">
                <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="min-w-0 flex-1 truncate">{g.label}</span>
              {!open && <Badge n={total} />}
            </button>
            {open && (
              <ul id={`nav-${g.id}`} className="mt-0.5 mb-1 ml-4 space-y-0.5 border-l border-zinc-200 pl-2">
                {g.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} onClick={onNavigate} aria-current={it.href === active ? "page" : undefined} className={linkCls(it.href === active)}>
                      <span className="min-w-0 truncate">{it.label}</span>
                      <Badge n={badges[it.href] ?? 0} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
