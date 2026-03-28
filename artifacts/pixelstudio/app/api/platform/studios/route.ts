import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { studiosTable, usersTable, clientsTable, photosTable, invoicesTable, paymentsTable } from "@workspace/db/schema";
import { eq, count, sum, desc, and, ne } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

async function enrichStudio(s: typeof studiosTable.$inferSelect) {
  const [staffCount, clientCount, photoCount, invoiceCount, revenue, adminUser] = await Promise.all([
    db.select({ count: count() }).from(usersTable)
      .where(and(eq(usersTable.studioId, s.id), ne(usersTable.role, "SUPERADMIN")))
      .then(r => Number(r[0].count)),
    db.select({ count: count() }).from(clientsTable).where(eq(clientsTable.studioId, s.id)).then(r => Number(r[0].count)),
    db.select({ count: count() }).from(photosTable).where(eq(photosTable.studioId, s.id)).then(r => Number(r[0].count)),
    db.select({ count: count() }).from(invoicesTable).where(eq(invoicesTable.studioId, s.id)).then(r => Number(r[0].count)),
    db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).where(eq(paymentsTable.studioId, s.id)).then(r => Number(r[0].total ?? 0)),
    db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable)
      .where(and(eq(usersTable.studioId, s.id), eq(usersTable.role, "ADMIN"))).limit(1).then(r => r[0] ?? null),
  ]);
  return { ...s, _stats: { staffCount, clientCount, photoCount, invoiceCount, revenue }, _admin: adminUser };
}

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  try {
    const studios  = await db.select().from(studiosTable).orderBy(desc(studiosTable.createdAt));
    const enriched = await Promise.all(studios.map(enrichStudio));
    return Response.json({ success: true, message: `${studios.length} studio(s) found`, data: enriched });
  } catch (err) {
    console.error("[platform/studios GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  try {
    const body = await request.json();
    const { name, slug, adminName, adminEmail, adminPassword, plan = "free" } = body;

    if (!name?.trim())          return Response.json({ success: false, message: "Studio name is required" }, { status: 400 });
    if (!slug?.trim())          return Response.json({ success: false, message: "Studio slug is required" }, { status: 400 });
    if (!adminName?.trim())     return Response.json({ success: false, message: "Admin name is required" }, { status: 400 });
    if (!adminEmail?.trim())    return Response.json({ success: false, message: "Admin email is required" }, { status: 400 });
    if (!adminPassword?.trim()) return Response.json({ success: false, message: "Admin password is required" }, { status: 400 });
    if (adminPassword.length < 6) return Response.json({ success: false, message: "Admin password must be at least 6 characters" }, { status: 400 });

    const cleanSlug = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,30}$/.test(cleanSlug)) {
      return Response.json({ success: false, message: "Slug must be 3–30 characters: lowercase letters, numbers, and hyphens only" }, { status: 400 });
    }

    const [existing] = await db.select({ id: studiosTable.id }).from(studiosTable).where(eq(studiosTable.slug, cleanSlug)).limit(1);
    if (existing) return Response.json({ success: false, message: `Slug "${cleanSlug}" is already taken` }, { status: 409 });

    const [studio] = await db.insert(studiosTable).values({
      name: name.trim(), slug: cleanSlug, plan: plan === "pro" ? "pro" : "free", isActive: true,
    }).returning();

    const hashedPw = await bcrypt.hash(adminPassword, 10);
    await db.insert(usersTable).values({
      name: adminName.trim(), email: adminEmail.trim().toLowerCase(), password: hashedPw,
      role: "ADMIN", phone: "00000000000", isActive: true, studioId: studio.id,
    });

    return Response.json({ success: true, message: `Studio "${studio.name}" created successfully`, data: await enrichStudio(studio) }, { status: 201 });
  } catch (err) {
    console.error("[platform/studios POST]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
