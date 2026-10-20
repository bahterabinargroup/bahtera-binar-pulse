import { categoryLabel, hostOf, LINK_CATEGORIES, type PositionNames, type ResourceLink } from "@/lib/links";

// Daftar tautan dikelompokkan per kategori. Tautan dibuka di tab baru.
// showScope: tampilkan untuk siapa tiap tautan (dipakai Owner/Manager).
export function LinkGroups({
  links,
  showScope = false,
  positionNames = {},
}: {
  links: ResourceLink[];
  showScope?: boolean;
  positionNames?: PositionNames;
}) {
  const groups = LINK_CATEGORIES.map((c) => ({ ...c, items: links.filter((l) => l.category === c.value) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.value}>
          <h3 className="mb-2 text-xs font-bold tracking-wide text-zinc-600 uppercase">
            {categoryLabel(g.value)} <span className="font-normal text-zinc-400">({g.items.length})</span>
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((l) => (
              <li key={l.id}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full items-start justify-between gap-3 rounded-xl border border-zinc-200 border-l-4 border-l-gold bg-white p-3 shadow-sm hover:border-gold hover:shadow-md"
                >
                  <span className="min-w-0">
                    <span className="block font-bold text-accent">{l.title}</span>
                    {l.description && <span className="mt-0.5 block text-sm text-zinc-600">{l.description}</span>}
                    <span className="mt-1 block truncate text-xs text-zinc-400">{hostOf(l.url)}</span>
                    {showScope && (
                      <span className="mt-1 flex flex-wrap gap-1 text-[11px]">
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">{l.company?.name ?? "Semua company"}</span>
                        {l.position_ids.length === 0 ? (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">Semua divisi</span>
                        ) : (
                          l.position_ids.map((id) => (
                            <span key={id} className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                              {positionNames[id] ?? "Divisi"}
                            </span>
                          ))
                        )}
                      </span>
                    )}
                  </span>
                  <span aria-hidden="true" className="text-lg text-gold">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
