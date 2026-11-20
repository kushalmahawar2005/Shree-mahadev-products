import { requireAdmin } from "@/lib/server/admin-auth";
import { labelPdf } from "@/lib/server/shipments";

/** Stored courier label PDF (Velocity), admins only. Labels carry the customer's address: never cached. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const pdf = await labelPdf(id);
  if (!pdf) return new Response("Label not found", { status: 404 });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="label-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
