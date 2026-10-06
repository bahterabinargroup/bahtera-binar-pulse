// Tipe roles_config.form_template (spesifikasi: schema_daily_report.sql bagian 7).

export type FieldType = "text" | "textarea" | "url" | "number" | "fixed_text";

export type Theme = {
  title_color: string;
  primary_color: string;
  label_bg: string;
  table_header_text: string;
  font?: string;
  plain?: boolean; // SPV: hitam-putih polos
};

export type HeaderField = { key: string; label: string; type: FieldType; required?: boolean };

export type Column = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  optional_column?: boolean;
};

export type ChecklistItem = {
  key: string;
  label: string;
  kind: "status" | "text" | "number";
  options?: string[];
  required?: boolean;
  unit?: string;
  note: { mode: "none" | "static" | "input"; text?: string; type?: "text" | "url"; placeholder?: string };
};

export type MatrixRow = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  unit?: string;
  placeholder?: string;
};

export type LabelColumn = "insights" | "obstacles" | "next_plan";

export type LabelRow = { key: string; label: string; type: FieldType; column: LabelColumn; sublabel?: string };

export type ActivitiesBlock = { type: "activities"; initial_rows?: number; columns: Column[] };
export type ChecklistBlock = { type: "checklist"; items: ChecklistItem[] };
export type TableBlock = {
  type: "table";
  key: string;
  title?: string;
  initial_rows?: number;
  show_index?: boolean;
  index_label?: string;
  fixed_rows?: Record<string, string>[];
  columns: Column[];
};
export type MatrixBlock = {
  type: "matrix";
  key: string;
  title?: string;
  entity_label: string;
  initial_entities?: number;
  max_entities?: number;
  rows: MatrixRow[];
};
export type LabelRowsBlock = { type: "label_rows"; rows: LabelRow[] };
export type EvidenceBlock = { type: "evidence"; title?: string };

export type Block =
  | ActivitiesBlock
  | ChecklistBlock
  | TableBlock
  | MatrixBlock
  | LabelRowsBlock
  | EvidenceBlock;

export type Section = { key: string; title: string | null; blocks: Block[] };

export type FormTemplate = {
  title: string;
  theme: Theme;
  name_label?: string;
  show_name?: boolean;
  header_fields: HeaderField[];
  sections: Section[];
};

export function allBlocks(t: FormTemplate): Block[] {
  return t.sections.flatMap((s) => s.blocks);
}
