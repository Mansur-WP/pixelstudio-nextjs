import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import {
  studiosTable, usersTable, clientsTable, photosTable,
  invoicesTable, paymentsTable, galleriesTable, activityLogsTable,
  upgradeRequestsTable, platformSettingsTable,
} from "@workspace/db/schema";
import { eq, count, sum, sql, desc, and, ne, gte, isNotNull } from "drizzle-orm";
import { authMiddleware, requireSuperAdmin } from "./middleware";

const SECRET  = process.env.JWT_SECRET     || "dev_fallback_secret_change_me_in_production";
const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

const router = Router();
router.use(authMiddleware, requireSuperAdmin);

const ok   = (res: any, message: string, data?: any, status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res: any, message: string, status = 400) => res.status(status).json({ success: false, message });

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Helper: enrich a studio with full stats ────────────────────────────────────
async function enrichStudio(s: typeof studiosTable.$inferSelect) {
  const [staffCount, clientCount, photoCount, invoiceCount, revenue, adminUser] = await Promise.all([
    db.select({ count: count() }).from(usersTable)
      .where(and(eq(usersTable.studioId, s.id), ne(usersTable.role, "SUPERADMIN")))
      .then(r => Number(r[0].count)),
    db.select({ count: count() }).from(clientsTable)
      .where(eq(clientsTable.studioId, s.id))
      .then(r => Number(r[0].count)),
    db.select({ count: count() }).from(photosTable)
      .where(eq(photosTable.studioId, s.id))
      .then(r => Number(r[0].count)),
    db.select({ count: count() }).from(invoicesTable)
      .where(eq(invoicesTable.studioId, s.id))
      .then(r => Number(r[0].count)),
    db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable)
      .where(eq(paymentsTable.studioId, s.id))
      .then(r => Number(r[0].total ?? 0)),
    db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable)
      .where(and(eq(usersTable.studioId, s.id), eq(usersTable.role, "ADMIN")))
      .limit(1)
      .then(r => r[0] ?? null),
  ]);
  return {
    ...s,
    _stats: { staffCount, clientCount, photoCount, invoiceCount, revenue },
    _admin: adminUser,
  };
}

// ── GET /api/platform/stats — platform-wide aggregate ─────────────────────────
router.get("/stats", async (_req, res, next) => {
  try {
    const [
      totalStudios, activeStudios, proStudios,
      totalUsers, totalClients, totalPhotos, totalRevenue,
    ] = await Promise.all([
      db.select({ count: count() }).from(studiosTable).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(studiosTable).where(eq(studiosTable.isActive, true)).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(studiosTable).where(eq(studiosTable.plan, "pro")).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(usersTable).where(ne(usersTable.role, "SUPERADMIN")).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(clientsTable).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(photosTable).then(r => Number(r[0].count)),
      db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).then(r => Number(r[0].total ?? 0)),
    ]);
    return ok(res, "Platform stats", {
      totalStudios, activeStudios, suspendedStudios: totalStudios - activeStudios, proStudios, freeStudios: totalStudios - proStudios,
      totalUsers, totalClients, totalPhotos, totalRevenue,
    });
  } catch (err) { next(err); }
});

// ── GET /api/platform/studios ─────────────────────────────────────────────────
router.get("/studios", async (_req, res, next) => {
  try {
    const studios = await db.select().from(studiosTable).orderBy(desc(studiosTable.createdAt));
    const enriched = await Promise.all(studios.map(enrichStudio));
    return ok(res, `${studios.length} studio(s) found`, enriched);
  } catch (err) { next(err); }
});

// ── POST /api/platform/studios — create studio + admin user ───────────────────
router.post("/studios", async (req, res, next) => {
  try {
    const { name, slug, adminName, adminEmail, adminPassword, plan = "free" } = req.body;

    if (!name?.trim())          return fail(res, "Studio name is required");
    if (!slug?.trim())          return fail(res, "Studio slug is required");
    if (!adminName?.trim())     return fail(res, "Admin name is required");
    if (!adminEmail?.trim())    return fail(res, "Admin email is required");
    if (!adminPassword?.trim()) return fail(res, "Admin password is required");
    if (adminPassword.length < 6) return fail(res, "Admin password must be at least 6 characters");

    const cleanSlug = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,30}$/.test(cleanSlug))
      return fail(res, "Slug must be 3–30 characters: lowercase letters, numbers, and hyphens only");

    // Check slug uniqueness
    const [existing] = await db.select({ id: studiosTable.id }).from(studiosTable)
      .where(eq(studiosTable.slug, cleanSlug)).limit(1);
    if (existing) return fail(res, `Slug "${cleanSlug}" is already taken`, 409);

    // Create studio
    const [studio] = await db.insert(studiosTable).values({
      name:     name.trim(),
      slug:     cleanSlug,
      plan:     plan === "pro" ? "pro" : "free",
      isActive: true,
    }).returning();

    // Create admin user for this studio
    const hashedPw = await bcrypt.hash(adminPassword, 10);
    await db.insert(usersTable).values({
      name:     adminName.trim(),
      email:    adminEmail.trim().toLowerCase(),
      password: hashedPw,
      role:     "ADMIN",
      phone:    "00000000000",
      isActive: true,
      studioId: studio.id,
    });

    const enriched = await enrichStudio(studio);
    return ok(res, `Studio "${studio.name}" created successfully`, enriched, 201);
  } catch (err) { next(err); }
});

// ── GET /api/platform/studios/:id ─────────────────────────────────────────────
router.get("/studios/:id", async (req, res, next) => {
  try {
    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.id, req.params.id)).limit(1);
    if (!studio) return fail(res, "Studio not found", 404);
    return ok(res, "Studio fetched", await enrichStudio(studio));
  } catch (err) { next(err); }
});

// ── PATCH /api/platform/studios/:id — update plan / status / name / slug ──────
router.patch("/studios/:id", async (req, res, next) => {
  try {
    const [existing] = await db.select().from(studiosTable).where(eq(studiosTable.id, req.params.id)).limit(1);
    if (!existing) return fail(res, "Studio not found", 404);

    const updates: Record<string, any> = {};
    if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
    if (req.body.plan     !== undefined) updates.plan     = req.body.plan;
    if (req.body.name     !== undefined) {
      const name = req.body.name.trim();
      if (!name) return fail(res, "Name cannot be empty");
      updates.name = name;
    }
    if (req.body.slug !== undefined) {
      const slug = req.body.slug.trim().toLowerCase();
      if (!/^[a-z0-9-]{3,30}$/.test(slug)) return fail(res, "Invalid slug format");
      const [conflict] = await db.select({ id: studiosTable.id }).from(studiosTable)
        .where(eq(studiosTable.slug, slug)).limit(1);
      if (conflict && conflict.id !== req.params.id) return fail(res, "Slug already taken", 409);
      updates.slug = slug;
    }

    if (req.body.subscriptionStatus !== undefined) {
      const allowed = ["active", "trial", "expired"];
      if (!allowed.includes(req.body.subscriptionStatus)) return fail(res, "Invalid subscription status");
      updates.subscriptionStatus = req.body.subscriptionStatus;
    }
    if (req.body.trialEndsAt !== undefined) {
      updates.trialEndsAt = req.body.trialEndsAt ? new Date(req.body.trialEndsAt) : null;
    }

    if (Object.keys(updates).length === 0) return fail(res, "No fields to update");

    const [updated] = await db.update(studiosTable).set(updates)
      .where(eq(studiosTable.id, req.params.id)).returning();

    return ok(res, "Studio updated", await enrichStudio(updated));
  } catch (err) { next(err); }
});

// ── POST /api/platform/studios/:id/impersonate — get a studio admin token ─────
router.post("/studios/:id/impersonate", async (req, res, next) => {
  try {
    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.id, req.params.id)).limit(1);
    if (!studio) return fail(res, "Studio not found", 404);
    if (!studio.isActive) return fail(res, "Cannot impersonate a suspended studio", 403);

    const [admin] = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, studioId: usersTable.studioId, isActive: usersTable.isActive,
    }).from(usersTable)
      .where(and(eq(usersTable.studioId, studio.id), eq(usersTable.role, "ADMIN"), eq(usersTable.isActive, true)))
      .limit(1);

    if (!admin) return fail(res, "No active admin found for this studio", 404);

    const token = jwt.sign(
      { id: admin.id, name: admin.name, role: "admin", studioId: studio.id, _impersonated: true },
      SECRET,
      { expiresIn: "2h" }
    );

    return ok(res, `Impersonating ${studio.name}`, {
      token,
      studio: { id: studio.id, name: studio.name, slug: studio.slug, plan: studio.plan },
      user:   { id: admin.id, name: admin.name, email: admin.email, role: "admin" },
    });
  } catch (err) { next(err); }
});

// ── GET /api/platform/activity — recent activity across all studios ────────────
router.get("/activity", async (_req, res, next) => {
  try {
    const logs = await db.select({
      id:         activityLogsTable.id,
      studioId:   activityLogsTable.studioId,
      studioName: studiosTable.name,
      studioSlug: studiosTable.slug,
      userId:     activityLogsTable.userId,
      userName:   activityLogsTable.userName,
      userRole:   activityLogsTable.userRole,
      action:     activityLogsTable.action,
      entityType: activityLogsTable.entityType,
      entityId:   activityLogsTable.entityId,
      entityName: activityLogsTable.entityName,
      createdAt:  activityLogsTable.createdAt,
    })
      .from(activityLogsTable)
      .leftJoin(studiosTable, eq(activityLogsTable.studioId, studiosTable.id))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(150);
    return ok(res, "Platform activity", logs);
  } catch (err) { next(err); }
});

// ── GET /api/platform/analytics — revenue + growth trends ─────────────────────
router.get("/analytics", async (_req, res, next) => {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Revenue by month (last 12 months)
    const revenueByMonth = await db
      .select({
        month: sql<string>`to_char(${paymentsTable.createdAt}, 'YYYY-MM')`,
        total: sum(paymentsTable.amount),
      })
      .from(paymentsTable)
      .where(gte(paymentsTable.createdAt, twelveMonthsAgo))
      .groupBy(sql`to_char(${paymentsTable.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${paymentsTable.createdAt}, 'YYYY-MM')`);

    // Studio growth by month (last 12 months)
    const studioGrowthByMonth = await db
      .select({
        month: sql<string>`to_char(${studiosTable.createdAt}, 'YYYY-MM')`,
        newStudios: count(),
      })
      .from(studiosTable)
      .where(gte(studiosTable.createdAt, twelveMonthsAgo))
      .groupBy(sql`to_char(${studiosTable.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${studiosTable.createdAt}, 'YYYY-MM')`);

    // Top studios by revenue (exclude payments with null studioId)
    const topStudios = await db
      .select({
        studioId:   paymentsTable.studioId,
        studioName: studiosTable.name,
        studioSlug: studiosTable.slug,
        plan:       studiosTable.plan,
        revenue:    sum(paymentsTable.amount),
      })
      .from(paymentsTable)
      .innerJoin(studiosTable, eq(paymentsTable.studioId, studiosTable.id))
      .where(isNotNull(paymentsTable.studioId))
      .groupBy(paymentsTable.studioId, studiosTable.name, studiosTable.slug, studiosTable.plan)
      .orderBy(desc(sum(paymentsTable.amount)))
      .limit(5);

    // Active vs inactive count
    const [activeCount, inactiveCount] = await Promise.all([
      db.select({ count: count() }).from(studiosTable).where(eq(studiosTable.isActive, true)).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(studiosTable).where(eq(studiosTable.isActive, false)).then(r => Number(r[0].count)),
    ]);

    return ok(res, "Analytics data", {
      revenueByMonth: revenueByMonth.map(r => ({ month: r.month, total: Number(r.total ?? 0) })),
      studioGrowthByMonth: studioGrowthByMonth.map(r => ({ month: r.month, newStudios: Number(r.newStudios) })),
      topStudios: topStudios.map(r => ({ ...r, revenue: Number(r.revenue ?? 0) })),
      activeVsInactive: { active: activeCount, inactive: inactiveCount },
    });
  } catch (err) { next(err); }
});

// ── GET /api/platform/health — system health status ───────────────────────────
router.get("/health", async (_req, res, next) => {
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    const dbLatency = Date.now() - start;
    const uptimeSeconds = process.uptime();
    const memUsage = process.memoryUsage();
    return ok(res, "Health OK", {
      status:    "operational",
      database:  { status: "connected", latencyMs: dbLatency },
      server:    { uptime: uptimeSeconds, uptimeHuman: formatUptime(uptimeSeconds) },
      memory:    { heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024), rss: Math.round(memUsage.rss / 1024 / 1024) },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// ── GET /api/platform/notifications — admin notifications feed ────────────────
router.get("/notifications", async (_req, res, next) => {
  try {
    const notifications: Array<{ id: string; type: string; title: string; body: string; createdAt: Date }> = [];
    const FREE_LIMITS = { staff: 3, clients: 50, photos: 200 };
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Batch aggregate: staff counts per free studio (one query)
    const [staffCounts, clientCounts, photoCounts, freeStudios, expiredTrials, newStudios] = await Promise.all([
      db.select({ studioId: usersTable.studioId, c: count() })
        .from(usersTable)
        .where(ne(usersTable.role, "SUPERADMIN"))
        .groupBy(usersTable.studioId),
      db.select({ studioId: clientsTable.studioId, c: count() })
        .from(clientsTable)
        .groupBy(clientsTable.studioId),
      db.select({ studioId: photosTable.studioId, c: count() })
        .from(photosTable)
        .groupBy(photosTable.studioId),
      db.select({ id: studiosTable.id, name: studiosTable.name, updatedAt: studiosTable.updatedAt })
        .from(studiosTable).where(eq(studiosTable.plan, "free")),
      db.select({ id: studiosTable.id, name: studiosTable.name, trialEndsAt: studiosTable.trialEndsAt })
        .from(studiosTable)
        .where(and(eq(studiosTable.subscriptionStatus, "trial"), isNotNull(studiosTable.trialEndsAt))),
      db.select({ id: studiosTable.id, name: studiosTable.name, createdAt: studiosTable.createdAt })
        .from(studiosTable).where(gte(studiosTable.createdAt, sevenDaysAgo)),
    ]);

    // Build lookup maps for O(1) access
    const staffMap  = new Map(staffCounts.map(r  => [r.studioId,  Number(r.c)]));
    const clientMap = new Map(clientCounts.map(r => [r.studioId, Number(r.c)]));
    const photoMap  = new Map(photoCounts.map(r  => [r.studioId,  Number(r.c)]));

    for (const s of freeStudios) {
      const staffCount  = staffMap.get(s.id)  ?? 0;
      const clientCount = clientMap.get(s.id) ?? 0;
      const photoCount  = photoMap.get(s.id)  ?? 0;

      if (staffCount >= FREE_LIMITS.staff)
        notifications.push({ id: `limit-staff-${s.id}`,   type: "limit",   title: "Staff limit reached",      body: `${s.name} has reached the free plan staff limit (${staffCount}/${FREE_LIMITS.staff})`,   createdAt: s.updatedAt });
      if (clientCount >= FREE_LIMITS.clients * 0.8)
        notifications.push({ id: `limit-clients-${s.id}`, type: "warning", title: "Approaching client limit",  body: `${s.name} is at ${clientCount}/${FREE_LIMITS.clients} clients`,                         createdAt: s.updatedAt });
      if (photoCount >= FREE_LIMITS.photos * 0.8)
        notifications.push({ id: `limit-photos-${s.id}`,  type: "warning", title: "Approaching photo limit",   body: `${s.name} is at ${photoCount}/${FREE_LIMITS.photos} photos`,                           createdAt: s.updatedAt });
    }

    for (const s of expiredTrials) {
      if (s.trialEndsAt && s.trialEndsAt < now)
        notifications.push({ id: `trial-expired-${s.id}`, type: "error", title: "Trial expired", body: `${s.name}'s trial ended on ${s.trialEndsAt.toLocaleDateString()}`, createdAt: s.trialEndsAt });
    }

    for (const s of newStudios)
      notifications.push({ id: `new-studio-${s.id}`, type: "info", title: "New studio joined", body: `${s.name} signed up`, createdAt: s.createdAt });

    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return ok(res, "Notifications", notifications.slice(0, 20));
  } catch (err) { next(err); }
});

// ── GET /api/platform/export/studios — CSV export ─────────────────────────────
router.get("/export/studios", async (_req, res, next) => {
  try {
    const studios = await db.select().from(studiosTable).orderBy(desc(studiosTable.createdAt));
    const enriched = await Promise.all(studios.map(enrichStudio));

    const headers = ["Name", "Slug", "Plan", "Status", "Subscription", "Trial Ends", "Staff", "Clients", "Photos", "Revenue", "Admin Email", "Created At"];
    const rows = enriched.map(s => [
      s.name, s.slug, s.plan, s.isActive ? "Active" : "Suspended",
      s.subscriptionStatus, s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString() : "",
      s._stats.staffCount, s._stats.clientCount, s._stats.photoCount,
      s._stats.revenue.toFixed(2), s._admin?.email ?? "", new Date(s.createdAt).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="studios-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// ── DELETE /api/platform/studios/:id — delete studio + all its data ───────────
router.delete("/studios/:id", async (req, res, next) => {
  try {
    const [studio] = await db.select().from(studiosTable).where(eq(studiosTable.id, req.params.id)).limit(1);
    if (!studio) return fail(res, "Studio not found", 404);

    // Delete all studio data in dependency order
    await db.delete(paymentsTable).where(eq(paymentsTable.studioId, studio.id));
    await db.delete(invoicesTable).where(eq(invoicesTable.studioId, studio.id));
    await db.delete(photosTable).where(eq(photosTable.studioId, studio.id));
    await db.delete(galleriesTable).where(eq(galleriesTable.studioId, studio.id));
    await db.delete(clientsTable).where(eq(clientsTable.studioId, studio.id));
    await db.delete(usersTable).where(eq(usersTable.studioId, studio.id));
    await db.delete(studiosTable).where(eq(studiosTable.id, studio.id));

    return ok(res, `Studio "${studio.name}" and all its data deleted`);
  } catch (err) { next(err); }
});

// ── GET /api/platform/settings ────────────────────────────────────────────────
router.get("/settings", async (_req, res, next) => {
  try {
    const [settings] = await db.select().from(platformSettingsTable).limit(1);
    return ok(res, "Settings fetched", settings ?? {
      bankName: "", accountNumber: "", accountName: "", proPlanPrice: "50000",
    });
  } catch (err) { next(err); }
});

// ── PUT /api/platform/settings ────────────────────────────────────────────────
router.put("/settings", async (req, res, next) => {
  try {
    const { bankName = "", accountNumber = "", accountName = "", proPlanPrice = "50000" } = req.body;
    const [existing] = await db.select({ id: platformSettingsTable.id }).from(platformSettingsTable).limit(1);
    let result;
    if (existing) {
      [result] = await db.update(platformSettingsTable)
        .set({ bankName, accountNumber, accountName, proPlanPrice: String(proPlanPrice) })
        .where(eq(platformSettingsTable.id, existing.id)).returning();
    } else {
      [result] = await db.insert(platformSettingsTable)
        .values({ bankName, accountNumber, accountName, proPlanPrice: String(proPlanPrice) }).returning();
    }
    return ok(res, "Settings updated", result);
  } catch (err) { next(err); }
});

// ── GET /api/platform/upgrade-requests ────────────────────────────────────────
router.get("/upgrade-requests", async (_req, res, next) => {
  try {
    const requests = await db
      .select({
        id:         upgradeRequestsTable.id,
        amount:     upgradeRequestsTable.amount,
        reference:  upgradeRequestsTable.reference,
        notes:      upgradeRequestsTable.notes,
        status:     upgradeRequestsTable.status,
        createdAt:  upgradeRequestsTable.createdAt,
        studioId:   upgradeRequestsTable.studioId,
        studioName: studiosTable.name,
        studioSlug: studiosTable.slug,
        studioPlan: studiosTable.plan,
      })
      .from(upgradeRequestsTable)
      .innerJoin(studiosTable, eq(upgradeRequestsTable.studioId, studiosTable.id))
      .orderBy(desc(upgradeRequestsTable.createdAt));
    return ok(res, "Upgrade requests fetched", requests);
  } catch (err) { next(err); }
});

// ── POST /api/platform/upgrade-requests/:id/confirm ───────────────────────────
router.post("/upgrade-requests/:id/confirm", async (req, res, next) => {
  try {
    const [request] = await db.select().from(upgradeRequestsTable)
      .where(eq(upgradeRequestsTable.id, req.params.id)).limit(1);
    if (!request) return fail(res, "Request not found", 404);
    if (request.status !== "pending") return fail(res, "Request is not pending");

    await db.update(studiosTable).set({ plan: "pro" }).where(eq(studiosTable.id, request.studioId));
    const [updated] = await db.update(upgradeRequestsTable)
      .set({ status: "confirmed" })
      .where(eq(upgradeRequestsTable.id, req.params.id)).returning();

    return ok(res, "Payment confirmed and studio upgraded to Pro", updated);
  } catch (err) { next(err); }
});

// ── POST /api/platform/upgrade-requests/:id/reject ────────────────────────────
router.post("/upgrade-requests/:id/reject", async (req, res, next) => {
  try {
    const [request] = await db.select().from(upgradeRequestsTable)
      .where(eq(upgradeRequestsTable.id, req.params.id)).limit(1);
    if (!request) return fail(res, "Request not found", 404);
    if (request.status !== "pending") return fail(res, "Request is not pending");

    const [updated] = await db.update(upgradeRequestsTable)
      .set({ status: "rejected" })
      .where(eq(upgradeRequestsTable.id, req.params.id)).returning();

    return ok(res, "Request rejected", updated);
  } catch (err) { next(err); }
});

export default router;
