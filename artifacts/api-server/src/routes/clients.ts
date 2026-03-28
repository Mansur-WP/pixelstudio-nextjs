import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import {
  usersTable, clientsTable, galleriesTable, photosTable, invoicesTable, paymentsTable,
} from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { authMiddleware, requireRole } from "./middleware";
import { logActivity } from "../lib/activity";

const router = Router();
router.use(authMiddleware);

const trimField     = (v: any): string | null => { if (v == null) return null; const t = String(v).trim(); return t.length > 0 ? t : null; };
const normaliseText = (v: any): string | null => { if (v == null) return null; const t = String(v).trim(); return t.length > 0 ? t : null; };

const VALID_PHOTO_FORMATS    = ["SOFTCOPY", "HARDCOPY", "BOTH"];
const VALID_PAYMENT_STATUSES = ["PENDING", "PAID"];
const VALID_ORDER_STATUSES   = ["PENDING", "EDITING", "READY", "DELIVERED"];

const FREE_CLIENT_LIMIT = 50;
const FREE_PHOTO_LIMIT  = 200;

const ok   = (res: any, message: string, data?: any, status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res: any, message: string, status = 400) => res.status(status).json({ success: false, message });

async function resolveClientOwnerId(req: any, currentOwnerId: string | null = null): Promise<string | null> {
  if (req.user.role === "staff") return req.user.id;
  if (req.body.createdById === undefined) return currentOwnerId;
  const createdById = trimField(req.body.createdById);
  if (!createdById) return null;
  const [owner] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, createdById), eq(usersTable.role, "STAFF"), eq(usersTable.isActive, true), eq(usersTable.studioId, req.studio.id)))
    .limit(1);
  return owner ? owner.id : null;
}

// GET /api/clients
router.get("/", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const conditions: any[] = [eq(clientsTable.studioId, studioId)];
    if (req.user.role === "staff") conditions.push(eq(clientsTable.createdById, req.user.id));
    if (req.query.orderStatus) {
      if (!VALID_ORDER_STATUSES.includes(req.query.orderStatus as string)) return fail(res, `orderStatus must be one of: ${VALID_ORDER_STATUSES.join(", ")}`, 400);
      conditions.push(eq(clientsTable.orderStatus, req.query.orderStatus as any));
    }
    if (req.query.paymentStatus) {
      if (!VALID_PAYMENT_STATUSES.includes(req.query.paymentStatus as string)) return fail(res, `paymentStatus must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}`, 400);
      conditions.push(eq(clientsTable.paymentStatus, req.query.paymentStatus as any));
    }

    const clients = await db.query.clientsTable.findMany({
      where: and(...conditions),
      orderBy: [desc(clientsTable.createdAt)],
      with: {
        createdBy: { columns: { id: true, name: true, email: true } },
        invoices:  { columns: { id: true, invoiceNumber: true, paymentStatus: true, amount: true } },
      },
    });

    const clientsWithCounts = await Promise.all(clients.map(async (c) => {
      const [photoCount] = await db.select({ count: sql<number>`count(*)` }).from(photosTable).where(eq(photosTable.clientId, c.id));
      return { ...c, _count: { photos: Number(photoCount.count) } };
    }));

    return ok(res, `${clients.length} client(s) found`, clientsWithCounts);
  } catch (err) { next(err); }
});

// GET /api/clients/:id
router.get("/:id", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const client = await db.query.clientsTable.findFirst({
      where: and(eq(clientsTable.id, req.params.id), eq(clientsTable.studioId, studioId)),
      with: {
        createdBy: { columns: { id: true, name: true, email: true } },
        gallery: {
          with: {
            photos: {
              columns: { id: true, imageUrl: true, fileName: true, createdAt: true },
              orderBy: [desc(photosTable.createdAt)],
            },
          },
        },
        invoices: { orderBy: [desc(invoicesTable.createdAt)] },
        payments: { orderBy: [desc(paymentsTable.createdAt)] },
      },
    });

    if (!client) return fail(res, "Client not found", 404);
    if (req.user.role === "staff" && client.createdById !== req.user.id) {
      return fail(res, "Access denied. This client belongs to a different staff member.", 403);
    }
    return ok(res, "Client fetched", client);
  } catch (err) { next(err); }
});

// POST /api/clients
router.post("/", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    // Plan enforcement: client limit
    if (req.studio.plan === "free") {
      const [{ count: clientCount }] = await db.select({ count: sql<number>`count(*)` })
        .from(clientsTable).where(eq(clientsTable.studioId, studioId));
      if (Number(clientCount) >= FREE_CLIENT_LIMIT) {
        return fail(res, `Free plan limit reached (${FREE_CLIENT_LIMIT} clients). Upgrade to Pro for unlimited clients.`, 403);
      }
    }

    const clientName = trimField(req.body.clientName);
    const phone      = trimField(req.body.phone);
    const { price, deposit, photoFormat } = req.body;

    if (!clientName) return fail(res, "clientName is required and must not be blank", 400);
    if (!phone)      return fail(res, "phone is required and must not be blank", 400);

    const parsedPrice = parseFloat(price);
    if (price == null || isNaN(parsedPrice) || parsedPrice <= 0) return fail(res, "price must be a positive number greater than zero", 400);

    const parsedDeposit = deposit != null ? parseFloat(deposit) : 0;
    if (isNaN(parsedDeposit) || parsedDeposit < 0) return fail(res, "deposit must be a non-negative number", 400);
    if (parsedDeposit > parsedPrice) return fail(res, "deposit cannot exceed the agreed price", 400);

    const resolvedFormat = photoFormat || "SOFTCOPY";
    if (!VALID_PHOTO_FORMATS.includes(resolvedFormat)) return fail(res, `photoFormat must be one of: ${VALID_PHOTO_FORMATS.join(", ")}`, 400);

    const resolvedOrderStatus   = req.body.orderStatus   || "PENDING";
    const resolvedPaymentStatus = req.body.paymentStatus || "PENDING";
    if (!VALID_ORDER_STATUSES.includes(resolvedOrderStatus))   return fail(res, `orderStatus must be one of: ${VALID_ORDER_STATUSES.join(", ")}`, 400);
    if (!VALID_PAYMENT_STATUSES.includes(resolvedPaymentStatus)) return fail(res, `paymentStatus must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}`, 400);

    const ownerId = await resolveClientOwnerId(req);
    if (!ownerId) return fail(res, "createdById is required and must reference an active staff member.", 400);

    const galleryToken = crypto.randomBytes(16).toString("hex");
    const [client] = await db.insert(clientsTable).values({
      clientName, phone,
      price:         String(parsedPrice),
      deposit:       String(parsedDeposit),
      photoFormat:   resolvedFormat as any,
      orderStatus:   resolvedOrderStatus as any,
      paymentStatus: resolvedPaymentStatus as any,
      notes:         normaliseText(req.body.notes),
      galleryToken,
      studioId,
      createdById:   ownerId,
    }).returning();

    const [createdBy] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, ownerId)).limit(1);

    logActivity({ studioId, userId: req.user.id, userName: req.user.name ?? "Unknown", userRole: req.user.role, action: "client_created", entityType: "client", entityId: client.id, entityName: clientName });
    return ok(res, "Client record created", { ...client, createdBy }, 201);
  } catch (err) { next(err); }
});

// PUT /api/clients/:id
router.put("/:id", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const clientId = req.params.id;
    const [existing] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.studioId, studioId))).limit(1);
    if (!existing) return fail(res, "Client not found", 404);
    if (req.user.role === "staff" && existing.createdById !== req.user.id) return fail(res, "Access denied. You can only update your own clients.", 403);

    const updateData: any = {};
    if (req.body.clientName !== undefined) {
      const v = trimField(req.body.clientName);
      if (!v) return fail(res, "clientName is required and must not be blank", 400);
      updateData.clientName = v;
    }
    if (req.body.phone !== undefined) {
      const v = trimField(req.body.phone);
      if (!v) return fail(res, "phone is required and must not be blank", 400);
      updateData.phone = v;
    }
    if (req.body.price !== undefined) {
      const p = parseFloat(req.body.price);
      if (isNaN(p) || p <= 0) return fail(res, "price must be a positive number greater than zero", 400);
      updateData.price = String(p);
    }
    if (req.body.deposit !== undefined) {
      const d = parseFloat(req.body.deposit);
      if (isNaN(d) || d < 0) return fail(res, "deposit must be a non-negative number", 400);
      const effectivePrice = updateData.price ? parseFloat(updateData.price) : parseFloat(existing.price);
      if (d > effectivePrice) return fail(res, "deposit cannot exceed the agreed price", 400);
      updateData.deposit = String(d);
      if (req.body.paymentStatus === undefined) {
        updateData.paymentStatus = d >= effectivePrice ? "PAID" : "PENDING";
      }
    }
    if (req.body.photoFormat !== undefined) {
      if (!VALID_PHOTO_FORMATS.includes(req.body.photoFormat)) return fail(res, `photoFormat must be one of: ${VALID_PHOTO_FORMATS.join(", ")}`, 400);
      updateData.photoFormat = req.body.photoFormat;
    }
    if (req.body.orderStatus !== undefined) {
      if (!VALID_ORDER_STATUSES.includes(req.body.orderStatus)) return fail(res, `orderStatus must be one of: ${VALID_ORDER_STATUSES.join(", ")}`, 400);
      updateData.orderStatus = req.body.orderStatus;
    }
    if (req.body.paymentStatus !== undefined) {
      if (req.user.role === "staff") return fail(res, "Staff cannot set paymentStatus directly.", 403);
      if (!VALID_PAYMENT_STATUSES.includes(req.body.paymentStatus)) return fail(res, `paymentStatus must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}`, 400);
      updateData.paymentStatus = req.body.paymentStatus;
    }
    if (req.body.notes !== undefined) updateData.notes = normaliseText(req.body.notes);
    if (req.body.createdById !== undefined) {
      if (req.user.role === "staff") return fail(res, "Staff cannot reassign client ownership.", 403);
      const ownerId = await resolveClientOwnerId(req, existing.createdById);
      if (!ownerId) return fail(res, "createdById must reference an active staff member.", 400);
      updateData.createdById = ownerId;
    }

    if (Object.keys(updateData).length === 0) return fail(res, "No valid fields were provided to update", 400);

    const [updated] = await db.update(clientsTable).set(updateData).where(eq(clientsTable.id, clientId)).returning();
    const [createdBy] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, updated.createdById)).limit(1);
    return ok(res, "Client updated", { ...updated, createdBy });
  } catch (err) { next(err); }
});

// DELETE /api/clients/:id  (admin only)
router.delete("/:id", requireRole("admin"), async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const [existing] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, req.params.id), eq(clientsTable.studioId, studioId))).limit(1);
    if (!existing) return fail(res, "Client not found", 404);

    const photos = await db.select({ imageUrl: photosTable.imageUrl }).from(photosTable)
      .where(eq(photosTable.clientId, req.params.id));

    const uploadsDir = path.resolve("uploads");
    for (const photo of photos) {
      const filePath = path.join(uploadsDir, path.basename(photo.imageUrl));
      try { fs.unlinkSync(filePath); } catch {}
    }

    await db.delete(clientsTable).where(eq(clientsTable.id, req.params.id));
    logActivity({ studioId, userId: req.user.id, userName: req.user.name ?? "Unknown", userRole: req.user.role, action: "client_deleted", entityType: "client", entityId: req.params.id, entityName: existing.clientName });
    return ok(res, `Client record for "${existing.clientName}" and ${photos.length} photo(s) have been permanently deleted`);
  } catch (err) { next(err); }
});

export default router;
