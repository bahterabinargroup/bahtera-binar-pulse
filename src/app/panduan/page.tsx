import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Panduan · Bahtera Binar Pulse" };

// Panduan pemakaian untuk karyawan, Manager, dan Owner.
// Halaman ini PUBLIK (tanpa login) agar bisa dibagikan bersama link undangan.
const SECTIONS: { id: string; title: string; badge?: string; body: React.ReactNode }[] = [
  {
    id: "masuk",
    title: "1. Pertama kali masuk",
    body: (
      <>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Admin mengirim <b>link undangan</b> lewat WhatsApp atau email. Buka link itu di ponsel atau komputer Anda.</li>
          <li>Klik tombol <b>&quot;Lanjutkan &amp; buat password&quot;</b>.</li>
          <li>Ketik password baru (minimal 8 karakter), ulangi sekali, lalu klik <b>Simpan password</b>. Ikon mata 👁 menampilkan atau menyembunyikan tulisannya.</li>
          <li>Selesai. Anda langsung masuk dan melihat Beranda.</li>
        </ol>
        <Tip>
          Link undangan hanya bisa dipakai <b>sekali</b> dan ada batas waktunya. Kalau muncul pesan &quot;kedaluwarsa&quot;, minta admin
          mengirim link baru.
        </Tip>
        <p className="mt-3">
          <b>Masuk di hari berikutnya:</b> buka alamat aplikasi, isi email dan password, lalu klik <b>Masuk</b>.
        </p>
        <p className="mt-3">
          <b>Pasang di layar utama ponsel</b> supaya mudah dibuka seperti aplikasi: di Chrome (Android) ketuk menu <b>⋮</b>, lalu
          <b> Tambahkan ke layar utama</b>. Di Safari (iPhone) ketuk tombol <b>Bagikan</b>, lalu <b>Tambah ke Layar Utama</b>. Setelah itu muncul ikon perahu Bahtera Binar Pulse di layar ponsel.
        </p>
      </>
    ),
  },
  {
    id: "laporan",
    title: "2. Mengisi Laporan Hari Ini",
    body: (
      <>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Di Beranda, ketuk <b>Laporan Hari Ini</b>. Form yang muncul otomatis sesuai <b>jabatan</b> Anda.</li>
          <li>Isi bagian demi bagian: Aktivitas, Input Wajib Harian, lalu Review dan Kendala.</li>
          <li>Laporan <b>tersimpan otomatis</b> beberapa detik setelah Anda berhenti mengetik. Di bagian bawah layar muncul tulisan hijau <b>&quot;✓ Tersimpan otomatis pukul ...&quot;</b>. Anda juga bisa mengetuk <b>Simpan</b> kapan saja.</li>
          <li>Anda boleh mengisi <b>sedikit demi sedikit</b> sepanjang hari, tidak perlu menunggu selesai.</li>
        </ol>
        <h4 className="mt-4 font-bold text-accent">Hal yang perlu diketahui</h4>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Tombol &quot;+ Tambah baris&quot;</b> menambah baris aktivitas. Tanda <b>×</b> menghapus baris. Baris yang kosong semua tidak ikut tersimpan.</li>
          <li><b>Status</b> (Sudah / Belum): ketuk kotak kecil bertanda &quot;?&quot; lalu pilih. Pilihan <b>Belum</b> tampil merah dan tetap boleh disimpan.</li>
          <li><b>&quot;Belum lengkap&quot;</b> (tulisan kuning) artinya isian wajib masih kosong. Laporan tetap bisa disimpan, tetapi usahakan dilengkapi.</li>
          <li><b>Angka</b> boleh ditulis seperti <code>1.500.000</code> atau <code>Rp 1.500.000</code>. <b>Link</b> boleh ditulis tanpa <code>https://</code>, misalnya <code>drive.google.com/...</code>. Di kolom Keterangan atau Link, tekan <b>Enter</b> untuk menulis link kedua di baris baru. Link yang terbaca tampil di bawah kolom sebagai tautan yang bisa diketuk untuk membukanya. Kalau formatnya salah, kolomnya ditandai merah beserta penjelasannya.</li>
          <li><b>Hanya hari ini.</b> Laporan hanya bisa dibuat dan diubah pada tanggal hari ini (WIB). Mulai besok, laporan itu <b>terkunci</b>. Kalau terlupa, minta Owner mengoreksinya.</li>
          <li>Kalau tanggal berganti saat Anda masih mengetik, muncul pesan &quot;Hari sudah berganti, laporan ini terkunci&quot;. Tulisan Anda <b>tidak dihapus</b>, jadi bisa disalin dulu.</li>
          <li>Kolom yang biasanya sama setiap hari (misalnya <b>Toko</b>, <b>Mentor</b>, <b>ADV / Tim</b>, dan nama toko di tabel per toko) <b>terisi otomatis</b> dari laporan Anda sebelumnya. Cukup periksa, ubah kalau berbeda. Angka dan status tidak ikut terisi.</li>
          <li>Kalau ada angka atau link yang formatnya salah, penyimpanan otomatis menunggu sampai Anda memperbaikinya (ketuk <b>Simpan</b> untuk melihat kolom mana yang salah).</li>
        </ul>
        <Tip>Isi laporan sedikit demi sedikit sepanjang hari lebih mudah daripada sekaligus di akhir hari.</Tip>
      </>
    ),
  },
  {
    id: "presensi",
    title: "Presensi: Check-In dan Check-Out",
    body: (
      <>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Buka menu <b>Presensi</b>. Pilih <b>status</b> (WFO, Tugas Luar, Izin, atau Sakit), tulis catatan bila diminta, lalu tekan <b>Check-In</b>. Sore hari, ambil foto selfie dan tekan <b>Check-Out</b>.</li>
          <li><b>WFO wajib di lokasi kantor.</b> Check-In dan Check-Out WFO hanya bisa dilakukan dalam <b>radius 15 meter</b> dari titik absen kantor Anda. Layar menampilkan jarak Anda, misalnya &quot;Anda 8 m dari Kantor 1. Bisa absen&quot;. Bila terlalu jauh, tombol tidak aktif.</li>
          <li><b>Tugas Luar wajib di tujuan yang sudah didaftarkan.</b> Check-In dan Check-Out Tugas Luar hanya bisa dalam radius titik tujuan (bawaan 50 meter), misalnya &quot;Redigma&quot;. Bila tujuan Anda belum terdaftar, minta Owner atau Manager mendaftarkannya <b>sebelum berangkat</b>.</li>
          <li>Izin dan Sakit <b>tidak dibatasi</b> lokasi.</li>
        </ol>
        <Tip>
          Bila muncul &quot;Akurasi GPS kurang tepat&quot;, tunggu beberapa detik atau berdiri dekat jendela atau tempat terbuka, lalu tekan <b>Ambil lokasi ulang</b>. Pastikan GPS dan izin lokasi peramban aktif.
        </Tip>
      </>
    ),
  },
  {
    id: "cuti",
    title: "Cuti dan izin",
    body: (
      <>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Buka menu <b>Cuti / Izin</b> (karyawan dan Manager). Pilih <b>jenis</b> (Cuti atau Izin), <b>tanggal mulai</b> dan <b>tanggal selesai</b>, tulis <b>alasan</b>, lalu <b>Kirim pengajuan</b>. Boleh diajukan jauh-jauh hari. Hari Minggu tidak dihitung. <b>Satu pengajuan maksimal 2 hari berturut-turut</b> (lebih lama harus dipecah dan tetap masuk kuota). <b>Kuota: maksimal 2 pengajuan per periode</b> (cuti dan izin digabung, dihitung dari tanggal mulai cuti). Periode mengikuti <b>tanggal mulai kerja</b> Anda: masuk tanggal 21 berarti kuota direset tiap tanggal 21 (periode 21 sampai 20 bulan berikutnya). Bila Owner belum mengisi tanggal mulai kerja, kuota direset tanggal 1. Bila sudah habis, muncul peringatan &quot;Kuota pengajuan telah habis&quot; dan pengajuan baru di periode itu ditolak. Pengajuan yang ditolak atau dibatalkan tidak dihitung.</li>
          <li>Pengajuan Karyawan diputuskan oleh Manager di company-nya atau Owner. Pengajuan Manager diputuskan oleh Owner. Pemberi keputusan bisa menulis catatan saat <b>Setujui</b> atau <b>Tolak</b> di menu <b>Persetujuan Cuti/Izin</b>.</li>
          <li>Selama masih <b>menunggu keputusan</b>, Anda bisa mengetuk <b>Batalkan pengajuan</b>.</li>
          <li>Setelah <b>disetujui</b>, pada tanggal itu Anda <b>tidak perlu presensi</b> dan <b>tidak perlu mengisi daily report</b>. Di Presensi tertulis &quot;Hari ini Anda Cuti (sudah disetujui)&quot;, dan Anda tidak dihitung belum mengisi.</li>
          <li>Kalau tidak jadi, buka pengajuan yang sudah disetujui lalu ketuk <b>Ajukan pembatalan</b> dengan alasan. Selama belum disetujui, cuti Anda tetap berlaku. Bila pembatalan disetujui dan cuti belum mulai, cuti batal. Bila sudah berjalan, cuti dipotong sampai kemarin.</li>
        </ol>
        <Tip>Manager, Owner, dan Lead bisa melihat <b>Kalender Cuti</b>: kalender sebulan berisi siapa yang cuti atau izin tiap tanggal (Lead hanya divisinya). Pengajuan yang masih menunggu tampil bergaris putus-putus.</Tip>
        <Tip>Status <b>Izin</b> dan <b>Sakit</b> yang dipilih langsung saat Check-In juga membuat daily report hari itu tidak wajib. <b>Tugas Luar</b> tetap wajib lapor.</Tip>
      </>
    ),
  },
  {
    id: "pantauan",
    title: "Pantauan Kendala dan Insight, dan Daftar Tindak Lanjut",
    badge: "Owner, Manager, Lead",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li><b>Pantauan Kendala</b> menyatukan semua kendala dan insight yang ditulis di laporan harian dalam satu daftar. Pilih periode, jenis (kendala atau insight), status, divisi, dan cari kata. Ketuk <b>Buka laporan</b> untuk membaca laporan lengkapnya, dan <b>Unduh CSV</b> untuk bahan rapat.</li>
        <li>Owner dan Manager bisa mengetuk <b>Tandai sudah ditangani</b> (dengan catatan opsional) setelah kendala ditindaklanjuti, dan <b>Batalkan tanda</b> bila keliru. Lead hanya melihat divisinya.</li>
        <li><b>Daftar Tindak Lanjut</b> (Owner dan Manager) menampilkan semua tugas dari notulensi: PIC, tenggat, status, dan yang lewat tenggat berwarna merah. Status diubah oleh PIC di <b>Tugas Saya</b> atau halaman notulensinya.</li>
      </ul>
    ),
  },
  {
    id: "beranda",
    title: "Beranda: ringkasan hari ini",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li><b>Laporan hari ini:</b> hijau berarti sudah tersimpan, kuning berarti belum diisi. Ketuk kartunya untuk langsung ke form.</li>
        <li><b>Tugas saya:</b> jumlah tugas yang belum selesai; merah kalau ada yang lewat tenggat.</li>
        <li><b>Tim hari ini</b> (Manager dan Owner): jumlah orang yang belum mengisi laporan hari ini.</li>
        <li><b>Permintaan hapus notulensi</b> (Owner): jumlah permintaan yang menunggu persetujuan.</li>
      </ul>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard di Beranda",
    body: (
      <>
        <p>
          <b>Hanya untuk Manager dan Owner.</b> Di bawah kartu ringkasan hari ini, Beranda menampilkan <b>dashboard</b>: kartu angka di kiri dan grafik di kanan. Pilih periode lewat tombol
          <b> Hari ini / 7 hari / 30 hari / Bulan ini</b>. Owner juga bisa memilih company; Manager hanya melihat company-nya. Karyawan tidak memiliki dashboard (cukup kartu ringkasan hari ini).
        </p>
        <p className="mt-2">Dashboard hanya memakai data yang diisi <b>semua divisi</b>:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li><b>Laporan harian:</b> berapa yang sudah melapor hari ini, kepatuhan (per hari dan per divisi), dan jumlah kendala yang ditulis.</li>
          <li><b>Presensi:</b> berapa yang sudah Check-In hari ini (dan yang belum Check-Out), kehadiran per hari dan per divisi, serta komposisi status (WFO, Tugas Luar, Izin, Sakit).</li>
          <li><b>Tugas dari notulensi</b> yang lewat tenggat.</li>
        </ul>
        <h4 className="mt-4 font-bold text-accent">Arti angka</h4>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Kepatuhan laporan</b> = laporan yang sudah masuk dibagi laporan yang seharusnya masuk (hari kerja Senin–Sabtu).</li>
          <li><b>Kehadiran (Check-In)</b> = presensi Check-In yang tercatat dibagi yang seharusnya (hari kerja Senin–Sabtu). Detail per orang, lokasi, dan foto ada di <b>Rekap Presensi</b>.</li>
        </ul>
        <Tip>
          Angka GMV, ads spent, CAC, dan target omzet sedang tidak ditampilkan di dashboard (disederhanakan dulu). Menu <b>Atur Target</b> dan datanya tetap tersimpan.
        </Tip>
      </>
    ),
  },
  {
    id: "tautan",
    title: "Tautan penting (tracker, aset, SOP)",
    body: (
      <>
        <p>
          Di <b>Beranda</b>, bagian <b>Tautan penting</b> berisi link kerja yang disiapkan untuk company dan divisi Anda: tracker spreadsheet,
          folder aset, SOP, dan lainnya. Ketuk satu link untuk membukanya di tab baru. Tidak perlu lagi mencari-cari di chat atau tempat lain.
        </p>
        <h4 className="mt-4 font-bold text-accent">Untuk Manager dan Owner: mengelola tautan</h4>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Ketuk <b>Kelola Tautan</b> di Beranda.</li>
          <li>Isi <b>judul</b>, <b>alamat link</b>, <b>kategori</b> (Tracker, Aset, SOP &amp; Dokumen, atau Lainnya), dan keterangan singkat bila perlu.</li>
          <li>Centang <b>untuk divisi</b> mana saja (boleh lebih dari satu, mis. brief untuk ADV, ADV MH, CC, dan AM). Tidak mencentang apa pun berarti untuk semua divisi. Owner juga memilih <b>untuk company</b> mana (atau Semua company); Manager otomatis untuk company-nya.</li>
          <li>Ketuk <b>Tambah tautan</b>. Untuk mengubah, ketuk <b>Ubah</b> pada tautan itu; untuk menghapus, ketuk <b>Hapus</b>.</li>
        </ol>
        <Tip>
          Aplikasi hanya menyimpan <b>jalan pintas</b> ke file. Siapa yang boleh membuka isi file (Drive, Spreadsheet, dll.) tetap diatur di layanan
          itu, jadi pastikan file sudah dibagikan ke tim yang membutuhkan.
        </Tip>
      </>
    ),
  },
  {
    id: "riwayat",
    title: "3. Riwayat Laporan",
    body: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>Ketuk <b>Riwayat Laporan</b> di Beranda. Daftar laporan Anda tampil dari yang terbaru.</li>
        <li>Label hijau <b>&quot;Hari ini · bisa diedit&quot;</b> berarti laporan hari ini. Label abu-abu <b>🔒 Terkunci</b> berarti hari yang sudah lewat.</li>
        <li>Ketuk satu laporan untuk membukanya. Laporan lama hanya bisa dibaca. Laporan hari ini punya tombol <b>Edit laporan hari ini</b>.</li>
      </ol>
    ),
  },
  {
    id: "notulensi",
    title: "4. Notulensi Meeting",
    body: (
      <>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Ketuk <b>Notulensi</b>, lalu <b>+ Buat Notulensi</b>.</li>
          <li>Isi <b>Nama meeting</b> terlebih dulu. Setelah itu notulensi <b>tersimpan otomatis</b> beberapa detik setelah Anda berhenti mengetik. Ketuk <b>Simpan</b> kalau ingin menyimpan sekarang.</li>
          <li>Isi tanggal, jam, <b>Lokasi</b> (Kantor 1, Kantor 2, Kantor Redigma, atau Online lengkap dengan link), peserta, agenda, pembahasan, dan keputusan.</li>
          <li><b>Peserta:</b> pilih rekan dari daftar, atau ketik nama tamu yang tidak punya akun.</li>
          <li><b>Tindak lanjut:</b> tulis tugasnya, pilih <b>PIC</b> (orang yang bertanggung jawab), tenggat, dan statusnya.</li>
          <li>Di akhir meeting, ketuk <b>Submit</b>. Notulensi lalu <b>terkunci</b> dan tidak bisa diubah lagi (hanya Owner yang bisa mengoreksi). Pastikan isinya sudah benar sebelum Submit.</li>
          <li>Ketuk <b>⬇ Download PDF</b> di halaman notulensi untuk mengunduh dan membagikannya.</li>
        </ol>
        <h4 className="mt-4 font-bold text-accent">Siapa yang bisa melihat notulensi?</h4>
        <p>Penulisnya, Manager di company yang sama, dan Owner. Rekan lain tidak melihatnya.</p>
        <h4 className="mt-4 font-bold text-accent">Ingin menghapus notulensi?</h4>
        <p>
          Ketuk <b>Ajukan hapus</b> dan tulis alasannya. Notulensi <b>tetap ada</b> sampai Owner menyetujui. Anda bisa membatalkan
          permintaan itu kapan saja.
        </p>
      </>
    ),
  },
  {
    id: "tugas",
    title: "5. Tugas Saya",
    body: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>Kalau seseorang menunjuk Anda sebagai <b>PIC</b> pada tindak lanjut meeting, tugasnya muncul di <b>Tugas Saya</b>, urut dari tenggat terdekat.</li>
        <li>Tugas yang <b>lewat tenggat</b> dan belum selesai ditandai merah.</li>
        <li>Ubah <b>status</b> langsung di kotak di sebelah kanan tugas: Open, Sedang dikerjakan, atau Selesai. Anda hanya bisa mengubah status, bukan isi tugas atau tenggatnya.</li>
        <li>Ketuk <b>&quot;Tampilkan juga tugas yang sudah selesai&quot;</b> untuk melihat yang sudah rampung.</li>
      </ol>
    ),
  },
  {
    id: "lead",
    title: "Untuk Lead: memantau tim divisi",
    badge: "Lead",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Urutan wewenang: Owner, Manager, <b>Lead</b>, Karyawan. Satu divisi boleh punya lebih dari satu Lead. Mentor adalah Lead yang membimbing anak Magang Hub (ADV MH).</li>
        <li>Lead <b>hanya melihat</b> laporan, presensi (lokasi dan foto), pengajuan cuti, dan daftar belum mengisi milik <b>karyawan biasa</b> di divisinya dan divisi tambahan yang diatur Owner. Lead tidak melihat Manager, sesama Lead, atau company lain, dan tidak bisa mengubah atau menyetujui apa pun.</li>
        <li>Menu untuk Lead: <b>Dashboard Tim</b> (belum mengisi, laporan masuk, kepatuhan minggu ini) dan <b>Rekap Presensi</b>, keduanya hanya berisi karyawan divisinya.</li>
        <li>Lead tetap mengisi laporan dan presensi sendiri, serta boleh mengajukan cuti atau izin (diputuskan Manager atau Owner).</li>
      </ul>
    ),
  },
  {
    id: "manager",
    title: "6. Untuk Manager: Dashboard Tim",
    badge: "Manager & Owner",
    body: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>Ketuk <b>Dashboard Tim</b>. Secara bawaan yang tampil adalah hari ini; pilih tanggal lain atau ketuk <b>← Kemarin</b>.</li>
        <li><b>Belum mengisi</b> menampilkan siapa saja yang belum melapor pada tanggal itu.</li>
        <li><b>Laporan masuk:</b> ketuk <b>Lihat →</b> untuk membaca laporan anggota tim (hanya baca).</li>
        <li><b>Kepatuhan minggu ini</b> memperlihatkan jumlah hari terisi dan persentasenya: hijau 100%, kuning 80–99%, merah di bawah 80%.</li>
        <li>Manager hanya melihat company-nya sendiri.</li>
      </ol>
    ),
  },
  {
    id: "owner",
    title: "7. Untuk Owner: mengelola aplikasi",
    badge: "Owner",
    body: (
      <>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Company:</b> tambah, ubah, atau nonaktifkan holding dan anak usaha.</li>
          <li><b>Tanggal mulai kerja</b> (Pengguna → kolom &quot;Mulai kerja&quot;): isi tanggal masuk tiap karyawan. Tanggal ini menjadi hari reset kuota cuti/izin bulanan (masuk tanggal 21 = reset tiap tanggal 21). Kosong = reset tanggal 1. Perubahan berlaku untuk pengajuan baru; pengajuan lama tidak berubah.</li>
          <li><b>Titik Absen</b> (Administrasi → Titik Absen): tetapkan lokasi kantor tiap company dan radiusnya (bawaan 15 meter). Berdiri di titik kantor lalu tekan <b>Pakai lokasi saya sekarang</b>, atau tempel tautan Google Maps. Satu company boleh punya beberapa titik. Company yang belum punya titik belum dibatasi.</li>
          <li><b>Titik tujuan Tugas Luar</b> (halaman yang sama, bagian atas; Manager juga bisa untuk company-nya): daftarkan tempat tujuan seperti &quot;Redigma&quot; dengan radius bawaan 50 meter. Setelah company punya minimal satu tujuan, Tugas Luar hanya bisa di titik terdaftar; tujuan baru harus didaftarkan lebih dulu.</li>
          <li>
            <b>Undangan Karyawan:</b> isi email, nama, company, role, dan jabatan, lalu <b>Kirim undangan</b>. Kalau email tertahan,
            ketuk <b>🔗 Salin link undangan</b> dan kirim lewat WhatsApp. Untuk akun yang <b>Belum pernah masuk</b>, ketuk
            <b> 🔑 Salin link atur password</b>.
          </li>
          <li><b>Pengguna:</b> ubah role (Karyawan / Lead / Manager / Owner), jabatan, atau nonaktifkan akun yang sudah tidak bekerja. Untuk <b>Lead</b>, centang <b>Divisi yang dipantau</b> bila ia membawahi divisi lain (contoh: Lead ADV yang membimbing anak Magang Hub centang ADV MH).</li>
          <li><b>Koreksi laporan lama:</b> buka laporan lewat Dashboard Tim, lalu ketuk <b>Koreksi (Owner)</b>.</li>
          <li><b>Tarikan Mingguan:</b> lihat laporan satu minggu dan unduh sebagai CSV (Excel) atau JSON.</li>
          <li><b>Pratinjau Form:</b> melihat form setiap jabatan tanpa menyimpan.</li>
        </ul>
        <Tip>
          <b>Role</b> menentukan apa yang boleh dilihat dan dilakukan. <b>Jabatan</b> menentukan form laporan yang muncul. Keduanya
          bisa diatur terpisah.
        </Tip>
      </>
    ),
  },
  {
    id: "faq",
    title: "8. Pertanyaan yang sering muncul",
    body: (
      <dl className="space-y-4">
        <Faq q="Saya lupa password.">
          Di halaman Masuk ketuk <b>Lupa password?</b>, isi email Anda, lalu buka email dari sistem dan ikuti link-nya. Kalau email tidak
          datang, minta admin membuatkan link atur password.
        </Faq>
        <Faq q="Muncul &quot;Akun Anda belum terdaftar. Hubungi admin.&quot;">
          Email Anda belum diundang atau akunnya sudah dinonaktifkan. Hubungi admin.
        </Faq>
        <Faq q="Link undangan bilang kedaluwarsa atau sudah dipakai.">
          Minta admin membuat link baru. Link hanya berlaku sekali dan dalam waktu terbatas.
        </Faq>
        <Faq q="Laporan kemarin tidak bisa saya ubah.">
          Itu memang aturannya: laporan hanya bisa diubah pada hari yang sama. Untuk koreksi, minta Owner.
        </Faq>
        <Faq q="Menu Dashboard Tim tidak ada di Beranda saya.">
          Dashboard hanya untuk Manager dan Owner.
        </Faq>
        <Faq q="Saya tidak bisa melihat notulensi rekan.">
          Notulensi terlihat oleh penulisnya, <b>peserta</b> yang disebut di notulensi (setelah penulis menekan Submit), Manager di company yang sama, dan Owner.
        </Faq>
        <Faq q="Notulensi saya tidak bisa diubah lagi.">
          Notulensi yang sudah di-Submit terkunci. Minta Owner kalau perlu dikoreksi.
        </Faq>
        <Faq q="Tulisan saya hilang.">
          Selama ada tulisan &quot;Tersimpan&quot; berwarna hijau, isiannya aman. Kalau tidak yakin, ketuk <b>Simpan</b> sebelum menutup halaman.
        </Faq>
      </dl>
    ),
  },
];

function Tip({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-lg border-l-4 border-gold bg-amber-50 p-3 text-sm text-zinc-800">💡 {children}</p>;
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-bold text-accent">{q}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

export default function PanduanPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <header className="rounded-xl border border-zinc-200 border-t-4 border-t-gold bg-white p-6 text-center shadow-sm">
        <Image
          src="/brand/logo-utama.png"
          alt="Bahtera Binar Group"
          width={1144}
          height={746}
          priority
          className="mx-auto h-28 w-auto"
        />
        <p className="mt-1 text-xs font-bold tracking-[0.25em] text-gold">BAHTERA BINAR PULSE</p>
        <h1 className="mt-3 text-2xl font-bold text-accent">Panduan Pemakaian</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Aplikasi untuk laporan harian, notulensi meeting, dan tugas tim. Pilih bagian di bawah untuk langsung ke langkahnya.
        </p>
      </header>

      <nav aria-label="Daftar isi" className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-bold">Isi panduan</p>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-accent underline decoration-gold underline-offset-2">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 space-y-4">
        {SECTIONS.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-4 rounded-xl border border-zinc-200 bg-white p-5 text-[15px] leading-relaxed shadow-sm"
          >
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-accent">
              {s.title}
              {s.badge && <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-bold text-accent">{s.badge}</span>}
            </h2>
            <div className="mt-3">{s.body}</div>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href="/" className="font-bold text-accent underline decoration-gold underline-offset-2">
          ← Buka aplikasi
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-zinc-500">Ada kendala atau pertanyaan? Hubungi admin.</p>
    </main>
  );
}
