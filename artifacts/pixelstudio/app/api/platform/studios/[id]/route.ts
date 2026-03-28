import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { studiosTable, usersTable, clientsTable, photosTable, invoicesTable, paymentsTable, galleriesTable } from "@workspace/db/schema";
import { eq, count, sum, and, ne } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

async function enrichStudio(s: typeof studiosTable.$inferSelect) {
  const [staffCount, clientCount, photoCount, invoiceCount, revenue, adminUser] = await Promise.all([
    db.select({ count: count() }).from(usersTable).where(and(eq(usersTable.studioId, s.id), ne(usersTable.role, "SUPERADMIN"))).then(r => Number(r[0].count)),
    db.select({ count: count() }).from(clientsTable).where(eq(clientsTable.studioId, s.id)).then(r => Number(r[0].count)),
    db.select({ count: count() }).from(photosTable).where(eq(photosTable.studioId, s.id)).then(r => Number(r[0].count)),
    db.select({ count: count() }).from(invoicesTable).where(eq(invoicesTable.studioId, s.id)).then(r => Number(r[0].count)),
    db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).where(eq(paymentsTable.studioId, s.id)).then(r => Number(r[0].total ?? 0)),
    db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable)
      .where(and(eq(usersTable.studioId, s.id), eq(usersTable.role, "ADMIN"))).limit(1).then(r => r[0] ?? null),
  ]);
  return { ...s, _stats: { staffCount, clientCount, photoCount, invoiceCount, revenue }, _admin: adminUser };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const { id } = await params;
  try {
    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.id, id)).limit(1);
    if (!studio) return Response.json({ success: false, message: "Studio not found" }, { status: 404 });
    return Response.json({ success: true, message: "Studio fetched", data: await enrichStudio(studio) });
  } catch (err) {
    console.error("[platform/studios/id GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const { id } = await params;
  try {
    const [existing] = await db.select().from(studiosTable).where(eq(studiosTable.id, id)).limit(1);
    if (!existing) return Response.json({ success: false, message: "Studio not found" }, { status: 404 });

    const body    = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);
    if (body.plan     !== undefined) updates.plan     = body.plan;
    if (body.name     !== undefined) {
      const name = body.name.trim();
      if (!name) return Response.json({ success: false, message: "Name cannot be empty" }, { status: 400 });
      updates.name = name;
    }
    if (body.slug !== undefined) {
      const slug = body.slug.trim().toLowerCase();
      if (!/^[a-z0-9-]{3,30}$/.test(slug)) return Response.json({ success: false, message: "Invalid slug format" }, { status: 400 });
      const [conflict] = await db.select({ id: studiosTable.id }).from(studiosTable).where(eq(studiosTable.slug, slug)).limit(1);
      if (conflict && conflict.id !== id) return Response.json({ success: false, message: "Slug already taken" }, { status: 409 });
      updates.slug = slug;
    }
    if (body.subscriptionStatus !== undefined) {
      const allowed = ["active", "trial", "expired"];
      if (!allowed.includes(body.subscriptionStatus)) return Response.json({ success: false, message: "Invalid subscription status" }, { status: 400 });
      updates.subscriptionStatus = body.subscriptionStatus;
    }
    if (body.trialEndsAt !== undefined) {
      updates.trialEndsAt = body.trialEndsAt ? new Date(body.trialEndsAt) : null;
    }

    if (Object.keys(updates).length === 0) return Response.json({ success: false, message: "No fields to update" }, { status: 400 });

    const [updated] = await db.update(studiosTable).set(updates).where(eq(studiosTable.id, id)).returning();
    return Response.json({ success: true, message: "Studio updated", data: await enrichStudio(updated) });
  } catch (err) {
    console.error("[platform/studios/id PATCH]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const { id } = await params;
  try {
    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.id, id)).limit(1);
    if (!studio) return Response.json({ success: false, message: "Studio not found" }, { status: 404 });

    await db.delete(paymentsTable).where(eq(paymentsTable.studioId, studio.id));
    await db.delete(invoicesTable).where(eq(invoicesTable.studioId, studio.id));
    await db.delete(photosTable).where(eq(photosTable.studioId, studio.id));
    await db.delete(galleriesTable).where(eq(galleriesTable.studioId, studio.id));
    await db.delete(clientsTable).where(eq(clientsTable.studioId, studio.id));
    await db.delete(usersTable).where(eq(usersTable.studioId, studio.id));
    await db.delete(studiosTable).where(eq(studiosTable.id, studio.id));

    return Response.json({ success: true, message: `Studio "${studio.name}" and all its data deleted` });
  } catch (err) {
    console.error("[platform/studios/id DELETE]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
