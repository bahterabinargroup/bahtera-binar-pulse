// Tautan penting: tipe dan label (database: resource_links, supabase/005_tautan_penting.sql).

export const LINK_CATEGORIES = [
  { value: "tracker", label: "Tracker (spreadsheet)" },
  { value: "aset", label: "Aset" },
  { value: "sop", label: "SOP & Dokumen" },
  { value: "lainnya", label: "Lainnya" },
] as const;

export type LinkCategory = (typeof LINK_CATEGORIES)[number]["value"];

export const categoryLabel = (c: string) => LINK_CATEGORIES.find((x) => x.value === c)?.label ?? "Lainnya";

export type ResourceLink = {
  id: string;
  category: LinkCategory;
  title: string;
  url: string;
  description: string | null;
  company_id: string | null;
  position_ids: number[]; // kosong = semua divisi
  company: { name: string } | null;
};

export const LINK_SELECT =
  "id, category, title, url, description, company_id, position_ids, company:companies(name)";

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Nama divisi untuk label "untuk siapa" (position_ids -> nama), dari daftar jabatan.
export type PositionNames = Record<number, string>;
export const positionNameMap = (rows: { id: number; name: string }[] | null | undefined): PositionNames =>
  Object.fromEntries((rows ?? []).map((r) => [r.id, r.name]));
