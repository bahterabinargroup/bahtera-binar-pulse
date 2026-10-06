import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionStatusSelect } from "@/components/meetings/ActionStatusSelect";
import { MeetingButtons } from "@/components/meetings/MeetingButtons";
import { dateFromYmd, formatHariTanggal, formatJam } from "@/lib/date";
import { canChangeActionStatus, canEditMeeting, MEETING_ACCENT } from "@/lib/meetings";
import { loadMeeting } from "@/lib/meetings-server";
import { getCurrentUser } from "@/lib/profile";
import { isUuid } from "@/lib/uuid";

const tanggal = (ymd: string | null) => (ymd ? formatHariTanggal(dateFromYmd(ymd)) : "—");

export default async function NotulensiDetailPage({ params, searchParams }: PageProps<"/notulensi/[id]">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await loadMeeting(id);
  if (!data) notFound();
  const { meeting: m, attendees, actions } = data;
  const pesan = (await searchParams).pesan;

  const isOwner = profile.role === "owner";
  const isCreator = m.created_by === profile.id;
  const jam = [m.start_time?.slice(0, 5), m.end_time?.slice(0, 5)].filter(Boolean).join(" – ");

  return (
    <div style={{ "--accent-m": MEETING_ACCENT } as React.CSSProperties}>
      <Link href="/notulensi" className="mb-3 inline-block text-sm font-bold text-accent hover:underline">
        ← Semua notulensi
      </Link>

      {pesan === "tersubmit" && (
        <p role="status" className="mb-3 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Notulensi berhasil di-submit dan sekarang terkunci.
        </p>
      )}
      {m.delete_requested_at && (
        <p className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <b>Menunggu persetujuan hapus</b> (diajukan {formatHariTanggal(new Date(m.delete_requested_at))}, pukul{" "}
          {formatJam(m.delete_requested_at)} WIB). Alasan: {m.delete_request_reason}
        </p>
      )}

      <div className="mb-4">
        <MeetingButtons
          id={m.id}
          canEdit={canEditMeeting(m, profile.id, profile.role)}
          isSubmitted={!!m.submitted_at}
          isOwner={isOwner}
          isCreator={isCreator}
          deleteRequested={!!m.delete_requested_at}
        />
      </div>

      <article className="rounded-xl bg-white p-4 text-[15px] shadow-sm sm:p-8" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-[var(--accent-m)] uppercase sm:text-2xl">Notulensi Meeting</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              m.submitted_at ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {m.submitted_at ? `Submit ${formatHariTanggal(new Date(m.submitted_at))}, ${formatJam(m.submitted_at)} WIB` : "Draft"}
          </span>
        </div>
        <p className="mt-2 text-lg font-bold">{m.title}</p>

        <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <Info label="Tanggal" value={tanggal(m.meeting_date)} />
          {jam && <Info label="Jam" value={`${jam} WIB`} />}
          <Info
            label="Lokasi"
            value={
              m.location === "Online" && m.meeting_link ? (
                <>
                  Online —{" "}
                  <a href={m.meeting_link} target="_blank" rel="noopener noreferrer" className="text-accent underline break-all">
                    {m.meeting_link}
                  </a>
                </>
              ) : (
                (m.location ?? "—")
              )
            }
          />
          <Info label="Penulis" value={m.created_by_name ?? "—"} />
          {isOwner && m.company && <Info label="Company" value={m.company.name} />}
        </dl>

        <Block title="Peserta">
          {attendees.length ? (
            <ul className="flex flex-wrap gap-2">
              {attendees.map((a) => (
                <li key={a.id} className="rounded-full bg-[var(--accent-m)]/10 px-3 py-1 text-sm">
                  {a.name}
                  {!a.user_id && <span className="text-xs text-zinc-500"> (tamu)</span>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Block>
        <TextBlock title="Agenda" text={m.agenda} />
        <TextBlock title="Pembahasan" text={m.discussion} />
        <TextBlock title="Keputusan" text={m.decisions} />

        <Block title="Tindak Lanjut">
          {actions.length ? (
            <table className="w-full table-fixed border-collapse text-sm max-sm:block">
              <thead className="max-sm:hidden">
                <tr>
                  {["Tindak lanjut", "PIC", "Tenggat", "Status"].map((h, i) => (
                    <th
                      key={h}
                      className={`border border-black bg-[var(--accent-m)] px-2 py-1.5 text-left font-bold text-white ${i === 0 ? "w-[40%]" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="max-sm:block">
                {actions.map((a) => (
                  <tr key={a.id} className="max-sm:mb-3 max-sm:block max-sm:border max-sm:border-black">
                    <Td label="Tindak lanjut">
                      <span className="whitespace-pre-wrap">{a.description}</span>
                    </Td>
                    <Td label="PIC">{a.assignee_name ?? "—"}</Td>
                    <Td label="Tenggat">{a.due_date ? tanggal(a.due_date) : "—"}</Td>
                    <Td label="Status">
                      <ActionStatusSelect
                        itemId={a.id}
                        status={a.status}
                        editable={canChangeActionStatus(m, a, profile.id, profile.role)}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty />
          )}
        </Block>

        <Block title="Rapat Berikutnya">
          <p>{tanggal(m.next_meeting_date)}</p>
        </Block>
        <Block title="Lampiran">
          {m.attachment_links.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {m.attachment_links.map((l) => (
                <li key={l}>
                  <a href={l} target="_blank" rel="noopener noreferrer" className="text-accent underline break-all">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Block>
      </article>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="font-bold">{label}</dt>
      <dd className="mb-1 sm:mb-0">{value}</dd>
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-lg font-bold text-[var(--accent-m)]">{title}</h2>
      {children}
    </section>
  );
}

function TextBlock({ title, text }: { title: string; text: string | null }) {
  return <Block title={title}>{text ? <p className="whitespace-pre-wrap">{text}</p> : <Empty />}</Block>;
}

function Empty() {
  return <p className="text-sm text-zinc-400">—</p>;
}

function Td({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <td className="border border-black px-2 py-1.5 align-top max-sm:block max-sm:border-0 max-sm:border-b max-sm:last:border-b-0">
      <span className="block text-xs font-bold text-[var(--accent-m)] sm:hidden">{label}</span>
      {children}
    </td>
  );
}
