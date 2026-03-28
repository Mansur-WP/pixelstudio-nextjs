import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { studiosTable, usersTable, clientsTable, photosTable, paymentsTable } from "@workspace/db/schema";
import { eq, count, sum, ne } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  try {
    const [
      totalStudios, activeStudios, proStudios,
      totalUsers, totalClients, totalPhotos, totalRevenue,
    ] = await Promise.all([
      db.select({ count: count() }).from(studiosTable).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(studiosTable).where(eq(studiosTable.isActive, true)).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(studiosTable).where(eq(studiosTable.plan, "pro")).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(usersTable).where(ne(usersTable.role, "SUPERADMIN")).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(clientsTable).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(photosTable).then(r => Number(r[0].count)),
      db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).then(r => Number(r[0].total ?? 0)),
    ]);

    return Response.json({
      success: true, message: "Platform stats",
      data: {
        totalStudios, activeStudios, suspendedStudios: totalStudios - activeStudios,
        proStudios, freeStudios: totalStudios - proStudios,
        totalUsers, totalClients, totalPhotos, totalRevenue,
      },
    });
  } catch (err) {
    console.error("[platform/stats GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
