import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { usersTable, clientsTable, galleriesTable, invoicesTable, paymentsTable } from "@workspace/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import { authenticate, isAuthContext, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const STAFF_COLS = {
  id: usersTable.id, name: usersTable.name, email: usersTable.email, phone: usersTable.phone,
  role: usersTable.role, isActive: usersTable.isActive, studioId: usersTable.studioId,
  createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt,
};

const req2str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const roleErr = requireRole(ctx, "admin");
  if (roleErr) return roleErr;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id } = await params;
  try {
    const [staff] = await db.select(STAFF_COLS).from(usersTable)
      .where(and(eq(usersTable.id, id), eq(usersTable.role, "STAFF"), eq(usersTable.studioId, studioId))).limit(1);
    if (!staff) return Response.json({ success: false, message: "Staff member not found" }, { status: 404 });
    return Response.json({ success: true, message: "Staff member fetched", data: staff });
  } catch (err) {
    console.error("[staff/id GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const roleErr = requireRole(ctx, "admin");
  if (roleErr) return roleErr;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id: staffId } = await params;
  try {
    const [existing] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, staffId), eq(usersTable.role, "STAFF"), eq(usersTable.studioId, studioId))).limit(1);
    if (!existing) return Response.json({ success: false, message: "Staff member not found" }, { status: 404 });

    const body  = await request.json();
    const updateData: Record<string, unknown> = {};
    const name  = req2str(body.name);
    const phone = req2str(body.phone);
    let   email = req2str(body.email);

    if (body.name  !== undefined && !name)  return Response.json({ success: false, message: "name must not be blank" }, { status: 400 });
    if (body.phone !== undefined && !phone) return Response.json({ success: false, message: "phone must not be blank" }, { status: 400 });
    if (body.email !== undefined && !email) return Response.json({ success: false, message: "email must not be blank" }, { status: 400 });

    if (name)  updateData.name  = name;
    if (phone) updateData.phone = phone;
    if (email) {
      email = email.toLowerCase();
      const [conflict] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(and(eq(usersTable.email, email), eq(usersTable.studioId, studioId), ne(usersTable.id, staffId))).limit(1);
      if (conflict) return Response.json({ success: false, message: "This email is already in use by another user in your studio" }, { status: 409 });
      updateData.email = email;
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ success: false, message: "No valid fields were provided to update" }, { status: 400 });
    }

    const [staff] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, staffId)).returning(STAFF_COLS);
    return Response.json({ success: true, message: "Staff member updated", data: staff });
  } catch (err) {
    console.error("[staff/id PUT]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const roleErr = requireRole(ctx, "admin");
  if (roleErr) return roleErr;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id: staffId } = await params;
  const adminId = ctx.user.id;

  try {
    const [existing] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, staffId), eq(usersTable.role, "STAFF"), eq(usersTable.studioId, studioId))).limit(1);
    if (!existing) return Response.json({ success: false, message: "Staff member not found" }, { status: 404 });

    await Promise.all([
      db.update(clientsTable).set({ createdById: adminId }).where(eq(clientsTable.createdById, staffId)),
      db.update(galleriesTable).set({ uploadedById: adminId }).where(eq(galleriesTable.uploadedById, staffId)),
      db.update(invoicesTable).set({ createdById: adminId }).where(eq(invoicesTable.createdById, staffId)),
      db.update(paymentsTable).set({ receivedById: adminId }).where(eq(paymentsTable.receivedById, staffId)),
    ]);

    await db.delete(usersTable).where(eq(usersTable.id, staffId));
    logActivity({ studioId, userId: ctx.user.id, userName: ctx.user.name ?? "Unknown", userRole: ctx.user.role, action: "staff_deleted", entityType: "staff", entityId: staffId, entityName: existing.name });
    return Response.json({ success: true, message: `${existing.name}'s account has been permanently deleted` });
  } catch (err) {
    console.error("[staff/id DELETE]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
