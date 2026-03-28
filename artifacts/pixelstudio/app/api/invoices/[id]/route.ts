import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { clientsTable, invoicesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

function studioInfo(studio: { name?: string; logoUrl?: string | null } | null) {
  return {
    name:    studio?.name    ?? "PixelStudio",
    address: "14 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id } = await params;
  try {
    const invoice = await db.query.invoicesTable.findFirst({
      where: and(eq(invoicesTable.id, id), eq(invoicesTable.studioId, studioId)),
      with: {
        client:    { columns: { id: true, clientName: true, phone: true, price: true, photoFormat: true, orderStatus: true, createdById: true } },
        createdBy: { columns: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!invoice) return Response.json({ success: false, message: "Invoice not found" }, { status: 404 });
    if (ctx.user.role === "staff" && invoice.client.createdById !== ctx.user.id) {
      return Response.json({ success: false, message: "Access denied. This invoice belongs to another staff member's client." }, { status: 403 });
    }

    const { createdById: _omit, ...clientData } = invoice.client;
    return Response.json({ success: true, message: "Invoice fetched", data: { ...invoice, client: clientData, studio: studioInfo(ctx.studio) } });
  } catch (err) {
    console.error("[invoices/id GET]", err);
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

    if (amount !== undefined && amount !== null && amount !== "") {
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) {
        return Response.json({ success: false, message: "amount must be a positive number" }, { status: 400 });
      }
    }

    const [client] = await db.select({ id: clientsTable.id, price: clientsTable.price, createdById: clientsTable.createdById })
      .from(clientsTable).where(and(eq(clientsTable.id, clientId), eq(clientsTable.studioId, studioId))).limit(1);

    if (!client) return Response.json({ success: false, message: "Client not found" }, { status: 404 });
    if (ctx.user.role === "staff" && client.createdById !== ctx.user.id) {
      return Response.json({ success: false, message: "Access denied. This client belongs to a different staff member." }, { status: 403 });
    }

    const resolvedAmount = (amount !== undefined && amount !== null && amount !== "")
      ? parseFloat(amount)
      : parseFloat(client.price);

    const invoiceNumber = await generateInvoiceNumber(studioId);
    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber, amount: String(resolvedAmount),
      paymentStatus: "PENDING", clientId, createdById: ctx.user.id, studioId,
    }).returning();

    const full = await db.query.invoicesTable.findFirst({
      where: eq(invoicesTable.id, invoice.id),
      with: {
        client:    { columns: { id: true, clientName: true, phone: true, price: true, photoFormat: true, orderStatus: true, createdById: true } },
        createdBy: { columns: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!full) return Response.json({ success: false, message: "Invoice not found after creation" }, { status: 500 });
    const { createdById: _omit, ...clientData } = full.client;
    logActivity({ studioId, userId: ctx.user.id, userName: ctx.user.name ?? "Unknown", userRole: ctx.user.role, action: "invoice_created", entityType: "invoice", entityId: invoice.id, entityName: invoiceNumber });
    return Response.json({ success: true, message: `Invoice ${invoiceNumber} generated successfully`, data: { ...full, client: clientData, studio: studioInfo(ctx.studio) } }, { status: 201 });
  } catch (err) {
    console.error("[invoices/id POST]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
