import { callBot, commonParams, textParam } from "@/lib/bot-api";

// GET /api/bot/v1/kendala?from&to&company&position&status=belum|sudah&limit&cursor — kendala + tanda "sudah ditangani".
export async function GET(request: Request) {
  const url = new URL(request.url);
  const common = commonParams(url);
  if (common instanceof Response) return common;
  return callBot(request, "bot_kendala", { ...common, p_position: textParam(url, "position", 20), p_status: textParam(url, "status", 10) });
}
