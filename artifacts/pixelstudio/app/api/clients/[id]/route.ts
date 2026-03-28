import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { clientsTable, photosTable, usersTable, invoicesTable, paymentsTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const VALID_PHOTO_FORMATS    = ["SOFTCOPY", "HARDCOPY", "BOTH"];
const VALID_ORDER_STATUSES   = ["PENDING", "EDITING", "READY", "DELIVERED"];
const VALID_PAYMENT_STATUSES = ["PENDING", "PAID"];

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id } = await params;
  try {
    const client = await db.query.clientsTable.findFirst({
      where: and(eq(clientsTable.id, id), eq(clientsTable.studioId, studioId)),
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
        invoices:  { orderBy: [desc(invoicesTable.createdAt)] },
        payments:  { orderBy: [desc(paymentsTable.createdAt)] },
      },
    });

    if (!client) return Response.json({ success: false, message: "Client not found" }, { status: 404 });
    if (ctx.user.role === "staff" && client.createdById !== ctx.user.id) {
      return Response.json({ success: false, message: "Access denied. This client belongs to a different staff member." }, { status: 403 });
    }
    return Response.json({ success: true, message: "Client fetched", data: client });
  } catch (err) {
    console.error("[clients/id GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id: clientId } = await params;
  try {
    const [existing] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.studioId, studioId))).limit(1);
    if (!existing) return Response.json({ success: false, message: "Client not found" }, { status: 404 });
    if (ctx.user.role === "staff" && existing.createdById !== ctx.user.id) {
      return Response.json({ success: false, message: "Access denied. You can only update your own clients." }, { status: 403 });
    }

    const body       = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.clientName !== undefined) {
      const v = String(body.clientName || "").trim();
      if (!v) return Response.json({ success: false, message: "clientName is required and must not be blank" }, { status: 400 });
      updateData.clientName = v;
    }
    if (body.phone !== undefined) {
      const v = String(body.phone || "").trim();
      if (!v) return Response.json({ success: false, message: "phone is required and must not be blank" }, { status: 400 });
      updateData.phone = v;
    }
    if (body.price !== undefined) {
      const p = parseFloat(body.price);
      if (isNaN(p) || p <= 0) return Response.json({ success: false, message: "price must be a positive number greater than zero" }, { status: 400 });
      updateData.price = String(p);
    }
    if (body.deposit !== undefined) {
      const d = parseFloat(body.deposit);
      if (isNaN(d) || d < 0) return Response.json({ success: false, message: "deposit must be a non-negative number" }, { status: 400 });
      const effectivePrice = updateData.price ? parseFloat(updateData.price as string) : parseFloat(existing.price);
      if (d > effectivePrice) return Response.json({ success: false, message: "deposit cannot exceed the agreed price" }, { status: 400 });
      updateData.deposit = String(d);
      if (body.paymentStatus === undefined) {
        updateData.paymentStatus = d >= effectivePrice ? "PAID" : "PENDING";
      }
    }
    if (body.photoFormat !== undefined) {
      if (!VALID_PHOTO_FORMATS.includes(body.photoFormat)) {
        return Response.json({ success: false, message: `photoFormat must be one of: ${VALID_PHOTO_FORMATS.join(", ")}` }, { status: 400 });
      }
      updateData.photoFormat = body.photoFormat;
    }
    if (body.orderStatus !== undefined) {
      if (!VALID_ORDER_STATUSES.includes(body.orderStatus)) {
        return Response.json({ success: false, message: `orderStatus must be one of: ${VALID_ORDER_STATUSES.join(", ")}` }, { status: 400 });
      }
      updateData.orderStatus = body.orderStatus;
    }
    if (body.paymentStatus !== undefined) {
      if (ctx.user.role === "staff") return Response.json({ success: false, message: "Staff cannot set paymentStatus directly." }, { status: 403 });
      if (!VALID_PAYMENT_STATUSES.includes(body.paymentStatus)) {
        return Response.json({ success: false, message: `paymentStatus must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}` }, { status: 400 });
      }
      updateData.paymentStatus = body.paymentStatus;
    }
    if (body.notes !== undefined) updateData.notes = body.notes ? String(body.notes).trim() || null : null;
    if (body.createdById !== undefined) {
      if (ctx.user.role === "staff") return Response.json({ success: false, message: "Staff cannot reassign client ownership." }, { status: 403 });
      const [owner] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(and(eq(usersTable.id, body.createdById as string), eq(usersTable.isActive, true))).limit(1);
      if (!owner) return Response.json({ success: false, message: "createdById must reference an active staff member." }, { status: 400 });
      updateData.createdById = owner.id;
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ success: false, message: "No valid fields were provided to update" }, { status: 400 });
    }

    const [updated] = await db.update(clientsTable).set(updateData).where(eq(clientsTable.id, clientId)).returning();
    const [createdBy] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, updated.createdById)).limit(1);
    return Response.json({ success: true, message: "Client updated", data: { ...updated, createdBy } });
  } catch (err) {
    console.error("[clients/id PUT]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  if (ctx.user.role === "staff") {
    return Response.json({ success: false, message: "Access denied. Admins only." }, { status: 403 });
  }

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id: clientId } = await params;
  try {
    const [existing] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.studioId, studioId))).limit(1);
    if (!existing) return Response.json({ success: false, message: "Client not found" }, { status: 404 });

    const photos = await db.select({ imageUrl: photosTable.imageUrl, fileName: photosTable.fileName })
      .from(photosTable).where(eq(photosTable.clientId, clientId));

    for (const photo of photos) {
      const filePath = path.join(UPLOAD_DIR, path.basename(photo.imageUrl));
      try { fs.unlinkSync(filePath); } catch {}
    }

    await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
    logActivity({ studioId, userId: ctx.user.id, userName: ctx.user.name ?? "Unknown", userRole: ctx.user.role, action: "client_deleted", entityType: "client", entityId: clientId, entityName: existing.clientName });
    return Response.json({ success: true, message: `Client record for "${existing.clientName}" and ${photos.length} photo(s) have been permanently deleted` });
  } catch (err) {
    console.error("[clients/id DELETE]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
