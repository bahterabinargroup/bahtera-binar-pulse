import { notFound, redirect } from "next/navigation";
import { MeetingEditor } from "@/components/meetings/MeetingEditor";
import { todayJakarta } from "@/lib/date";
import { canEditMeeting } from "@/lib/meetings";
import { loadCompaniesForOwner, loadMeeting, loadPeople } from "@/lib/meetings-server";
import { getCurrentUser } from "@/lib/profile";
import { isUuid } from "@/lib/uuid";

export default async function NotulensiEditPage({ params }: PageProps<"/notulensi/[id]/edit">) {
  const { profile } = await getCurrentUser();
  if (!profile?.company) return null;
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const data = await loadMeeting(id);
  if (!data) notFound();
  // Sudah di-submit / bukan penulis: tampilkan halaman baca saja.
  if (!canEditMeeting(data.meeting, profile.id, profile.role)) redirect(`/notulensi/${id}`);

  const [people, companies] = await Promise.all([loadPeople(), loadCompaniesForOwner(profile)]);
  return (
    <MeetingEditor
      key={id}
      meeting={data.meeting}
      attendees={data.attendees}
      actions={data.actions}
      people={people}
      companies={companies}
      defaultCompanyId={profile.company.id}
      writerName={profile.full_name}
      today={todayJakarta()}
    />
  );
}
