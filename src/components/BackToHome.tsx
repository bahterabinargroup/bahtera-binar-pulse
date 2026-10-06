"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Tautan "← Beranda" di setiap halaman selain Beranda.
export function BackToHome() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <Link
      href="/"
      className="mb-4 inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-bold text-zinc-700 hover:border-accent hover:text-accent"
    >
      <span aria-hidden="true">←</span> Kembali ke Beranda
    </Link>
  );
}
