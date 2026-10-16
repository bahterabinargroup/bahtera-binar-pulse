import Link from "next/link";
import { redirect } from "next/navigation";
import { MeetingTabs } from "@/components/meetings/MeetingTabs";
import { cardCls, inputCls } from "@/components/owner/ui";
import { todayJakarta } from "@/lib/date";
import { fmtTanggal } from "@/lib/leave";
import { getCurrentUser, isManagerial } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const STATUS_LABEL: Record<string, string> = { open: "Open", in_progress: "Sedang dikerjakan", done: "Selesai" };

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`${cardCls} text-center`}>
      <p className={`text-2xl font-bold ${tone ?? "text-accent"}`}>{value}</p>
      <p className="text-xs text-zinc-600">{label}</p>
    </div>
  );
}

type Row = {
  id: string;
  description: string;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  status: "open" | "in_progress" | "done";
  completed_at: string | null;
  meeting: { id: string; title: string; meeting_date: string; company_id: string } | null;
};

// Semua tindak lanjut dari notulensi dalam satu daftar, untuk Owner (semua company) dan Manager (company-nya).
// Yang mengubah status tetap PIC-nya (di Tugas Saya atau halaman notulensi). Data disaring RLS.
export default async function TindakLanjutPage({ searchParams }: PageProps<"/tindak-lanjut">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  if (!isManagerial(profile.role)) redirect("/tugas");
  const isOwner = profile.role === "owner";

  const sp = await searchParams;
  const status = ["selesai", "semua", "lewat"].includes(one(sp.status)) ? one(sp.status) : "belum";
  const pic = isUuid(one(sp.pic)) ? one(sp.pic) : "";
  const company = isOwner && isUuid(one(sp.company)) ? one(sp.company) : "";
  const today = todayJakarta();

  const supabase = await createClient();
  const [res, compRes] = await Promise.all([
    supabase
      .from("meeting_action_items")
      .select("id, description, assignee_id, assignee_name, due_date, status, completed_at, meeting:meetings(id, title, meeting_date, company_id)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1000),
    isOwner ? supabase.from("companies").select("id, name").order("name") : Promise.resolve({ data: null }),
  ]);
  if (res.error) throw new Error(`Gagal memuat tindak lanjut: ${res.error.message}`);
  const all = ((res.data ?? []) as unknown as Row[]).filter((r) => !company || r.meeting?.company_id === company);
  const companies = compRes.data as { id: string; name: string }[] | null;
  const compName = new Map((companies ?? []).map((c) => [c.id, c.name]));

  const overdue = (r: Row) => r.status !== "done" && !!r.due_date && r.due_date < today;
  const openAll = all.filter((r) => r.status !== "done");
  const monthStartYmd = `${today.slice(0, 7)}-01`;
  const doneMonth = all.filter((r) => r.status === "done" && (r.completed_at ?? "").slice(0, 10) >= monthStartYmd).length;

  const pics = [...new Map(all.filter((r) => r.assignee_id).map((r) => [r.assignee_id as string, r.assignee_name ?? "—"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const rows = all
    .filter((r) => (status === "belum" ? r.status !== "done" : status === "selesai" ? r.status === "done" : status === "lewat" ? overdue(r) : true))
    .filter((r) => !pic || r.assignee_id === pic);

  return (
    <div>
      <MeetingTabs active="tindak" showFollowup />
      <h1 className="text-2xl font-bold text-accent">Daftar Tindak Lanjut</h1>
      <p className="mt-1 text-sm text-zinc-600">Semua tugas dari notulensi {isOwner ? "di semua company" : "di company Anda"}, urut tenggat terdekat.</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Belum selesai" value={openAll.length} />
        <Stat label="Lewat tenggat" value={openAll.filter(overdue).length} tone={openAll.some(overdue) ? "text-red-700" : "text-green-700"} />
        <Stat label="Selesai bulan ini" value={doneMonth} tone="text-green-700" />
      </div>

      <form action="/tindak-lanjut" className={`${cardCls} mt-3 flex flex-wrap items-end gap-2 text-sm`}>
        <label className="text-xs font-bold">Status
          <select name="status" defaultValue={status} className={inputCls}>
            <option value="belum">Belum selesai</option>
            <option value="lewat">Lewat tenggat</option>
            <option value="selesai">Selesai</option>
            <option value="semua">Semua</option>
          </select>
        </label>
        <label className="text-xs font-bold">PIC
          <select name="pic" defaultValue={pic} className={inputCls}>
            <option value="">Semua PIC</option>
            {pics.map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
          </select>
        </label>
        {isOwner && companies && (
          <label className="text-xs font-bold">Company
            <select name="company" defaultValue={company} className={inputCls}>
              <option value="">Semua company</option>
              {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </label>
        )}
        <button type="submit" className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white">Terapkan</button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm">{status === "belum" ? "Tidak ada tindak lanjut yang belum selesai. 🎉" : "Tidak ada yang cocok dengan filter ini."}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => {
            const late = overdue(r);
            return (
              <li key={r.id} className={`rounded-xl border p-4 text-sm shadow-sm ${late ? "border-red-400 bg-red-50" : "border-zinc-200 bg-white"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-bold whitespace-pre-wrap">{r.description}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.status === "done" ? "bg-green-100 text-green-800" : r.status === "in_progress" ? "bg-sky-100 text-sky-900" : "bg-zinc-100 text-zinc-700"}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p className="mt-1 text-zinc-700">
                  PIC: <b>{r.assignee_name ?? "—"}</b> · Tenggat:{" "}
                  {r.due_date ? <b className={late ? "text-red-700" : ""}>{fmtTanggal(r.due_date)}{late ? " (lewat tenggat)" : ""}</b> : "tanpa tenggat"}
                  {r.status === "done" && r.completed_at ? ` · selesai ${fmtTanggal(r.completed_at.slice(0, 10))}` : ""}
                </p>
                {r.meeting && (
                  <p className="mt-1 text-xs text-zinc-600">
                    Dari notulensi{" "}
                    <Link href={`/notulensi/${r.meeting.id}`} className="font-bold text-accent underline">{r.meeting.title}</Link> ({fmtTanggal(r.meeting.meeting_date)}
                    {isOwner && !company ? ` · ${compName.get(r.meeting.company_id) ?? ""}` : ""})
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
