import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, invoicesTable, paymentsTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { authMiddleware } from "./middleware";
import { logActivity } from "../lib/activity";

const router = Router();
router.use(authMiddleware);

const ok   = (res: any, message: string, data?: any, status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res: any, message: string, status = 400) => res.status(status).json({ success: false, message });

function studioInfo(studio: any) {
  return {
    name:    studio?.name    ?? (process.env.STUDIO_NAME    || "PixelStudio"),
    address: studio?.address ?? (process.env.STUDIO_ADDRESS || "14 Admiralty Way, Lekki Phase 1, Lagos, Nigeria"),
    logoUrl: studio?.logoUrl ?? null,
  };
}

async function generateInvoiceNumber(studioId: string): Promise<string> {
  const existing = await db.select({ invoiceNumber: invoicesTable.invoiceNumber })
    .from(invoicesTable).where(eq(invoicesTable.studioId, studioId));
  if (existing.length === 0) return "INV-0001";
  const numbers = existing.map(inv => {
    const match = inv.invoiceNumber.match(/^INV-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const max = numbers.reduce((h, n) => n > h ? n : h, 0);
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

// GET /api/invoices
router.get("/", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const invoices = await db.query.invoicesTable.findMany({
      where: eq(invoicesTable.studioId, studioId),
      orderBy: [desc(invoicesTable.createdAt)],
      with: {
        client:    { columns: { id: true, clientName: true, phone: true, orderStatus: true, createdById: true } },
        createdBy: { columns: { id: true, name: true } },
      },
    });

    const filtered = req.user.role === "staff"
      ? invoices.filter(i => i.client.createdById === req.user.id)
      : invoices;

    const result = filtered.map(({ client: { createdById: _omit, ...c }, ...inv }) => ({ ...inv, client: c }));
    return ok(res, "Invoices fetched", result);
  } catch (err) { next(err); }
});

// GET /api/invoices/:id
router.get("/:id", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const invoice = await db.query.invoicesTable.findFirst({
      where: and(eq(invoicesTable.id, req.params.id), eq(invoicesTable.studioId, studioId)),
      with: {
        client:    { columns: { id: true, clientName: true, phone: true, price: true, photoFormat: true, orderStatus: true, createdById: true } },
        createdBy: { columns: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!invoice) return fail(res, "Invoice not found", 404);
    if (req.user.role === "staff" && invoice.client.createdById !== req.user.id) {
      return fail(res, "Access denied. This invoice belongs to another staff member's client.", 403);
    }

    const { createdById: _omit, ...clientData } = invoice.client;
    return ok(res, "Invoice fetched", { ...invoice, client: clientData, studio: studioInfo(req.studio) });
  } catch (err) { next(err); }
});

// POST /api/invoices/:clientId
router.post("/:clientId", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const { clientId } = req.params;
    const { amount }   = req.body;

    if (amount !== undefined && amount !== null && amount !== "") {
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) return fail(res, "amount must be a positive number", 400);
    }

    const [client] = await db.select({ id: clientsTable.id, price: clientsTable.price, createdById: clientsTable.createdById })
      .from(clientsTable).where(and(eq(clientsTable.id, clientId), eq(clientsTable.studioId, studioId))).limit(1);

    if (!client) return fail(res, "Client not found", 404);
    if (req.user.role === "staff" && client.createdById !== req.user.id) {
      return fail(res, "Access denied. This client belongs to a different staff member.", 403);
    }

    const resolvedAmount = (amount !== undefined && amount !== null && amount !== "")
      ? parseFloat(amount)
      : parseFloat(client.price);

    const invoiceNumber = await generateInvoiceNumber(studioId);

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber, amount: String(resolvedAmount),
      paymentStatus: "PENDING", clientId, createdById: req.user.id, studioId,
    }).returning();

    const full = await db.query.invoicesTable.findFirst({
      where: eq(invoicesTable.id, invoice.id),
      with: {
        client:    { columns: { id: true, clientName: true, phone: true, price: true, photoFormat: true, orderStatus: true, createdById: true } },
        createdBy: { columns: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!full) return fail(res, "Invoice not found after creation", 500);
    const { createdById: _omit, ...clientData } = full.client;
    logActivity({ studioId, userId: req.user.id, userName: req.user.name ?? "Unknown", userRole: req.user.role, action: "invoice_created", entityType: "invoice", entityId: invoice.id, entityName: invoiceNumber });
    return ok(res, `Invoice ${invoiceNumber} generated successfully`, { ...full, client: clientData, studio: studioInfo(req.studio) }, 201);
  } catch (err) { next(err); }
});

// PATCH /api/invoices/:id/mark-paid
router.patch("/:id/mark-paid", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const [existing] = await db.select({
      id: invoicesTable.id, amount: invoicesTable.amount, paymentStatus: invoicesTable.paymentStatus,
      clientId: invoicesTable.clientId,
    }).from(invoicesTable)
      .where(and(eq(invoicesTable.id, req.params.id), eq(invoicesTable.studioId, studioId))).limit(1);

    if (!existing) return fail(res, "Invoice not found", 404);

    const [client] = await db.select({ id: clientsTable.id, price: clientsTable.price, createdById: clientsTable.createdById })
      .from(clientsTable).where(eq(clientsTable.id, existing.clientId)).limit(1);

    if (req.user.role === "staff" && client.createdById !== req.user.id) {
      return fail(res, "Access denied. This invoice belongs to another staff member's client.", 403);
    }
    if (existing.paymentStatus === "PAID") return fail(res, "This invoice is already marked as PAID.", 409);

    await db.update(invoicesTable).set({ paymentStatus: "PAID" }).where(eq(invoicesTable.id, req.params.id));

    await db.insert(paymentsTable).values({
      amount: existing.amount, status: "PAID", clientId: existing.clientId, receivedById: req.user.id, studioId,
    });

    const [agg] = await db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.clientId, existing.clientId), eq(paymentsTable.status, "PAID")));

    const totalPaid    = parseFloat(agg.total);
    const sessionPrice = parseFloat(client.price);
    const isFullyPaid  = totalPaid >= sessionPrice;

    if (isFullyPaid) {
      await db.update(clientsTable).set({ paymentStatus: "PAID" }).where(eq(clientsTable.id, existing.clientId));
      await db.update(invoicesTable).set({ paymentStatus: "PAID" })
        .where(and(eq(invoicesTable.clientId, existing.clientId), eq(invoicesTable.paymentStatus, "PENDING")));
    }

    const updated = await db.query.invoicesTable.findFirst({
      where: eq(invoicesTable.id, req.params.id),
      with: {
        client:    { columns: { id: true, clientName: true, phone: true, price: true, photoFormat: true, orderStatus: true, createdById: true } },
        createdBy: { columns: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!updated) return fail(res, "Invoice not found", 500);
    const { createdById: _omit, ...clientData } = updated.client;
    return ok(res, "Invoice marked as paid", { ...updated, client: clientData, studio: studioInfo(req.studio) });
  } catch (err) { next(err); }
});

export default router;
