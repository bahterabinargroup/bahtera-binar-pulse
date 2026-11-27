// Uji otomatis API bot lewat HTTP.
// Pakai: node scripts/uji-api-bot.mjs https://bahterapulse.vercel.app
// Dengan kunci (opsional, untuk uji isi data): BOT_KEY=<kunci> node scripts/uji-api-bot.mjs <alamat>
// Kunci dibaca dari variabel lingkungan dan TIDAK pernah dicetak.
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const key = process.env.BOT_KEY || "";
const api = `${base}/api/bot/v1`;
let gagal = 0;
const cek = (nama, ok, info = "") => {
  if (!ok) gagal++;
  console.log(`${ok ? "LULUS" : ">>> GAGAL <<<"} | ${nama}${info ? ` | ${info}` : ""}`);
};
const get = (path, k) => fetch(`${api}${path}`, { headers: k ? { Authorization: `Bearer ${k}` } : {}, redirect: "manual" });

let r = await get("/health");
cek("Tanpa kunci -> 401", r.status === 401, `status=${r.status}`);
r = await get("/laporan", "bbp_" + "0".repeat(64));
cek("Kunci salah -> 401", r.status === 401, `status=${r.status}`);
for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
  r = await fetch(`${api}/laporan`, { method: m, headers: { Authorization: `Bearer ${key || "x"}` }, redirect: "manual" });
  cek(`${m} /laporan ditolak`, r.status === 405, `status=${r.status}`);
  r = await fetch(`${base}/api/bot/apa-saja`, { method: m, redirect: "manual" });
  cek(`${m} alamat bot lain ditolak`, r.status === 405, `status=${r.status}`);
}
r = await get("/tidak-ada", key);
cek("Endpoint tidak dikenal -> 404 (bukan dialihkan ke login)", r.status === 404, `status=${r.status}`);

if (!key) {
  console.log("(BOT_KEY tidak diisi: uji isi data dilewati)");
} else {
  r = await get("/health", key);
  const h = await r.json().catch(() => ({}));
  cek("Health dengan kunci", r.status === 200 && h.ok === true, `status=${r.status}`);

  r = await get("/laporan?from=2026-11-01&to=2026-11-30&limit=2", key);
  const j = await r.json().catch(() => ({}));
  cek("Laporan: data, next_cursor, total", r.status === 200 && Array.isArray(j.data) && "next_cursor" in j && typeof j.total === "number", `total=${j.total}`);
  const teks = JSON.stringify(j);
  cek("Laporan: tanpa foto/GPS/email/password", !/(photo|foto_|latitude|longitude|"lat"|"lng"|email|password|key_hash)/i.test(teks));
  cek("Laporan: tanggal dalam rentang", (j.data || []).every((d) => d.report_date >= "2026-11-01" && d.report_date <= "2026-11-30"));
  if (j.next_cursor) {
    const r2 = await get(`/laporan?from=2026-11-01&to=2026-11-30&limit=2&cursor=${encodeURIComponent(j.next_cursor)}`, key);
    const j2 = await r2.json().catch(() => ({}));
    cek("Laporan: halaman berikut berbeda", r2.status === 200 && JSON.stringify(j2.data?.[0]) !== JSON.stringify(j.data?.[0]));
  }
  r = await get("/laporan?from=2026-01-01&to=2026-11-30", key);
  cek("Rentang > 93 hari -> 400", r.status === 400, `status=${r.status}`);
  r = await get("/laporan?from=27-11-2026", key);
  cek("Format tanggal salah -> 400", r.status === 400, `status=${r.status}`);
  r = await get("/laporan?company=TIDAK_ADA", key);
  cek("Company tidak dikenal -> 400", r.status === 400, `status=${r.status}`);
  r = await get("/laporan?fields=ringkas&limit=1", key);
  const rk = await r.json().catch(() => ({}));
  cek("Laporan ringkas tanpa activities", r.status === 200 && (rk.data || []).every((d) => !("activities" in d)));
  r = await get("/notulensi?from=2026-11-01&to=2026-11-30&limit=5", key);
  const n = await r.json().catch(() => ({}));
  cek("Notulensi: data + action_items", r.status === 200 && Array.isArray(n.data) && (n.data || []).every((d) => Array.isArray(d.action_items)), `total=${n.total}`);
}
console.log(`\nRINGKASAN: ${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
