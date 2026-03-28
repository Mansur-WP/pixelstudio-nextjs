import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authenticate, isAuthContext, requireSuperAdmin } from "@/lib/auth";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    const dbLatency     = Date.now() - start;
    const uptimeSeconds = process.uptime();
    const memUsage      = process.memoryUsage();

    return Response.json({
      success: true, message: "Health OK",
      data: {
        status:   "operational",
        database: { status: "connected", latencyMs: dbLatency },
        server:   { uptime: uptimeSeconds, uptimeHuman: formatUptime(uptimeSeconds) },
        memory:   { heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024), rss: Math.round(memUsage.rss / 1024 / 1024) },
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[platform/health GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
