import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { upgradeRequestsTable } from "@workspace/db/schema";
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

    const [updated] = await db.update(upgradeRequestsTable)
      .set({ status: "rejected" }).where(eq(upgradeRequestsTable.id, id)).returning();

    return Response.json({ success: true, message: "Request rejected", data: updated });
  } catch (err) {
    console.error("[platform/upgrade-requests/id/reject POST]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
