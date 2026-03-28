import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { studiosTable, usersTable, clientsTable, photosTable } from "@workspace/db/schema";
import { eq, count, ne, and, gte, isNotNull } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  try {
    const notifications: Array<{ id: string; type: string; title: string; body: string; createdAt: Date }> = [];
    const FREE_LIMITS = { staff: 3, clients: 50, photos: 200 };
    const now         = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [staffCounts, clientCounts, photoCounts, freeStudios, expiredTrials, newStudios] = await Promise.all([
      db.select({ studioId: usersTable.studioId, c: count() }).from(usersTable)
        .where(ne(usersTable.role, "SUPERADMIN")).groupBy(usersTable.studioId),
      db.select({ studioId: clientsTable.studioId, c: count() }).from(clientsTable).groupBy(clientsTable.studioId),
      db.select({ studioId: photosTable.studioId, c: count() }).from(photosTable).groupBy(photosTable.studioId),
      db.select({ id: studiosTable.id, name: studiosTable.name, updatedAt: studiosTable.updatedAt })
        .from(studiosTable).where(eq(studiosTable.plan, "free")),
      db.select({ id: studiosTable.id, name: studiosTable.name, trialEndsAt: studiosTable.trialEndsAt })
        .from(studiosTable).where(and(eq(studiosTable.subscriptionStatus, "trial"), isNotNull(studiosTable.trialEndsAt))),
      db.select({ id: studiosTable.id, name: studiosTable.name, createdAt: studiosTable.createdAt })
        .from(studiosTable).where(gte(studiosTable.createdAt, sevenDaysAgo)),
    ]);

    const staffMap  = new Map(staffCounts.map(r  => [r.studioId, Number(r.c)]));
    const clientMap = new Map(clientCounts.map(r => [r.studioId, Number(r.c)]));
    const photoMap  = new Map(photoCounts.map(r  => [r.studioId, Number(r.c)]));

    for (const s of freeStudios) {
      const sc = staffMap.get(s.id)  ?? 0;
      const cc = clientMap.get(s.id) ?? 0;
      const pc = photoMap.get(s.id)  ?? 0;

      if (sc >= FREE_LIMITS.staff)
        notifications.push({ id: `limit-staff-${s.id}`,   type: "limit",   title: "Staff limit reached",     body: `${s.name} has reached the free plan staff limit (${sc}/${FREE_LIMITS.staff})`,   createdAt: s.updatedAt });
      if (cc >= FREE_LIMITS.clients * 0.8)
        notifications.push({ id: `limit-clients-${s.id}`, type: "warning", title: "Approaching client limit", body: `${s.name} is at ${cc}/${FREE_LIMITS.clients} clients`,                         createdAt: s.updatedAt });
      if (pc >= FREE_LIMITS.photos * 0.8)
        notifications.push({ id: `limit-photos-${s.id}`,  type: "warning", title: "Approaching photo limit",  body: `${s.name} is at ${pc}/${FREE_LIMITS.photos} photos`,                           createdAt: s.updatedAt });
    }

    for (const s of expiredTrials) {
      if (s.trialEndsAt && s.trialEndsAt < now)
        notifications.push({ id: `trial-expired-${s.id}`, type: "error", title: "Trial expired", body: `${s.name}'s trial ended on ${s.trialEndsAt.toLocaleDateString()}`, createdAt: s.trialEndsAt });
    }

    for (const s of newStudios)
      notifications.push({ id: `new-studio-${s.id}`, type: "info", title: "New studio joined", body: `${s.name} signed up`, createdAt: s.createdAt });

    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Response.json({ success: true, message: "Notifications", data: notifications.slice(0, 20) });
  } catch (err) {
    console.error("[platform/notifications GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
