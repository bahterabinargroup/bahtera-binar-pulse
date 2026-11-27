// Tarikan notulensi (Owner): semua notulensi dalam rentang tanggal meeting, beserta peserta dan tindak lanjut.
// Dibaca dengan sesi login (RLS berlaku: Owner melihat semua, termasuk draft).
import { ACTION_STATUS_LABEL, type ActionStatus } from "@/lib/meetings";
import { createClient } from "@/lib/supabase/server";

export type MeetingExportRow = {
  meeting_date: string;
  company_name: string;
  title: string;
  status: "Draft" | "Submit";
  created_by_name: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  meeting_link: string | null;
  agenda: string | null;
  discussion: string | null;
  decisions: string | null;
  next_meeting_date: string | null;
  attendees: string[];
  action_items: { description: string; pic: string | null; due_date: string | null; status: string }[];
  attachment_links: string[];
  submitted_at: string | null;
  updated_at: string;
};

type Raw = {
  meeting_date: string;
  title: string;
  created_by_name: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  meeting_link: string | null;
  agenda: string | null;
  discussion: string | null;
  decisions: string | null;
  next_meeting_date: string | null;
  attachment_links: string[] | null;
  submitted_at: string | null;
  updated_at: string;
  company: { name: string } | { name: string }[] | null;
  meeting_attendees: { name: string }[];
  meeting_action_items: { description: string; assignee_name: string | null; due_date: string | null; status: ActionStatus; created_at: string }[];
};

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

export async function loadMeetings(start: string, end: string, companyId: string | null): Promise<MeetingExportRow[]> {
  const supabase = await createClient();
  const out: MeetingExportRow[] = [];
  const PAGE = 500;
  for (let from = 0; from < 20000; from += PAGE) {
    let q = supabase
      .from("meetings")
      .select(
        "meeting_date, title, created_by_name, start_time, end_time, location, meeting_link, agenda, discussion, decisions, next_meeting_date, attachment_links, submitted_at, updated_at, company:companies(name), meeting_attendees(name), meeting_action_items(description, assignee_name, due_date, status, created_at)",
      )
      .gte("meeting_date", start)
      .lte("meeting_date", end);
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q.order("meeting_date").order("start_time", { nullsFirst: true }).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`Gagal memuat tarikan notulensi: ${error.message}`);
    for (const m of (data ?? []) as unknown as Raw[]) {
      const comp = Array.isArray(m.company) ? m.company[0] : m.company;
      out.push({
        meeting_date: m.meeting_date,
        company_name: comp?.name ?? "",
        title: m.title,
        status: m.submitted_at ? "Submit" : "Draft",
        created_by_name: m.created_by_name,
        start_time: hhmm(m.start_time),
        end_time: hhmm(m.end_time),
        location: m.location,
        meeting_link: m.meeting_link,
        agenda: m.agenda,
        discussion: m.discussion,
        decisions: m.decisions,
        next_meeting_date: m.next_meeting_date,
        attendees: m.meeting_attendees.map((a) => a.name),
        action_items: [...m.meeting_action_items]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((a) => ({ description: a.description, pic: a.assignee_name, due_date: a.due_date, status: ACTION_STATUS_LABEL[a.status] ?? a.status })),
        attachment_links: m.attachment_links ?? [],
        submitted_at: m.submitted_at,
        updated_at: m.updated_at,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const HEADERS: [string, (r: MeetingExportRow) => string][] = [
  ["tanggal", (r) => r.meeting_date],
  ["company", (r) => r.company_name],
  ["judul", (r) => r.title],
  ["status", (r) => r.status],
  ["penulis", (r) => r.created_by_name ?? ""],
  ["jam_mulai", (r) => r.start_time ?? ""],
  ["jam_selesai", (r) => r.end_time ?? ""],
  ["lokasi", (r) => r.location ?? ""],
  ["link_meeting", (r) => r.meeting_link ?? ""],
  ["peserta", (r) => r.attendees.join("; ")],
  ["agenda", (r) => r.agenda ?? ""],
  ["pembahasan", (r) => r.discussion ?? ""],
  ["keputusan", (r) => r.decisions ?? ""],
  ["tindak_lanjut", (r) => r.action_items.map((a) => `${a.description} (PIC: ${a.pic ?? "-"}; tenggat: ${a.due_date ?? "-"}; ${a.status})`).join(" | ")],
  ["rapat_berikutnya", (r) => r.next_meeting_date ?? ""],
  ["lampiran", (r) => r.attachment_links.join(" ")],
  ["diperbarui", (r) => r.updated_at],
];

// CSV satu baris per notulensi (UTF-8 dengan BOM agar terbaca benar di Excel).
export function meetingsToCsv(rows: MeetingExportRow[]): string {
  const cell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [HEADERS.map(([h]) => h).join(","), ...rows.map((r) => HEADERS.map(([, f]) => cell(f(r))).join(","))];
  return "﻿" + lines.join("\r\n");
}
