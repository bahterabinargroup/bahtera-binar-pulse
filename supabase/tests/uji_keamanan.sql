-- =====================================================================
-- UJI KEAMANAN (RLS) — DAILY REPORT
-- Jalankan di Supabase SQL Editor. AMAN: seluruh skrip adalah satu blok yang
-- SELALU berakhir dengan error disengaja, sehingga SEMUA data uji (company,
-- akun, laporan, notulensi rekaan) otomatis DIBATALKAN. Data asli tidak berubah.
--
-- Hasil muncul sebagai pesan "error" berisi daftar LULUS / GAGAL.
-- Skrip meniru tiap peran (Owner, Manager, Karyawan, akun tanpa undangan)
-- dengan peran database "authenticated" + klaim JWT, lalu mencoba hal-hal yang
-- seharusnya DIIZINKAN dan DILARANG.
-- =====================================================================

create or replace function pg_temp.t_as(p uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $f$;

create or replace function pg_temp.t_line(no int, nama text, ok boolean, info text) returns text language sql as $f$
  select lpad(no::text, 2, '0') || ' | ' || case when ok then 'LULUS' else '>>> GAGAL <<<' end
         || ' | ' || nama || ' | ' || coalesce(info, '') || E'\n'
$f$;

do $test$
declare
  today date := public.today_jakarta();
  ca uuid := gen_random_uuid(); cb uuid := gen_random_uuid();
  uo uuid := gen_random_uuid(); ma uuid := gen_random_uuid(); mb uuid := gen_random_uuid();
  ea1 uuid := gen_random_uuid(); ea2 uuid := gen_random_uuid();
  eb1 uuid := gen_random_uuid(); eb2 uuid := gen_random_uuid();
  gh uuid := gen_random_uuid();
  p_adv int; p_rnd int; p_cc int; p_am int;
  m1 uuid; m2 uuid; m3 uuid; m4 uuid; a1 uuid; a2 uuid;
  l1 uuid; l2 uuid; l3 uuid; l4 uuid; l5 uuid; l6 uuid; t1 uuid;
  r_a1_today uuid; r_a1_past uuid; r_a2_past uuid; r_b1 uuid;
  n int; n2 int; n3 bigint; n4 int; n5 int; n6 int;
  st text; t text; ts timestamptz;
  res text := '';
begin
  -- ---------- Persiapan data rekaan (sebagai postgres) ----------
  select id into p_adv from public.roles_config where code = 'ADV';
  select id into p_rnd from public.roles_config where code = 'RND';
  select id into p_cc  from public.roles_config where code = 'CC';
  select id into p_am  from public.roles_config where code = 'AM';

  insert into public.companies (id, code, name) values (ca, 'UJI_A', 'Uji Company A'), (cb, 'UJI_B', 'Uji Company B');

  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  select x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', x.em, now(), now(), now()
  from (values
    (uo,  'uji.owner@example.invalid'),
    (ma,  'uji.manager.a@example.invalid'),
    (mb,  'uji.manager.b@example.invalid'),
    (ea1, 'uji.karyawan.a1@example.invalid'),
    (ea2, 'uji.karyawan.a2@example.invalid'),
    (eb1, 'uji.karyawan.b1@example.invalid'),
    (eb2, 'uji.karyawan.b2@example.invalid'),
    (gh,  'uji.tanpa.undangan@example.invalid')
  ) as x(id, em);

  insert into public.users (id, company_id, position_id, role, full_name, email) values
    (uo,  ca, null,  'owner',    'Uji Owner',        'uji.owner@example.invalid'),
    (ma,  ca, p_adv, 'manager',  'Uji Manager A',    'uji.manager.a@example.invalid'),
    (mb,  cb, p_adv, 'manager',  'Uji Manager B',    'uji.manager.b@example.invalid'),
    (ea1, ca, p_adv, 'employee', 'Uji Karyawan A1',  'uji.karyawan.a1@example.invalid'),
    (ea2, ca, p_rnd, 'employee', 'Uji Karyawan A2',  'uji.karyawan.a2@example.invalid'),
    (eb1, cb, p_am,  'employee', 'Uji Karyawan B1',  'uji.karyawan.b1@example.invalid'),
    (eb2, cb, p_cc,  'employee', 'Uji Karyawan B2',  'uji.karyawan.b2@example.invalid');
  -- gh (akun tanpa undangan) sengaja TIDAK punya profil.

  insert into public.daily_reports (company_id, user_id, report_date) values (ca, ea1, today)   returning id into r_a1_today;
  insert into public.daily_reports (company_id, user_id, report_date) values (ca, ea1, today-1) returning id into r_a1_past;
  insert into public.daily_reports (company_id, user_id, report_date) values (ca, ea2, today-1) returning id into r_a2_past;
  insert into public.daily_reports (company_id, user_id, report_date) values (cb, eb1, today)   returning id into r_b1;

  insert into public.meetings (company_id, created_by, title, meeting_date) values (ca, ea1, 'Rapat uji A1', today) returning id into m1;
  insert into public.meetings (company_id, created_by, title, meeting_date) values (cb, mb,  'Rapat uji B',  today) returning id into m2;
  insert into public.meetings (company_id, created_by, title, meeting_date) values (ca, ea1, 'Rapat uji hapus', today) returning id into m3;
  insert into public.meetings (company_id, created_by, title, meeting_date) values (ca, ea1, 'Rapat uji peserta', today) returning id into m4;
  insert into public.meeting_attendees (meeting_id, user_id, name) values (m1, ea2, 'x'), (m3, ea2, 'x');
  insert into public.meeting_action_items (meeting_id, description, assignee_id, due_date) values (m1, 'Tugas uji 1', ea2, today+3) returning id into a1;
  insert into public.meeting_action_items (meeting_id, description, assignee_id, due_date) values (m3, 'Tugas uji 2', ea2, today+5) returning id into a2;

  -- Tautan penting (butuh supabase/005 dan 006 sudah dijalankan)
  insert into public.resource_links (company_id, category, title, url) values (ca, 'tracker', 'L1 company A, semua divisi', 'https://example.com/1') returning id into l1;
  insert into public.resource_links (company_id, position_ids, category, title, url) values (ca, array[p_adv]::smallint[], 'aset', 'L2 company A, ADV', 'https://example.com/2') returning id into l2;
  insert into public.resource_links (company_id, position_ids, category, title, url) values (ca, array[p_rnd]::smallint[], 'sop', 'L3 company A, RND', 'https://example.com/3') returning id into l3;
  insert into public.resource_links (company_id, category, title, url) values (cb, 'tracker', 'L4 company B, semua divisi', 'https://example.com/4') returning id into l4;
  insert into public.resource_links (company_id, category, title, url) values (null, 'lainnya', 'L5 semua company', 'https://example.com/5') returning id into l5;
  insert into public.resource_links (company_id, position_ids, category, title, url) values (ca, array[p_adv, p_cc]::smallint[], 'aset', 'L6 company A, ADV dan CC', 'https://example.com/6') returning id into l6;

  -- Target omzet (butuh supabase/007_target_omzet.sql sudah dijalankan)
  insert into public.omzet_targets (company_id, user_id, month, amount) values (ca, ea1, date_trunc('month', today)::date, 50000000) returning id into t1;
  insert into public.omzet_targets (company_id, user_id, month, amount) values (ca, ea2, date_trunc('month', today)::date, 30000000);
  insert into public.omzet_targets (company_id, user_id, month, amount) values (cb, eb1, date_trunc('month', today)::date, 40000000);

  -- =====================================================================
  -- LAPORAN HARIAN
  -- =====================================================================

  -- 01. Karyawan tidak bisa melihat laporan karyawan lain
  perform pg_temp.t_as(ea1);
  select count(*) into n  from public.daily_reports where user_id = ea1;
  select count(*) into n2 from public.daily_reports where user_id = ea2;
  select count(*) into n3 from public.daily_reports where user_id = eb1;
  select count(*) into n4 from public.daily_reports where id = r_a2_past;
  reset role;
  res := res || pg_temp.t_line(1, 'Karyawan tidak bisa melihat laporan karyawan lain (rekan, company lain, lewat id/URL)',
    n = 2 and n2 = 0 and n3 = 0 and n4 = 0, format('milik sendiri=%s, rekan=%s, company lain=%s, lewat id=%s', n, n2, n3, n4));

  -- 02. Manager hanya melihat company-nya
  perform pg_temp.t_as(ma);
  select count(*) into n  from public.daily_reports where company_id = ca;
  select count(*) into n2 from public.daily_reports where company_id = cb;
  select count(*) into n3 from public.daily_reports where id = r_b1;
  select count(*) into n4 from public.users where company_id = cb;
  select count(*) into n5 from public.companies;
  select count(*) into n6 from public.users where company_id = ca;
  reset role;
  res := res || pg_temp.t_line(2, 'Manager hanya melihat laporan/karyawan/company miliknya, tidak bisa membuka company lain',
    n = 3 and n2 = 0 and n3 = 0 and n4 = 0 and n5 = 1 and n6 = 4,
    format('laporan company sendiri=%s, company lain=%s, lewat id=%s, karyawan company lain=%s, company terlihat=%s', n, n2, n3, n4, n5));
  perform pg_temp.t_as(mb);
  select count(*) into n  from public.daily_reports where company_id = cb;
  select count(*) into n2 from public.daily_reports where company_id = ca;
  reset role;
  res := res || pg_temp.t_line(2, 'Manager company B: simetris (hanya company B)', n = 1 and n2 = 0, format('sendiri=%s, company lain=%s', n, n2));

  -- 03. Owner melihat semua & bisa mengoreksi laporan lampau
  perform pg_temp.t_as(uo);
  select count(*) into n  from public.companies where id in (ca, cb);
  select count(*) into n2 from public.daily_reports where id in (r_a1_today, r_a1_past, r_a2_past, r_b1);
  update public.daily_reports set obstacles = 'dikoreksi owner' where id = r_a1_past;
  get diagnostics n3 = row_count;
  reset role;
  res := res || pg_temp.t_line(3, 'Owner melihat semua company/laporan dan bisa mengoreksi laporan lampau',
    n = 2 and n2 = 4 and n3 = 1, format('company=%s, laporan=%s, koreksi lampau=%s baris', n, n2, n3));

  -- 04. Laporan lampau tidak bisa diedit; tanggal lain tidak bisa dibuat; kolom identitas terkunci
  perform pg_temp.t_as(ea1);
  update public.daily_reports set obstacles = 'x' where id = r_a1_past;
  get diagnostics n = row_count;
  reset role;
  perform pg_temp.t_as(ma);
  update public.daily_reports set obstacles = 'x' where id = r_a1_past;
  get diagnostics n2 = row_count;
  update public.daily_reports set obstacles = 'x' where id = r_a1_today;
  get diagnostics n3 = row_count;
  reset role;
  res := res || pg_temp.t_line(4, 'Employee & Manager tidak bisa mengedit laporan kemarin; Manager tidak bisa mengedit laporan orang lain',
    n = 0 and n2 = 0 and n3 = 0, format('employee kemarin=%s, manager kemarin=%s, manager hari ini milik orang lain=%s baris terubah', n, n2, n3));

  begin
    perform pg_temp.t_as(eb2);
    insert into public.daily_reports (company_id, user_id, report_date) values (cb, eb2, today - 1);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(4, 'Tidak bisa membuat laporan untuk tanggal kemarin', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(eb2);
    insert into public.daily_reports (company_id, user_id, report_date) values (cb, eb2, today + 1);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(4, 'Tidak bisa membuat laporan untuk tanggal besok', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    update public.daily_reports set report_date = today + 5 where id = r_a1_today;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(4, 'Tanggal laporan tidak bisa dipindah (kolom report_date terkunci)', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    update public.daily_reports set user_id = ea2 where id = r_a1_today;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(4, 'Pemilik laporan tidak bisa dialihkan ke orang lain (kolom user_id terkunci)', st = '42501', 'hasil=' || st);

  -- 05. Satu laporan per karyawan per hari
  begin
    perform pg_temp.t_as(ea1);
    insert into public.daily_reports (company_id, user_id) values (ca, ea1);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(5, 'Laporan kedua pada hari yang sama ditolak (duplikat)', st = '23505', 'hasil=' || st);

  begin
    perform pg_temp.t_as(eb2);
    insert into public.daily_reports (company_id, user_id) values (cb, ea1);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(5, 'Tidak bisa membuat laporan atas nama orang lain', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(eb2);
    insert into public.daily_reports (company_id, user_id) values (ca, eb2);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(5, 'Tidak bisa membuat laporan dengan company yang bukan company-nya', st = '42501', 'hasil=' || st);

  -- 06. Email tanpa undangan tidak punya akses
  select count(*) into n from public.users where id = gh;
  perform pg_temp.t_as(gh);
  select count(*) into n2 from public.users;
  select count(*) into n3 from public.companies;
  select count(*) into n4 from public.daily_reports;
  select count(*) into n5 from public.meetings;
  select count(*) into n6 from public.user_invites;
  reset role;
  res := res || pg_temp.t_line(6, 'Akun tanpa undangan: tidak punya profil dan tidak melihat data apa pun',
    n = 0 and n2 = 0 and n3 = 0 and n4 = 0 and n5 = 0 and n6 = 0,
    format('profil=%s, users=%s, companies=%s, laporan=%s, notulensi=%s, undangan=%s', n, n2, n3, n4, n5, n6));

  begin
    perform pg_temp.t_as(gh);
    insert into public.daily_reports (company_id, user_id) values (ca, gh);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(6, 'Akun tanpa undangan tidak bisa membuat laporan', st = '42501' or st = '23503', 'hasil=' || st);

  begin
    perform pg_temp.t_as(gh);
    insert into public.meetings (company_id, created_by, title) values (ca, gh, 'bobol');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(6, 'Akun tanpa undangan tidak bisa membuat notulensi', st = '42501' or st = '23503', 'hasil=' || st);

  perform pg_temp.t_as(gh);
  select count(*) into n from public.roles_config;
  reset role;
  res := res || pg_temp.t_line(6, 'Akun tanpa undangan tidak bisa membaca daftar jabatan/template form', n = 0, format('terbaca=%s baris', n));

  -- 07. Karyawan tidak melihat dashboard kepatuhan; Manager hanya company-nya
  perform pg_temp.t_as(ea1);
  select count(*) into n  from public.get_missing_reports();
  select count(*) into n2 from public.get_weekly_report_compliance();
  reset role;
  res := res || pg_temp.t_line(7, 'Karyawan mendapat daftar kosong dari dashboard kepatuhan', n = 0 and n2 = 0,
    format('belum mengisi=%s, kepatuhan=%s', n, n2));

  perform pg_temp.t_as(ma);
  select count(*) into n  from public.get_missing_reports() where company_id = cb;
  select count(*) into n2 from public.get_missing_reports() where user_id = ea2;
  select count(*) into n3 from public.get_weekly_report_compliance() where company_id = cb;
  select count(*) into n4 from public.get_weekly_report_compliance();
  reset role;
  res := res || pg_temp.t_line(7, 'Manager hanya melihat kepatuhan company-nya (tidak ada company lain)',
    n = 0 and n2 = 1 and n3 = 0 and (n4 >= 3 or extract(isodow from today) = 7), format('belum mengisi company lain=%s, rekan yang belum mengisi=%s, kepatuhan company lain=%s, total baris=%s', n, n2, n3, n4));

  perform pg_temp.t_as(uo);
  select count(*) into n from public.get_missing_reports() where company_id in (ca, cb);
  reset role;
  res := res || pg_temp.t_line(7, 'Owner melihat kepatuhan semua company', n >= 4, format('baris belum mengisi=%s', n));

  -- 08. Pencegahan kenaikan hak akses
  perform pg_temp.t_as(ea1);
  update public.users set role = 'owner' where id = ea1;
  get diagnostics n = row_count;
  reset role;
  select role::text into t from public.users where id = ea1;
  res := res || pg_temp.t_line(8, 'Karyawan tidak bisa menaikkan role-nya sendiri menjadi Owner', n = 0 and t = 'employee', format('baris terubah=%s, role sekarang=%s', n, t));

  perform pg_temp.t_as(ma);
  update public.users set company_id = cb where id = ma;
  get diagnostics n = row_count;
  update public.companies set name = 'dibajak' where id = ca;
  get diagnostics n2 = row_count;
  reset role;
  res := res || pg_temp.t_line(8, 'Manager tidak bisa mengubah company profilnya atau mengubah data company', n = 0 and n2 = 0, format('baris terubah=%s dan %s', n, n2));

  begin
    perform pg_temp.t_as(ea1);
    insert into public.user_invites (email, company_id, role, full_name) values ('a@example.invalid', ca, 'owner', 'x');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(8, 'Karyawan tidak bisa membuat undangan (apalagi sebagai Owner)', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    insert into public.companies (code, name) values ('BAJAK', 'Bajak');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(8, 'Karyawan tidak bisa membuat company', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    delete from public.daily_reports where id = r_a1_today;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(8, 'Laporan tidak bisa dihapus lewat aplikasi (tidak ada hak hapus)', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(ma);
  select count(*) into n from public.user_invites;
  begin
    update public.roles_config set name = name where code = 'ADV';
    get diagnostics n2 = row_count;
  exception when others then
    n2 := case when sqlstate = '42501' then 0 else -1 end;   -- ditolak = aman
  end;
  reset role;
  res := res || pg_temp.t_line(8, 'Manager tidak melihat daftar undangan dan tidak bisa mengubah template form (jabatan)', n = 0 and n2 = 0, format('undangan terlihat=%s, template terubah=%s baris', n, n2));

  perform pg_temp.t_as(ea1);
  select count(*) into n from public.v_weekly_team_reports where user_id <> ea1;
  select count(*) into n2 from public.v_weekly_team_reports where user_id = ea1;
  reset role;
  res := res || pg_temp.t_line(8, 'Tarikan mingguan untuk karyawan hanya berisi laporannya sendiri', n = 0 and n2 = 2, format('milik orang lain=%s, milik sendiri=%s', n, n2));

  -- =====================================================================
  -- NOTULENSI
  -- =====================================================================

  -- 09. Siapa melihat notulensi
  perform pg_temp.t_as(ea1);  select count(*) into n  from public.meetings where id = m1;
  reset role;
  perform pg_temp.t_as(ea2);
  select count(*) into n2 from public.meetings where id in (m1, m2, m3, m4);
  select count(*) into n3 from public.meeting_attendees where meeting_id in (m1, m3);
  select count(*) into n4 from public.meeting_action_items;
  reset role;
  perform pg_temp.t_as(ma);   select count(*) into n5 from public.meetings where id in (m1, m3, m4);  select count(*) into n6 from public.meetings where id = m2;
  reset role;
  res := res || pg_temp.t_line(9, 'Karyawan hanya melihat notulensi buatannya; rekan se-company tidak melihat; Manager melihat se-company saja',
    n = 1 and n2 = 0 and n3 = 0 and n5 = 3 and n6 = 0,
    format('pembuat=%s, rekan=%s, peserta terlihat rekan=%s, manager A (company sendiri)=%s, manager A (company B)=%s', n, n2, n3, n5, n6));
  res := res || pg_temp.t_line(9, 'Karyawan PIC hanya melihat tugasnya sendiri, bukan tugas lain', n4 = 2, format('tugas terlihat=%s', n4));

  perform pg_temp.t_as(mb);  select count(*) into n from public.meetings where id in (m1, m3, m4);  select count(*) into n2 from public.meetings where id = m2;
  reset role;
  perform pg_temp.t_as(uo);  select count(*) into n3 from public.meetings where id in (m1, m2, m3, m4);
  reset role;
  res := res || pg_temp.t_line(9, 'Manager company B tidak melihat notulensi company A; Owner melihat semuanya',
    n = 0 and n2 = 1 and n3 = 4, format('manager B -> company A=%s, company B=%s; owner=%s', n, n2, n3));

  -- 10. Pembuatan notulensi
  begin
    perform pg_temp.t_as(ma);
    insert into public.meetings (company_id, created_by, title, visibility) values (ca, ma, 'holding', 'holding');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(10, 'Manager tidak bisa membuat notulensi "Seluruh holding"', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    insert into public.meetings (company_id, created_by, title, visibility) values (ca, ea1, 'holding', 'holding');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(10, 'Karyawan tidak bisa membuat notulensi "Seluruh holding"', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    insert into public.meetings (company_id, created_by, title) values (cb, ea1, 'company lain');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(10, 'Karyawan tidak bisa membuat notulensi di company lain', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    insert into public.meetings (company_id, created_by, title) values (ca, ea2, 'atas nama orang lain');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(10, 'Tidak bisa membuat notulensi atas nama orang lain', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(ea1);
  insert into public.meetings (company_id, created_by, created_by_name, title) values (ca, ea1, 'Nama Palsu', 'nama penulis') returning created_by_name into t;
  reset role;
  res := res || pg_temp.t_line(10, 'Karyawan bisa membuat notulensi; nama penulis tidak bisa dipalsukan', t = 'Uji Karyawan A1', 'nama tersimpan=' || coalesce(t, '-'));

  -- 11. Tugas (PIC)
  perform pg_temp.t_as(ea2);
  update public.meeting_action_items set status = 'in_progress' where id = a1;
  get diagnostics n = row_count;
  reset role;
  res := res || pg_temp.t_line(11, 'PIC bisa mengubah status tugasnya sendiri', n = 1, format('baris terubah=%s', n));

  begin
    perform pg_temp.t_as(ea2);
    update public.meeting_action_items set description = 'diubah PIC' where id = a1;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(11, 'PIC tidak bisa mengubah deskripsi tugas', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea2);
    update public.meeting_action_items set due_date = today + 30 where id = a1;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(11, 'PIC tidak bisa mengubah tenggat', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea2);
    update public.meeting_action_items set assignee_id = ea1 where id = a1;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(11, 'PIC tidak bisa melempar tugas ke orang lain', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(ea2);
  select count(*) into n from public.get_my_action_items();
  select count(*) into n2 from public.meetings where id = m1;
  update public.meeting_action_items set status = 'done' where id = a1;
  select count(*) into n3 from public.get_my_action_items();
  select count(*) into n4 from public.get_my_action_items(true);
  reset role;
  select completed_at into ts from public.meeting_action_items where id = a1;
  res := res || pg_temp.t_line(11, '"Tugas saya" menampilkan tugas PIC tanpa membuka isi notulensi; status selesai tercatat waktunya',
    n = 2 and n2 = 0 and n3 = 1 and n4 = 2 and ts is not null,
    format('tugas=%s, notulensi terbaca=%s, setelah selesai=%s, dengan selesai=%s, waktu selesai terisi=%s', n, n2, n3, n4, ts is not null));

  perform pg_temp.t_as(ma);
  update public.meeting_action_items set status = 'open' where id = a1;
  get diagnostics n = row_count;
  reset role;
  res := res || pg_temp.t_line(11, 'Manager yang bukan PIC/pembuat tidak bisa mengubah status tugas orang lain', n = 0, format('baris terubah=%s', n));

  -- 12. Draft -> Submit -> terkunci
  perform pg_temp.t_as(ea1);
  update public.meetings set title = 'Rapat uji A1 (diedit)' where id = m1;
  get diagnostics n = row_count;
  update public.meetings set submitted_at = '2000-01-01' where id = m1;
  get diagnostics n2 = row_count;
  select submitted_at into ts from public.meetings where id = m1;
  reset role;
  res := res || pg_temp.t_line(12, 'Pembuat bisa mengedit draft lalu Submit; waktu Submit selalu dari server (tidak bisa dipalsukan)',
    n = 1 and n2 = 1 and ts > now() - interval '5 minutes', format('edit draft=%s, submit=%s, waktu submit wajar=%s', n, n2, ts > now() - interval '5 minutes'));

  perform pg_temp.t_as(ea1);
  update public.meetings set title = 'diubah setelah submit' where id = m1;
  get diagnostics n = row_count;
  update public.meetings set submitted_at = null where id = m1;
  get diagnostics n2 = row_count;
  reset role;
  res := res || pg_temp.t_line(12, 'Setelah Submit, pembuat tidak bisa mengedit atau membuka kembali', n = 0 and n2 = 0, format('edit=%s, buka kembali=%s baris terubah', n, n2));

  perform pg_temp.t_as(ma);
  update public.meetings set title = 'diubah manager' where id = m1;
  get diagnostics n = row_count;
  reset role;
  perform pg_temp.t_as(uo);
  update public.meetings set title = 'Rapat uji A1 (koreksi owner)' where id = m1;
  get diagnostics n2 = row_count;
  reset role;
  res := res || pg_temp.t_line(12, 'Manager tidak bisa mengedit notulensi orang lain; Owner masih bisa mengoreksi setelah Submit', n = 0 and n2 = 1, format('manager=%s, owner=%s baris terubah', n, n2));

  begin
    perform pg_temp.t_as(ea1);
    insert into public.meeting_attendees (meeting_id, user_id, name) values (m1, ea1, 'x');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(12, 'Setelah Submit, pembuat tidak bisa menambah peserta', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(ea1);
  update public.meeting_action_items set description = 'diubah pembuat' where id = a1;
  get diagnostics n = row_count;
  delete from public.meeting_action_items where id = a1;
  get diagnostics n2 = row_count;
  reset role;
  res := res || pg_temp.t_line(12, 'Setelah Submit, pembuat tidak bisa mengubah/menghapus tindak lanjut', n = 0 and n2 = 0, format('ubah=%s, hapus=%s baris', n, n2));

  -- 13. Hapus notulensi hanya Owner
  perform pg_temp.t_as(ea1);   delete from public.meetings where id = m3;   get diagnostics n = row_count;
  reset role;
  perform pg_temp.t_as(ma);    delete from public.meetings where id = m3;   get diagnostics n2 = row_count;
  reset role;
  perform pg_temp.t_as(ea2);   delete from public.meetings where id = m3;   get diagnostics n3 = row_count;
  reset role;
  res := res || pg_temp.t_line(13, 'Pembuat, Manager, dan karyawan lain tidak bisa menghapus notulensi', n = 0 and n2 = 0 and n3 = 0, format('pembuat=%s, manager=%s, rekan=%s baris terhapus', n, n2, n3));
  perform pg_temp.t_as(uo);    delete from public.meetings where id = m3;   get diagnostics n = row_count;
  reset role;
  select count(*) into n2 from public.meeting_attendees where meeting_id = m3;
  select count(*) into n3 from public.meeting_action_items where meeting_id = m3;
  res := res || pg_temp.t_line(13, 'Owner bisa menghapus; peserta dan tindak lanjutnya ikut terhapus', n = 1 and n2 = 0 and n3 = 0, format('terhapus=%s, sisa peserta=%s, sisa tugas=%s', n, n2, n3));

  -- 14. Peserta / PIC
  begin
    perform pg_temp.t_as(ea1);
    insert into public.meeting_attendees (meeting_id, user_id, name) values (m4, eb1, 'x');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(14, 'Peserta dari company lain ditolak (non-Owner)', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    insert into public.meeting_action_items (meeting_id, description, assignee_id) values (m4, 'tugas', eb1);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(14, 'PIC dari company lain ditolak (non-Owner)', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(ea1);
  insert into public.meeting_attendees (meeting_id, user_id, name) values (m4, ea2, 'Nama Palsu') returning name into t;
  insert into public.meeting_attendees (meeting_id, name) values (m4, 'Tamu Uji');
  select count(*) into n from public.meeting_attendees where meeting_id = m4;
  reset role;
  res := res || pg_temp.t_line(14, 'Nama peserta karyawan selalu dari profil (tidak bisa dipalsukan); tamu tanpa akun boleh', t = 'Uji Karyawan A2' and n = 2, format('nama tersimpan=%s, jumlah peserta=%s', t, n));

  begin
    perform pg_temp.t_as(ea2);
    insert into public.meeting_attendees (meeting_id, name) values (m4, 'Penyusup');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(14, 'Orang yang bukan pembuat tidak bisa menambah peserta', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(uo);
  insert into public.meeting_attendees (meeting_id, user_id, name) values (m4, eb1, 'x');
  reset role;
  res := res || pg_temp.t_line(14, 'Owner boleh menambah peserta dari company lain (pengecualian Owner)', true, 'berhasil');

  -- 15. Permintaan hapus (perlu persetujuan Owner)
  begin
    perform pg_temp.t_as(ma);
    perform public.request_meeting_deletion(m4, 'alasan');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(15, 'Manager yang bukan pembuat tidak bisa mengajukan hapus', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    perform public.request_meeting_deletion(m4, '   ');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(15, 'Permintaan hapus tanpa alasan ditolak', st = '22023', 'hasil=' || st);

  perform pg_temp.t_as(ea1);
  perform public.request_meeting_deletion(m4, 'salah buat');
  select count(*) into n from public.meetings where id = m4;
  select count(*) into n2 from public.meetings where id = m4 and delete_requested_at is not null;
  reset role;
  res := res || pg_temp.t_line(15, 'Pembuat bisa mengajukan hapus; notulensi TETAP ADA sampai Owner menyetujui', n = 1 and n2 = 1, format('notulensi masih ada=%s, tertandai permintaan hapus=%s', n, n2));

  begin
    perform pg_temp.t_as(ea1);
    update public.meetings set delete_requested_at = null where id = m4;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(15, 'Kolom permintaan hapus tidak bisa diubah langsung (hanya lewat fungsi resmi)', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea2);
    perform public.cancel_meeting_deletion(m4);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(15, 'Orang lain tidak bisa membatalkan permintaan hapus milik pembuat', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(ea1);
  perform public.cancel_meeting_deletion(m4);
  reset role;
  select count(*) into n from public.meetings where id = m4 and delete_requested_at is null;
  perform pg_temp.t_as(ea1);
  perform public.request_meeting_deletion(m4, 'ajukan lagi');
  reset role;
  perform pg_temp.t_as(uo);
  perform public.cancel_meeting_deletion(m4);
  reset role;
  select count(*) into n2 from public.meetings where id = m4 and delete_requested_at is null;
  res := res || pg_temp.t_line(15, 'Pembuat bisa membatalkan; Owner bisa menolak permintaan hapus', n = 1 and n2 = 1, format('batal pembuat=%s, tolak owner=%s', n, n2));

  -- =====================================================================
  -- TAUTAN PENTING
  -- =====================================================================

  -- 16. Siapa melihat tautan
  perform pg_temp.t_as(ea1);
  select count(*) into n  from public.resource_links where id in (l1, l2, l5, l6);
  select count(*) into n2 from public.resource_links where id in (l3, l4);
  reset role;
  res := res || pg_temp.t_line(16, 'Karyawan ADV (company A) melihat tautan untuk semua divisi, ADV (juga yang untuk ADV dan CC), dan semua company; tidak melihat RND atau company lain', n = 4 and n2 = 0, format('terlihat=%s, tidak seharusnya=%s', n, n2));

  perform pg_temp.t_as(ea2);
  select count(*) into n  from public.resource_links where id in (l1, l3, l5);
  select count(*) into n2 from public.resource_links where id in (l2, l4, l6);
  reset role;
  res := res || pg_temp.t_line(16, 'Karyawan RND melihat tautan RND, bukan tautan ADV atau ADV+CC', n = 3 and n2 = 0, format('terlihat=%s, tidak seharusnya=%s', n, n2));

  perform pg_temp.t_as(eb1);
  select count(*) into n  from public.resource_links where id in (l4, l5);
  select count(*) into n2 from public.resource_links where id in (l1, l2, l3);
  reset role;
  res := res || pg_temp.t_line(16, 'Karyawan company B hanya melihat tautan company B dan tautan semua company', n = 2 and n2 = 0, format('terlihat=%s, company A=%s', n, n2));

  perform pg_temp.t_as(ma);
  select count(*) into n  from public.resource_links where id in (l1, l2, l3, l5, l6);
  select count(*) into n2 from public.resource_links where id = l4;
  reset role;
  res := res || pg_temp.t_line(16, 'Manager melihat semua tautan company-nya (semua divisi) dan tautan semua company, bukan company lain', n = 5 and n2 = 0, format('terlihat=%s, company lain=%s', n, n2));

  perform pg_temp.t_as(uo);
  select count(*) into n from public.resource_links where id in (l1, l2, l3, l4, l5, l6);
  reset role;
  res := res || pg_temp.t_line(16, 'Owner melihat semua tautan', n = 6, format('terlihat=%s', n));

  perform pg_temp.t_as(eb2);
  select count(*) into n from public.resource_links where id = l6;
  reset role;
  res := res || pg_temp.t_line(16, 'Divisi yang tercantum di tautan tidak cukup: karyawan CC company B tetap tidak melihat tautan company A', n = 0, format('terlihat=%s', n));

  perform pg_temp.t_as(gh);
  select count(*) into n from public.resource_links;
  reset role;
  res := res || pg_temp.t_line(16, 'Akun tanpa undangan tidak melihat tautan apa pun', n = 0, format('terlihat=%s', n));

  -- 17. Siapa mengelola tautan
  begin
    perform pg_temp.t_as(ea1);
    insert into public.resource_links (company_id, title, url) values (ca, 'bobol', 'https://example.com/x');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(17, 'Karyawan tidak bisa menambah tautan', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(ea1);
  update public.resource_links set title = 'dibajak' where id = l1;
  get diagnostics n = row_count;
  delete from public.resource_links where id = l1;
  get diagnostics n2 = row_count;
  reset role;
  res := res || pg_temp.t_line(17, 'Karyawan tidak bisa mengubah atau menghapus tautan', n = 0 and n2 = 0, format('ubah=%s, hapus=%s baris', n, n2));

  perform pg_temp.t_as(ma);
  insert into public.resource_links (company_id, title, url, created_by, created_by_name) values (ca, 'Link Manager A', 'https://example.com/m', ea1, 'Nama Palsu') returning created_by_name into t;
  reset role;
  res := res || pg_temp.t_line(17, 'Manager bisa menambah tautan untuk company-nya; nama pembuat tidak bisa dipalsukan', t = 'Uji Manager A', 'nama tersimpan=' || coalesce(t, '-'));

  begin
    perform pg_temp.t_as(ma);
    insert into public.resource_links (company_id, title, url) values (cb, 'company lain', 'https://example.com/y');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(17, 'Manager tidak bisa menambah tautan untuk company lain', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ma);
    insert into public.resource_links (company_id, title, url) values (null, 'semua company', 'https://example.com/z');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(17, 'Manager tidak bisa membuat tautan "semua company" (hanya Owner)', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(ma);
  update public.resource_links set title = 'diubah manager' where id = l1;
  get diagnostics n = row_count;
  update public.resource_links set title = 'diubah manager' where id = l4;
  get diagnostics n2 = row_count;
  update public.resource_links set title = 'diubah manager' where id = l5;
  get diagnostics n3 = row_count;
  reset role;
  res := res || pg_temp.t_line(17, 'Manager bisa mengubah tautan company-nya; tidak bisa mengubah tautan company lain atau "semua company"', n = 1 and n2 = 0 and n3 = 0, format('company sendiri=%s, company lain=%s, semua company=%s baris', n, n2, n3));

  begin
    perform pg_temp.t_as(ma);
    update public.resource_links set company_id = cb where id = l2;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(17, 'Manager tidak bisa memindahkan tautan ke company lain', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ma);
    update public.resource_links set created_by = ea1 where id = l1;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(17, 'Pembuat tautan tidak bisa diubah (kolom terkunci)', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(ma);
  delete from public.resource_links where id = l2;
  get diagnostics n = row_count;
  delete from public.resource_links where id = l4;
  get diagnostics n2 = row_count;
  reset role;
  res := res || pg_temp.t_line(17, 'Manager bisa menghapus tautan company-nya, tidak bisa menghapus milik company lain', n = 1 and n2 = 0, format('sendiri=%s, company lain=%s baris', n, n2));

  begin
    perform pg_temp.t_as(uo);
    insert into public.resource_links (company_id, title, url) values (null, 'alamat berbahaya', 'javascript:alert(1)');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(17, 'Alamat bukan http/https ditolak (mis. javascript:)', st = '23514', 'hasil=' || st);

  perform pg_temp.t_as(uo);
  insert into public.resource_links (company_id, title, url) values (null, 'tautan owner', 'https://example.com/o');
  update public.resource_links set title = 'diubah owner' where id = l4;
  get diagnostics n = row_count;
  reset role;
  res := res || pg_temp.t_line(17, 'Owner bisa membuat tautan "semua company" dan mengubah tautan company mana pun', n = 1, format('ubah=%s baris', n));

  -- =====================================================================
  -- TARGET OMZET
  -- =====================================================================

  -- 18. Siapa melihat target
  perform pg_temp.t_as(ea1);
  select count(*) into n from public.omzet_targets;
  select count(*) into n2 from public.omzet_targets where user_id = ea1;
  reset role;
  res := res || pg_temp.t_line(18, 'Karyawan hanya melihat target milik dirinya sendiri', n = 1 and n2 = 1, format('terlihat=%s, milik sendiri=%s', n, n2));

  perform pg_temp.t_as(ma);
  select count(*) into n from public.omzet_targets where company_id = ca;
  select count(*) into n2 from public.omzet_targets where company_id = cb;
  reset role;
  res := res || pg_temp.t_line(18, 'Manager melihat semua target di company-nya, tidak company lain', n = 2 and n2 = 0, format('company sendiri=%s, company lain=%s', n, n2));

  perform pg_temp.t_as(uo);
  select count(*) into n from public.omzet_targets where company_id in (ca, cb);
  reset role;
  res := res || pg_temp.t_line(18, 'Owner melihat semua target', n = 3, format('terlihat=%s', n));

  perform pg_temp.t_as(gh);
  select count(*) into n from public.omzet_targets;
  reset role;
  res := res || pg_temp.t_line(18, 'Akun tanpa undangan tidak melihat target', n = 0, format('terlihat=%s', n));

  -- 19. Siapa menetapkan target
  begin
    perform pg_temp.t_as(ma);
    insert into public.omzet_targets (company_id, user_id, month, amount) values (ca, ma, date_trunc('month', today + 40)::date, 1000);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(19, 'Manager tidak bisa menetapkan target', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    insert into public.omzet_targets (company_id, user_id, month, amount) values (ca, ea1, date_trunc('month', today + 40)::date, 1000);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(19, 'Karyawan tidak bisa menetapkan target untuk dirinya', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(ea1);
  update public.omzet_targets set amount = 999999999 where id = t1;
  get diagnostics n = row_count;
  delete from public.omzet_targets where id = t1;
  get diagnostics n2 = row_count;
  reset role;
  res := res || pg_temp.t_line(19, 'Karyawan tidak bisa mengubah atau menghapus targetnya', n = 0 and n2 = 0, format('ubah=%s, hapus=%s baris', n, n2));

  perform pg_temp.t_as(ma);
  update public.omzet_targets set amount = 1 where id = t1;
  get diagnostics n = row_count;
  delete from public.omzet_targets where id = t1;
  get diagnostics n2 = row_count;
  reset role;
  res := res || pg_temp.t_line(19, 'Manager tidak bisa mengubah atau menghapus target', n = 0 and n2 = 0, format('ubah=%s, hapus=%s baris', n, n2));

  perform pg_temp.t_as(uo);
  update public.omzet_targets set amount = 55000000 where id = t1;
  get diagnostics n = row_count;
  reset role;
  select amount::bigint into n3 from public.omzet_targets where id = t1;
  res := res || pg_temp.t_line(19, 'Owner bisa mengubah target', n = 1 and n3 = 55000000, format('ubah=%s, nilai=%s', n, n3));

  begin
    perform pg_temp.t_as(uo);
    insert into public.omzet_targets (company_id, user_id, month, amount) values (ca, ea1, date_trunc('month', today)::date, 1);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(19, 'Satu ADV hanya punya satu target per bulan', st = '23505', 'hasil=' || st);

  begin
    perform pg_temp.t_as(uo);
    insert into public.omzet_targets (company_id, user_id, month, amount) values (cb, ea2, date_trunc('month', today + 40)::date, 1);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(19, 'Target tidak bisa memakai company yang berbeda dari company ADV-nya', st = '23503', 'hasil=' || st);

  begin
    perform pg_temp.t_as(uo);
    insert into public.omzet_targets (company_id, user_id, month, amount) values (ca, ea2, date_trunc('month', today + 40)::date + 5, 1);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(19, 'Bulan target harus tanggal 1', st = '23514', 'hasil=' || st);

  begin
    perform pg_temp.t_as(uo);
    insert into public.omzet_targets (company_id, user_id, month, amount) values (ca, ea2, date_trunc('month', today + 40)::date, -5);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(19, 'Target negatif ditolak', st = '23514', 'hasil=' || st);

  -- =====================================================================
  -- PRESENSI (butuh supabase/008_presensi.sql sudah dijalankan)
  -- =====================================================================

  -- 20. Check-In
  begin
    perform pg_temp.t_as(ea1);
    insert into public.presensi (company_id, user_id, status) values (ca, ea1, 'wfo');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  select position_id, check_in_at into n, ts from public.presensi where user_id = ea1 and attendance_date = today;
  res := res || pg_temp.t_line(20, 'Karyawan bisa Check-In; jabatan terisi otomatis dan jam masuk dari server', st = 'OK' and n = p_adv and ts > now() - interval '1 minute', format('hasil=%s, jabatan=%s', st, n));

  begin
    perform pg_temp.t_as(ea1);
    insert into public.presensi (company_id, user_id, status) values (ca, ea1, 'wfo');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(20, 'Check-In kedua pada hari yang sama ditolak', st = '23505', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea2);
    insert into public.presensi (company_id, user_id, status) values (ca, ea1, 'wfo');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(20, 'Tidak bisa Check-In atas nama orang lain', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea2);
    insert into public.presensi (company_id, user_id, status) values (cb, ea2, 'wfo');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(20, 'Tidak bisa Check-In dengan company yang bukan company-nya', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea2);
    insert into public.presensi (company_id, user_id, status) values (ca, ea2, 'izin');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(20, 'Izin tanpa catatan ditolak', st = '23514', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea2);
    insert into public.presensi (company_id, user_id, status, note) values (ca, ea2, 'tugas_luar', '   ');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(20, 'Tugas Luar dengan catatan kosong/spasi ditolak', st = '23514', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea2);
    insert into public.presensi (company_id, user_id, status) values (ca, ea2, 'wfo_bahtera');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(20, 'Status lama WFO per tempat (wfo_bahtera) tidak berlaku lagi', st = '23514', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea2);
    insert into public.presensi (company_id, user_id, status) values (ca, ea2, 'bolos');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(20, 'Status di luar daftar ditolak', st = '23514', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea2);
    insert into public.presensi (company_id, user_id, status, check_in_lat, check_in_lng) values (ca, ea2, 'wfo', 123, 10);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(20, 'Koordinat GPS di luar jangkauan ditolak', st = '23514', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea2);
    insert into public.presensi (company_id, user_id, status, check_out_photo_path) values (ca, ea2, 'wfo', 'x.jpg');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(20, 'Kolom pulang tidak bisa diisi saat Check-In', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(gh);
    insert into public.presensi (company_id, user_id, status) values (ca, gh, 'wfo');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(20, 'Akun tanpa undangan tidak bisa Check-In', st = '42501', 'hasil=' || st);

  -- Izin/Sakit otomatis Check-Out; Tugas Luar wajib foto (data uji dihapus lagi agar hitungan di bawah tetap)
  begin
    perform pg_temp.t_as(eb2);
    insert into public.presensi (company_id, user_id, status, note) values (cb, eb2, 'sakit', 'demam');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  select check_out_at into ts from public.presensi where user_id = eb2 and attendance_date = today;
  res := res || pg_temp.t_line(20, 'Sakit/Izin: Check-Out tercatat otomatis (tanpa foto pulang)', st = 'OK' and ts is not null, format('hasil=%s, otomatis pulang=%s', st, ts is not null));
  delete from public.presensi where user_id = eb2;

  begin
    perform pg_temp.t_as(eb2);
    insert into public.presensi (company_id, user_id, status, note) values (cb, eb2, 'tugas_luar', 'diminta klien');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(20, 'Tugas Luar tanpa foto bukti ditolak', st = '23514', 'hasil=' || st);

  begin
    perform pg_temp.t_as(eb2);
    insert into public.presensi (company_id, user_id, status, note, check_in_photo_path) values (cb, eb2, 'tugas_luar', 'diminta klien', cb::text || '/' || eb2::text || '/bukti.jpg');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  select check_out_at into ts from public.presensi where user_id = eb2 and attendance_date = today;
  res := res || pg_temp.t_line(20, 'Tugas Luar dengan foto bukti diterima; belum otomatis pulang', st = 'OK' and ts is null, format('hasil=%s, pulang kosong=%s', st, ts is null));
  delete from public.presensi where user_id = eb2;

  begin
    perform pg_temp.t_as(eb2);
    insert into public.presensi (company_id, user_id, status) values (cb, eb2, 'wfo');
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  select check_out_at into ts from public.presensi where user_id = eb2 and attendance_date = today;
  res := res || pg_temp.t_line(20, 'WFO tanpa foto diterima; belum otomatis pulang', st = 'OK' and ts is null, format('hasil=%s, pulang kosong=%s', st, ts is null));
  delete from public.presensi where user_id = eb2;

  -- 21. Check-Out
  perform pg_temp.t_as(ea2);
  update public.presensi set check_out_lat = -6.2, check_out_lng = 106.8, check_out_photo_path = 'x.jpg'
    where user_id = ea2 and attendance_date = today;
  get diagnostics n = row_count;
  reset role;
  res := res || pg_temp.t_line(21, 'Check-Out tanpa Check-In hari itu tidak mengubah apa pun', n = 0, format('baris terubah=%s', n));

  begin
    perform pg_temp.t_as(ea1);
    update public.presensi set check_out_lat = -6.2, check_out_lng = 106.8 where user_id = ea1 and attendance_date = today;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  select check_out_at into ts from public.presensi where user_id = ea1 and attendance_date = today;
  res := res || pg_temp.t_line(21, 'Tanpa foto, jam pulang tidak tercatat', ts is null, format('hasil=%s, jam pulang kosong=%s', st, ts is null));

  perform pg_temp.t_as(ea1);
  update public.presensi set check_out_lat = -6.2, check_out_lng = 106.8, check_out_photo_path = ca::text || '/' || ea1::text || '/pulang.jpg'
    where user_id = ea1 and attendance_date = today;
  get diagnostics n = row_count;
  reset role;
  select check_out_at into ts from public.presensi where user_id = ea1 and attendance_date = today;
  res := res || pg_temp.t_line(21, 'Check-Out dengan foto berhasil; jam pulang dari server', n = 1 and ts > now() - interval '1 minute', format('baris=%s', n));

  perform pg_temp.t_as(ea1);
  update public.presensi set check_out_lat = -1, check_out_lng = -1, check_out_photo_path = 'lain.jpg'
    where user_id = ea1 and attendance_date = today;
  get diagnostics n = row_count;
  reset role;
  res := res || pg_temp.t_line(21, 'Check-Out hanya sekali (setelah pulang terkunci)', n = 0, format('baris terubah=%s', n));

  begin
    perform pg_temp.t_as(ea1);
    update public.presensi set status = 'sakit' where user_id = ea1 and attendance_date = today;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(21, 'Data Check-In (status, jam masuk, lokasi) tidak bisa diubah', st = '42501', 'hasil=' || st);

  insert into public.presensi (company_id, user_id, status, attendance_date) values (ca, ea2, 'wfo', today - 1);
  perform pg_temp.t_as(ea2);
  update public.presensi set check_out_lat = -6.2, check_out_lng = 106.8, check_out_photo_path = 'k.jpg'
    where user_id = ea2 and attendance_date = today - 1;
  get diagnostics n = row_count;
  reset role;
  res := res || pg_temp.t_line(21, 'Presensi hari lampau terkunci (tidak bisa Check-Out belakangan)', n = 0, format('baris terubah=%s', n));

  begin
    perform pg_temp.t_as(ea1);
    delete from public.presensi where user_id = ea1;
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(21, 'Presensi tidak bisa dihapus lewat aplikasi (tidak ada hak hapus)', st = '42501', 'hasil=' || st);

  -- 22. Siapa melihat presensi
  insert into public.presensi (company_id, user_id, status) values (cb, eb1, 'wfo');

  perform pg_temp.t_as(ea1);
  select count(*) into n from public.presensi;
  reset role;
  res := res || pg_temp.t_line(22, 'Karyawan hanya melihat presensi sendiri', n = 1, format('terlihat=%s', n));

  perform pg_temp.t_as(ma);
  select count(*) into n from public.presensi where company_id = ca and attendance_date = today;
  select count(*) into n2 from public.presensi where company_id = cb;
  reset role;
  res := res || pg_temp.t_line(22, 'Manager melihat presensi company-nya, tidak company lain', n = 1 and n2 = 0, format('company sendiri=%s, company lain=%s', n, n2));

  perform pg_temp.t_as(uo);
  select count(*) into n from public.presensi where company_id in (ca, cb) and attendance_date = today;
  reset role;
  res := res || pg_temp.t_line(22, 'Owner melihat presensi semua company', n = 2, format('terlihat=%s', n));

  perform pg_temp.t_as(gh);
  select count(*) into n from public.presensi;
  reset role;
  res := res || pg_temp.t_line(22, 'Akun tanpa undangan tidak melihat presensi', n = 0, format('terlihat=%s', n));

  -- 23. Foto (bucket privat)
  select (public = false and file_size_limit <= 524288)::int into n from storage.buckets where id = 'presensi';
  res := res || pg_temp.t_line(23, 'Bucket foto presensi ada, privat, dan dibatasi ukurannya', n = 1, format('ok=%s', n));

  begin
    perform pg_temp.t_as(ea1);
    insert into storage.objects (bucket_id, name, owner_id) values ('presensi', ca::text || '/' || ea1::text || '/masuk-uji.jpg', ea1::text);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(23, 'Karyawan bisa mengunggah foto ke folder sendiri', st = 'OK', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    insert into storage.objects (bucket_id, name, owner_id) values ('presensi', ca::text || '/' || ea2::text || '/curang.jpg', ea1::text);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(23, 'Karyawan tidak bisa mengunggah ke folder orang lain', st = '42501', 'hasil=' || st);

  begin
    perform pg_temp.t_as(ea1);
    insert into storage.objects (bucket_id, name, owner_id) values ('presensi', cb::text || '/' || ea1::text || '/curang.jpg', ea1::text);
    st := 'OK';
  exception when others then st := sqlstate; end;
  reset role;
  res := res || pg_temp.t_line(23, 'Karyawan tidak bisa mengunggah ke folder company lain', st = '42501', 'hasil=' || st);

  perform pg_temp.t_as(ea2);
  select count(*) into n from storage.objects where bucket_id = 'presensi';
  reset role;
  res := res || pg_temp.t_line(23, 'Karyawan lain tidak melihat foto orang lain', n = 0, format('terlihat=%s', n));

  -- Supabase menolak DELETE langsung ke storage.objects (42501) bagi siapa pun; 0 baris terhapus juga dianggap aman.
  perform pg_temp.t_as(ea1);
  select count(*) into n from storage.objects where bucket_id = 'presensi';
  begin
    delete from storage.objects where bucket_id = 'presensi';
    get diagnostics n2 = row_count;
    st := 'OK';
  exception when others then st := sqlstate; n2 := 0; end;
  reset role;
  res := res || pg_temp.t_line(23, 'Pemilik melihat fotonya sendiri tetapi tidak bisa menghapus', n = 1 and n2 = 0 and st in ('OK', '42501'), format('terlihat=%s, terhapus=%s, hasil=%s', n, n2, st));

  perform pg_temp.t_as(ma);
  select count(*) into n from storage.objects where bucket_id = 'presensi';
  reset role;
  res := res || pg_temp.t_line(23, 'Manager melihat foto company-nya', n = 1, format('terlihat=%s', n));

  perform pg_temp.t_as(mb);
  select count(*) into n from storage.objects where bucket_id = 'presensi';
  reset role;
  res := res || pg_temp.t_line(23, 'Manager company lain tidak melihat foto company A', n = 0, format('terlihat=%s', n));

  -- Owner sungguhan juga melihat foto asli di bucket, jadi hitung hanya foto uji (berdasarkan nama folder uji).
  perform pg_temp.t_as(uo);
  select count(*) into n from storage.objects where bucket_id = 'presensi' and name like ca::text || '/%';
  select count(*) into n2 from storage.objects where bucket_id = 'presensi';
  reset role;
  res := res || pg_temp.t_line(23, 'Owner melihat semua foto (termasuk foto uji company A)', n = 1 and n2 >= 1, format('foto uji=%s, total terlihat=%s', n, n2));

  -- =====================================================================
  -- RINGKASAN (error disengaja agar semua data uji otomatis dibatalkan)
  -- =====================================================================
  n := (length(res) - length(replace(res, 'GAGAL', ''))) / 5;
  raise exception E'\n=== HASIL PENGUJIAN KEAMANAN ===\n%\nRINGKASAN: % skenario GAGAL.\n(Error ini disengaja: semua data uji sudah dibatalkan.)', res, n;
end $test$;
