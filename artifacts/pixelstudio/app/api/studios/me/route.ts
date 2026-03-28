import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { studiosTable, usersTable, clientsTable, photosTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";
import { authenticate, isAuthContext, requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  if (!ctx.studio) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    const [staffCount, clientCount, photoCount] = await Promise.all([
      db.select({ count: count() }).from(usersTable)
        .where(and(eq(usersTable.studioId, ctx.studio.id), eq(usersTable.role, "STAFF"), eq(usersTable.isActive, true)))
        .then(r => Number(r[0].count)),
      db.select({ count: count() }).from(clientsTable)
        .where(eq(clientsTable.studioId, ctx.studio.id))
        .then(r => Number(r[0].count)),
      db.select({ count: count() }).from(photosTable)
        .where(eq(photosTable.studioId, ctx.studio.id))
        .then(r => Number(r[0].count)),
    ]);

    const limits = ctx.studio.plan === "pro"
      ? { staff: null, clients: null, photos: null }
      : { staff: 3, clients: 50, photos: 200 };

    return Response.json({
      success: true, message: "Studio fetched",
      data: {
        studio: {
          id:      ctx.studio.id,
          name:    ctx.studio.name,
          slug:    ctx.studio.slug,
          logoUrl: ctx.studio.logoUrl ?? null,
          phone:   ctx.studio.phone ?? null,
          address: ctx.studio.address ?? null,
          email:   ctx.studio.email ?? null,
          plan:    ctx.studio.plan,
        },
        usage:  { staffCount, clientCount, photoCount },
        limits,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[studios/me GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const roleErr = requireRole(ctx, "admin");
  if (roleErr) return roleErr;

  if (!ctx.studio) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    const body    = await request.json();
    const updates: Record<string, unknown> = {};
    const name = (body.name || "").trim();
    const slug = (body.slug || "").trim().toLowerCase();

    if (body.name !== undefined) {
      if (!name) return Response.json({ success: false, message: "name cannot be empty" }, { status: 400 });
      updates.name = name;
    }
    if (body.slug !== undefined) {
      if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
        return Response.json({ success: false, message: "slug must be 3–30 characters, lowercase letters, numbers, and hyphens only" }, { status: 400 });
      }
      const [conflict] = await db.select({ id: studiosTable.id }).from(studiosTable).where(eq(studiosTable.slug, slug)).limit(1);
      if (conflict && conflict.id !== ctx.studio.id) {
        return Response.json({ success: false, message: "This slug is already taken" }, { status: 409 });
      }
      updates.slug = slug;
    }
    if (body.logoUrl  !== undefined) updates.logoUrl  = body.logoUrl  || null;
    if (body.phone    !== undefined) updates.phone    = (body.phone    || "").trim() || null;
    if (body.address  !== undefined) updates.address  = (body.address  || "").trim() || null;
    if (body.email    !== undefined) updates.email    = (body.email    || "").trim() || null;

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, message: "No valid fields to update" }, { status: 400 });
    }

    const [updated] = await db.update(studiosTable).set(updates).where(eq(studiosTable.id, ctx.studio.id)).returning();
    return Response.json({
      success: true, message: "Studio updated",
      data: {
        id:      updated.id,
        name:    updated.name,
        slug:    updated.slug,
        logoUrl: updated.logoUrl ?? null,
        phone:   updated.phone   ?? null,
        address: updated.address ?? null,
        email:   updated.email   ?? null,
        plan:    updated.plan,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[studios/me PUT]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
