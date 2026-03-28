import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { upgradeRequestsTable, platformSettingsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, isAuthContext, requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const roleErr = requireRole(ctx, "admin");
  if (roleErr) return roleErr;

  if (!ctx.studio) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    const [[settings], [latestRequest]] = await Promise.all([
      db.select().from(platformSettingsTable).limit(1),
      db.select().from(upgradeRequestsTable)
        .where(eq(upgradeRequestsTable.studioId, ctx.studio.id))
        .orderBy(desc(upgradeRequestsTable.createdAt)).limit(1),
    ]);

    return Response.json({
      success: true, message: "Upgrade info fetched",
      data: {
        bankName:      settings?.bankName      ?? "",
        accountNumber: settings?.accountNumber ?? "",
        accountName:   settings?.accountName   ?? "",
        proPlanPrice:  settings?.proPlanPrice  ?? "50000",
        request:       latestRequest ?? null,
      },
    });
  } catch (err) {
    console.error("[studios/me/upgrade-info GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
