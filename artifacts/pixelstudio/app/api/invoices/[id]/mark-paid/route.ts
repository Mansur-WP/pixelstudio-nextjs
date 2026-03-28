import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { clientsTable, invoicesTable, paymentsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";

function studioInfo(studio: { name?: string; logoUrl?: string | null } | null) {
  return {
    name:    studio?.name    ?? "PixelStudio",
    address: "14 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
    logoUrl: studio?.logoUrl ?? null,
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id } = await params;
  try {
    const [existing] = await db.select({
      id: invoicesTable.id, amount: invoicesTable.amount,
      paymentStatus: invoicesTable.paymentStatus, clientId: invoicesTable.clientId,
    }).from(invoicesTable)
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.studioId, studioId))).limit(1);

    if (!existing) return Response.json({ success: false, message: "Invoice not found" }, { status: 404 });

    const [client] = await db.select({ id: clientsTable.id, price: clientsTable.price, createdById: clientsTable.createdById })
      .from(clientsTable).where(eq(clientsTable.id, existing.clientId)).limit(1);

    if (ctx.user.role === "staff" && client.createdById !== ctx.user.id) {
      return Response.json({ success: false, message: "Access denied. This invoice belongs to another staff member's client." }, { status: 403 });
    }
    if (existing.paymentStatus === "PAID") {
      return Response.json({ success: false, message: "This invoice is already marked as PAID." }, { status: 409 });
    }

    await db.update(invoicesTable).set({ paymentStatus: "PAID" }).where(eq(invoicesTable.id, id));

    await db.insert(paymentsTable).values({
      amount: existing.amount, status: "PAID",
      clientId: existing.clientId, receivedById: ctx.user.id, studioId,
    });

    const [agg] = await db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
      .from(paymentsTable).where(and(eq(paymentsTable.clientId, existing.clientId), eq(paymentsTable.status, "PAID")));

    const totalPaid    = parseFloat(agg.total);
    const sessionPrice = parseFloat(client.price);
    const isFullyPaid  = totalPaid >= sessionPrice;

    if (isFullyPaid) {
      await db.update(clientsTable).set({ paymentStatus: "PAID" }).where(eq(clientsTable.id, existing.clientId));
      await db.update(invoicesTable).set({ paymentStatus: "PAID" })
        .where(and(eq(invoicesTable.clientId, existing.clientId), eq(invoicesTable.paymentStatus, "PENDING")));
    }

    const updated = await db.query.invoicesTable.findFirst({
      where: eq(invoicesTable.id, id),
      with: {
        client:    { columns: { id: true, clientName: true, phone: true, price: true, photoFormat: true, orderStatus: true, createdById: true } },
        createdBy: { columns: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!updated) return Response.json({ success: false, message: "Invoice not found" }, { status: 500 });
    const { createdById: _omit, ...clientData } = updated.client;
    return Response.json({ success: true, message: "Invoice marked as paid", data: { ...updated, client: clientData, studio: studioInfo(ctx.studio) } });
  } catch (err) {
    console.error("[invoices/id/mark-paid PATCH]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
