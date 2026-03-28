import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, clientsTable, galleriesTable, photosTable, paymentsTable } from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { authMiddleware, requireRole } from "./middleware";

const router = Router();
router.use(authMiddleware);

const ok   = (res: any, message: string, data?: any) => res.status(200).json({ success: true, message, data });
const fail = (res: any, message: string, status = 400) => res.status(status).json({ success: false, message });

// GET /api/dashboard/admin
router.get("/admin", requireRole("admin"), async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

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

    return ok(res, "Admin dashboard fetched", {
      stats: { totalStaff, totalClients: allClients, totalRevenue: totalPaid, totalPaid, totalPending, pendingPaymentsCount, totalGalleries, totalPhotos },
      recentClients,
      recentPayments,
    });
  } catch (err) { next(err); }
});

// GET /api/dashboard/staff
router.get("/staff", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const staffId = req.user.id;

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

    return ok(res, "Staff dashboard fetched", {
      stats: { totalClients, pendingEditingCount, readyForUploadCount, uploadedGalleriesCount, totalRevenue: totalPaid, totalPaid, totalPending },
      recentClients,
      recentPayments,
    });
  } catch (err) { next(err); }
});

export default router;
