import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    const url   = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);

    const logs = await db.select().from(activityLogsTable)
      .where(eq(activityLogsTable.studioId, studioId))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(Math.min(limit, 500));

    return Response.json({ success: true, message: "Activity log fetched", data: logs });
  } catch (err) {
    console.error("[activity GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
