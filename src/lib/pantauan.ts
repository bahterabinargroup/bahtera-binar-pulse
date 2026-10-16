// Pantauan kendala dan insight: pengambilan data dan penyaringan (dipakai halaman dan unduhan CSV).
import { todayJakarta } from "@/lib/date";
import { parsePeriode, periodRange, type Periode } from "@/lib/dashboard";
import type { Profile } from "@/lib/profile";
import type { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

type Sb = Awaited<ReturnType<typeof createClient>>;

export type Jenis = "semua" | "kendala" | "insight";
export type StatusF = "belum" | "sudah" | "semua";

export type Filters = {
  periode: Periode;
  jenis: Jenis;
  status: StatusF;
  divisi: string; // id jabatan atau ""
  company: string; // uuid atau "" (hanya Owner)
  q: string;
};

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export function parseFilters(sp: Record<string, string | string[] | undefined>, isOwner: boolean): Filters {
  const jenis = one(sp.jenis);
  const status = one(sp.status);
  const divisi = one(sp.divisi);
  const company = one(sp.company);
  return {
    periode: parsePeriode(one(sp.periode)),
    jenis: jenis === "kendala" || jenis === "insight" ? jenis : "semua",
    status: status === "sudah" || status === "semua" ? status : "belum",
    divisi: /^\d+$/.test(divisi) ? divisi : "",
    company: isOwner && isUuid(company) ? company : "",
    q: one(sp.q).trim().slice(0, 100),
  };
}

export type Item = {
  id: string;
  date: string;
  userName: string;
  positionName: string;
  companyId: string;
  companyName: string;
  kendala: string;
  insight: string;
  handled: { note: string | null; at: string; by: string } | null;
};

export type Loaded = { items: Item[]; range: { from: string; to: string }; truncated: boolean };

export async function loadPantauan(sb: Sb, _profile: Profile, f: Filters): Promise<Loaded> {
  const today = todayJakarta();
  const range = periodRange(f.periode, today);
  let q = sb
    .from("daily_reports")
    .select("id, user_id, company_id, position_id, report_date, obstacles, insights")
    .gte("report_date", range.from)
    .lte("report_date", range.to)
    .order("report_date", { ascending: false })
    .limit(1000);
  if (f.company) q = q.eq("company_id", f.company);
  if (f.divisi) q = q.eq("position_id", Number(f.divisi));
  const [repRes, usersRes, posRes, compRes, fuRes] = await Promise.all([
    q,
    sb.from("users").select("id, full_name").limit(5000),
    sb.from("roles_config").select("id, name"),
    sb.from("companies").select("id, name"),
    sb.from("report_followups").select("report_id, note, handled_at, handled_by").order("handled_at", { ascending: false }).limit(5000),
  ]);
  for (const r of [repRes, usersRes, posRes, compRes]) if (r.error) throw new Error(`Gagal memuat pantauan: ${r.error.message}`);
  // Tabel tanda belum ada (016 belum dijalankan): tampilkan tanpa status penanganan.
  const fu = fuRes.error ? [] : (fuRes.data ?? []);

  const names = new Map((usersRes.data ?? []).map((u) => [u.id as string, u.full_name as string]));
  const pos = new Map((posRes.data ?? []).map((p) => [p.id as number, p.name as string]));
  const comp = new Map((compRes.data ?? []).map((c) => [c.id as string, c.name as string]));
  const handled = new Map(fu.map((x) => [x.report_id as string, x]));

  const needle = f.q.toLowerCase();
  const items: Item[] = [];
  for (const r of repRes.data ?? []) {
    const kendala = String(r.obstacles ?? "").trim();
    const insight = String(r.insights ?? "").trim();
    if (f.jenis === "kendala" ? !kendala : f.jenis === "insight" ? !insight : !kendala && !insight) continue;
    if (needle) {
      const hay = (f.jenis === "kendala" ? kendala : f.jenis === "insight" ? insight : `${kendala}\n${insight}`).toLowerCase();
      if (!hay.includes(needle)) continue;
    }
    const h = handled.get(r.id as string);
    if (f.status === "belum" && h) continue;
    if (f.status === "sudah" && !h) continue;
    items.push({
      id: r.id as string,
      date: r.report_date as string,
      userName: names.get(r.user_id as string) ?? "—",
      positionName: pos.get(r.position_id as number) ?? "—",
      companyId: r.company_id as string,
      companyName: comp.get(r.company_id as string) ?? "—",
      kendala: f.jenis === "insight" ? "" : kendala,
      insight: f.jenis === "kendala" ? "" : insight,
      handled: h ? { note: (h.note as string | null) ?? null, at: h.handled_at as string, by: names.get(h.handled_by as string) ?? "—" } : null,
    });
  }
  return { items, range, truncated: (repRes.data ?? []).length >= 1000 };
}
