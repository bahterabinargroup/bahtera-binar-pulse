"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavGroup } from "@/lib/menu";
import { NavList } from "./NavList";

// Sidebar tetap di layar lebar.
export function DesktopNav({ groups, badges }: { groups: NavGroup[]; badges: Record<string, number> }) {
  return (
    <aside className="hidden w-60 shrink-0 md:block">
      <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
        <NavList groups={groups} badges={badges} />
      </div>
    </aside>
  );
}

// Di ponsel: tombol menu yang membuka panel geser dari kiri.
export function MobileNav({ groups, badges }: { groups: NavGroup[]; badges: Record<string, number> }) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname; // pindah halaman = panel menutup sendiri
  const total = Object.values(badges).reduce((s, n) => s + n, 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpenAt(pathname)}
        aria-label="Buka menu"
        aria-expanded={open}
        className="relative rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-100"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {total > 0 && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-600" aria-hidden="true" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <button type="button" aria-label="Tutup menu" onClick={() => setOpenAt(null)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 p-3">
              <p className="font-bold text-accent">Menu</p>
              <button type="button" autoFocus onClick={() => setOpenAt(null)} aria-label="Tutup menu" className="rounded-lg border border-zinc-300 px-2.5 py-1 text-sm font-bold">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <NavList groups={groups} badges={badges} onNavigate={() => setOpenAt(null)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
