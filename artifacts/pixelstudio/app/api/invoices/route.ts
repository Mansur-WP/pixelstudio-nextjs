import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { invoicesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    const invoices = await db.query.invoicesTable.findMany({
      where: eq(invoicesTable.studioId, studioId),
      orderBy: [desc(invoicesTable.createdAt)],
      with: {
        client:    { columns: { id: true, clientName: true, phone: true, orderStatus: true, createdById: true } },
        createdBy: { columns: { id: true, name: true } },
      },
    });

    const filtered = ctx.user.role === "staff"
      ? invoices.filter(i => i.client.createdById === ctx.user.id)
      : invoices;

    const result = filtered.map(({ client: { createdById: _omit, ...c }, ...inv }) => ({ ...inv, client: c }));
    return Response.json({ success: true, message: "Invoices fetched", data: result });
  } catch (err) {
    console.error("[invoices GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
