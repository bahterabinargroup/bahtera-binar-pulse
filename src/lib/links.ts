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
  position_id: number | null;
  company: { name: string } | null;
  position: { name: string } | null;
};

export const LINK_SELECT =
  "id, category, title, url, description, company_id, position_id, company:companies(name), position:roles_config(name)";

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
