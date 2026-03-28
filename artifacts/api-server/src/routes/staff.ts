import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, clientsTable, galleriesTable, invoicesTable, paymentsTable } from "@workspace/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import { authMiddleware, requireRole } from "./middleware";
import { logActivity } from "../lib/activity";

const router = Router();
router.use(authMiddleware, requireRole("admin"));

const ok   = (res: any, message: string, data?: any, status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res: any, message: string, status = 400) => res.status(status).json({ success: false, message });

const FREE_STAFF_LIMIT = 3;

const STAFF_COLS = {
  id: usersTable.id, name: usersTable.name, email: usersTable.email, phone: usersTable.phone,
  role: usersTable.role, isActive: usersTable.isActive, studioId: usersTable.studioId,
  createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt,
};

const parseIsActive = (v: any): boolean | null => {
  if (v === undefined || v === null) return null;
  if (v === false || v === "false" || v === 0) return false;
  return true;
};

const requireString = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  const t = String(v).trim(); return t.length > 0 ? t : null;
};

// GET /api/staff
router.get("/", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const staff = await db.select(STAFF_COLS).from(usersTable)
      .where(and(eq(usersTable.studioId, studioId), eq(usersTable.role, "STAFF")))
      .orderBy(desc(usersTable.createdAt));

    const filtered = (req.query as any).active !== undefined
      ? staff.filter(s => s.isActive === ((req.query as any).active !== "false"))
      : staff;

    return ok(res, `${filtered.length} staff member(s) found`, filtered);
  } catch (err) { next(err); }
});

// GET /api/staff/:id
router.get("/:id", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const [staff] = await db.select(STAFF_COLS).from(usersTable)
      .where(and(eq(usersTable.id, req.params.id), eq(usersTable.role, "STAFF"), eq(usersTable.studioId, studioId))).limit(1);
    if (!staff) return fail(res, "Staff member not found", 404);
    return ok(res, "Staff member fetched", staff);
  } catch (err) { next(err); }
});

// POST /api/staff
router.post("/", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    // Plan enforcement: staff limit
    if (req.studio.plan === "free") {
      const existing = await db.select(STAFF_COLS).from(usersTable)
        .where(and(eq(usersTable.studioId, studioId), eq(usersTable.role, "STAFF")));
      if (existing.length >= FREE_STAFF_LIMIT) {
        return fail(res, `Free plan limit reached (${FREE_STAFF_LIMIT} staff members). Upgrade to Pro for unlimited staff.`, 403);
      }
    }

    const { password, isActive } = req.body;
    const name  = requireString(req.body.name);
    const email = requireString(req.body.email);
    const phone = requireString(req.body.phone);

    if (!name)  return fail(res, "name is required and must not be blank", 400);
    if (!email) return fail(res, "email is required and must not be blank", 400);
    if (!phone) return fail(res, "phone is required and must not be blank", 400);
    if (!password || String(password).trim().length < 6) return fail(res, "password must be at least 6 characters", 400);

    const normalisedEmail = email.toLowerCase();

    // Email uniqueness within this studio
    const [conflict] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.email, normalisedEmail), eq(usersTable.studioId, studioId))).limit(1);
    if (conflict) return fail(res, "A user with this email already exists in your studio", 409);

    const hashedPassword = await bcrypt.hash(password, 10);
    const [staff] = await db.insert(usersTable).values({
      name, email: normalisedEmail, phone, password: hashedPassword, role: "STAFF",
      isActive: parseIsActive(isActive) ?? true, studioId,
    }).returning(STAFF_COLS);

    logActivity({ studioId, userId: req.user.id, userName: req.user.name ?? "Unknown", userRole: req.user.role, action: "staff_created", entityType: "staff", entityId: staff.id, entityName: name });
    return ok(res, "Staff member created successfully", staff, 201);
  } catch (err) { next(err); }
});

// PUT /api/staff/:id
router.put("/:id", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const staffId = req.params.id;
    const [existing] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, staffId), eq(usersTable.role, "STAFF"), eq(usersTable.studioId, studioId))).limit(1);
    if (!existing) return fail(res, "Staff member not found", 404);

    const updateData: any = {};
    const name  = requireString(req.body.name);
    const phone = requireString(req.body.phone);
    let   email = requireString(req.body.email);

    if (req.body.name  !== undefined && !name)  return fail(res, "name must not be blank",  400);
    if (req.body.phone !== undefined && !phone) return fail(res, "phone must not be blank", 400);
    if (req.body.email !== undefined && !email) return fail(res, "email must not be blank", 400);

    if (name)  updateData.name  = name;
    if (phone) updateData.phone = phone;
    if (email) {
      email = email.toLowerCase();
      const [conflict] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(and(eq(usersTable.email, email), eq(usersTable.studioId, studioId), ne(usersTable.id, staffId))).limit(1);
      if (conflict) return fail(res, "This email is already in use by another user in your studio", 409);
      updateData.email = email;
    }

    if (Object.keys(updateData).length === 0) return fail(res, "No valid fields were provided to update", 400);

    const [staff] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, staffId)).returning(STAFF_COLS);
    return ok(res, "Staff member updated", staff);
  } catch (err) { next(err); }
});

// PATCH /api/staff/:id/status
router.patch("/:id/status", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const staffId = req.params.id;
    const parsed  = parseIsActive(req.body.isActive);
    if (parsed === null) return fail(res, "isActive is required (true to activate, false to deactivate)", 400);

    const [existing] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, staffId), eq(usersTable.role, "STAFF"), eq(usersTable.studioId, studioId))).limit(1);
    if (!existing) return fail(res, "Staff member not found", 404);
    if (existing.isActive === parsed) return fail(res, `This staff member is ${parsed ? "already active" : "already inactive"}`, 409);

    const [staff] = await db.update(usersTable).set({ isActive: parsed }).where(eq(usersTable.id, staffId)).returning(STAFF_COLS);
    return ok(res, `${staff.name} has been ${parsed ? "activated" : "deactivated"}`, staff);
  } catch (err) { next(err); }
});

// DELETE /api/staff/:id
router.delete("/:id", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const staffId = req.params.id;
    const adminId = req.user?.id;

    const [existing] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, staffId), eq(usersTable.role, "STAFF"), eq(usersTable.studioId, studioId))).limit(1);
    if (!existing) return fail(res, "Staff member not found", 404);

    await Promise.all([
      db.update(clientsTable).set({ createdById: adminId }).where(eq(clientsTable.createdById, staffId)),
      db.update(galleriesTable).set({ uploadedById: adminId }).where(eq(galleriesTable.uploadedById, staffId)),
      db.update(invoicesTable).set({ createdById: adminId }).where(eq(invoicesTable.createdById, staffId)),
      db.update(paymentsTable).set({ receivedById: adminId }).where(eq(paymentsTable.receivedById, staffId)),
    ]);

    await db.delete(usersTable).where(eq(usersTable.id, staffId));
    logActivity({ studioId, userId: req.user.id, userName: req.user.name ?? "Unknown", userRole: req.user.role, action: "staff_deleted", entityType: "staff", entityId: staffId, entityName: existing.name });
    return ok(res, `${existing.name}'s account has been permanently deleted`);
  } catch (err) { next(err); }
});

// PATCH /api/staff/:id/password
router.patch("/:id/password", async (req: any, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const staffId = req.params.id;
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).trim().length < 6) return fail(res, "newPassword must be at least 6 characters", 400);

    const [staff] = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, staffId), eq(usersTable.role, "STAFF"), eq(usersTable.studioId, studioId))).limit(1);
    if (!staff) return fail(res, "Staff member not found", 404);

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, staffId));
    return ok(res, `Password updated for ${staff.name}`);
  } catch (err) { next(err); }
});

export default router;
