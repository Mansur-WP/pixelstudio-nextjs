import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { paymentsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    const payments = await db.query.paymentsTable.findMany({
      where: eq(paymentsTable.studioId, studioId),
      orderBy: [desc(paymentsTable.createdAt)],
      with: {
        client:     { columns: { id: true, clientName: true, phone: true, createdById: true } },
        receivedBy: { columns: { id: true, name: true } },
      },
    });

    const filtered = ctx.user.role === "staff"
      ? payments.filter(p => p.client.createdById === ctx.user.id)
      : payments;

    const result = filtered.map(p => {
      const { createdById: _omit, ...c } = p.client;
      return { ...p, client: c };
    });

    return Response.json({ success: true, message: "Payments fetched", data: result });
  } catch (err) {
    console.error("[payments GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
