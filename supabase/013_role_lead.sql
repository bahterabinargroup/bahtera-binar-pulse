-- =====================================================================
-- 013 ROLE BARU "lead" (langkah 1 dari 2; lanjutkan dengan 014)
-- Urutan wewenang (keputusan pemilik 15 Okt 2026): Owner > Manager > Lead > Karyawan.
-- Di divisi ADV MH, Mentor = Lead (jabatan ADV MH); anak Magang Hub = karyawan biasa.
-- File ini HANYA menambah nilai "lead" pada daftar role. Dijalankan TERPISAH dan
-- lebih dulu, karena nilai baru baru boleh dipakai setelah perubahan ini tersimpan.
-- Aman dijalankan ulang.
-- =====================================================================

alter type public.user_role add value if not exists 'lead' before 'employee';
