import { csvBody } from "@/lib/csv";
import { todayJakarta } from "@/lib/date";
import { loadPantauan, parseFilters } from "@/lib/pantauan";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

// Unduh daftar pantauan kendala dan insight sesuai filter (Owner, Manager, Lead; data disaring RLS).
export async function GET(request: Request) {
  const { profile } = await getCurrentUser();
  if (!profile || profile.role === "employee") return new Response("Hanya Owner, Manager, dan Lead.", { status: 403 });
  const url = new URL(request.url);
  const f = parseFilters(Object.fromEntries(url.searchParams), profile.role === "owner");
  const supabase = await createClient();
  const { items } = await loadPantauan(supabase, profile, f);

  const body = csvBody(
    ["Tanggal", "Nama", "Jabatan", "Company", "Kendala", "Insight", "Status", "Catatan penanganan", "Ditandai oleh", "Tanggal ditandai"],
    items.map((i) => [i.date, i.userName, i.positionName, i.companyName, i.kendala, i.insight, i.handled ? "Sudah ditangani" : "Belum ditangani", i.handled?.note ?? "", i.handled?.by ?? "", i.handled?.at.slice(0, 10) ?? ""]),
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pantauan-kendala-${todayJakarta()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
