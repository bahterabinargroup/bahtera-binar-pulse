import { notFound } from "next/navigation";
import { MeetingEditor } from "@/components/meetings/MeetingEditor";
import { todayJakarta } from "@/lib/date";

// HANYA pengembangan lokal: tampilan form notulensi dengan data rekaan
// (menyimpan akan gagal karena tidak login).
export default function DevNotulensiPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <MeetingEditor
        meeting={null}
        attendees={[]}
        actions={[]}
        people={[
          { id: "1", full_name: "Budi Santoso", company_id: "c1", position: "Advertiser" },
          { id: "2", full_name: "Sari Dewi", company_id: "c1", position: "Content Creator" },
        ]}
        companies={null}
        defaultCompanyId="c1"
        writerName="Contoh Penulis"
        today={todayJakarta()}
      />
    </main>
  );
}
