import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  try {
    const [settings] = await db.select().from(platformSettingsTable).limit(1);
    return Response.json({
      success: true, message: "Settings fetched",
      data: settings ?? { bankName: "", accountNumber: "", accountName: "", proPlanPrice: "50000" },
    });
  } catch (err) {
    console.error("[platform/settings GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  try {
    const body = await request.json();
    const { bankName = "", accountNumber = "", accountName = "", proPlanPrice = "50000" } = body;

    const [existing] = await db.select({ id: platformSettingsTable.id }).from(platformSettingsTable).limit(1);
    let result;
    if (existing) {
      [result] = await db.update(platformSettingsTable)
        .set({ bankName, accountNumber, accountName, proPlanPrice: String(proPlanPrice) })
        .where(eq(platformSettingsTable.id, existing.id)).returning();
    } else {
      [result] = await db.insert(platformSettingsTable)
        .values({ bankName, accountNumber, accountName, proPlanPrice: String(proPlanPrice) }).returning();
    }
    return Response.json({ success: true, message: "Settings updated", data: result });
  } catch (err) {
    console.error("[platform/settings PUT]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
