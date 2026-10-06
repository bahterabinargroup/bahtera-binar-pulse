import { MeetingEditor } from "@/components/meetings/MeetingEditor";
import { todayJakarta } from "@/lib/date";
import { loadCompaniesForOwner, loadPeople } from "@/lib/meetings-server";
import { getCurrentUser } from "@/lib/profile";

export default async function NotulensiBaruPage() {
  const { profile } = await getCurrentUser();
  if (!profile?.company) return null;
  const [people, companies] = await Promise.all([loadPeople(), loadCompaniesForOwner(profile)]);

  return (
    <MeetingEditor
      meeting={null}
      attendees={[]}
      actions={[]}
      people={people}
      companies={companies}
      defaultCompanyId={profile.company.id}
      writerName={profile.full_name}
      today={todayJakarta()}
    />
  );
}
