"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { correctReport, saveReport } from "@/app/(app)/laporan/actions";
import { formatJam } from "@/lib/date";
import {
  buildFormState,
  missingRequired,
  toReportData,
  validate,
  type Errors,
  type FormState,
  type ReportData,
} from "@/lib/report/form-state";
import type { FormTemplate } from "@/lib/report/template";
import { FormRenderer } from "./FormRenderer";

type Status =
  | { kind: "idle" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string }
  | { kind: "locked"; message: string };

// Form "Laporan Hari Ini": menyimpan isian dan menampilkan status simpan.
// mode "preview" = pratinjau tanpa tombol simpan; "view" = hanya baca (riwayat);
// "correct" = koreksi Owner untuk laporan tanggal berapa pun.
export function ReportForm({
  template,
  name,
  dateLabel,
  reportDate,
  initialReport,
  mode = "edit",
}: {
  template: FormTemplate;
  name: string;
  dateLabel: string;
  reportDate: string;
  initialReport: (ReportData & { id: string; updated_at: string }) | null;
  mode?: "edit" | "preview" | "view" | "correct";
}) {
  const [state, setState] = useState<FormState>(() => buildFormState(template, initialReport));
  const [reportId, setReportId] = useState<string | null>(initialReport?.id ?? null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(state));
  // Kesalahan format baru ditampilkan setelah tombol Simpan ditekan,
  // lalu diperbarui langsung saat isian diperbaiki.
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<Status>(
    initialReport ? { kind: "saved", at: initialReport.updated_at } : { kind: "idle" },
  );
  const [pending, startTransition] = useTransition();

  const locked = status.kind === "locked";
  const dirty = JSON.stringify(state) !== savedSnapshot;
  const missing = useMemo(() => missingRequired(template, state), [template, state]);
  const errors: Errors = useMemo(() => (showErrors ? validate(template, state) : {}), [showErrors, template, state]);

  // Peringatkan bila halaman ditutup sebelum disimpan.
  useEffect(() => {
    if (!dirty || (mode !== "edit" && mode !== "correct")) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, mode]);

  const set = (update: (s: FormState) => FormState) => setState(update);

  const onSave = () => {
    const found = validate(template, state);
    setShowErrors(true);
    if (Object.keys(found).length) {
      setStatus({ kind: "error", message: "Ada isian yang formatnya belum benar (ditandai merah). Perbaiki dulu, lalu simpan lagi." });
      return;
    }
    const snapshot = JSON.stringify(state);
    startTransition(async () => {
      try {
        const data = toReportData(template, state);
        const res =
          mode === "correct" && reportId
            ? await correctReport({ reportId, data })
            : await saveReport({ reportId, reportDate, data });
        if (res.ok) {
          setReportId(res.reportId);
          setSavedSnapshot(snapshot);
          setStatus({ kind: "saved", at: res.savedAt });
        } else {
          setStatus({ kind: res.locked ? "locked" : "error", message: res.error });
        }
      } catch {
        setStatus({ kind: "error", message: "Tidak dapat terhubung ke server. Periksa koneksi internet, lalu tekan Simpan lagi." });
      }
    });
  };

  return (
    <div className="pb-28">
      {locked && (
        <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800">
          🔒 {status.message}
        </p>
      )}

      <FormRenderer
        template={template}
        state={state}
        set={set}
        errors={errors}
        missing={missing}
        readOnly={locked || mode === "view"}
        name={name}
        dateLabel={dateLabel}
      />

      {(mode === "edit" || mode === "correct") && !locked && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 text-sm">
              {status.kind === "error" ? (
                <p role="alert" className="text-red-700">{status.message}</p>
              ) : dirty ? (
                <p className="text-amber-700">Ada perubahan yang belum disimpan.</p>
              ) : status.kind === "saved" ? (
                <p className="text-green-700">✓ Tersimpan pukul {formatJam(status.at)} WIB</p>
              ) : (
                <p className="text-zinc-500">Belum disimpan.</p>
              )}
              {missing.size > 0 && (
                <p className="text-xs text-zinc-500">{missing.size} isian wajib belum lengkap (boleh disimpan dulu).</p>
              )}
            </div>
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="shrink-0 rounded-lg bg-accent px-6 py-2.5 font-bold text-white hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
