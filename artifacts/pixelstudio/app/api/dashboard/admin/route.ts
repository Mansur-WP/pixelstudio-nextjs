import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { usersTable, clientsTable, galleriesTable, photosTable, paymentsTable } from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { authenticate, isAuthContext, requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const roleErr = requireRole(ctx, "admin");
  if (roleErr) return roleErr;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    const [
      totalStaff, allClients, totalPaid, totalPending, recentClients, recentPayments,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(usersTable)
        .where(and(eq(usersTable.studioId, studioId), eq(usersTable.role, "STAFF"), eq(usersTable.isActive, true)))
        .then(r => Number(r[0].count)),

      db.select({ count: sql<number>`count(*)` }).from(clientsTable)
        .where(eq(clientsTable.studioId, studioId))
        .then(r => Number(r[0].count)),

      db.select({ total: sql<string>`coalesce(sum(price::numeric), 0)` }).from(clientsTable)
        .where(and(eq(clientsTable.studioId, studioId), eq(clientsTable.paymentStatus, "PAID")))
        .then(r => parseFloat(r[0].total)),

      db.select({ total: sql<string>`coalesce(sum(price::numeric), 0)` }).from(clientsTable)
        .where(and(eq(clientsTable.studioId, studioId), eq(clientsTable.paymentStatus, "PENDING")))
        .then(r => parseFloat(r[0].total)),

      db.query.clientsTable.findMany({
        where: eq(clientsTable.studioId, studioId),
        limit: 5, orderBy: [desc(clientsTable.createdAt)],
        with: { createdBy: { columns: { id: true, name: true } } },
        columns: { id: true, clientName: true, phone: true, price: true, photoFormat: true, orderStatus: true, paymentStatus: true, createdAt: true, createdById: true },
      }),

      db.query.paymentsTable.findMany({
        where: eq(paymentsTable.studioId, studioId),
        limit: 5, orderBy: [desc(paymentsTable.createdAt)],
        with: {
          client:     { columns: { id: true, clientName: true } },
          receivedBy: { columns: { id: true, name: true } },
        },
      }),
    ]);

    const [pendingPaymentsCount, totalGalleries, totalPhotos] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(clientsTable)
        .where(and(eq(clientsTable.studioId, studioId), eq(clientsTable.paymentStatus, "PENDING")))
        .then(r => Number(r[0].count)),
      db.select({ count: sql<number>`count(*)` }).from(galleriesTable)
        .where(eq(galleriesTable.studioId, studioId))
        .then(r => Number(r[0].count)),
      db.select({ count: sql<number>`count(*)` }).from(photosTable)
        .where(eq(photosTable.studioId, studioId))
        .then(r => Number(r[0].count)),
    ]);

    return Response.json({
      success: true, message: "Admin dashboard fetched",
      data: {
        stats: { totalStaff, totalClients: allClients, totalRevenue: totalPaid, totalPaid, totalPending, pendingPaymentsCount, totalGalleries, totalPhotos },
        recentClients,
        recentPayments,
      },
    });
  } catch (err) {
    console.error("[dashboard/admin]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
