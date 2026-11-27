import { ringkasan } from "@/lib/bot-api";

// GET /api/bot/v1/ringkasan/tindak-lanjut?from&to&company — ringkasan yang dihitung database (tanpa halaman).
export async function GET(request: Request) {
  return ringkasan(request, "bot_ringkasan_tindak_lanjut");
}
