import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { clientsTable, galleriesTable, paymentsTable } from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const staffId = ctx.user.id;

  try {
    const [
      totalClients, pendingEditingCount, readyForUploadCount,
      uploadedGalleriesCount, totalPaid, totalPending, recentClients, recentPayments,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(clientsTable)
        .where(and(eq(clientsTable.studioId, studioId), eq(clientsTable.createdById, staffId)))
        .then(r => Number(r[0].count)),
      db.select({ count: sql<number>`count(*)` }).from(clientsTable)
        .where(and(eq(clientsTable.studioId, studioId), eq(clientsTable.createdById, staffId), eq(clientsTable.orderStatus, "PENDING")))
        .then(r => Number(r[0].count)),
      db.select({ count: sql<number>`count(*)` }).from(clientsTable)
        .where(and(eq(clientsTable.studioId, studioId), eq(clientsTable.createdById, staffId), eq(clientsTable.orderStatus, "EDITING")))
        .then(r => Number(r[0].count)),
      db.select({ count: sql<number>`count(*)` }).from(galleriesTable)
        .where(and(eq(galleriesTable.studioId, studioId), eq(galleriesTable.uploadedById, staffId)))
        .then(r => Number(r[0].count)),
      db.select({ total: sql<string>`coalesce(sum(price::numeric), 0)` }).from(clientsTable)
        .where(and(eq(clientsTable.studioId, studioId), eq(clientsTable.createdById, staffId), eq(clientsTable.paymentStatus, "PAID")))
        .then(r => parseFloat(r[0].total)),
      db.select({ total: sql<string>`coalesce(sum(price::numeric), 0)` }).from(clientsTable)
        .where(and(eq(clientsTable.studioId, studioId), eq(clientsTable.createdById, staffId), eq(clientsTable.paymentStatus, "PENDING")))
        .then(r => parseFloat(r[0].total)),
      db.select({
        id: clientsTable.id, clientName: clientsTable.clientName, phone: clientsTable.phone,
        orderStatus: clientsTable.orderStatus, paymentStatus: clientsTable.paymentStatus, createdAt: clientsTable.createdAt,
      }).from(clientsTable)
        .where(and(eq(clientsTable.studioId, studioId), eq(clientsTable.createdById, staffId)))
        .orderBy(desc(clientsTable.createdAt)).limit(5),
      db.query.paymentsTable.findMany({
        where: and(eq(paymentsTable.studioId, studioId), eq(paymentsTable.receivedById, staffId)),
        limit: 5, orderBy: [desc(paymentsTable.createdAt)],
        with: { client: { columns: { id: true, clientName: true } } },
      }),
    ]);

    return Response.json({
      success: true, message: "Staff dashboard fetched",
      data: {
        stats: { totalClients, pendingEditingCount, readyForUploadCount, uploadedGalleriesCount, totalRevenue: totalPaid, totalPaid, totalPending },
        recentClients,
        recentPayments,
      },
    });
  } catch (err) {
    console.error("[dashboard/staff]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
