import { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@workspace/db";
import { clientsTable, photosTable, usersTable } from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const FREE_CLIENT_LIMIT    = 50;
const VALID_PHOTO_FORMATS  = ["SOFTCOPY", "HARDCOPY", "BOTH"];
const VALID_ORDER_STATUSES = ["PENDING", "EDITING", "READY", "DELIVERED"];
const VALID_PAYMENT_STATUSES = ["PENDING", "PAID"];

const trim = (v: unknown): string => (v === undefined || v === null ? "" : String(v).trim());

async function resolveOwnerId(ctx: { user: { id: string; role: string }; studio: { id: string } | null }, body: Record<string, unknown>): Promise<string | null> {
  if (ctx.user.role === "staff") return ctx.user.id;
  if (!body.createdById) return ctx.user.id;

  const [owner] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, body.createdById as string), eq(usersTable.isActive, true))).limit(1);
  return owner?.id ?? null;
}

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    const url    = new URL(request.url);
    const osf    = url.searchParams.get("orderStatus");
    const psf    = url.searchParams.get("paymentStatus");

    const conditions = [eq(clientsTable.studioId, studioId)] as ReturnType<typeof eq>[];
    if (osf) conditions.push(eq(clientsTable.orderStatus, osf as "PENDING" | "EDITING" | "READY" | "DELIVERED"));
    if (psf) conditions.push(eq(clientsTable.paymentStatus, psf as "PENDING" | "PAID"));

    const clients = await db.query.clientsTable.findMany({
      where: and(...conditions),
      orderBy: [desc(clientsTable.createdAt)],
      with: {
        createdBy: { columns: { id: true, name: true, email: true } },
        invoices:  { columns: { id: true, invoiceNumber: true, paymentStatus: true, amount: true } },
      },
    });

    // If staff, filter to own clients only
    const filtered = ctx.user.role === "staff"
      ? clients.filter(c => c.createdById === ctx.user.id)
      : clients;

    const clientsWithCounts = await Promise.all(filtered.map(async c => {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(photosTable).where(eq(photosTable.clientId, c.id));
      return { ...c, _count: { photos: Number(count) } };
    }));

    return Response.json({ success: true, message: `${filtered.length} client(s) found`, data: clientsWithCounts });
  } catch (err) {
    console.error("[clients GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    if (ctx.studio?.plan === "free") {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(clientsTable).where(eq(clientsTable.studioId, studioId));
      if (Number(count) >= FREE_CLIENT_LIMIT) {
        return Response.json({ success: false, message: `Free plan limit reached (${FREE_CLIENT_LIMIT} clients). Upgrade to Pro for unlimited clients.` }, { status: 403 });
      }
    }

    const body = await request.json();
    const clientName = trim(body.clientName);
    const phone      = trim(body.phone);
    const { price, deposit, photoFormat, orderStatus, paymentStatus, notes, createdById } = body;

    if (!clientName) return Response.json({ success: false, message: "clientName is required and must not be blank" }, { status: 400 });
    if (!phone)      return Response.json({ success: false, message: "phone is required and must not be blank" }, { status: 400 });

    const parsedPrice = parseFloat(price);
    if (price == null || isNaN(parsedPrice) || parsedPrice <= 0) {
      return Response.json({ success: false, message: "price must be a positive number greater than zero" }, { status: 400 });
    }

    const parsedDeposit = deposit != null ? parseFloat(deposit) : 0;
    if (isNaN(parsedDeposit) || parsedDeposit < 0) {
      return Response.json({ success: false, message: "deposit must be a non-negative number" }, { status: 400 });
    }
    if (parsedDeposit > parsedPrice) {
      return Response.json({ success: false, message: "deposit cannot exceed the agreed price" }, { status: 400 });
    }

    const resolvedFormat = photoFormat || "SOFTCOPY";
    if (!VALID_PHOTO_FORMATS.includes(resolvedFormat)) {
      return Response.json({ success: false, message: `photoFormat must be one of: ${VALID_PHOTO_FORMATS.join(", ")}` }, { status: 400 });
    }

    const resolvedOS = orderStatus   || "PENDING";
    const resolvedPS = paymentStatus || "PENDING";
    if (!VALID_ORDER_STATUSES.includes(resolvedOS))   return Response.json({ success: false, message: `orderStatus must be one of: ${VALID_ORDER_STATUSES.join(", ")}` }, { status: 400 });
    if (!VALID_PAYMENT_STATUSES.includes(resolvedPS)) return Response.json({ success: false, message: `paymentStatus must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}` }, { status: 400 });

    const ownerId = await resolveOwnerId(ctx as Parameters<typeof resolveOwnerId>[0], body);
    if (!ownerId) return Response.json({ success: false, message: "createdById is required and must reference an active staff member." }, { status: 400 });

    const galleryToken = crypto.randomBytes(16).toString("hex");
    const [client] = await db.insert(clientsTable).values({
      clientName, phone,
      price:         String(parsedPrice),
      deposit:       String(parsedDeposit),
      photoFormat:   resolvedFormat as "SOFTCOPY" | "HARDCOPY" | "BOTH",
      orderStatus:   resolvedOS as "PENDING" | "EDITING" | "READY" | "DELIVERED",
      paymentStatus: resolvedPS as "PENDING" | "PAID",
      notes:         notes ? String(notes).trim() || null : null,
      galleryToken,
      studioId,
      createdById:   ownerId,
    }).returning();

    const [createdBy] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, ownerId)).limit(1);

    logActivity({ studioId, userId: ctx.user.id, userName: ctx.user.name ?? "Unknown", userRole: ctx.user.role, action: "client_created", entityType: "client", entityId: client.id, entityName: clientName });
    return Response.json({ success: true, message: "Client record created", data: { ...client, createdBy } }, { status: 201 });
  } catch (err) {
    console.error("[clients POST]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
