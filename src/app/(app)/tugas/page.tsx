import Link from "next/link";
import { ActionStatusSelect } from "@/components/meetings/ActionStatusSelect";
import { MeetingTabs } from "@/components/meetings/MeetingTabs";
import { dateFromYmd, formatHariTanggal, todayJakarta } from "@/lib/date";
import type { ActionStatus } from "@/lib/meetings";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

type Task = {
  id: string;
  meeting_id: string;
  meeting_title: string;
  meeting_date: string;
  description: string;
  due_date: string | null;
  status: ActionStatus;
};

// Tindak lanjut yang PIC-nya pengguna ini. Karyawan tidak bisa membuka
// isi notulensi, jadi hanya tugasnya yang ditampilkan (RPC get_my_action_items).
export default async function TugasSayaPage({ searchParams }: PageProps<"/tugas">) {
  const { profile } = await getCurrentUser();
  if (!profile) return null;
  const showDone = (await searchParams).selesai === "1";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_action_items", { p_include_done: showDone });
  if (error) throw new Error(`Gagal memuat tugas: ${error.message}`);
  const tasks = (data ?? []) as Task[];
  const today = todayJakarta();
  const canOpenMeeting = profile.role === "owner" || profile.role === "manager";

  return (
    <div>
      <MeetingTabs active="tugas" showFollowup={profile.role === "owner" || profile.role === "manager"} showTarikan={profile.role === "owner"} />
      <h1 className="text-2xl font-bold">Tugas Saya</h1>
      <p className="mt-1 text-sm text-zinc-600">Tindak lanjut meeting yang ditugaskan kepada Anda, urut tenggat terdekat.</p>
      <p className="mt-2 text-sm">
        <Link href={showDone ? "/tugas" : "/tugas?selesai=1"} className="font-bold text-accent underline">
          {showDone ? "Sembunyikan tugas yang sudah selesai" : "Tampilkan juga tugas yang sudah selesai"}
        </Link>
      </p>

      {tasks.length === 0 && (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          {showDone ? "Belum ada tugas untuk Anda." : "Tidak ada tugas yang belum selesai. 🎉"}
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {tasks.map((t) => {
          const overdue = t.status !== "done" && !!t.due_date && t.due_date < today;
          return (
            <li
              key={t.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${overdue ? "border-red-400 bg-red-50" : "border-zinc-200"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold whitespace-pre-wrap">{t.description}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Dari meeting{" "}
                    {canOpenMeeting ? (
                      <Link href={`/notulensi/${t.meeting_id}`} className="font-bold text-accent underline">
                        {t.meeting_title}
                      </Link>
                    ) : (
                      <b>{t.meeting_title}</b>
                    )}
                    , {formatHariTanggal(dateFromYmd(t.meeting_date))}
                  </p>
                  <p className={`mt-1 text-sm font-bold ${overdue ? "text-red-700" : "text-zinc-700"}`}>
                    Tenggat: {t.due_date ? formatHariTanggal(dateFromYmd(t.due_date)) : "tidak ditentukan"}
                    {overdue && " · LEWAT TENGGAT"}
                  </p>
                </div>
                <ActionStatusSelect itemId={t.id} status={t.status} editable />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
