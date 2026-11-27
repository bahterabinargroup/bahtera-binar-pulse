import { botError, callBot, dateParam, textParam } from "@/lib/bot-api";

// GET /api/bot/v1/target?from&to&company — target omzet bulanan per ADV (bulan yang bersinggungan dengan rentang).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = dateParam(url, "from");
  const to = dateParam(url, "to");
  for (const v of [from, to]) if (v instanceof Error) return botError(400, v.message);
  return callBot(request, "bot_target", { p_from: from, p_to: to, p_company: textParam(url, "company", 50) });
}
