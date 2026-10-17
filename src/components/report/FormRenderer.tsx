"use client";

// SATU form renderer untuk semua jabatan: membaca roles_config.form_template
// dan menggambar form sesuai PDF contoh di referensi-form/.
// Di layar lebar tampil sebagai tabel; di ponsel baris tabel menjadi kartu
// bertumpuk dengan label kolom yang sama.

import type { CSSProperties, ReactNode } from "react";
import type { Errors, FormState, Row } from "@/lib/report/form-state";
import { MAX_EVIDENCE, NEGATIVE_STATUS, normalizeUrl, splitLinks } from "@/lib/report/form-state";
import type {
  ActivitiesBlock,
  Block,
  ChecklistBlock,
  Column,
  EvidenceBlock,
  FieldType,
  FormTemplate,
  LabelRowsBlock,
  MatrixBlock,
  TableBlock,
} from "@/lib/report/template";

export type SetFormState = (update: (s: FormState) => FormState) => void;

type Ctx = {
  state: FormState;
  set: SetFormState;
  errors: Errors;
  missing: Set<string>;
  readOnly: boolean;
  plain: boolean;
};

export function FormRenderer({
  template,
  state,
  set,
  errors,
  missing,
  readOnly,
  name,
  dateLabel,
}: {
  template: FormTemplate;
  state: FormState;
  set: SetFormState;
  errors: Errors;
  missing: Set<string>;
  readOnly: boolean;
  name: string;
  dateLabel: string;
}) {
  const t = template.theme;
  const plain = !!t.plain;
  const style = {
    "--title": t.title_color,
    "--primary": t.primary_color,
    "--label-bg": t.label_bg,
    "--th-bg": plain ? "#FFFFFF" : t.primary_color,
    "--th-text": plain ? "#000000" : t.table_header_text,
    fontFamily: `${t.font ?? "Arial"}, Helvetica, sans-serif`,
  } as CSSProperties;
  const ctx: Ctx = { state, set, errors, missing, readOnly, plain };

  return (
    <div style={style} className="rounded-xl bg-white p-4 text-[15px] text-black shadow-sm sm:p-8">
      <h1 className="text-xl leading-tight font-bold text-[var(--title)] uppercase sm:text-2xl">{template.title}</h1>

      <div className="mt-3 space-y-1 text-sm">
        {template.show_name !== false && (
          <p>
            {template.name_label ?? "Nama"} : <span className="font-bold">{name}</span>
          </p>
        )}
        <p>
          Hari, Tanggal : <span className="font-bold">{dateLabel}</span>
        </p>
        {template.header_fields.map((f) => {
          const path = `header.${f.key}`;
          return (
            <div key={f.key} className="flex flex-wrap items-center gap-x-2">
              <label htmlFor={path}>{f.label} :</label>
              <input
                id={path}
                value={state.header[f.key] ?? ""}
                onChange={(e) => set((s) => ({ ...s, header: { ...s.header, [f.key]: e.target.value } }))}
                readOnly={readOnly}
                className="min-w-0 flex-1 border-b border-zinc-400 px-1 py-0.5 font-bold outline-none focus:border-[var(--primary)] sm:max-w-sm"
              />
              <FieldNote path={path} ctx={ctx} />
            </div>
          );
        })}
      </div>

      {template.sections.map((section) => (
        <section key={section.key} className="mt-8">
          {section.title && (
            <h2 className="mb-3 text-lg font-bold text-[var(--primary)] sm:text-xl">{section.title}</h2>
          )}
          <div className="space-y-5">
            {section.blocks.map((b, i) => (
              <BlockView key={i} block={b} ctx={ctx} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BlockView({ block, ctx }: { block: Block; ctx: Ctx }) {
  switch (block.type) {
    case "activities":
      return <ActivitiesView block={block} ctx={ctx} />;
    case "checklist":
      return <ChecklistView block={block} ctx={ctx} />;
    case "table":
      return <TableView block={block} ctx={ctx} />;
    case "matrix":
      return <MatrixView block={block} ctx={ctx} />;
    case "label_rows":
      return <LabelRowsView block={block} ctx={ctx} />;
    case "evidence":
      return <EvidenceView block={block} ctx={ctx} />;
  }
}

// ---------- Unsur dasar ----------

const tableCls = "w-full table-fixed border-collapse max-sm:block";
const thCls = "border border-black bg-[var(--th-bg)] px-2 py-1.5 text-left text-sm text-[var(--th-text)]";
const trCls = "max-sm:mb-3 max-sm:block max-sm:border max-sm:border-black";
const tdCls = "border border-black align-top max-sm:block max-sm:border-0 max-sm:border-b max-sm:last:border-b-0";

function Th({ children, plain, className = "" }: { children?: ReactNode; plain: boolean; className?: string }) {
  return <th className={`${thCls} ${plain ? "font-normal" : "font-bold"} ${className}`}>{children}</th>;
}

// Label kolom yang hanya tampil di ponsel (pengganti baris judul tabel).
function MobileLabel({ children }: { children: ReactNode }) {
  return <span className="block px-2 pt-1.5 text-xs font-bold text-[var(--primary)] sm:hidden">{children}</span>;
}

function BlockTitle({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-sm font-bold">{children}</p>;
}

function FieldNote({ path, ctx }: { path: string; ctx: Ctx }) {
  if (ctx.errors[path]) return <span className="block px-2 pb-1 text-xs text-red-700">{ctx.errors[path]}</span>;
  if (ctx.missing.has(path) && !ctx.readOnly)
    return <span className="block px-2 pb-1 text-xs font-bold text-amber-700">Belum lengkap</span>;
  return null;
}

// Link yang terbaca di sebuah isian: tampil sebagai tautan yang bisa diklik (buka di tab baru).
function LinkChips({ value }: { value: string }) {
  const links = splitLinks(value)
    .map((t) => normalizeUrl(t))
    .filter((u): u is string => !!u);
  if (links.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 pb-1 text-xs">
      {links.map((u, i) => (
        <a key={`${u}-${i}`} href={u} target="_blank" rel="noopener noreferrer" className="max-w-full truncate font-bold text-sky-700 underline" title={u}>
          ↗ {u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
        </a>
      ))}
    </span>
  );
}

function CellInput({
  type,
  value,
  onChange,
  ctx,
  path,
  placeholder,
  label,
  single = false,
}: {
  type: FieldType;
  value: string;
  onChange: (v: string) => void;
  ctx: Ctx;
  path: string;
  placeholder?: string;
  label: string;
  single?: boolean; // satu baris saja (mis. satu link bukti per kolom)
}) {
  const invalid = !!ctx.errors[path];
  const cls = `block w-full bg-white px-2 py-1.5 outline-none focus:bg-sky-50 ${invalid ? "bg-red-50" : ""}`;
  // Teks panjang dan link boleh banyak baris (Enter = baris baru; beberapa link, satu per baris).
  const multiline = type === "textarea" || (type === "url" && !single);
  return (
    <>
      {multiline ? (
        <textarea
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={ctx.readOnly}
          placeholder={ctx.readOnly ? undefined : placeholder}
          rows={2}
          className={`${cls} field-sizing-content min-h-[2.75rem] resize-none`}
        />
      ) : (
        <input
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={ctx.readOnly}
          placeholder={ctx.readOnly ? undefined : placeholder}
          inputMode={type === "number" ? "decimal" : type === "url" ? "url" : undefined}
          className={cls}
        />
      )}
      {type === "url" && <LinkChips value={value} />}
      <FieldNote path={path} ctx={ctx} />
    </>
  );
}

function RowButtons({
  ctx,
  onAdd,
  onRemove,
  canRemove,
  addLabel = "+ Tambah baris",
}: {
  ctx: Ctx;
  addLabel?: string;
  onAdd?: () => void;
  onRemove?: () => void;
  canRemove?: boolean;
}) {
  if (ctx.readOnly) return null;
  return (
    <>
      {onRemove && canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Hapus baris"
          title="Hapus baris"
          className="px-2 text-lg leading-none text-zinc-400 hover:text-red-600"
        >
          ×
        </button>
      )}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 rounded-lg border border-dashed border-zinc-400 px-3 py-1.5 text-sm font-bold text-zinc-600 hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          {addLabel}
        </button>
      )}
    </>
  );
}

// Tabel baris berulang (dipakai blok activities dan table).
function RowsTable({
  columns,
  rows,
  basePath,
  ctx,
  onChange,
  onAdd,
  onRemove,
  indexLabel,
  fixed,
  widths,
}: {
  widths?: string[];
  columns: Column[];
  rows: Row[];
  basePath: string;
  ctx: Ctx;
  onChange: (i: number, key: string, v: string) => void;
  onAdd?: () => void;
  onRemove?: (i: number) => void;
  indexLabel?: string;
  fixed?: boolean;
}) {
  const canRemove = !fixed && rows.length > 1;
  return (
    <div>
      <table className={tableCls}>
        <thead className="max-sm:hidden">
          <tr>
            {indexLabel !== undefined && (
              <Th plain={ctx.plain} className={fixed ? "w-12" : ""}>
                {indexLabel}
              </Th>
            )}
            {columns.map((c, ci) => (
              <Th key={c.key} plain={ctx.plain} className={widths?.[ci] ?? ""}>
                {c.label}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody className="max-sm:block">
          {rows.map((r, i) => (
            <tr key={i} className={trCls}>
              {indexLabel !== undefined && (
                <td className={`${tdCls} px-2 py-1.5 max-sm:bg-zinc-50 max-sm:font-bold`}>
                  <span className="sm:hidden">{indexLabel || "No"} </span>
                  {i + 1}
                </td>
              )}
              {columns.map((c, ci) => (
                <td key={c.key} className={`${tdCls} ${ci === columns.length - 1 ? `relative ${!fixed && canRemove && !ctx.readOnly ? "pr-6" : ""}` : ""}`}>
                  {c.type === "fixed_text" ? (
                    <span className="block px-2 py-1.5 max-sm:font-bold">{r[c.key]}</span>
                  ) : (
                    <>
                      <MobileLabel>{c.label || "Catatan lain"}</MobileLabel>
                      <CellInput
                        type={c.type}
                        value={r[c.key] ?? ""}
                        onChange={(v) => onChange(i, c.key, v)}
                        ctx={ctx}
                        path={`${basePath}.${i}.${c.key}`}
                        placeholder={c.placeholder}
                        label={`${c.label || "Catatan"} baris ${i + 1}`}
                      />
                    </>
                  )}
                  {ci === columns.length - 1 && !fixed && (
                    <span className="absolute top-0 right-0">
                      <RowButtons ctx={ctx} onRemove={() => onRemove?.(i)} canRemove={canRemove} />
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!fixed && <RowButtons ctx={ctx} onAdd={onAdd} />}
    </div>
  );
}

const blankRow = (columns: Column[]): Row =>
  Object.fromEntries(columns.filter((c) => c.type !== "fixed_text").map((c) => [c.key, ""]));

// ---------- Blok ----------

function ActivitiesView({ block, ctx }: { block: ActivitiesBlock; ctx: Ctx }) {
  const { set } = ctx;
  return (
    <RowsTable
      // PDF: tabel aktivitas 3 kolom = Jam 25%, Kegiatan 25%, Deskripsi 50%.
      widths={block.columns.length === 3 ? ["w-1/4", "w-1/4", "w-1/2"] : undefined}
      columns={block.columns}
      rows={ctx.state.activities}
      basePath="activities"
      ctx={ctx}
      onChange={(i, key, v) =>
        set((s) => ({ ...s, activities: s.activities.map((r, j) => (j === i ? { ...r, [key]: v } : r)) }))
      }
      onAdd={() => set((s) => ({ ...s, activities: [...s.activities, blankRow(block.columns)] }))}
      onRemove={(i) => set((s) => ({ ...s, activities: s.activities.filter((_, j) => j !== i) }))}
    />
  );
}

function TableView({ block, ctx }: { block: TableBlock; ctx: Ctx }) {
  const { set } = ctx;
  const update = (fn: (rows: Row[]) => Row[]) =>
    set((s) => ({ ...s, tables: { ...s.tables, [block.key]: fn(s.tables[block.key]) } }));
  return (
    <div>
      {block.title && <BlockTitle>{block.title}</BlockTitle>}
      <RowsTable
        columns={block.columns}
        rows={ctx.state.tables[block.key]}
        basePath={`tables.${block.key}`}
        ctx={ctx}
        indexLabel={block.show_index ? (block.index_label ?? "No") : undefined}
        fixed={!!block.fixed_rows?.length}
        // PDF SPV: kolom Kegiatan (teks tetap) lebih sempit dari kolom Review.
        widths={block.columns.map((c) => (c.type === "fixed_text" ? "w-1/4" : ""))}
        onChange={(i, key, v) => update((rows) => rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)))}
        onAdd={() => update((rows) => [...rows, blankRow(block.columns)])}
        onRemove={(i) => update((rows) => rows.filter((_, j) => j !== i))}
      />
    </div>
  );
}

function StatusSelect({
  value,
  options,
  onChange,
  ctx,
  label,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  ctx: Ctx;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={ctx.readOnly}
      className={`cursor-pointer rounded-full border-0 py-1 pr-6 pl-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:cursor-default disabled:opacity-100 ${
        !value
          ? "bg-zinc-200"
          : NEGATIVE_STATUS.includes(value)
            ? "bg-red-100 font-bold text-red-800"
            : "bg-[var(--label-bg)] font-bold"
      }`}
      style={{
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 4l3 3 3-3' fill='none' stroke='%23444' stroke-width='1.5'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.5rem center",
      }}
    >
      <option value="">?</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function ChecklistView({ block, ctx }: { block: ChecklistBlock; ctx: Ctx }) {
  const { state, set } = ctx;
  const update = (key: string, field: "value" | "note", v: string) =>
    set((s) => ({ ...s, checklists: { ...s.checklists, [key]: { ...s.checklists[key], [field]: v } } }));

  return (
    <table className={tableCls}>
      <thead className="max-sm:hidden">
        <tr>
          <Th plain={ctx.plain} className="w-1/3">Metrik Wajib</Th>
          <Th plain={ctx.plain} className="w-1/3">Status</Th>
          <Th plain={ctx.plain}>Keterangan</Th>
        </tr>
      </thead>
      <tbody className="max-sm:block">
        {block.items.map((item) => {
          const v = state.checklists[item.key];
          const valuePath = `checklists.${item.key}.value`;
          const notePath = `checklists.${item.key}.note`;
          return (
            <tr key={item.key} className={trCls}>
              <td className={`${tdCls} px-2 py-1.5 max-sm:bg-zinc-50 max-sm:font-bold`}>{item.label}</td>
              <td className={tdCls}>
                <MobileLabel>Status</MobileLabel>
                {item.kind === "status" ? (
                  <div className="flex flex-col items-center px-2 py-1.5 max-sm:items-start">
                    <StatusSelect
                      value={v.value}
                      options={item.options ?? []}
                      onChange={(x) => update(item.key, "value", x)}
                      ctx={ctx}
                      label={`Status ${item.label}`}
                    />
                    <FieldNote path={valuePath} ctx={ctx} />
                  </div>
                ) : (
                  <div className="flex items-start">
                    {item.unit && <span className="py-1.5 pl-2 text-zinc-500">{item.unit}</span>}
                    <div className="flex-1">
                      <CellInput
                        type={item.kind === "number" ? "number" : "textarea"}
                        value={v.value}
                        onChange={(x) => update(item.key, "value", x)}
                        ctx={ctx}
                        path={valuePath}
                        label={item.label}
                      />
                    </div>
                  </div>
                )}
              </td>
              <td className={tdCls}>
                {item.note.mode !== "none" && <MobileLabel>Keterangan</MobileLabel>}
                {item.note.mode === "static" && <span className="block px-2 py-1.5">{item.note.text}</span>}
                {item.note.mode === "input" && (
                  <div className="flex items-start">
                    {item.note.placeholder && (
                      <span className="py-1.5 pl-2 whitespace-nowrap">{item.note.placeholder}</span>
                    )}
                    <div className="flex-1">
                      <CellInput
                        type={item.note.type === "url" ? "url" : "textarea"}
                        value={v.note}
                        onChange={(x) => update(item.key, "note", x)}
                        ctx={ctx}
                        path={notePath}
                        label={`Keterangan ${item.label}`}
                      />
                    </div>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MatrixView({ block, ctx }: { block: MatrixBlock; ctx: Ctx }) {
  const { state, set } = ctx;
  const entities = state.matrices[block.key];
  const update = (i: number, key: string, v: string) =>
    set((s) => ({
      ...s,
      matrices: { ...s.matrices, [block.key]: s.matrices[block.key].map((r, j) => (j === i ? { ...r, [key]: v } : r)) },
    }));

  const nameInput = (i: number, className: string) => (
    <input
      aria-label={`Nama ${block.entity_label} ${i + 1}`}
      value={entities[i].nama ?? ""}
      onChange={(e) => update(i, "nama", e.target.value)}
      readOnly={ctx.readOnly}
      placeholder="______"
      className={className}
    />
  );

  return (
    <div>
      {block.title && <BlockTitle>{block.title}</BlockTitle>}

      {/* Ponsel: nama entitas diisi di atas tabel */}
      <div className="mb-2 space-y-1 sm:hidden">
        {entities.map((_, i) => (
          <div key={i}>
            <label className="flex items-center gap-2 text-sm font-bold">
              {block.entity_label} {i + 1}:
              {nameInput(i, "min-w-0 flex-1 border-b border-zinc-400 px-1 py-0.5 outline-none focus:border-[var(--primary)]")}
            </label>
            <FieldNote path={`matrices.${block.key}.${i}.nama`} ctx={ctx} />
          </div>
        ))}
      </div>

      <table className={tableCls}>
        <thead className="max-sm:hidden">
          <tr>
            <Th plain={ctx.plain} className="w-1/3">Metrik</Th>
            {entities.map((_, i) => (
              <Th key={i} plain={ctx.plain}>
                <span className="flex items-center gap-1">
                  {block.entity_label} {i + 1}:
                  {nameInput(
                    i,
                    "min-w-0 flex-1 border-b border-current bg-transparent px-1 font-bold text-inherit outline-none placeholder:text-current/70",
                  )}
                </span>
                {ctx.missing.has(`matrices.${block.key}.${i}.nama`) && !ctx.readOnly && (
                  <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 text-xs font-bold text-amber-800">
                    Belum lengkap
                  </span>
                )}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody className="max-sm:block">
          {block.rows.map((row) => (
            <tr key={row.key} className={trCls}>
              <td className={`${tdCls} px-2 py-1.5 max-sm:bg-zinc-50 max-sm:font-bold`}>{row.label}</td>
              {entities.map((entity, i) => {
                const path = `matrices.${block.key}.${i}.${row.key}`;
                return (
                  <td key={i} className={tdCls}>
                    <MobileLabel>
                      {block.entity_label} {i + 1}
                      {entity.nama ? `: ${entity.nama}` : ""}
                    </MobileLabel>
                    <div className="flex items-start">
                      {row.unit && <span className="py-1.5 pl-2 text-zinc-500">{row.unit}</span>}
                      <div className="flex-1">
                        <CellInput
                          type={row.type}
                          value={entity[row.key] ?? ""}
                          onChange={(v) => update(i, row.key, v)}
                          ctx={ctx}
                          path={path}
                          placeholder={row.placeholder}
                          label={`${row.label} ${block.entity_label} ${i + 1}`}
                        />
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LabelRowsView({ block, ctx }: { block: LabelRowsBlock; ctx: Ctx }) {
  const { state, set } = ctx;
  return (
    <table className={tableCls}>
      <tbody className="max-sm:block">
        {block.rows.map((row) => (
          <tr key={row.key} className={trCls}>
            <td
              className={`${tdCls} w-1/3 bg-[var(--label-bg)] px-2 py-1.5 text-sm font-bold max-sm:w-auto`}
            >
              {row.label}
              {row.sublabel && <span className="block font-normal italic">({row.sublabel})</span>}
            </td>
            <td className={tdCls}>
              <CellInput
                type="textarea"
                value={state.labels[row.column]}
                onChange={(v) => set((s) => ({ ...s, labels: { ...s.labels, [row.column]: v } }))}
                ctx={ctx}
                path={`labels.${row.column}`}
                label={row.label}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EvidenceView({ block, ctx }: { block: EvidenceBlock; ctx: Ctx }) {
  const { state, set } = ctx;
  const links = state.evidence;
  return (
    <div>
      <p className="mb-1 text-sm">{block.title ?? "Bukti"}</p>
      <div className="space-y-2">
        {links.map((v, i) => (
          <div key={i} className="flex items-start gap-1">
            <div className="flex-1 border border-black">
              <CellInput
                type="url"
                single
                value={v}
                onChange={(x) => set((s) => ({ ...s, evidence: s.evidence.map((e, j) => (j === i ? x : e)) }))}
                ctx={ctx}
                path={`evidence.${i}`}
                placeholder="Tempel link bukti (Drive, foto, dsb.)"
                label={`Link bukti ${i + 1}`}
              />
            </div>
            <RowButtons
              ctx={ctx}
              canRemove={links.length > 1}
              onRemove={() => set((s) => ({ ...s, evidence: s.evidence.filter((_, j) => j !== i) }))}
            />
          </div>
        ))}
      </div>
      {ctx.errors["evidence"] && <p className="mt-1 text-xs text-red-700">{ctx.errors["evidence"]}</p>}
      {links.length < MAX_EVIDENCE && (
        <RowButtons
          ctx={ctx}
          addLabel="+ Tambah link"
          onAdd={() => set((s) => ({ ...s, evidence: [...s.evidence, ""] }))}
        />
      )}
    </div>
  );
}
