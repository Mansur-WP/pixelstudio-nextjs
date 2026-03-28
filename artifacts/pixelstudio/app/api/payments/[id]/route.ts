import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { clientsTable, paymentsTable, invoicesTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id } = await params;
  try {
    const payment = await db.query.paymentsTable.findFirst({
      where: and(eq(paymentsTable.id, id), eq(paymentsTable.studioId, studioId)),
      with: {
        client:     { columns: { id: true, clientName: true, phone: true, price: true, paymentStatus: true, orderStatus: true, createdById: true } },
        receivedBy: { columns: { id: true, name: true, email: true } },
      },
    });

    if (!payment) return Response.json({ success: false, message: "Payment not found" }, { status: 404 });
    if (ctx.user.role === "staff" && payment.client.createdById !== ctx.user.id) {
      return Response.json({ success: false, message: "Access denied. This payment belongs to another staff member's client." }, { status: 403 });
    }
    const { createdById: _omit, ...clientData } = payment.client;
    return Response.json({ success: true, message: "Payment fetched", data: { ...payment, client: clientData } });
  } catch (err) {
    console.error("[payments/id GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id: clientId } = await params;
  try {
    const body = await request.json();
    const { amount } = body;

    if (amount === undefined || amount === null || amount === "") {
      return Response.json({ success: false, message: "amount is required" }, { status: 400 });
    }
    const resolvedAmount = parseFloat(amount);
    if (isNaN(resolvedAmount) || resolvedAmount <= 0) {
      return Response.json({ success: false, message: "amount must be a positive number" }, { status: 400 });
    }

    const [client] = await db.select({ id: clientsTable.id, price: clientsTable.price, createdById: clientsTable.createdById })
      .from(clientsTable).where(and(eq(clientsTable.id, clientId), eq(clientsTable.studioId, studioId))).limit(1);

    if (!client) return Response.json({ success: false, message: "Client not found" }, { status: 404 });
    if (ctx.user.role === "staff" && client.createdById !== ctx.user.id) {
      return Response.json({ success: false, message: "Access denied. This client belongs to a different staff member." }, { status: 403 });
    }

    const sessionPrice = parseFloat(client.price);
    const [newPayment] = await db.insert(paymentsTable).values({
      amount: String(resolvedAmount), status: "PAID", clientId, receivedById: ctx.user.id, studioId,
    }).returning({ id: paymentsTable.id });

    const [agg] = await db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
      .from(paymentsTable).where(and(eq(paymentsTable.clientId, clientId), eq(paymentsTable.status, "PAID")));

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

    if (!fullPayment) return Response.json({ success: false, message: "Payment not found" }, { status: 500 });

    const { createdById: _omit, ...clientData } = fullPayment.client;
    const balance = Math.max(0, sessionPrice - totalPaid);

    logActivity({ studioId, userId: ctx.user.id, userName: ctx.user.name ?? "Unknown", userRole: ctx.user.role, action: "payment_recorded", entityType: "payment", entityId: newPayment.id, entityName: `₦${resolvedAmount.toFixed(2)}` });

    return Response.json({
      success: true, message: "Payment recorded successfully",
      data: { payment: { ...fullPayment, client: clientData }, summary: { totalPaid, sessionPrice, balance, isFullyPaid } },
    }, { status: 201 });
  } catch (err) {
    console.error("[payments/id POST]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
