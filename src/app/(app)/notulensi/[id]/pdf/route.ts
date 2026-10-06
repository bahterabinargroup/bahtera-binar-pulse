import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { MeetingPdf } from "@/lib/meeting-pdf";
import { loadMeeting } from "@/lib/meetings-server";
import { isUuid } from "@/lib/uuid";

// Unduh notulensi sebagai PDF. Data dibaca dengan sesi pengguna (RLS berlaku).
export async function GET(_req: Request, ctx: RouteContext<"/notulensi/[id]/pdf">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Notulensi tidak ditemukan.", { status: 404 });

  const data = await loadMeeting(id);
  if (!data) return new Response("Notulensi tidak ditemukan atau Anda tidak berhak melihatnya.", { status: 404 });

  const { meeting, attendees, actions } = data;
  const pdf = await renderToBuffer(
    createElement(MeetingPdf, { meeting, attendees, actions, companyName: meeting.company?.name ?? null }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  const base = `Notulensi - ${meeting.title} - ${meeting.meeting_date}`;
  const ascii = base.replace(/[^\w .-]+/g, "_");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(base)}.pdf`,
      "Cache-Control": "private, no-store",
    },
  });
}
