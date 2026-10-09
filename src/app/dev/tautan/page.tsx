import { notFound } from "next/navigation";
import { LinkGroups } from "@/components/links/LinkGroups";
import type { ResourceLink } from "@/lib/links";

// HANYA pengembangan lokal: tampilan bagian "Tautan penting" dengan data rekaan.
export default function DevTautanPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const mk = (id: string, category: ResourceLink["category"], title: string, url: string, description: string | null, position: string | null): ResourceLink => ({
    id, category, title, url, description, company_id: null, position_id: null, company: null, position: position ? { name: position } : null,
  });
  const links = [
    mk("1", "tracker", "Tracker penjualan harian", "https://docs.google.com/spreadsheets/d/contoh1", "Isi sebelum jam 10 pagi", null),
    mk("2", "tracker", "Tracker affiliate", "https://docs.google.com/spreadsheets/d/contoh2", "Daftar kreator dan status kerja sama", "Affiliate Manajemen"),
    mk("3", "aset", "Folder aset konten", "https://drive.google.com/drive/folders/contoh3", "Logo, template, dan footage", "Content Creator"),
    mk("4", "sop", "SOP posting konten", "https://docs.google.com/document/d/contoh4", null, null),
  ];
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h2 className="mb-3 text-lg font-bold text-accent">Tautan penting</h2>
      <LinkGroups links={links} showScope />
    </main>
  );
}
