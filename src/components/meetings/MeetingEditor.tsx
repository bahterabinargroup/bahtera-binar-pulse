"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveMeeting, submitMeeting } from "@/app/(app)/notulensi/actions";
import { formatHariTanggal, formatJam } from "@/lib/date";
import {
  ACTION_STATUS_LABEL,
  buildMeetingForm,
  diffChildren,
  emptyActionItem,
  LOCATIONS,
  MAX_ATTACHMENTS,
  MEETING_ACCENT,
  meetingFields,
  newKey,
  validateMeeting,
  type ActionRow,
  type ActionStatus,
  type AttendeeRow,
  type MeetingForm,
  type MeetingRow,
} from "@/lib/meetings";

export type Person = { id: string; full_name: string; company_id: string; position: string | null };
export type CompanyOption = { id: string; name: string };

const AUTOSAVE_DELAY_MS = 2500;

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: string; auto: boolean }
  | { kind: "error"; message: string };

const inputCls =
  "block w-full rounded border border-zinc-300 bg-white px-2 py-1.5 outline-none focus:border-[var(--accent-m)] focus:ring-2 focus:ring-[var(--accent-m)]/20";
const textareaCls = `${inputCls} field-sizing-content min-h-[4.5rem] resize-y`;
const thCls = "border border-black bg-[var(--accent-m)] px-2 py-1.5 text-left text-sm font-bold text-white";
const tdCls = "border border-black align-top";

export function MeetingEditor({
  meeting,
  attendees,
  actions,
  people,
  companies,
  defaultCompanyId,
  writerName,
  today,
}: {
  meeting: MeetingRow | null;
  attendees: AttendeeRow[];
  actions: ActionRow[];
  people: Person[];
  companies: CompanyOption[] | null; // diisi hanya untuk Owner
  defaultCompanyId: string;
  writerName: string;
  today: string;
}) {
  const router = useRouter();
  const initial = useMemo(
    () => buildMeetingForm({ company_id: defaultCompanyId, meeting_date: today }, meeting, attendees, actions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [form, setForm] = useState<MeetingForm>(initial);
  const [id, setId] = useState<string | null>(meeting?.id ?? null);
  const [saved, setSaved] = useState<MeetingForm>(initial);
  const [state, setState] = useState<SaveState>(
    meeting ? { kind: "saved", at: meeting.updated_at, auto: false } : { kind: "idle" },
  );
  const [showErrors, setShowErrors] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [submitting, startSubmit] = useTransition();
  const isSubmitted = !!meeting?.submitted_at;

  // Nilai terbaru untuk dipakai di dalam save() (dipanggil dari timer).
  const formRef = useRef(form);
  const idRef = useRef(id);
  const savedRef = useRef(saved);
  useLayoutEffect(() => {
    formRef.current = form;
    idRef.current = id;
    savedRef.current = saved;
  });
  const busy = useRef(false);
  const again = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

  const errors = useMemo(() => validateMeeting(form), [form]);
  const visibleErrors = showErrors ? errors : {};
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const companyPeople = people.filter((p) => p.company_id === form.company_id);

  const update = (patch: Partial<MeetingForm>) => setForm((f) => ({ ...f, ...patch }));

  const save = useCallback(async (auto: boolean): Promise<boolean> => {
    if (busy.current) {
      again.current = true;
      return false;
    }
    const sent = formRef.current;
    if (Object.keys(validateMeeting(sent)).length) {
      if (!auto) {
        setShowErrors(true);
        setState({ kind: "error", message: "Ada isian yang belum benar (ditandai merah)." });
      }
      return false;
    }
    busy.current = true;
    setState({ kind: "saving" });
    let ok = false;
    try {
      const res = await saveMeeting({
        id: idRef.current,
        companyId: sent.company_id,
        fields: meetingFields(sent),
        children: diffChildren(savedRef.current, sent),
      });
      const result = res.ok ? res : res.partial;
      if (result) {
        // Pasang id baru ke baris yang baru tersimpan (berdasarkan key).
        const mapped = Object.keys(result.attendeeIds).length + Object.keys(result.actionIds).length > 0;
        const withIds = (f: MeetingForm): MeetingForm =>
          !mapped
            ? f
            : {
                ...f,
                attendees: f.attendees.map((a) => (result.attendeeIds[a.key] ? { ...a, id: result.attendeeIds[a.key] } : a)),
                actions: f.actions.map((a) => (result.actionIds[a.key] ? { ...a, id: result.actionIds[a.key] } : a)),
              };
        if (!idRef.current) {
          idRef.current = result.id;
          setId(result.id);
          window.history.replaceState(null, "", `/notulensi/${result.id}/edit`);
        }
        setForm((f) => withIds(f));
        if (res.ok) setSaved(withIds(sent));
      }
      if (res.ok) {
        setState({ kind: "saved", at: res.updatedAt, auto });
        ok = true;
      } else {
        setState({ kind: "error", message: res.error });
      }
    } catch {
      setState({ kind: "error", message: "Tidak dapat terhubung ke server. Isian Anda masih ada; coba Simpan lagi." });
    } finally {
      busy.current = false;
    }
    if (again.current) {
      // Ada permintaan simpan saat sedang menyimpan: jadwalkan ulang.
      again.current = false;
      setRetryTick((t) => t + 1);
    }
    return ok;
  }, []);

  // Simpan otomatis beberapa detik setelah berhenti mengetik.
  useEffect(() => {
    if (!dirty || !form.title.trim() || Object.keys(errors).length) return;
    const t = setTimeout(() => void save(true), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [form, dirty, errors, save, retryTick]);

  // Peringatkan bila halaman ditutup sebelum tersimpan.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onSubmit = () => {
    if (
      !window.confirm(
        "Submit notulensi?\n\nSetelah di-submit, notulensi TIDAK BISA diubah lagi (kecuali oleh Owner). Status tindak lanjut tetap bisa diperbarui PIC.",
      )
    )
      return;
    startSubmit(async () => {
      const okSave = dirty || !idRef.current ? await save(false) : true;
      if (!okSave || !idRef.current) return;
      const res = await submitMeeting(idRef.current);
      if (!res.ok) {
        setState({ kind: "error", message: res.error });
        return;
      }
      setSaved(formRef.current); // hindari peringatan "belum tersimpan" saat pindah halaman
      router.push(`/notulensi/${idRef.current}?pesan=tersubmit`);
    });
  };

  const err = (k: string) =>
    visibleErrors[k] ? <p className="mt-1 text-xs text-red-700">{visibleErrors[k]}</p> : null;

  const addAttendee = (personId: string) => {
    const p = people.find((x) => x.id === personId);
    if (!p || form.attendees.some((a) => a.user_id === p.id)) return;
    update({ attendees: [...form.attendees, { key: newKey(), user_id: p.id, name: p.full_name }] });
  };

  const setAction = (key: string, patch: Partial<MeetingForm["actions"][number]>) =>
    update({ actions: form.actions.map((a) => (a.key === key ? { ...a, ...patch } : a)) });

  return (
    <div className="pb-28" style={{ "--accent-m": MEETING_ACCENT } as React.CSSProperties}>
      <div className="rounded-xl bg-white p-4 text-[15px] text-black shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-[var(--accent-m)] uppercase sm:text-2xl">Notulensi Meeting</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isSubmitted ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {isSubmitted ? "Sudah di-submit (koreksi Owner)" : "Draft"}
          </span>
        </div>

        {/* Identitas meeting */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nama meeting" required className="sm:col-span-2">
            <input
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="mis. Evaluasi Iklan Mingguan"
              className={`${inputCls} text-base font-bold`}
            />
            {err("title")}
            {!form.title.trim() && !id && (
              <p className="mt-1 text-xs text-zinc-500">Isi nama meeting dulu; setelah itu notulensi tersimpan otomatis.</p>
            )}
          </Field>
          <Field label="Tanggal" required>
            <input type="date" value={form.meeting_date} onChange={(e) => update({ meeting_date: e.target.value })} className={inputCls} />
            {form.meeting_date && <p className="mt-1 text-xs text-zinc-500">{formatHariTanggal(new Date(`${form.meeting_date}T12:00:00+07:00`))}</p>}
            {err("meeting_date")}
          </Field>
          <Field label="Penulis">
            <p className="py-1.5 font-bold">{meeting?.created_by_name ?? writerName}</p>
          </Field>
          <Field label="Jam mulai">
            <input type="time" value={form.start_time} onChange={(e) => update({ start_time: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Jam selesai">
            <input type="time" value={form.end_time} onChange={(e) => update({ end_time: e.target.value })} className={inputCls} />
            {err("end_time")}
          </Field>
          <Field label="Lokasi">
            <select value={form.location} onChange={(e) => update({ location: e.target.value })} className={inputCls}>
              <option value="">— Pilih lokasi —</option>
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          {form.location === "Online" && (
            <Field label="Link meeting">
              <input
                value={form.meeting_link}
                onChange={(e) => update({ meeting_link: e.target.value })}
                placeholder="https://meet.google.com/..."
                inputMode="url"
                className={inputCls}
              />
              {err("meeting_link")}
            </Field>
          )}
          {companies && (
            <Field label="Company" className="sm:col-span-2">
              <select
                value={form.company_id}
                onChange={(e) => update({ company_id: e.target.value, attendees: [], actions: form.actions.map((a) => ({ ...a, assignee_id: "" })) })}
                disabled={!!id}
                className={`${inputCls} disabled:bg-zinc-100`}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">
                {id ? "Company tidak bisa diubah setelah tersimpan." : "Notulensi terlihat oleh Manager company ini."}
              </p>
            </Field>
          )}
        </div>

        {/* Peserta */}
        <Section title="Peserta">
          {form.attendees.length > 0 ? (
            <ul className="mb-3 flex flex-wrap gap-2">
              {form.attendees.map((a) => (
                <li key={a.key} className="flex items-center gap-1 rounded-full bg-[var(--accent-m)]/10 py-1 pr-1 pl-3 text-sm">
                  {a.name}
                  {!a.user_id && <span className="text-xs text-zinc-500">(tamu)</span>}
                  <button
                    type="button"
                    onClick={() => update({ attendees: form.attendees.filter((x) => x.key !== a.key) })}
                    aria-label={`Hapus peserta ${a.name}`}
                    className="rounded-full px-2 text-zinc-500 hover:bg-red-100 hover:text-red-700"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-zinc-500">Belum ada peserta.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <select value="" onChange={(e) => addAttendee(e.target.value)} className={inputCls} aria-label="Tambah peserta karyawan">
              <option value="">+ Tambah karyawan…</option>
              {companyPeople
                .filter((p) => !form.attendees.some((a) => a.user_id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                    {p.position ? ` — ${p.position}` : ""}
                  </option>
                ))}
            </select>
            <div className="flex gap-2">
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && guestName.trim()) {
                    e.preventDefault();
                    update({ attendees: [...form.attendees, { key: newKey(), user_id: null, name: guestName.trim() }] });
                    setGuestName("");
                  }
                }}
                placeholder="Nama tamu (tanpa akun)"
                className={inputCls}
              />
              <button
                type="button"
                disabled={!guestName.trim()}
                onClick={() => {
                  update({ attendees: [...form.attendees, { key: newKey(), user_id: null, name: guestName.trim() }] });
                  setGuestName("");
                }}
                className="shrink-0 rounded border border-zinc-300 px-3 text-sm font-bold disabled:opacity-40"
              >
                Tambah
              </button>
            </div>
          </div>
        </Section>

        <Section title="Agenda">
          <textarea value={form.agenda} onChange={(e) => update({ agenda: e.target.value })} className={textareaCls} />
        </Section>
        <Section title="Pembahasan">
          <textarea value={form.discussion} onChange={(e) => update({ discussion: e.target.value })} className={`${textareaCls} min-h-[9rem]`} />
        </Section>
        <Section title="Keputusan">
          <textarea value={form.decisions} onChange={(e) => update({ decisions: e.target.value })} className={textareaCls} />
        </Section>

        {/* Tindak lanjut */}
        <Section title="Tindak Lanjut">
          <table className="w-full table-fixed border-collapse max-sm:block">
            <thead className="max-sm:hidden">
              <tr>
                <th className={`${thCls} w-[40%]`}>Tindak lanjut</th>
                <th className={thCls}>PIC</th>
                <th className={thCls}>Tenggat</th>
                <th className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody className="max-sm:block">
              {form.actions.map((a) => (
                <tr key={a.key} className="max-sm:mb-3 max-sm:block max-sm:border max-sm:border-black">
                  <td className={`${tdCls} max-sm:block max-sm:border-0 max-sm:border-b`}>
                    <MobileLabel>Tindak lanjut</MobileLabel>
                    <textarea
                      value={a.description}
                      onChange={(e) => setAction(a.key, { description: e.target.value })}
                      rows={2}
                      aria-label="Tindak lanjut"
                      className="field-sizing-content block min-h-[2.75rem] w-full resize-none px-2 py-1.5 outline-none focus:bg-sky-50"
                    />
                  </td>
                  <td className={`${tdCls} max-sm:block max-sm:border-0 max-sm:border-b`}>
                    <MobileLabel>PIC</MobileLabel>
                    <select
                      value={a.assignee_id}
                      onChange={(e) => setAction(a.key, { assignee_id: e.target.value })}
                      aria-label="PIC"
                      className="block w-full bg-white px-2 py-1.5 outline-none focus:bg-sky-50"
                    >
                      <option value="">— Pilih PIC —</option>
                      {companyPeople.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${tdCls} max-sm:block max-sm:border-0 max-sm:border-b`}>
                    <MobileLabel>Tenggat</MobileLabel>
                    <input
                      type="date"
                      value={a.due_date}
                      onChange={(e) => setAction(a.key, { due_date: e.target.value })}
                      aria-label="Tenggat"
                      className="block w-full bg-white px-2 py-1.5 outline-none focus:bg-sky-50"
                    />
                  </td>
                  <td className={`${tdCls} relative pr-7 max-sm:block max-sm:border-0`}>
                    <MobileLabel>Status</MobileLabel>
                    <select
                      value={a.status}
                      onChange={(e) => setAction(a.key, { status: e.target.value as ActionStatus })}
                      aria-label="Status"
                      className="block w-full bg-white px-2 py-1.5 outline-none focus:bg-sky-50"
                    >
                      {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {ACTION_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    {form.actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => update({ actions: form.actions.filter((x) => x.key !== a.key) })}
                        aria-label="Hapus baris"
                        title="Hapus baris"
                        className="absolute top-0 right-0 px-2 text-lg text-zinc-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <AddButton onClick={() => update({ actions: [...form.actions, emptyActionItem()] })}>+ Tambah baris</AddButton>
          <p className="mt-1 text-xs text-zinc-500">Baris tanpa isi &quot;Tindak lanjut&quot; tidak disimpan.</p>
        </Section>

        <Section title="Rapat Berikutnya">
          <input
            type="date"
            value={form.next_meeting_date}
            onChange={(e) => update({ next_meeting_date: e.target.value })}
            className={`${inputCls} sm:max-w-xs`}
          />
        </Section>

        <Section title="Lampiran (link)">
          <div className="space-y-2">
            {form.attachment_links.map((l, i) => (
              <div key={i}>
                <div className="flex gap-1">
                  <input
                    value={l}
                    onChange={(e) =>
                      update({ attachment_links: form.attachment_links.map((x, j) => (j === i ? e.target.value : x)) })
                    }
                    placeholder="Tempel link (Drive, dokumen, foto, dsb.)"
                    inputMode="url"
                    className={inputCls}
                  />
                  {form.attachment_links.length > 1 && (
                    <button
                      type="button"
                      onClick={() => update({ attachment_links: form.attachment_links.filter((_, j) => j !== i) })}
                      aria-label="Hapus link"
                      className="px-2 text-lg text-zinc-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  )}
                </div>
                {err(`attachment.${i}`)}
              </div>
            ))}
          </div>
          {err("attachments")}
          {form.attachment_links.length < MAX_ATTACHMENTS && (
            <AddButton onClick={() => update({ attachment_links: [...form.attachment_links, ""] })}>+ Tambah link</AddButton>
          )}
        </Section>
      </div>

      {/* Bilah simpan */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <div className="min-w-0 flex-1 text-sm">
            {state.kind === "error" ? (
              <p role="alert" className="text-red-700">{state.message}</p>
            ) : state.kind === "saving" ? (
              <p className="text-zinc-500">Menyimpan…</p>
            ) : dirty ? (
              <p className="text-amber-700">
                {form.title.trim() ? "Ada perubahan, akan tersimpan otomatis…" : "Isi nama meeting untuk mulai menyimpan."}
              </p>
            ) : state.kind === "saved" ? (
              <p className="text-green-700">
                ✓ Tersimpan{state.auto ? " otomatis" : ""} pukul {formatJam(state.at)} WIB
              </p>
            ) : (
              <p className="text-zinc-500">Belum disimpan.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void save(false)}
            disabled={state.kind === "saving" || submitting}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 font-bold hover:bg-zinc-50 disabled:opacity-60"
          >
            Simpan
          </button>
          {isSubmitted ? (
            id && (
              <button
                type="button"
                onClick={() => router.push(`/notulensi/${id}`)}
                disabled={dirty}
                className="rounded-lg bg-[var(--accent-m)] px-4 py-2.5 font-bold text-white disabled:opacity-60"
              >
                Selesai koreksi
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !form.title.trim()}
              className="rounded-lg bg-[var(--accent-m)] px-4 py-2.5 font-bold text-white hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? "Mengirim…" : "Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-sm font-bold">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </p>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-lg font-bold text-[var(--accent-m)]">{title}</h2>
      {children}
    </section>
  );
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return <span className="block px-2 pt-1.5 text-xs font-bold text-[var(--accent-m)] sm:hidden">{children}</span>;
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 rounded-lg border border-dashed border-zinc-400 px-3 py-1.5 text-sm font-bold text-zinc-600 hover:border-[var(--accent-m)] hover:text-[var(--accent-m)]"
    >
      {children}
    </button>
  );
}
