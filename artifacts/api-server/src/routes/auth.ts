import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  usersTable,
  studiosTable,
  passwordResetSessionsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "./middleware";

const router = Router();

const SECRET  = process.env.JWT_SECRET     || "dev_fallback_secret_change_me_in_production";
const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

const OTP_TTL_MINUTES         = 10;
const RESET_TOKEN_TTL_MINUTES = 15;
const OTP_RESEND_COOLDOWN_MS  = 60 * 1000;
const MAX_OTP_ATTEMPTS        = 5;

const signToken = (payload: object) => jwt.sign(payload, SECRET, { expiresIn: EXPIRES as any });

const hashValue = (value: string) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const generateOtp = () =>
  String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

const generateResetToken = () => crypto.randomBytes(32).toString("hex");

const formatUser = (user: any) => ({
  id:        user.id,
  name:      user.name,
  email:     user.email,
  phone:     user.phone,
  role:      user.role.toLowerCase(),
  studioId:  user.studioId ?? null,
  isActive:  user.isActive,
  createdAt: user.createdAt || null,
});

const formatStudio = (studio: any) => ({
  id:      studio.id,
  name:    studio.name,
  slug:    studio.slug,
  logoUrl: studio.logoUrl ?? null,
  plan:    studio.plan,
});

const ok   = (res: any, message: string, data?: any, status = 200) =>
  res.status(status).json({ success: true, message, data });

const fail = (res: any, message: string, status = 400) =>
  res.status(status).json({ success: false, message });

// ─── POST /api/auth/register — create a new studio + admin account ────────────
router.post("/register", async (req, res, next) => {
  try {
    const studioName   = (req.body.studioName   || "").trim();
    const slug         = (req.body.slug         || "").trim().toLowerCase();
    const adminName    = (req.body.adminName    || "").trim();
    const adminEmail   = (req.body.adminEmail   || "").trim().toLowerCase();
    const adminPassword = (req.body.adminPassword || "").trim();

    if (!studioName)   return fail(res, "studioName is required", 400);
    if (!slug)         return fail(res, "slug is required", 400);
    if (!adminName)    return fail(res, "adminName is required", 400);
    if (!adminEmail)   return fail(res, "adminEmail is required", 400);
    if (!adminPassword || adminPassword.length < 6) return fail(res, "adminPassword must be at least 6 characters", 400);

    // Validate slug format
    if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
      return fail(res, "slug must be 3–30 characters, lowercase letters, numbers, and hyphens only", 400);
    }

    // Check slug uniqueness
    const [existing] = await db.select({ id: studiosTable.id }).from(studiosTable)
      .where(eq(studiosTable.slug, slug)).limit(1);
    if (existing) return fail(res, "This studio URL is already taken. Please choose another slug.", 409);

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create studio and admin user in a single transaction
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

    // Re-fetch the admin user to get their id
    const [admin] = await db.select().from(usersTable)
      .where(and(eq(usersTable.email, adminEmail), eq(usersTable.studioId, studio.id))).limit(1);

    const token = signToken({ id: admin.id, role: "admin", studioId: studio.id });

    return ok(res, `Studio "${studioName}" created successfully. Welcome!`, {
      token,
      user:   formatUser(admin),
      studio: formatStudio(studio),
    }, 201);
  } catch (err) { next(err); }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const { email, password, role, studioSlug } = req.body;
    if (!email || !password || !role) return fail(res, "email, password, and role are required", 400);

    // ── Superadmin login (no studio required) ──
    if (role === "superadmin") {
      const [user] = await db.select().from(usersTable)
        .where(and(eq(usersTable.email, email.toLowerCase().trim()), eq(usersTable.role, "SUPERADMIN")))
        .limit(1);

      if (!user) return fail(res, "Invalid credentials", 401);
      const ok2 = await bcrypt.compare(password, user.password);
      if (!ok2) return fail(res, "Invalid credentials", 401);

      const token = signToken({ id: user.id, name: user.name, role: "superadmin", studioId: null });
      return ok(res, "Login successful", { token, user: formatUser(user), studio: null });
    }

    // ── Studio user login (admin or staff) ──
    if (!studioSlug) return fail(res, "studioSlug is required for admin and staff login", 400);

    const dbRole = role === "admin" ? "ADMIN" : role === "staff" ? "STAFF" : null;
    if (!dbRole) return fail(res, "role must be 'admin', 'staff', or 'superadmin'", 400);

    // Resolve studio by slug
    const [studio] = await db.select().from(studiosTable)
      .where(eq(studiosTable.slug, studioSlug.toLowerCase().trim())).limit(1);

    if (!studio) return fail(res, "Studio not found. Check your studio slug and try again.", 404);
    if (!studio.isActive) return fail(res, "This studio account is currently suspended.", 403);

    // Resolve user within this studio
    const [user] = await db.select().from(usersTable)
      .where(and(
        eq(usersTable.email, email.toLowerCase().trim()),
        eq(usersTable.role, dbRole),
        eq(usersTable.studioId, studio.id),
        eq(usersTable.isActive, true),
      )).limit(1);

    if (!user) return fail(res, "Invalid email, password, or studio", 401);

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return fail(res, "Invalid email, password, or studio", 401);

    const token = signToken({ id: user.id, name: user.name, role: role as string, studioId: studio.id });
    return ok(res, "Login successful", { token, user: formatUser(user), studio: formatStudio(studio) });
  } catch (err) { next(err); }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", authMiddleware, async (req: any, res, next) => {
  try {
    const [user] = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      phone: usersTable.phone, role: usersTable.role, studioId: usersTable.studioId,
      isActive: usersTable.isActive, createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);

    if (!user) return fail(res, "User account no longer exists. Please log in again.", 401);
    if (!user.isActive) return fail(res, "Your account has been deactivated. Contact the admin.", 403);

    return ok(res, "User profile fetched", {
      user:   formatUser(user),
      studio: req.studio ? formatStudio(req.studio) : null,
    });
  } catch (err) { next(err); }
});

// ─── PUT /api/auth/me — update display name ───────────────────────────────────
router.put("/me", authMiddleware, async (req: any, res, next) => {
  try {
    const newName = (req.body.name || "").trim();
    if (!newName) return fail(res, "Name cannot be empty.", 400);
    if (newName.length > 100) return fail(res, "Name must be 100 characters or fewer.", 400);

    const [updated] = await db
      .update(usersTable)
      .set({ name: newName })
      .where(eq(usersTable.id, req.user.id))
      .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, studioId: usersTable.studioId });

    if (!updated) return fail(res, "User not found.", 404);
    return ok(res, "Profile updated", formatUser(updated as any));
  } catch (err) { next(err); }
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post("/change-password", authMiddleware, async (req: any, res, next) => {
  try {
    const currentTrimmed = (req.body.currentPassword || "").trim();
    const newTrimmed     = (req.body.newPassword     || "").trim();

    if (!currentTrimmed || !newTrimmed) return fail(res, "currentPassword and newPassword are required", 400);
    if (newTrimmed.length < 6) return fail(res, "New password must be at least 6 characters", 400);
    if (currentTrimmed === newTrimmed) return fail(res, "New password must be different from the current password", 400);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
    if (!user) return fail(res, "User not found", 404);

    const match = await bcrypt.compare(currentTrimmed, user.password);
    if (!match) return fail(res, "Current password is incorrect", 401);

    const hashed = await bcrypt.hash(newTrimmed, 10);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, req.user.id));
    return ok(res, "Password changed successfully");
  } catch (err) { next(err); }
});

// ─── POST /api/auth/request-otp ──────────────────────────────────────────────
router.post("/request-otp", async (req: any, res, next) => {
  try {
    const emailTrimmed = (req.body.email || "").trim().toLowerCase();
    const studioSlug   = (req.body.studioSlug || "").trim().toLowerCase();
    if (!emailTrimmed) return fail(res, "email is required", 400);
    if (!studioSlug)   return fail(res, "studioSlug is required", 400);

    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.slug, studioSlug)).limit(1);
    if (!studio) return fail(res, "Studio not found", 404);

    const [user] = await db.select().from(usersTable)
      .where(and(eq(usersTable.email, emailTrimmed), eq(usersTable.studioId, studio.id), eq(usersTable.isActive, true)))
      .limit(1);

    // Always return success to prevent email enumeration
    if (!user) return ok(res, "If that email is registered, a reset code has been sent.");

    const existing = await db.query.passwordResetSessionsTable.findFirst({
      where: eq(passwordResetSessionsTable.userId, user.id),
    });

    if (existing && Date.now() - new Date(existing.lastSentAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
      return fail(res, "Please wait 60 seconds before requesting another code.", 429);
    }

    const otp     = generateOtp();
    const otpHash = hashValue(otp);
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
    return ok(res, "If that email is registered, a reset code has been sent.");
  } catch (err) { next(err); }
});

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────
router.post("/verify-otp", async (req: any, res, next) => {
  try {
    const emailTrimmed = (req.body.email || "").trim().toLowerCase();
    const studioSlug   = (req.body.studioSlug || "").trim().toLowerCase();
    const otp          = (req.body.otp || "").trim();

    if (!emailTrimmed || !otp || !studioSlug) return fail(res, "email, studioSlug, and otp are required", 400);

    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.slug, studioSlug)).limit(1);
    if (!studio) return fail(res, "Studio not found", 404);

    const [user] = await db.select().from(usersTable)
      .where(and(eq(usersTable.email, emailTrimmed), eq(usersTable.studioId, studio.id)))
      .limit(1);

    if (!user) return fail(res, "Invalid code or email", 400);

    const session = await db.query.passwordResetSessionsTable.findFirst({
      where: eq(passwordResetSessionsTable.userId, user.id),
    });

    if (!session || !session.otpHash) return fail(res, "No active reset session. Please request a new code.", 400);
    if (session.consumedAt || session.verifiedAt) return fail(res, "This code has already been used.", 400);

    if (session.otpExpiresAt && new Date(session.otpExpiresAt).getTime() < Date.now()) {
      return fail(res, "This code has expired. Please request a new one.", 400);
    }

    if (session.attemptCount >= MAX_OTP_ATTEMPTS) {
      return fail(res, "Too many attempts. Please request a new code.", 429);
    }

    if (hashValue(otp) !== session.otpHash) {
      await db.update(passwordResetSessionsTable)
        .set({ attemptCount: session.attemptCount + 1 })
        .where(eq(passwordResetSessionsTable.userId, user.id));
      return fail(res, "Invalid code. Please check and try again.", 400);
    }

    const resetToken = generateResetToken();
    const resetTokenHash = hashValue(resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await db.update(passwordResetSessionsTable).set({
      verifiedAt: new Date(), resetTokenHash, resetTokenExpiresAt,
    }).where(eq(passwordResetSessionsTable.userId, user.id));

    return ok(res, "Code verified. You may now reset your password.", { resetToken });
  } catch (err) { next(err); }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post("/reset-password", async (req: any, res, next) => {
  try {
    const emailTrimmed = (req.body.email       || "").trim().toLowerCase();
    const newTrimmed   = (req.body.newPassword  || "").trim();
    const resetTrimmed = (req.body.resetToken   || "").trim();
    const studioSlug   = (req.body.studioSlug   || "").trim().toLowerCase();

    if (!emailTrimmed || !newTrimmed || !resetTrimmed || !studioSlug)
      return fail(res, "email, studioSlug, newPassword, and resetToken are required", 400);
    if (newTrimmed.length < 6) return fail(res, "New password must be at least 6 characters", 400);

    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.slug, studioSlug)).limit(1);
    if (!studio) return fail(res, "Studio not found", 404);

    const [user] = await db.select().from(usersTable)
      .where(and(eq(usersTable.email, emailTrimmed), eq(usersTable.studioId, studio.id), eq(usersTable.isActive, true)))
      .limit(1);

    if (!user) return fail(res, "Password reset session is invalid or expired", 401);

    const session = await db.query.passwordResetSessionsTable.findFirst({
      where: eq(passwordResetSessionsTable.userId, user.id),
    });

    if (!session || !session.verifiedAt || session.consumedAt)
      return fail(res, "Password reset session is invalid or expired", 401);

    if (session.resetTokenExpiresAt && new Date(session.resetTokenExpiresAt).getTime() < Date.now())
      return fail(res, "Password reset session has expired. Request a new code.", 401);

    if (hashValue(resetTrimmed) !== session.resetTokenHash)
      return fail(res, "Password reset session is invalid or expired", 401);

    const hashed = await bcrypt.hash(newTrimmed, 10);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, user.id));
    await db.update(passwordResetSessionsTable)
      .set({ consumedAt: new Date() })
      .where(eq(passwordResetSessionsTable.userId, user.id));

    return ok(res, "Password reset successfully. Please log in with your new password.");
  } catch (err) { next(err); }
});

export default router;
