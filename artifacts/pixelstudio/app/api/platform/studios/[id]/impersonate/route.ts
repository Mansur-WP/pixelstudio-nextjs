import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { studiosTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

const SECRET = process.env.JWT_SECRET || "dev_fallback_secret_change_me_in_production";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const { id } = await params;
  try {
    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.id, id)).limit(1);
    if (!studio) return Response.json({ success: false, message: "Studio not found" }, { status: 404 });
    if (!studio.isActive) return Response.json({ success: false, message: "Cannot impersonate a suspended studio" }, { status: 403 });

    const [admin] = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, studioId: usersTable.studioId, isActive: usersTable.isActive,
    }).from(usersTable)
      .where(and(eq(usersTable.studioId, studio.id), eq(usersTable.role, "ADMIN"), eq(usersTable.isActive, true)))
      .limit(1);

    if (!admin) return Response.json({ success: false, message: "No active admin found for this studio" }, { status: 404 });

    const token = jwt.sign(
      { id: admin.id, name: admin.name, role: "admin", studioId: studio.id, _impersonated: true },
      SECRET,
      { expiresIn: "2h" },
    );

    return Response.json({
      success: true, message: `Impersonating ${studio.name}`,
      data: {
        token,
        studio: { id: studio.id, name: studio.name, slug: studio.slug, plan: studio.plan },
        user:   { id: admin.id, name: admin.name, email: admin.email, role: "admin" },
      },
    });
  } catch (err) {
    console.error("[platform/studios/id/impersonate POST]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
