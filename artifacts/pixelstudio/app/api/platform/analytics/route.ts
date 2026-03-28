import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { studiosTable, paymentsTable, invoicesTable } from "@workspace/db/schema";
import { eq, count, sum, sql, desc, gte, isNotNull } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      revenueByMonth,
      studioGrowthByMonth,
      topStudios,
      activeCount,
      inactiveCount,
      totalRevenueRow,
      totalInvoicesRow,
      paidInvoicesRow,
      pendingInvoicesRow,
    ] = await Promise.all([
      db.select({
        month: sql<string>`to_char(${paymentsTable.createdAt}, 'YYYY-MM')`,
        total: sum(paymentsTable.amount),
      })
        .from(paymentsTable)
        .where(gte(paymentsTable.createdAt, twelveMonthsAgo))
        .groupBy(sql`to_char(${paymentsTable.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${paymentsTable.createdAt}, 'YYYY-MM')`),

      db.select({
        month:      sql<string>`to_char(${studiosTable.createdAt}, 'YYYY-MM')`,
        newStudios: count(),
      })
        .from(studiosTable)
        .where(gte(studiosTable.createdAt, twelveMonthsAgo))
        .groupBy(sql`to_char(${studiosTable.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${studiosTable.createdAt}, 'YYYY-MM')`),

      db.select({
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
        .limit(5),

      db.select({ count: count() }).from(studiosTable).where(eq(studiosTable.isActive, true)).then(r => Number(r[0].count)),
      db.select({ count: count() }).from(studiosTable).where(eq(studiosTable.isActive, false)).then(r => Number(r[0].count)),

      db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable),
      db.select({ count: count() }).from(invoicesTable),
      db.select({ count: count() }).from(invoicesTable).where(eq(invoicesTable.paymentStatus, "PAID")),
      db.select({ count: count() }).from(invoicesTable).where(eq(invoicesTable.paymentStatus, "PENDING")),
    ]);

    const totalRevenue     = Number(totalRevenueRow[0].total ?? 0);
    const totalInvoices    = Number(totalInvoicesRow[0].count);
    const paidInvoices     = Number(paidInvoicesRow[0].count);
    const pendingInvoices  = Number(pendingInvoicesRow[0].count);
    const avgRevenuePerStudio = activeCount > 0 ? totalRevenue / activeCount : 0;

    return Response.json({
      success: true, message: "Analytics data",
      data: {
        revenueByMonth:      revenueByMonth.map(r => ({ month: r.month, total: Number(r.total ?? 0) })),
        studioGrowthByMonth: studioGrowthByMonth.map(r => ({ month: r.month, newStudios: Number(r.newStudios) })),
        topStudios:          topStudios.map(r => ({ ...r, revenue: Number(r.revenue ?? 0) })),
        activeVsInactive:    { active: activeCount, inactive: inactiveCount },
        totalRevenue,
        totalInvoices,
        paidInvoices,
        pendingInvoices,
        avgRevenuePerStudio,
      },
    });
  } catch (err) {
    console.error("[platform/analytics GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
