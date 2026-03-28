import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { upgradeRequestsTable, studiosTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  try {
    const requests = await db.select({
      id:         upgradeRequestsTable.id,
      amount:     upgradeRequestsTable.amount,
      reference:  upgradeRequestsTable.reference,
      notes:      upgradeRequestsTable.notes,
      status:     upgradeRequestsTable.status,
      createdAt:  upgradeRequestsTable.createdAt,
      studioId:   upgradeRequestsTable.studioId,
      studioName: studiosTable.name,
      studioSlug: studiosTable.slug,
      studioPlan: studiosTable.plan,
    })
      .from(upgradeRequestsTable)
      .innerJoin(studiosTable, eq(upgradeRequestsTable.studioId, studiosTable.id))
      .orderBy(desc(upgradeRequestsTable.createdAt));

    return Response.json({ success: true, message: "Upgrade requests fetched", data: requests });
  } catch (err) {
    console.error("[platform/upgrade-requests GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
