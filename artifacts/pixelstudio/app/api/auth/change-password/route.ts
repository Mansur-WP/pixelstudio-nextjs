import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const currentTrimmed = (body.currentPassword || "").trim();
    const newTrimmed     = (body.newPassword     || "").trim();

    if (!currentTrimmed || !newTrimmed) {
      return Response.json({ success: false, message: "currentPassword and newPassword are required" }, { status: 400 });
    }
    if (newTrimmed.length < 6) {
      return Response.json({ success: false, message: "New password must be at least 6 characters" }, { status: 400 });
    }
    if (currentTrimmed === newTrimmed) {
      return Response.json({ success: false, message: "New password must be different from the current password" }, { status: 400 });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, ctx.user.id)).limit(1);
    if (!user) return Response.json({ success: false, message: "User not found" }, { status: 404 });

    const match = await bcrypt.compare(currentTrimmed, user.password);
    if (!match) return Response.json({ success: false, message: "Current password is incorrect" }, { status: 401 });

    const hashed = await bcrypt.hash(newTrimmed, 10);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, ctx.user.id));
    return Response.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("[auth/change-password]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
