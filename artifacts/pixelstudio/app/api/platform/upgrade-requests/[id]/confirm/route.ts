import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { upgradeRequestsTable, studiosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const { id } = await params;
  try {
    const [req] = await db.select().from(upgradeRequestsTable).where(eq(upgradeRequestsTable.id, id)).limit(1);
    if (!req) return Response.json({ success: false, message: "Request not found" }, { status: 404 });
    if (req.status !== "pending") return Response.json({ success: false, message: "Request is not pending" }, { status: 400 });

    await db.update(studiosTable).set({ plan: "pro" }).where(eq(studiosTable.id, req.studioId));
    const [updated] = await db.update(upgradeRequestsTable)
      .set({ status: "confirmed" }).where(eq(upgradeRequestsTable.id, id)).returning();

    return Response.json({ success: true, message: "Payment confirmed and studio upgraded to Pro", data: updated });
  } catch (err) {
    console.error("[platform/upgrade-requests/id/confirm POST]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
