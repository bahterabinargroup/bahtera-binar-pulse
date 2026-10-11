import { TIME_ZONE, todayJakarta } from "@/lib/date";
import { mapsUrl, statusLabel } from "@/lib/presensi";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { monthEnd, parseMonth } from "@/lib/target";
import { isUuid } from "@/lib/uuid";

const PAGE = 1000;
const jam = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "";

// CSV: pemisah koma, UTF-8 dengan BOM (terbaca benar di Excel). Sel yang diawali = + - @ diberi tanda ' agar tidak dibaca sebagai rumus.
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Row = {
  user_id: string;
  company_id: string;
  attendance_date: string;
  status: string;
  note: string | null;
  check_in_at: string;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_photo_path: string | null;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_photo_path: string | null;
};

// Unduh rekap presensi satu bulan (Owner: semua company/filter; Manager: company-nya). Data disaring RLS.
export async function GET(request: Request) {
  const { profile } = await getCurrentUser();
  if (!profile || profile.role === "employee") return new Response("Hanya Owner dan Manager.", { status: 403 });

  const url = new URL(request.url);
  const month = parseMonth(url.searchParams.get("bulan"), `${todayJakarta().slice(0, 7)}-01`);
  const companyParam = url.searchParams.get("company");
  const company = profile.role === "owner" && companyParam && isUuid(companyParam) ? companyParam : null;

  const supabase = await createClient();
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("presensi")
      .select("user_id, company_id, attendance_date, status, note, check_in_at, check_in_lat, check_in_lng, check_in_photo_path, check_out_at, check_out_lat, check_out_lng, check_out_photo_path")
      .gte("attendance_date", month)
      .lte("attendance_date", monthEnd(month))
      .order("attendance_date")
      .order("check_in_at")
      .range(from, from + PAGE - 1);
    if (company) q = q.eq("company_id", company);
    const { data, error } = await q;
    if (error) return new Response(`Gagal memuat presensi: ${error.message}`, { status: 500 });
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }

  const [usersRes, compRes] = await Promise.all([
    supabase.from("users").select("id, full_name, position:roles_config(name)").limit(5000),
    supabase.from("companies").select("id, name"),
  ]);
  const people = new Map(((usersRes.data ?? []) as unknown as { id: string; full_name: string; position: { name: string } | null }[]).map((u) => [u.id, u]));
  const comps = new Map(((compRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  const header = ["Tanggal", "Nama", "Company", "Jabatan", "Status", "Catatan", "Jam masuk (WIB)", "Lat masuk", "Lng masuk", "Peta masuk", "Jam pulang (WIB)", "Lat pulang", "Lng pulang", "Peta pulang", "Foto masuk", "Foto pulang"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const p = people.get(r.user_id);
    const auto = r.status === "izin" || r.status === "sakit";
    lines.push(
      [
        r.attendance_date,
        p?.full_name ?? "",
        comps.get(r.company_id) ?? "",
        p?.position?.name ?? "",
        statusLabel(r.status),
        r.note,
        jam(r.check_in_at),
        r.check_in_lat,
        r.check_in_lng,
        r.check_in_lat !== null && r.check_in_lng !== null ? mapsUrl(r.check_in_lat, r.check_in_lng) : "",
        jam(r.check_out_at) + (auto && r.check_out_at ? " (otomatis)" : ""),
        r.check_out_lat,
        r.check_out_lng,
        r.check_out_lat !== null && r.check_out_lng !== null ? mapsUrl(r.check_out_lat, r.check_out_lng) : "",
        r.check_in_photo_path ? "Ada" : "",
        r.check_out_photo_path ? "Ada" : "",
      ]
        .map(cell)
        .join(","),
    );
  }

  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekap-presensi-${month.slice(0, 7)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
