import { callBot } from "@/lib/bot-api";

// GET /api/bot/v1/health — cek koneksi dan kunci. Hanya GET (metode lain otomatis 405).
export async function GET(request: Request) {
  return callBot(request, "bot_health", {});
}
