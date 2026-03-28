import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable, studiosTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const SECRET  = process.env.JWT_SECRET     || "dev_fallback_secret_change_me_in_production";
const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

const signToken = (payload: object) => jwt.sign(payload, SECRET, { expiresIn: EXPIRES as unknown as number });

const formatUser = (user: { id: string; name: string; email: string; phone: string; role: string; studioId: string | null; isActive: boolean; createdAt: Date | null }) => ({
  id:        user.id,
  name:      user.name,
  email:     user.email,
  phone:     user.phone,
  role:      user.role.toLowerCase(),
  studioId:  user.studioId ?? null,
  isActive:  user.isActive,
  createdAt: user.createdAt || null,
});

const formatStudio = (studio: { id: string; name: string; slug: string; logoUrl: string | null; phone: string | null; address: string | null; email: string | null; plan: string }) => ({
  id:      studio.id,
  name:    studio.name,
  slug:    studio.slug,
  logoUrl: studio.logoUrl ?? null,
  phone:   studio.phone   ?? null,
  address: studio.address ?? null,
  email:   studio.email   ?? null,
  plan:    studio.plan,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, role, studioSlug } = body;

    if (!email || !password || !role) {
      return Response.json({ success: false, message: "email, password, and role are required" }, { status: 400 });
    }

    // Superadmin login
    if (role === "superadmin") {
      const [user] = await db.select().from(usersTable)
        .where(and(eq(usersTable.email, email.toLowerCase().trim()), eq(usersTable.role, "SUPERADMIN")))
        .limit(1);

      if (!user) return Response.json({ success: false, message: "Invalid credentials" }, { status: 401 });
      const match = await bcrypt.compare(password, user.password);
      if (!match) return Response.json({ success: false, message: "Invalid credentials" }, { status: 401 });

      const token = signToken({ id: user.id, name: user.name, role: "superadmin", studioId: null });
      return Response.json({ success: true, message: "Login successful", data: { token, user: formatUser(user), studio: null } });
    }

    // Studio login (admin or staff)
    if (!studioSlug) {
      return Response.json({ success: false, message: "studioSlug is required for admin and staff login" }, { status: 400 });
    }

    const dbRole = role === "admin" ? "ADMIN" : role === "staff" ? "STAFF" : null;
    if (!dbRole) {
      return Response.json({ success: false, message: "role must be 'admin', 'staff', or 'superadmin'" }, { status: 400 });
    }

    const [studio] = await db.select().from(studiosTable)
      .where(eq(studiosTable.slug, studioSlug.toLowerCase().trim())).limit(1);

    if (!studio) return Response.json({ success: false, message: "Studio not found. Check your studio slug and try again." }, { status: 404 });
    if (!studio.isActive) return Response.json({ success: false, message: "This studio account is currently suspended." }, { status: 403 });

    const [user] = await db.select().from(usersTable)
      .where(and(
        eq(usersTable.email, email.toLowerCase().trim()),
        eq(usersTable.role, dbRole),
        eq(usersTable.studioId, studio.id),
        eq(usersTable.isActive, true),
      )).limit(1);

    if (!user) return Response.json({ success: false, message: "Invalid email, password, or studio" }, { status: 401 });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return Response.json({ success: false, message: "Invalid email, password, or studio" }, { status: 401 });

    const token = signToken({ id: user.id, name: user.name, role: role as string, studioId: studio.id });
    return Response.json({ success: true, message: "Login successful", data: { token, user: formatUser(user), studio: formatStudio(studio) } });
  } catch (err) {
    console.error("[auth/login]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
