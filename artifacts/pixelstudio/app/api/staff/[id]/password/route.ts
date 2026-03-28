import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, isAuthContext, requireRole } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const roleErr = requireRole(ctx, "admin");
  if (roleErr) return roleErr;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id: staffId } = await params;
  try {
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || String(newPassword).trim().length < 6) {
      return Response.json({ success: false, message: "newPassword must be at least 6 characters" }, { status: 400 });
    }

    const [staff] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, staffId), eq(usersTable.role, "STAFF"), eq(usersTable.studioId, studioId))).limit(1);
    if (!staff) return Response.json({ success: false, message: "Staff member not found" }, { status: 404 });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, staffId));
    return Response.json({ success: true, message: `Password updated for ${staff.name}` });
  } catch (err) {
    console.error("[staff/id/password PATCH]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
