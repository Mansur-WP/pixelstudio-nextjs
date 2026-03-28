import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, paymentsTable, invoicesTable } from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { authMiddleware } from "./middleware";
import { logActivity } from "../lib/activity";

const router = Router();
router.use(authMiddleware);

const ok   = (res: any, message: string, data?: any, status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res: any, message: string, status = 400) => res.status(status).json({ success: false, message });

const formatPayment = (payment: any) => {
  const { createdById: _omit, ...clientData } = payment.client;
  return { ...payment, client: clientData };
};

// GET /api/payments
router.get("/", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const payments = await db.query.paymentsTable.findMany({
      where: eq(paymentsTable.studioId, studioId),
      orderBy: [desc(paymentsTable.createdAt)],
      with: {
        client:     { columns: { id: true, clientName: true, phone: true, createdById: true } },
        receivedBy: { columns: { id: true, name: true } },
      },
    });

    const filtered = req.user.role === "staff"
      ? payments.filter(p => p.client.createdById === req.user.id)
      : payments;

    const result = filtered.map(p => {
      const { createdById: _omit, ...c } = p.client;
      return { ...p, client: c };
    });
    return ok(res, "Payments fetched", result);
  } catch (err) { next(err); }
});

// GET /api/payments/:id
router.get("/:id", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const payment = await db.query.paymentsTable.findFirst({
      where: and(eq(paymentsTable.id, req.params.id), eq(paymentsTable.studioId, studioId)),
      with: {
        client:     { columns: { id: true, clientName: true, phone: true, price: true, paymentStatus: true, orderStatus: true, createdById: true } },
        receivedBy: { columns: { id: true, name: true, email: true } },
      },
    });

    if (!payment) return fail(res, "Payment not found", 404);
    if (req.user.role === "staff" && payment.client.createdById !== req.user.id) {
      return fail(res, "Access denied. This payment belongs to another staff member's client.", 403);
    }
    return ok(res, "Payment fetched", formatPayment(payment));
  } catch (err) { next(err); }
});

// POST /api/payments/:clientId
router.post("/:clientId", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const { clientId } = req.params;
    const { amount }   = req.body;

    if (amount === undefined || amount === null || amount === "") return fail(res, "amount is required", 400);
    const resolvedAmount = parseFloat(amount);
    if (isNaN(resolvedAmount) || resolvedAmount <= 0) return fail(res, "amount must be a positive number", 400);

    const [client] = await db.select({ id: clientsTable.id, price: clientsTable.price, createdById: clientsTable.createdById })
      .from(clientsTable).where(and(eq(clientsTable.id, clientId), eq(clientsTable.studioId, studioId))).limit(1);

    if (!client) return fail(res, "Client not found", 404);
    if (req.user.role === "staff" && client.createdById !== req.user.id) {
      return fail(res, "Access denied. This client belongs to a different staff member.", 403);
    }

    const sessionPrice = parseFloat(client.price);

    const [newPayment] = await db.insert(paymentsTable).values({
      amount: String(resolvedAmount), status: "PAID", clientId, receivedById: req.user.id, studioId,
    }).returning({ id: paymentsTable.id });

    const [agg] = await db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.clientId, clientId), eq(paymentsTable.status, "PAID")));

    const totalPaid   = parseFloat(agg.total);
    const isFullyPaid = totalPaid >= sessionPrice;

    if (isFullyPaid) {
      await db.update(clientsTable).set({ paymentStatus: "PAID" }).where(eq(clientsTable.id, clientId));
      await db.update(invoicesTable).set({ paymentStatus: "PAID" })
        .where(and(eq(invoicesTable.clientId, clientId), eq(invoicesTable.paymentStatus, "PENDING")));
    }

    const fullPayment = await db.query.paymentsTable.findFirst({
      where: eq(paymentsTable.id, newPayment.id),
      with: {
        client:     { columns: { id: true, clientName: true, phone: true, price: true, paymentStatus: true, orderStatus: true, createdById: true } },
        receivedBy: { columns: { id: true, name: true, email: true } },
      },
    });

    if (!fullPayment) return fail(res, "Payment not found", 500);
    const balance = Math.max(0, sessionPrice - totalPaid);

    logActivity({ studioId, userId: req.user.id, userName: req.user.name ?? "Unknown", userRole: req.user.role, action: "payment_recorded", entityType: "payment", entityId: newPayment.id, entityName: `$${resolvedAmount.toFixed(2)}` });
    return ok(res, "Payment recorded successfully", {
      payment: formatPayment(fullPayment),
      summary: { totalPaid, sessionPrice, balance, isFullyPaid },
    }, 201);
  } catch (err) { next(err); }
});

export default router;
