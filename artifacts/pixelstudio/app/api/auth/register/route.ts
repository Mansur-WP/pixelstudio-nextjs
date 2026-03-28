import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable, studiosTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const SECRET  = process.env.JWT_SECRET     || "dev_fallback_secret_change_me_in_production";
const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";
const signToken = (payload: object) => jwt.sign(payload, SECRET, { expiresIn: EXPIRES as unknown as number });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const studioName    = (body.studioName    || "").trim();
    const slug          = (body.slug          || "").trim().toLowerCase();
    const adminName     = (body.adminName     || "").trim();
    const adminEmail    = (body.adminEmail    || "").trim().toLowerCase();
    const adminPassword = (body.adminPassword || "").trim();

    if (!studioName)   return Response.json({ success: false, message: "studioName is required" }, { status: 400 });
    if (!slug)         return Response.json({ success: false, message: "slug is required" }, { status: 400 });
    if (!adminName)    return Response.json({ success: false, message: "adminName is required" }, { status: 400 });
    if (!adminEmail)   return Response.json({ success: false, message: "adminEmail is required" }, { status: 400 });
    if (!adminPassword || adminPassword.length < 6) {
      return Response.json({ success: false, message: "adminPassword must be at least 6 characters" }, { status: 400 });
    }
    if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
      return Response.json({ success: false, message: "slug must be 3–30 characters, lowercase letters, numbers, and hyphens only" }, { status: 400 });
    }

    const [existing] = await db.select({ id: studiosTable.id }).from(studiosTable)
      .where(eq(studiosTable.slug, slug)).limit(1);
    if (existing) {
      return Response.json({ success: false, message: "This studio URL is already taken. Please choose another slug." }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const studio = await db.transaction(async (tx) => {
      const [newStudio] = await tx.insert(studiosTable).values({
        name: studioName, slug, plan: "free", isActive: true,
      }).returning();

      await tx.insert(usersTable).values({
        name:     adminName,
        email:    adminEmail,
        phone:    "—",
        password: hashedPassword,
        role:     "ADMIN",
        isActive: true,
        studioId: newStudio.id,
      });

      return newStudio;
    });

    const [admin] = await db.select().from(usersTable)
      .where(and(eq(usersTable.email, adminEmail), eq(usersTable.studioId, studio.id))).limit(1);

    const token = signToken({ id: admin.id, name: admin.name, role: "admin", studioId: studio.id });

    return Response.json({
      success: true,
      message: `Studio "${studioName}" created successfully. Welcome!`,
      data: {
        token,
        user:   { id: admin.id, name: admin.name, email: admin.email, phone: admin.phone, role: "admin", studioId: studio.id, isActive: true, createdAt: null },
        studio: { id: studio.id, name: studio.name, slug: studio.slug, logoUrl: studio.logoUrl ?? null, plan: studio.plan },
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[auth/register]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
