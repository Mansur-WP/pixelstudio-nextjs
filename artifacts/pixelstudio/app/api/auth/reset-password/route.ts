import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, studiosTable, passwordResetSessionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const hashValue = (v: string) => crypto.createHash("sha256").update(String(v)).digest("hex");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailTrimmed = (body.email       || "").trim().toLowerCase();
    const newTrimmed   = (body.newPassword  || "").trim();
    const resetTrimmed = (body.resetToken   || "").trim();
    const studioSlug   = (body.studioSlug   || "").trim().toLowerCase();

    if (!emailTrimmed || !newTrimmed || !resetTrimmed || !studioSlug) {
      return Response.json({ success: false, message: "email, studioSlug, newPassword, and resetToken are required" }, { status: 400 });
    }
    if (newTrimmed.length < 6) {
      return Response.json({ success: false, message: "New password must be at least 6 characters" }, { status: 400 });
    }

    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.slug, studioSlug)).limit(1);
    if (!studio) return Response.json({ success: false, message: "Studio not found" }, { status: 404 });

    const [user] = await db.select().from(usersTable)
      .where(and(eq(usersTable.email, emailTrimmed), eq(usersTable.studioId, studio.id), eq(usersTable.isActive, true)))
      .limit(1);

    if (!user) return Response.json({ success: false, message: "Password reset session is invalid or expired" }, { status: 401 });

    const session = await db.query.passwordResetSessionsTable.findFirst({
      where: eq(passwordResetSessionsTable.userId, user.id),
    });

    if (!session || !session.verifiedAt || session.consumedAt) {
      return Response.json({ success: false, message: "Password reset session is invalid or expired" }, { status: 401 });
    }
    if (session.resetTokenExpiresAt && new Date(session.resetTokenExpiresAt).getTime() < Date.now()) {
      return Response.json({ success: false, message: "Password reset session has expired. Request a new code." }, { status: 401 });
    }
    if (hashValue(resetTrimmed) !== session.resetTokenHash) {
      return Response.json({ success: false, message: "Password reset session is invalid or expired" }, { status: 401 });
    }

    const hashed = await bcrypt.hash(newTrimmed, 10);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, user.id));
    await db.update(passwordResetSessionsTable).set({ consumedAt: new Date() }).where(eq(passwordResetSessionsTable.userId, user.id));

    return Response.json({ success: true, message: "Password reset successfully. Please log in with your new password." });
  } catch (err) {
    console.error("[auth/reset-password]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
