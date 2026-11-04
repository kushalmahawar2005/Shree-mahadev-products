import { processMarketingOutbox } from "@/lib/server/marketing";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await processMarketingOutbox());
}
