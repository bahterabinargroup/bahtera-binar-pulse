-- =====================================================================
-- 012 PEMBATALAN CUTI / IZIN (diajukan karyawan, disetujui atasan)
-- (sama dengan bagian 19 schema_daily_report.sql)
--
-- Keputusan pemilik (14 Okt 2026): karyawan yang sudah disetujui cuti/izin
-- lalu tidak jadi, bisa MENGAJUKAN PEMBATALAN. Yang memutuskan sama seperti
-- pengajuan cuti: Owner (semua); Manager hanya untuk KARYAWAN di company-nya;
-- tidak boleh memutuskan milik sendiri.
-- - Selama pembatalan belum disetujui, cuti/izin TETAP berlaku.
-- - Disetujui: cuti yang belum mulai menjadi "cancelled" (laporan dan presensi
--   kembali wajib). Cuti yang SUDAH berjalan dipotong: tanggal selesai menjadi
--   kemarin (hari yang sudah lewat tetap dihitung cuti).
-- - Ditolak: cuti/izin tetap berlaku; karyawan boleh mengajukan lagi.
-- - Pengajuan yang masih menunggu keputusan tetap bisa dibatalkan langsung.
-- Aman dijalankan ulang.
-- =====================================================================

alter table public.leave_requests add column if not exists cancel_requested_at timestamptz;
alter table public.leave_requests add column if not exists cancel_reason text;
alter table public.leave_requests add column if not exists cancel_outcome text;
alter table public.leave_requests add column if not exists cancel_decided_by uuid references public.users (id) on delete set null;
alter table public.leave_requests add column if not exists cancel_decided_at timestamptz;
alter table public.leave_requests add column if not exists cancel_note text;

alter table public.leave_requests drop constraint if exists leave_requests_cancel_ok;
alter table public.leave_requests add constraint leave_requests_cancel_ok check (
  (cancel_outcome is null or cancel_outcome in ('approved', 'rejected'))
  and (cancel_reason is null or (length(btrim(cancel_reason)) > 0 and length(cancel_reason) <= 1000))
  and (cancel_note is null or length(cancel_note) <= 500)
);

comment on column public.leave_requests.cancel_requested_at is 'Waktu karyawan mengajukan pembatalan. Pembatalan menunggu keputusan bila cancel_requested_at terisi dan cancel_outcome kosong.';

-- Pembatalan langsung hanya untuk pengajuan yang MASIH MENUNGGU keputusan
create or replace function public.cancel_leave(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.leave_requests;
begin
  select * into r from public.leave_requests where id = p_id for update;
  if not found or r.user_id is distinct from auth.uid() then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  if r.status <> 'pending' then
    raise exception 'Pengajuan yang sudah disetujui dibatalkan lewat pengajuan pembatalan.' using errcode = '22023';
  end if;
  update public.leave_requests set status = 'cancelled', updated_at = now() where id = p_id;
end;
$$;

revoke all on function public.cancel_leave(uuid) from public, anon;
grant execute on function public.cancel_leave(uuid) to authenticated;

-- Karyawan mengajukan pembatalan untuk cuti/izin yang sudah disetujui dan belum berakhir
create or replace function public.request_leave_cancel(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.leave_requests;
begin
  select * into r from public.leave_requests where id = p_id for update;
  if not found or r.user_id is distinct from auth.uid() then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  if r.status <> 'approved' then
    raise exception 'Pembatalan hanya untuk cuti/izin yang sudah disetujui.' using errcode = '22023';
  end if;
  if r.end_date < public.today_jakarta() then
    raise exception 'Cuti/izin ini sudah berakhir.' using errcode = '22023';
  end if;
  if r.cancel_requested_at is not null and r.cancel_outcome is null then
    raise exception 'Pengajuan pembatalan sudah dikirim dan menunggu keputusan.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Alasan pembatalan wajib diisi.' using errcode = '22023';
  end if;
  if length(p_reason) > 1000 then
    raise exception 'Alasan terlalu panjang.' using errcode = '22023';
  end if;
  update public.leave_requests
     set cancel_requested_at = now(),
         cancel_reason = btrim(p_reason),
         cancel_outcome = null,
         cancel_decided_by = null,
         cancel_decided_at = null,
         cancel_note = null,
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.request_leave_cancel(uuid, text) from public, anon;
grant execute on function public.request_leave_cancel(uuid, text) to authenticated;

-- Keputusan atas pengajuan pembatalan: aturan sama dengan decide_leave
create or replace function public.decide_leave_cancel(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.leave_requests;
  me_role public.user_role := (select public.current_user_role());
  me_company uuid := (select public.current_company_id());
  req_role public.user_role;
  today date := public.today_jakarta();
begin
  if auth.uid() is null or me_role is null then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  select * into r from public.leave_requests where id = p_id for update;
  if not found then
    raise exception 'Pengajuan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if r.status <> 'approved' or r.cancel_requested_at is null or r.cancel_outcome is not null then
    raise exception 'Tidak ada pengajuan pembatalan yang menunggu keputusan.' using errcode = '22023';
  end if;
  if r.user_id = auth.uid() then
    raise exception 'Tidak boleh memutuskan pengajuan sendiri.' using errcode = '42501';
  end if;
  select u.role into req_role from public.users u where u.id = r.user_id;
  if not (
    me_role = 'owner'
    or (me_role = 'manager' and r.company_id = me_company and req_role = 'employee')
  ) then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  if r.end_date < today then
    raise exception 'Cuti/izin ini sudah berakhir.' using errcode = '22023';
  end if;

  if p_approve then
    if r.start_date >= today then
      -- belum mulai: batal seluruhnya
      update public.leave_requests
         set status = 'cancelled',
             cancel_outcome = 'approved', cancel_decided_by = auth.uid(), cancel_decided_at = now(),
             cancel_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
       where id = p_id;
    else
      -- sudah berjalan: dipotong sampai kemarin (hari yang lewat tetap dihitung cuti)
      update public.leave_requests
         set end_date = today - 1,
             cancel_outcome = 'approved', cancel_decided_by = auth.uid(), cancel_decided_at = now(),
             cancel_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
       where id = p_id;
    end if;
  else
    update public.leave_requests
       set cancel_outcome = 'rejected', cancel_decided_by = auth.uid(), cancel_decided_at = now(),
           cancel_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
     where id = p_id;
  end if;
end;
$$;

revoke all on function public.decide_leave_cancel(uuid, boolean, text) from public, anon;
grant execute on function public.decide_leave_cancel(uuid, boolean, text) to authenticated;
