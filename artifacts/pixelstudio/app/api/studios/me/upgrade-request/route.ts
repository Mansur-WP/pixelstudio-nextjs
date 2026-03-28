import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { upgradeRequestsTable, platformSettingsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, isAuthContext, requireRole } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const roleErr = requireRole(ctx, "admin");
  if (roleErr) return roleErr;

  if (!ctx.studio) return Response.json({ success: false, message: "No studio context" }, { status: 400 });
  if (ctx.studio.plan === "pro") {
    return Response.json({ success: false, message: "Studio is already on Pro plan" }, { status: 400 });
  }

  try {
    const body      = await request.json();
    const reference = (body.reference || "").trim();
    const notes     = (body.notes     || "").trim();

    if (!reference) return Response.json({ success: false, message: "Payment reference is required" }, { status: 400 });

    const [pending] = await db.select({ id: upgradeRequestsTable.id })
      .from(upgradeRequestsTable)
      .where(and(eq(upgradeRequestsTable.studioId, ctx.studio.id), eq(upgradeRequestsTable.status, "pending")))
      .limit(1);

    if (pending) {
      return Response.json({ success: false, message: "You already have a pending upgrade request. Please wait for it to be reviewed." }, { status: 409 });
    }

    const [settings] = await db.select({ proPlanPrice: platformSettingsTable.proPlanPrice })
      .from(platformSettingsTable).limit(1);
    const amount = settings?.proPlanPrice ?? "50000";

    const [req] = await db.insert(upgradeRequestsTable).values({
      studioId: ctx.studio.id, amount, reference, notes: notes || null,
    }).returning();

    return Response.json({ success: true, message: "Upgrade request submitted. The platform team will verify your payment shortly.", data: req }, { status: 201 });
  } catch (err) {
    console.error("[studios/me/upgrade-request POST]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
