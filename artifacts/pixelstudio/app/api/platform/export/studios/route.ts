import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { studiosTable, usersTable, clientsTable, photosTable, invoicesTable, paymentsTable } from "@workspace/db/schema";
import { eq, count, sum, desc, and, ne } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

async function enrichStudio(s: typeof studiosTable.$inferSelect) {
  const [staffCount, clientCount, photoCount, invoiceCount, revenue, adminUser] = await Promise.all([
    db.select({ count: count() }).from(usersTable).where(and(eq(usersTable.studioId, s.id), ne(usersTable.role, "SUPERADMIN"))).then(r => Number(r[0].count)),
    db.select({ count: count() }).from(clientsTable).where(eq(clientsTable.studioId, s.id)).then(r => Number(r[0].count)),
    db.select({ count: count() }).from(photosTable).where(eq(photosTable.studioId, s.id)).then(r => Number(r[0].count)),
    db.select({ count: count() }).from(invoicesTable).where(eq(invoicesTable.studioId, s.id)).then(r => Number(r[0].count)),
    db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).where(eq(paymentsTable.studioId, s.id)).then(r => Number(r[0].total ?? 0)),
    db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable)
      .where(and(eq(usersTable.studioId, s.id), eq(usersTable.role, "ADMIN"))).limit(1).then(r => r[0] ?? null),
  ]);
  return { ...s, _stats: { staffCount, clientCount, photoCount, invoiceCount, revenue }, _admin: adminUser };
}

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  try {
    const studios  = await db.select().from(studiosTable).orderBy(desc(studiosTable.createdAt));
    const enriched = await Promise.all(studios.map(enrichStudio));

    const headers = ["Name", "Slug", "Plan", "Status", "Subscription", "Trial Ends", "Staff", "Clients", "Photos", "Revenue", "Admin Email", "Created At"];
    const rows = enriched.map(s => [
      s.name, s.slug, s.plan, s.isActive ? "Active" : "Suspended",
      s.subscriptionStatus ?? "", s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString() : "",
      s._stats.staffCount, s._stats.clientCount, s._stats.photoCount,
      s._stats.revenue.toFixed(2), s._admin?.email ?? "", new Date(s.createdAt).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="studios-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    console.error("[platform/export/studios GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
