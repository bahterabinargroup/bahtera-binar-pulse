"use client";

import { useState, useTransition } from "react";
import { updateUser, type ActionResult } from "@/app/(app)/owner/actions";
import type { UserRole } from "@/lib/profile";
import { Result } from "./ActionForm";

export type UserRowData = {
  id: string;
  full_name: string;
  email: string;
  employee_code: string | null;
  role: UserRole;
  position_id: number | null;
  lead_position_ids: number[];
  work_start_date: string | null;
  is_active: boolean;
  company_name: string;
};

// Satu baris pengguna: ubah role, jabatan, dan status aktif lalu Simpan.
export function UserRow({
  user,
  positions,
  isSelf,
}: {
  user: UserRowData;
  positions: { id: number; name: string }[];
  isSelf: boolean;
}) {
  const [role, setRole] = useState(user.role);
  const [positionId, setPositionId] = useState(user.position_id ? String(user.position_id) : "");
  const [active, setActive] = useState(user.is_active);
  const [startDate, setStartDate] = useState(user.work_start_date ?? "");
  const [leadIds, setLeadIds] = useState<number[]>(user.lead_position_ids ?? []);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const changed = role !== user.role || positionId !== (user.position_id ? String(user.position_id) : "") || active !== user.is_active || startDate !== (user.work_start_date ?? "") || (role === "lead" && JSON.stringify([...leadIds].sort()) !== JSON.stringify([...(user.lead_position_ids ?? [])].sort()));
  const sel = "rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm disabled:bg-zinc-100";

  return (
    <li className={`py-3 ${user.is_active ? "" : "opacity-70"}`}>
      <p className="font-bold">
        {user.full_name}
        {isSelf && <span className="ml-1 text-xs font-normal text-zinc-500">(Anda)</span>}
        {!user.is_active && <span className="ml-2 rounded bg-zinc-200 px-1.5 text-xs">NONAKTIF</span>}
      </p>
      <p className="text-sm text-zinc-600">
        {user.email} · {user.company_name}
        {user.employee_code ? ` · ${user.employee_code}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} disabled={isSelf} className={sel} aria-label="Role">
          <option value="employee">Karyawan</option>
          <option value="lead">Lead</option>
          <option value="manager">Manager</option>
          <option value="owner">Owner</option>
        </select>
        <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className={sel} aria-label="Jabatan">
          <option value="">— Tanpa jabatan —</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm">
          Mulai kerja
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={sel} aria-label="Tanggal mulai kerja" />
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={isSelf} /> Aktif
        </label>
        <button
          type="button"
          disabled={!changed || pending}
          onClick={() => {
            if (!active && user.is_active && !window.confirm(`Nonaktifkan ${user.full_name}? Ia tidak bisa lagi membuka data apa pun.`)) return;
            start(async () => {
              const res = await updateUser({
                id: user.id,
                role,
                position_id: positionId ? Number(positionId) : null,
                is_active: active,
                lead_position_ids: role === "lead" ? leadIds : [],
                work_start_date: startDate || null,
              });
              setResult(res);
            });
          }}
          className="rounded-lg bg-accent px-3 py-1 text-sm font-bold text-white disabled:opacity-40"
        >
          {pending ? "…" : "Simpan"}
        </button>
        {result && <Result result={result} />}
      </div>
      <p className="mt-1 text-xs text-zinc-600">
        {startDate
          ? `Kuota cuti/izin direset setiap tanggal ${Number(startDate.slice(8, 10))}${Number(startDate.slice(8, 10)) > 1 ? ` (periode ${Number(startDate.slice(8, 10))} sampai ${Number(startDate.slice(8, 10)) - 1} bulan berikutnya)` : ""}.`
          : "Tanggal mulai kerja kosong: kuota cuti/izin direset setiap tanggal 1."}
      </p>
      {role === "lead" && (
        <fieldset className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          <legend className="px-1 text-xs font-bold">Divisi yang dipantau (selain jabatannya sendiri)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {positions
              .filter((p) => String(p.id) !== positionId)
              .map((p) => (
                <label key={p.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={leadIds.includes(p.id)}
                    onChange={(e) => setLeadIds((cur) => (e.target.checked ? [...cur, p.id] : cur.filter((x) => x !== p.id)))}
                  />
                  {p.name}
                </label>
              ))}
          </div>
          <p className="mt-1 text-xs text-zinc-600">Lead selalu melihat karyawan biasa berjabatan sama di company-nya. Contoh: Lead ADV yang membimbing anak Magang Hub centang <b>ADV MH</b>. Lead hanya melihat, tidak mengubah.</p>
        </fieldset>
      )}
    </li>
  );
}
