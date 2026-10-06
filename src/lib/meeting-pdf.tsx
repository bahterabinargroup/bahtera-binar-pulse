import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { dateFromYmd, formatHariTanggal, formatJam } from "@/lib/date";
import { ACTION_STATUS_LABEL, MEETING_ACCENT, type ActionRow, type AttendeeRow, type MeetingRow } from "@/lib/meetings";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: MEETING_ACCENT },
  name: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 4 },
  status: { fontSize: 9, color: "#555", marginTop: 2 },
  infoRow: { flexDirection: "row", marginTop: 3 },
  infoLabel: { width: 70, fontFamily: "Helvetica-Bold" },
  infoValue: { flex: 1 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: MEETING_ACCENT, marginTop: 14, marginBottom: 4 },
  text: { lineHeight: 1.25 },
  empty: { color: "#999" },
  table: { borderWidth: 1, borderColor: "#000" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" },
  th: { backgroundColor: MEETING_ACCENT, color: "#fff", fontFamily: "Helvetica-Bold", padding: 4 },
  td: { padding: 4 },
  link: { color: MEETING_ACCENT },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 8, color: "#888", textAlign: "center" },
});

const COLS = [
  { label: "Tindak lanjut", width: "40%" },
  { label: "PIC", width: "20%" },
  { label: "Tenggat", width: "22%" },
  { label: "Status", width: "18%" },
] as const;

const tanggal = (ymd: string | null) => (ymd ? formatHariTanggal(dateFromYmd(ymd)) : "-");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View wrap={false}>
      <Text style={s.h2}>{title}</Text>
      {children}
    </View>
  );
}

const Para = ({ text }: { text: string | null }) =>
  text ? <Text style={s.text}>{text}</Text> : <Text style={s.empty}>-</Text>;

// Dokumen PDF notulensi (dipakai /notulensi/[id]/pdf).
export function MeetingPdf({
  meeting: m,
  attendees,
  actions,
  companyName,
}: {
  meeting: MeetingRow;
  attendees: AttendeeRow[];
  actions: ActionRow[];
  companyName: string | null;
}) {
  const jam = [m.start_time?.slice(0, 5), m.end_time?.slice(0, 5)].filter(Boolean).join(" - ");
  const lokasi = m.location === "Online" && m.meeting_link ? `Online - ${m.meeting_link}` : (m.location ?? "-");
  const info: [string, string][] = [
    ["Tanggal", tanggal(m.meeting_date)],
    ...(jam ? [["Jam", `${jam} WIB`] as [string, string]] : []),
    ["Lokasi", lokasi],
    ["Penulis", m.created_by_name ?? "-"],
    ...(companyName ? [["Company", companyName] as [string, string]] : []),
  ];

  return (
    <Document title={`Notulensi - ${m.title}`} author={m.created_by_name ?? undefined}>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>NOTULENSI MEETING</Text>
        <Text style={s.name}>{m.title}</Text>
        <Text style={s.status}>
          {m.submitted_at
            ? `Disubmit ${formatHariTanggal(new Date(m.submitted_at))}, ${formatJam(m.submitted_at)} WIB`
            : "DRAFT - belum disubmit"}
        </Text>

        <View style={{ marginTop: 8 }}>
          {info.map(([label, value]) => (
            <View key={label} style={s.infoRow}>
              <Text style={s.infoLabel}>{label}</Text>
              <Text style={s.infoValue}>: {value}</Text>
            </View>
          ))}
        </View>

        <Section title="Peserta">
          <Para text={attendees.length ? attendees.map((a) => (a.user_id ? a.name : `${a.name} (tamu)`)).join(", ") : null} />
        </Section>
        <Section title="Agenda">
          <Para text={m.agenda} />
        </Section>
        <Text style={s.h2}>Pembahasan</Text>
        <Para text={m.discussion} />
        <Section title="Keputusan">
          <Para text={m.decisions} />
        </Section>

        <Text style={s.h2}>Tindak Lanjut</Text>
        {actions.length ? (
          <View style={s.table}>
            <View style={s.tr} fixed>
              {COLS.map((c) => (
                <Text key={c.label} style={[s.th, { width: c.width }]}>
                  {c.label}
                </Text>
              ))}
            </View>
            {actions.map((a, i) => (
              <View key={a.id} style={[s.tr, i === actions.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
                <Text style={[s.td, { width: COLS[0].width }]}>{a.description}</Text>
                <Text style={[s.td, { width: COLS[1].width }]}>{a.assignee_name ?? "-"}</Text>
                <Text style={[s.td, { width: COLS[2].width }]}>{tanggal(a.due_date)}</Text>
                <Text style={[s.td, { width: COLS[3].width }]}>{ACTION_STATUS_LABEL[a.status]}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.empty}>-</Text>
        )}

        <Section title="Rapat Berikutnya">
          <Text>{tanggal(m.next_meeting_date)}</Text>
        </Section>
        <Section title="Lampiran">
          {m.attachment_links.length ? (
            m.attachment_links.map((l) => (
              <Link key={l} src={l} style={s.link}>
                {l}
              </Link>
            ))
          ) : (
            <Text style={s.empty}>-</Text>
          )}
        </Section>

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) => `Notulensi "${m.title}" - halaman ${pageNumber} dari ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
