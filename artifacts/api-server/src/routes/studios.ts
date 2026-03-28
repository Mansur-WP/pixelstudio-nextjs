import { Router } from "express";
import { db } from "@workspace/db";
import { studiosTable, usersTable, clientsTable, photosTable, upgradeRequestsTable, platformSettingsTable } from "@workspace/db/schema";
import { eq, and, count, sql, desc } from "drizzle-orm";
import { authMiddleware, requireRole } from "./middleware";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// ── GET /api/studios/public/:slug — NO auth, returns basic branding info ───────
router.get("/public/:slug", async (req, res, next) => {
  try {
    const slug = (req.params.slug || "").toLowerCase().trim();
    const [studio] = await db.select({
      name:    studiosTable.name,
      logoUrl: studiosTable.logoUrl,
      isActive: studiosTable.isActive,
    }).from(studiosTable).where(eq(studiosTable.slug, slug)).limit(1);

    if (!studio) return res.status(404).json({ success: false, message: "Studio not found" });
    return res.json({ success: true, message: "ok", data: { name: studio.name, logoUrl: studio.logoUrl ?? null, isActive: studio.isActive } });
  } catch (err) { next(err); }
});

router.use(authMiddleware);

const ok   = (res: any, message: string, data?: any, status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res: any, message: string, status = 400) => res.status(status).json({ success: false, message });

// Logo upload storage
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed for logos"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── GET /api/studios/me ────────────────────────────────────────────────────────
router.get("/me", async (req: any, res, next) => {
  try {
    if (!req.studio) return fail(res, "No studio context", 400);

    // Plan usage counts
    const [staffCount, clientCount, photoCount] = await Promise.all([
      db.select({ count: count() }).from(usersTable)
        .where(and(eq(usersTable.studioId, req.studio.id), eq(usersTable.role, "STAFF"), eq(usersTable.isActive, true)))
        .then(r => Number(r[0].count)),
      db.select({ count: count() }).from(clientsTable)
        .where(eq(clientsTable.studioId, req.studio.id))
        .then(r => Number(r[0].count)),
      db.select({ count: count() }).from(photosTable)
        .where(eq(photosTable.studioId, req.studio.id))
        .then(r => Number(r[0].count)),
    ]);

    const limits = req.studio.plan === "pro"
      ? { staff: null, clients: null, photos: null }
      : { staff: 3, clients: 50, photos: 200 };

    return ok(res, "Studio fetched", {
      studio: {
        id:      req.studio.id,
        name:    req.studio.name,
        slug:    req.studio.slug,
        logoUrl: req.studio.logoUrl ?? null,
        plan:    req.studio.plan,
      },
      usage:  { staffCount, clientCount, photoCount },
      limits,
    });
  } catch (err) { next(err); }
});

// ── PUT /api/studios/me — update studio name/slug (admin only) ─────────────────
router.put("/me", requireRole("admin"), async (req: any, res, next) => {
  try {
    if (!req.studio) return fail(res, "No studio context", 400);

    const updates: any = {};
    const name = (req.body.name || "").trim();
    const slug = (req.body.slug || "").trim().toLowerCase();

    if (req.body.name !== undefined) {
      if (!name) return fail(res, "name cannot be empty", 400);
      updates.name = name;
    }
    if (req.body.slug !== undefined) {
      if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
        return fail(res, "slug must be 3–30 characters, lowercase letters, numbers, and hyphens only", 400);
      }
      // Check uniqueness (excluding current studio)
      const [conflict] = await db.select({ id: studiosTable.id }).from(studiosTable)
        .where(eq(studiosTable.slug, slug)).limit(1);
      if (conflict && conflict.id !== req.studio.id) return fail(res, "This slug is already taken", 409);
      updates.slug = slug;
    }
    if (req.body.logoUrl !== undefined) updates.logoUrl = req.body.logoUrl || null;

    if (Object.keys(updates).length === 0) return fail(res, "No valid fields to update", 400);

    const [updated] = await db.update(studiosTable).set(updates)
      .where(eq(studiosTable.id, req.studio.id)).returning();

    return ok(res, "Studio updated", { id: updated.id, name: updated.name, slug: updated.slug, logoUrl: updated.logoUrl, plan: updated.plan });
  } catch (err) { next(err); }
});

// ── POST /api/studios/me/logo — upload studio logo ─────────────────────────────
router.post("/me/logo", requireRole("admin"), upload.single("logo"), async (req: any, res, next) => {
  try {
    if (!req.studio) return fail(res, "No studio context", 400);
    if (!req.file) return fail(res, "No logo file uploaded", 400);

    const logoUrl = `/uploads/${req.file.filename}`;
    const [updated] = await db.update(studiosTable).set({ logoUrl })
      .where(eq(studiosTable.id, req.studio.id)).returning({ logoUrl: studiosTable.logoUrl });

    return ok(res, "Logo uploaded successfully", { logoUrl: updated.logoUrl });
  } catch (err) { next(err); }
});

// ── GET /api/studios/me/upgrade-info — bank details + current request ──────────
router.get("/me/upgrade-info", requireRole("admin"), async (req: any, res, next) => {
  try {
    if (!req.studio) return fail(res, "No studio context", 400);

    const [[settings], [request]] = await Promise.all([
      db.select().from(platformSettingsTable).limit(1),
      db.select().from(upgradeRequestsTable)
        .where(eq(upgradeRequestsTable.studioId, req.studio.id))
        .orderBy(desc(upgradeRequestsTable.createdAt))
        .limit(1),
    ]);

    return ok(res, "Upgrade info fetched", {
      bankName:      settings?.bankName      ?? "",
      accountNumber: settings?.accountNumber ?? "",
      accountName:   settings?.accountName   ?? "",
      proPlanPrice:  settings?.proPlanPrice  ?? "50000",
      request:       request ?? null,
    });
  } catch (err) { next(err); }
});

// ── POST /api/studios/me/upgrade-request — submit payment reference ────────────
router.post("/me/upgrade-request", requireRole("admin"), async (req: any, res, next) => {
  try {
    if (!req.studio) return fail(res, "No studio context", 400);
    if (req.studio.plan === "pro") return fail(res, "Studio is already on Pro plan");

    const reference = (req.body.reference || "").trim();
    const notes     = (req.body.notes     || "").trim();
    if (!reference) return fail(res, "Payment reference is required");

    const [pending] = await db.select({ id: upgradeRequestsTable.id })
      .from(upgradeRequestsTable)
      .where(and(eq(upgradeRequestsTable.studioId, req.studio.id), eq(upgradeRequestsTable.status, "pending")))
      .limit(1);
    if (pending) return fail(res, "You already have a pending upgrade request. Please wait for it to be reviewed.", 409);

    const [settings] = await db.select({ proPlanPrice: platformSettingsTable.proPlanPrice })
      .from(platformSettingsTable).limit(1);
    const amount = settings?.proPlanPrice ?? "50000";

    const [request] = await db.insert(upgradeRequestsTable).values({
      studioId:  req.studio.id,
      amount,
      reference,
      notes: notes || null,
    }).returning();

    return ok(res, "Upgrade request submitted. The platform team will verify your payment shortly.", request, 201);
  } catch (err) { next(err); }
});

export default router;
