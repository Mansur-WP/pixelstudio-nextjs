import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import {
  usersTable, studiosTable, clientsTable, galleriesTable,
  photosTable, invoicesTable, paymentsTable,
} from "@workspace/db/schema";
import { eq, isNull, and, count } from "drizzle-orm";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

async function seedEverything() {
  try {
    // ── 1. Ensure the default GBSM studio exists ──────────────────────────────
    const GBSM_SLUG = "gbsm";
    let [gbsmStudio] = await db.select().from(studiosTable).where(eq(studiosTable.slug, GBSM_SLUG)).limit(1);

    if (!gbsmStudio) {
      [gbsmStudio] = await db.insert(studiosTable).values({
        name:     process.env["STUDIO_NAME"] || "GBSM Photography",
        slug:     GBSM_SLUG,
        plan:     "free",
        isActive: true,
      }).returning();
      logger.info({ slug: GBSM_SLUG }, "Default GBSM studio created");
    }

    const studioId = gbsmStudio.id;

    // ── 2. Backfill: assign all orphaned records to the GBSM studio ───────────
    const [usersToFix, clientsToFix, galleriesToFix, photosToFix, invoicesToFix, paymentsToFix] = await Promise.all([
      db.select({ count: count() }).from(usersTable).where(isNull(usersTable.studioId)).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(clientsTable).where(isNull(clientsTable.studioId)).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(galleriesTable).where(isNull(galleriesTable.studioId)).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(photosTable).where(isNull(photosTable.studioId)).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(invoicesTable).where(isNull(invoicesTable.studioId)).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(paymentsTable).where(isNull(paymentsTable.studioId)).then(r => Number(r[0].count)),
    ]);

    if (usersToFix + clientsToFix + galleriesToFix + photosToFix + invoicesToFix + paymentsToFix > 0) {
      await Promise.all([
        db.update(usersTable).set({ studioId }).where(isNull(usersTable.studioId)),
        db.update(clientsTable).set({ studioId }).where(isNull(clientsTable.studioId)),
        db.update(galleriesTable).set({ studioId }).where(isNull(galleriesTable.studioId)),
        db.update(photosTable).set({ studioId }).where(isNull(photosTable.studioId)),
        db.update(invoicesTable).set({ studioId }).where(isNull(invoicesTable.studioId)),
        db.update(paymentsTable).set({ studioId }).where(isNull(paymentsTable.studioId)),
      ]);
      logger.info(
        { usersToFix, clientsToFix, galleriesToFix, photosToFix, invoicesToFix, paymentsToFix },
        "Backfilled orphaned records to GBSM studio"
      );
    }

    // ── 3. Ensure GBSM studio admin exists ───────────────────────────────────
    const adminEmail    = (process.env["ADMIN_EMAIL"]    ?? "admin@gbsm").toLowerCase();
    const adminPassword = process.env["ADMIN_PASSWORD"]  ?? "gbsm123";
    const adminName     = process.env["ADMIN_NAME"]      ?? "Admin User";

    const [existingAdmin] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.email, adminEmail), eq(usersTable.studioId, studioId))).limit(1);

    if (!existingAdmin) {
      const hashed = await bcrypt.hash(adminPassword, 10);
      await db.insert(usersTable).values({
        name: adminName, email: adminEmail, password: hashed,
        role: "ADMIN", phone: "00000000000", isActive: true, studioId,
      });
      logger.info({ email: adminEmail, studioId }, "GBSM admin user seeded");
    }

    // ── 4. Ensure superadmin exists ───────────────────────────────────────────
    const superEmail    = (process.env["SUPERADMIN_EMAIL"]    ?? "platform@admin").toLowerCase();
    const superPassword =  process.env["SUPERADMIN_PASSWORD"] ?? "platform123";

    const [existingSuper] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.email, superEmail)).limit(1);

    if (!existingSuper) {
      const hashed = await bcrypt.hash(superPassword, 10);
      await db.insert(usersTable).values({
        name: "Platform Admin", email: superEmail, password: hashed,
        role: "SUPERADMIN", phone: "00000000000", isActive: true, studioId: null,
      });
      logger.info({ email: superEmail }, "Superadmin seeded");
    }

  } catch (err) {
    logger.error({ err }, "Failed to seed initial data");
  }
}

seedEverything().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});
