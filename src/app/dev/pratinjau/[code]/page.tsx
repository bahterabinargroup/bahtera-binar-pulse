import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportForm } from "@/components/report/ReportForm";
import { dateFromYmd, formatHariTanggal, todayJakarta } from "@/lib/date";
import type { FormTemplate } from "@/lib/report/template";

// HANYA untuk pengembangan di komputer lokal (tidak ada di versi tayang):
// menampilkan form langsung dari schema_daily_report.sql tanpa login,
// agar tampilan bisa dicocokkan dengan PDF.
export default async function DevPratinjauPage({ params, searchParams }: PageProps<"/dev/pratinjau/[code]">) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { code } = await params;
  const view = (await searchParams).mode === "view"; // ?mode=view = tampilan hanya baca

  const sql = await readFile(path.join(process.cwd(), "schema_daily_report.sql"), "utf8");
  const templates = [...sql.matchAll(/\('([A-Z_]+)',\s*'[^']*',\s*'[^']*',\s*\d+,\s*\$json\$([\s\S]*?)\$json\$/g)].map(
    (m) => ({ code: m[1], template: JSON.parse(m[2]) as FormTemplate }),
  );
  const selected = templates.find((t) => t.code === code);
  if (!selected) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <nav className="mb-4 flex flex-wrap gap-2 text-sm">
        {templates.map((t) => (
          <Link key={t.code} href={`/dev/pratinjau/${t.code}`} className="rounded border bg-white px-2 py-1">
            {t.code}
          </Link>
        ))}
      </nav>
      <ReportForm
        key={code}
        template={selected.template}
        name="Contoh Nama"
        dateLabel={formatHariTanggal(dateFromYmd(todayJakarta()))}
        reportDate={todayJakarta()}
        initialReport={null}
        mode={view ? "view" : "preview"}
      />
    </main>
  );
}
