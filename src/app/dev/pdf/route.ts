import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { MeetingPdf } from "@/lib/meeting-pdf";
import type { MeetingRow } from "@/lib/meetings";

// HANYA pengembangan lokal: contoh PDF notulensi dengan data rekaan.
export async function GET() {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const meeting: MeetingRow = {
    id: "x", company_id: "x", created_by: "x", created_by_name: "Contoh Penulis",
    title: "Evaluasi Iklan Mingguan", meeting_date: "2026-10-06", start_time: "09:00:00", end_time: "10:30:00",
    location: "Online", meeting_link: "https://meet.google.com/abc-defg-hij",
    agenda: "1. Review performa iklan\n2. Target minggu depan",
    discussion: "CTR Toko A turun 2% dibanding minggu lalu. ".repeat(12),
    decisions: "Materi iklan Toko A diganti sebelum Jumat.",
    next_meeting_date: "2026-10-13", attachment_links: ["https://drive.google.com/contoh"],
    submitted_at: "2026-10-06T04:00:00Z", delete_requested_at: null, delete_request_reason: null, updated_at: "2026-10-06T04:00:00Z",
  };
  const pdf = await renderToBuffer(
    createElement(MeetingPdf, {
      meeting,
      attendees: [{ id: "a", user_id: "u", name: "Budi" }, { id: "b", user_id: null, name: "Pak Joko" }],
      actions: [
        { id: "1", description: "Perbaiki materi iklan Toko A", assignee_id: "u", assignee_name: "Budi", due_date: "2026-10-09", status: "open" },
        { id: "2", description: "Kirim rekap penjualan", assignee_id: "u", assignee_name: "Sari", due_date: null, status: "done" },
      ],
      companyName: "PT Contoh",
    }) as Parameters<typeof renderToBuffer>[0],
  );
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf" } });
}
