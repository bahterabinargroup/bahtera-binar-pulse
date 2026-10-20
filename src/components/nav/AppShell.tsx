import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BackToHome } from "@/components/BackToHome";
import type { NavGroup } from "@/lib/menu";
import { DesktopNav, MobileNav } from "./AppNav";

// Bingkai penuh layar: kepala halaman di atas selebar layar, sidebar menempel di tepi kiri setinggi layar,
// dan isi halaman memenuhi sisanya (dipusatkan dengan lebar maksimum agar tetap nyaman dibaca).
export function AppShell({
  groups,
  badges,
  name,
  subtitle,
  roleLabel,
  logoutButton,
  children,
}: {
  groups: NavGroup[];
  badges: Record<string, number>;
  name: string;
  subtitle: string;
  roleLabel: string;
  logoutButton: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b-4 border-gold bg-white">
        <div className="flex h-16 items-center gap-3 px-3 sm:px-4">
          <MobileNav groups={groups} badges={badges} />
          <Link href="/" aria-label="Beranda" className="shrink-0">
            <Image src="/brand/logo-horizontal.png" alt="Bahtera Binar Group" width={941} height={360} priority className="h-11 w-auto" />
          </Link>
          <Link href="/" className="ml-auto block min-w-0 text-right">
            <p className="truncate text-sm font-bold text-accent">{name}</p>
            <p className="truncate text-xs text-zinc-600">
              {subtitle}
              <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white">{roleLabel}</span>
            </p>
          </Link>
          <div className="shrink-0">{logoutButton}</div>
        </div>
      </header>
      <div className="flex flex-1">
        <DesktopNav groups={groups} badges={badges} />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-6xl">
            {/* Di layar lebar, tombol Beranda sudah ada di sidebar */}
            <div className="md:hidden">
              <BackToHome />
            </div>
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
