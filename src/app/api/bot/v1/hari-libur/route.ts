import { callBot, dateParam, botError } from "@/lib/bot-api";

// GET /api/bot/v1/hari-libur?from&to — daftar hari libur (semua company).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = dateParam(url, "from");
  const to = dateParam(url, "to");
  for (const v of [from, to]) if (v instanceof Error) return botError(400, v.message);
  return callBot(request, "bot_hari_libur", { p_from: from, p_to: to });
}
