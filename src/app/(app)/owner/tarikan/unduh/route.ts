import { mondayOf, todayJakarta } from "@/lib/date";
import { getCurrentUser } from "@/lib/profile";
import { isUuid } from "@/lib/uuid";
import { isMonth, loadRange, loadWeekly, monthRange, toCsv } from "@/lib/weekly";

// Unduh tarikan mingguan atau bulanan sebagai CSV atau JSON (khusus Owner).
export async function GET(request: Request) {
  const { profile } = await getCurrentUser();
  if (profile?.role !== "owner") return new Response("Hanya Owner.", { status: 403 });

  const url = new URL(request.url);
  const minggu = url.searchParams.get("minggu") ?? "";
  const week = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(minggu) ? minggu : todayJakarta());
  const company = url.searchParams.get("company");
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";

  const companyId = company && isUuid(company) ? company : null;
  const bulan = url.searchParams.get("bulan") ?? "";
  const monthly = url.searchParams.get("mode") === "bulan" && isMonth(bulan);
  const rows = monthly
    ? await loadRange(monthRange(bulan).start, monthRange(bulan).end, companyId)
    : await loadWeekly(week, companyId);
  const filename = monthly ? `laporan-bulanan-${bulan}.${format}` : `laporan-mingguan-${week}.${format}`;
  const body = format === "json" ? JSON.stringify(rows, null, 2) : toCsv(rows);
  return new Response(body, {
    headers: {
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
