import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { authenticate, isAuthContext, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const FREE_STAFF_LIMIT = 3;

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

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const role = requireRole(ctx, "admin");
  if (role) return role;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    const url    = new URL(request.url);
    const active = url.searchParams.get("active");

    const staff = await db.select(STAFF_COLS).from(usersTable)
      .where(and(eq(usersTable.studioId, studioId), eq(usersTable.role, "STAFF")))
      .orderBy(desc(usersTable.createdAt));

    const filtered = active !== null
      ? staff.filter(s => s.isActive === (active !== "false"))
      : staff;

    return Response.json({ success: true, message: `${filtered.length} staff member(s) found`, data: filtered });
  } catch (err) {
    console.error("[staff GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const role = requireRole(ctx, "admin");
  if (role) return role;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    if (ctx.studio?.plan === "free") {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(usersTable)
        .where(and(eq(usersTable.studioId, studioId), eq(usersTable.role, "STAFF")));
      if (Number(count) >= FREE_STAFF_LIMIT) {
        return Response.json({ success: false, message: `Free plan limit reached (${FREE_STAFF_LIMIT} staff members). Upgrade to Pro for unlimited staff.` }, { status: 403 });
      }
    }

    const body     = await request.json();
    const name     = req2str(body.name);
    const email    = req2str(body.email);
    const phone    = req2str(body.phone);
    const password = req2str(body.password);

    if (!name)     return Response.json({ success: false, message: "name is required and must not be blank" }, { status: 400 });
    if (!email)    return Response.json({ success: false, message: "email is required and must not be blank" }, { status: 400 });
    if (!phone)    return Response.json({ success: false, message: "phone is required and must not be blank" }, { status: 400 });
    if (!password || password.length < 6) {
      return Response.json({ success: false, message: "password must be at least 6 characters" }, { status: 400 });
    }

    const normEmail = email.toLowerCase();
    const [conflict] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.email, normEmail), eq(usersTable.studioId, studioId))).limit(1);
    if (conflict) return Response.json({ success: false, message: "A user with this email already exists in your studio" }, { status: 409 });

    const hashed = await bcrypt.hash(password, 10);
    const isActive = body.isActive !== false && body.isActive !== "false" && body.isActive !== 0;

    const [staff] = await db.insert(usersTable).values({
      name, email: normEmail, phone, password: hashed, role: "STAFF", isActive, studioId,
    }).returning(STAFF_COLS);

    logActivity({ studioId, userId: ctx.user.id, userName: ctx.user.name ?? "Unknown", userRole: ctx.user.role, action: "staff_created", entityType: "staff", entityId: staff.id, entityName: name });
    return Response.json({ success: true, message: "Staff member created successfully", data: staff }, { status: 201 });
  } catch (err) {
    console.error("[staff POST]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
