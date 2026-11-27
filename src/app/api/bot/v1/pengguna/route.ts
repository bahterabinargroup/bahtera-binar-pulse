import { botError, callBot, textParam } from "@/lib/bot-api";

// GET /api/bot/v1/pengguna?company&aktif=true|false — tanpa email/no. HP.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const aktif = textParam(url, "aktif", 5);
  if (aktif !== null && aktif !== "true" && aktif !== "false") return botError(400, "aktif hanya boleh true atau false.");
  return callBot(request, "bot_pengguna", { p_company: textParam(url, "company", 50), p_aktif: aktif === null ? null : aktif === "true" });
}
