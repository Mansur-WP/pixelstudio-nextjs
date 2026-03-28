import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { activityLogsTable, studiosTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  try {
    const logs = await db.select({
      id:         activityLogsTable.id,
      studioId:   activityLogsTable.studioId,
      studioName: studiosTable.name,
      studioSlug: studiosTable.slug,
      userId:     activityLogsTable.userId,
      userName:   activityLogsTable.userName,
      userRole:   activityLogsTable.userRole,
      action:     activityLogsTable.action,
      entityType: activityLogsTable.entityType,
      entityId:   activityLogsTable.entityId,
      entityName: activityLogsTable.entityName,
      createdAt:  activityLogsTable.createdAt,
    })
      .from(activityLogsTable)
      .leftJoin(studiosTable, eq(activityLogsTable.studioId, studiosTable.id))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(150);

    return Response.json({ success: true, message: "Platform activity", data: logs });
  } catch (err) {
    console.error("[platform/activity GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
