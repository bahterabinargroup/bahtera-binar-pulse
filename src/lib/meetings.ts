// Notulensi meeting: tipe data, label, dan konversi form <-> database.
// Aturan akses ditegakkan database (schema bagian 11 & 13); di sini hanya
// untuk menampilkan/menyembunyikan tombol.

import { normalizeUrl } from "@/lib/report/form-state";
import type { UserRole } from "@/lib/profile";

export const MEETING_ACCENT = "#012C4E"; // navy brand (sebelumnya biru netral)
export const LOCATIONS = ["Kantor 1", "Kantor 2", "Kantor Redigma", "Online"] as const;
export const MAX_ATTACHMENTS = 20;

export type ActionStatus = "open" | "in_progress" | "done";
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  open: "Open",
  in_progress: "Sedang dikerjakan",
  done: "Selesai",
};

export type MeetingRow = {
  id: string;
  company_id: string;
  created_by: string;
  created_by_name: string | null;
  title: string;
  meeting_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  meeting_link: string | null;
  agenda: string | null;
  discussion: string | null;
  decisions: string | null;
  next_meeting_date: string | null;
  attachment_links: string[];
  submitted_at: string | null;
  delete_requested_at: string | null;
  delete_request_reason: string | null;
  updated_at: string;
};

export type AttendeeRow = { id: string; user_id: string | null; name: string };
export type ActionRow = {
  id: string;
  description: string;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  status: ActionStatus;
};

export const MEETING_COLUMNS =
  "id, company_id, created_by, created_by_name, title, meeting_date, start_time, end_time, location, meeting_link, agenda, discussion, decisions, next_meeting_date, attachment_links, submitted_at, delete_requested_at, delete_request_reason, updated_at";

// ---------- Form ----------

export type AttendeeItem = { key: string; id?: string; user_id: string | null; name: string };
export type ActionItem = {
  key: string;
  id?: string;
  description: string;
  assignee_id: string;
  due_date: string;
  status: ActionStatus;
};

export type MeetingForm = {
  company_id: string;
  title: string;
  meeting_date: string;
  start_time: string;
  end_time: string;
  location: string;
  meeting_link: string;
  agenda: string;
  discussion: string;
  decisions: string;
  next_meeting_date: string;
  attachment_links: string[];
  attendees: AttendeeItem[];
  actions: ActionItem[];
};

export const newKey = () => Math.random().toString(36).slice(2, 10);
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

export function emptyActionItem(): ActionItem {
  return { key: newKey(), description: "", assignee_id: "", due_date: "", status: "open" };
}

export function buildMeetingForm(
  defaults: { company_id: string; meeting_date: string },
  m?: MeetingRow | null,
  attendees: AttendeeRow[] = [],
  actions: ActionRow[] = [],
): MeetingForm {
  return {
    company_id: m?.company_id ?? defaults.company_id,
    title: m?.title ?? "",
    meeting_date: m?.meeting_date ?? defaults.meeting_date,
    start_time: hhmm(m?.start_time ?? null),
    end_time: hhmm(m?.end_time ?? null),
    location: m?.location ?? "",
    meeting_link: m?.meeting_link ?? "",
    agenda: m?.agenda ?? "",
    discussion: m?.discussion ?? "",
    decisions: m?.decisions ?? "",
    next_meeting_date: m?.next_meeting_date ?? "",
    attachment_links: m?.attachment_links?.length ? [...m.attachment_links] : [""],
    attendees: attendees.map((a) => ({ key: a.id, id: a.id, user_id: a.user_id, name: a.name })),
    actions: actions.length
      ? actions.map((a) => ({
          key: a.id,
          id: a.id,
          description: a.description,
          assignee_id: a.assignee_id ?? "",
          due_date: a.due_date ?? "",
          status: a.status,
        }))
      : [emptyActionItem()],
  };
}

export type MeetingErrors = Record<string, string>;

export function validateMeeting(f: MeetingForm): MeetingErrors {
  const e: MeetingErrors = {};
  if (!f.title.trim()) e.title = "Nama meeting wajib diisi.";
  if (!f.meeting_date) e.meeting_date = "Tanggal wajib diisi.";
  if (f.start_time && f.end_time && f.end_time < f.start_time)
    e.end_time = "Jam selesai tidak boleh lebih awal dari jam mulai.";
  if (f.location === "Online" && f.meeting_link.trim() && normalizeUrl(f.meeting_link) === null)
    e.meeting_link = "Link tidak valid. Contoh: https://meet.google.com/...";
  f.attachment_links.forEach((l, i) => {
    if (l.trim() && normalizeUrl(l) === null) e[`attachment.${i}`] = "Link tidak valid.";
  });
  if (f.attachment_links.filter((l) => l.trim()).length > MAX_ATTACHMENTS)
    e.attachments = `Maksimal ${MAX_ATTACHMENTS} link lampiran.`;
  return e;
}

const nul = (v: string) => (v.trim() ? v.trim() : null);

// Kolom meetings yang dikirim saat menyimpan.
export function meetingFields(f: MeetingForm) {
  return {
    title: f.title.trim(),
    meeting_date: f.meeting_date,
    start_time: f.start_time || null,
    end_time: f.end_time || null,
    location: f.location || null,
    meeting_link: f.location === "Online" ? (normalizeUrl(f.meeting_link) || null) : null,
    agenda: nul(f.agenda),
    discussion: nul(f.discussion),
    decisions: nul(f.decisions),
    next_meeting_date: f.next_meeting_date || null,
    attachment_links: f.attachment_links.map((l) => normalizeUrl(l)).filter((l): l is string => !!l),
  };
}

export type MeetingFields = ReturnType<typeof meetingFields>;

const actionIsEmpty = (a: ActionItem) => !a.description.trim();

// Perubahan sejak penyimpanan terakhir: hanya baris yang berubah dikirim,
// agar status tindak lanjut yang diubah PIC tidak tertimpa.
export function diffChildren(saved: MeetingForm, cur: MeetingForm) {
  const savedAtt = new Map(saved.attendees.filter((a) => a.id).map((a) => [a.id!, a]));
  const curAttIds = new Set(cur.attendees.filter((a) => a.id).map((a) => a.id!));
  const attendees = {
    insert: cur.attendees.filter((a) => !a.id).map((a) => ({ key: a.key, user_id: a.user_id, name: a.name })),
    delete: [...savedAtt.keys()].filter((id) => !curAttIds.has(id)),
  };

  const savedAct = new Map(saved.actions.filter((a) => a.id).map((a) => [a.id!, a]));
  const curActIds = new Set(cur.actions.filter((a) => a.id && !actionIsEmpty(a)).map((a) => a.id!));
  const toRow = (a: ActionItem) => ({
    description: a.description.trim(),
    assignee_id: a.assignee_id || null,
    due_date: a.due_date || null,
    status: a.status,
  });
  const actions = {
    insert: cur.actions.filter((a) => !a.id && !actionIsEmpty(a)).map((a) => ({ key: a.key, ...toRow(a) })),
    update: cur.actions
      .filter((a) => a.id && !actionIsEmpty(a))
      .flatMap((a) => {
        const before = savedAct.get(a.id!);
        if (!before) return [];
        const row = toRow(a);
        const prev = toRow(before);
        const changed = Object.fromEntries(
          Object.entries(row).filter(([k, v]) => prev[k as keyof typeof prev] !== v),
        );
        return Object.keys(changed).length ? [{ id: a.id!, ...changed }] : [];
      }),
    delete: [...savedAct.keys()].filter((id) => !curActIds.has(id)),
  };
  return { attendees, actions };
}

export type ChildDiff = ReturnType<typeof diffChildren>;

// ---------- Hak tampil tombol ----------

export function canEditMeeting(m: Pick<MeetingRow, "created_by" | "submitted_at">, userId: string, role: UserRole) {
  return role === "owner" || (m.created_by === userId && !m.submitted_at);
}

export function canChangeActionStatus(
  m: Pick<MeetingRow, "created_by" | "submitted_at">,
  a: Pick<ActionRow, "assignee_id">,
  userId: string,
  role: UserRole,
) {
  return role === "owner" || a.assignee_id === userId || (m.created_by === userId && !m.submitted_at);
}
