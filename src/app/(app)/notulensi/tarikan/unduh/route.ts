import { addDays, mondayOf, todayJakarta } from "@/lib/date";
import { loadMeetings, meetingsToCsv } from "@/lib/meeting-export";
import { getCurrentUser } from "@/lib/profile";
import { isUuid } from "@/lib/uuid";
import { isMonth, monthRange } from "@/lib/weekly";

// Unduh tarikan notulensi mingguan atau bulanan sebagai CSV atau JSON (khusus Owner).
export async function GET(request: Request) {
  const { profile } = await getCurrentUser();
  if (profile?.role !== "owner") return new Response("Hanya Owner.", { status: 403 });

  const url = new URL(request.url);
  const minggu = url.searchParams.get("minggu") ?? "";
  const week = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(minggu) ? minggu : todayJakarta());
  const company = url.searchParams.get("company");
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  const bulan = url.searchParams.get("bulan") ?? "";
  const monthly = url.searchParams.get("mode") === "bulan" && isMonth(bulan);

  const start = monthly ? monthRange(bulan).start : week;
  const end = monthly ? monthRange(bulan).end : addDays(week, 6);
  const rows = await loadMeetings(start, end, company && isUuid(company) ? company : null);
  const filename = monthly ? `notulensi-bulanan-${bulan}.${format}` : `notulensi-mingguan-${week}.${format}`;
  return new Response(format === "json" ? JSON.stringify(rows, null, 2) : meetingsToCsv(rows), {
    headers: {
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
