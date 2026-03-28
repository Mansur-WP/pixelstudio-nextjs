import { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, studiosTable, passwordResetSessionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const RESET_TOKEN_TTL_MINUTES = 15;
const MAX_OTP_ATTEMPTS        = 5;

const hashValue        = (v: string) => crypto.createHash("sha256").update(String(v)).digest("hex");
const generateResetToken = () => crypto.randomBytes(32).toString("hex");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailTrimmed = (body.email      || "").trim().toLowerCase();
    const studioSlug   = (body.studioSlug || "").trim().toLowerCase();
    const otp          = (body.otp        || "").trim();

    if (!emailTrimmed || !otp || !studioSlug) {
      return Response.json({ success: false, message: "email, studioSlug, and otp are required" }, { status: 400 });
    }

    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.slug, studioSlug)).limit(1);
    if (!studio) return Response.json({ success: false, message: "Studio not found" }, { status: 404 });

    const [user] = await db.select().from(usersTable)
      .where(and(eq(usersTable.email, emailTrimmed), eq(usersTable.studioId, studio.id)))
      .limit(1);

    if (!user) return Response.json({ success: false, message: "Invalid code or email" }, { status: 400 });

    const session = await db.query.passwordResetSessionsTable.findFirst({
      where: eq(passwordResetSessionsTable.userId, user.id),
    });

    if (!session || !session.otpHash) {
      return Response.json({ success: false, message: "No active reset session. Please request a new code." }, { status: 400 });
    }
    if (session.consumedAt || session.verifiedAt) {
      return Response.json({ success: false, message: "This code has already been used." }, { status: 400 });
    }
    if (session.otpExpiresAt && new Date(session.otpExpiresAt).getTime() < Date.now()) {
      return Response.json({ success: false, message: "This code has expired. Please request a new one." }, { status: 400 });
    }
    if (session.attemptCount >= MAX_OTP_ATTEMPTS) {
      return Response.json({ success: false, message: "Too many attempts. Please request a new code." }, { status: 429 });
    }
    if (hashValue(otp) !== session.otpHash) {
      await db.update(passwordResetSessionsTable)
        .set({ attemptCount: session.attemptCount + 1 })
        .where(eq(passwordResetSessionsTable.userId, user.id));
      return Response.json({ success: false, message: "Invalid code. Please check and try again." }, { status: 400 });
    }

    const resetToken          = generateResetToken();
    const resetTokenHash      = hashValue(resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await db.update(passwordResetSessionsTable)
      .set({ verifiedAt: new Date(), resetTokenHash, resetTokenExpiresAt })
      .where(eq(passwordResetSessionsTable.userId, user.id));

    return Response.json({ success: true, message: "Code verified. You may now reset your password.", data: { resetToken } });
  } catch (err) {
    console.error("[auth/verify-otp]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
