import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, isAuthContext, requireRole } from "@/lib/auth";

const STAFF_COLS = {
  id: usersTable.id, name: usersTable.name, email: usersTable.email, phone: usersTable.phone,
  role: usersTable.role, isActive: usersTable.isActive, studioId: usersTable.studioId,
  createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt,
};

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
    const { isActive } = body;

    if (isActive === undefined || isActive === null) {
      return Response.json({ success: false, message: "isActive is required (true to activate, false to deactivate)" }, { status: 400 });
    }
    const parsed = isActive !== false && isActive !== "false" && isActive !== 0;

    const [existing] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, staffId), eq(usersTable.role, "STAFF"), eq(usersTable.studioId, studioId))).limit(1);
    if (!existing) return Response.json({ success: false, message: "Staff member not found" }, { status: 404 });
    if (existing.isActive === parsed) {
      return Response.json({ success: false, message: `This staff member is ${parsed ? "already active" : "already inactive"}` }, { status: 409 });
    }

    const [staff] = await db.update(usersTable).set({ isActive: parsed }).where(eq(usersTable.id, staffId)).returning(STAFF_COLS);
    return Response.json({ success: true, message: `${staff.name} has been ${parsed ? "activated" : "deactivated"}`, data: staff });
  } catch (err) {
    console.error("[staff/id/status PATCH]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
