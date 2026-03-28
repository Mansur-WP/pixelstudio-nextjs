import { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, studiosTable, passwordResetSessionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const OTP_TTL_MINUTES        = 10;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const hashValue   = (v: string) => crypto.createHash("sha256").update(String(v)).digest("hex");
const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emailTrimmed = (body.email      || "").trim().toLowerCase();
    const studioSlug   = (body.studioSlug || "").trim().toLowerCase();

    if (!emailTrimmed) return Response.json({ success: false, message: "email is required" }, { status: 400 });
    if (!studioSlug)   return Response.json({ success: false, message: "studioSlug is required" }, { status: 400 });

    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.slug, studioSlug)).limit(1);
    if (!studio) return Response.json({ success: false, message: "Studio not found" }, { status: 404 });

    const [user] = await db.select().from(usersTable)
      .where(and(eq(usersTable.email, emailTrimmed), eq(usersTable.studioId, studio.id), eq(usersTable.isActive, true)))
      .limit(1);

    if (!user) return Response.json({ success: true, message: "If that email is registered, a reset code has been sent." });

    const existing = await db.query.passwordResetSessionsTable.findFirst({
      where: eq(passwordResetSessionsTable.userId, user.id),
    });

    if (existing && Date.now() - new Date(existing.lastSentAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
      return Response.json({ success: false, message: "Please wait 60 seconds before requesting another code." }, { status: 429 });
    }

    const otp          = generateOtp();
    const otpHash      = hashValue(otp);
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    if (existing) {
      await db.update(passwordResetSessionsTable).set({
        otpHash, otpExpiresAt, attemptCount: 0, lastSentAt: new Date(),
        verifiedAt: null, resetTokenHash: null, resetTokenExpiresAt: null, consumedAt: null,
      }).where(eq(passwordResetSessionsTable.userId, user.id));
    } else {
      await db.insert(passwordResetSessionsTable).values({
        userId: user.id, otpHash, otpExpiresAt, attemptCount: 0, lastSentAt: new Date(),
      });
    }

    console.log(`[DEV] Password reset OTP for ${emailTrimmed}: ${otp}`);
    return Response.json({ success: true, message: "If that email is registered, a reset code has been sent." });
  } catch (err) {
    console.error("[auth/request-otp]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
