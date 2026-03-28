import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "./middleware";

const router = Router();
router.use(authMiddleware, requireRole("admin"));

const ok   = (res: any, message: string, data?: any, status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res: any, message: string, status = 400) => res.status(status).json({ success: false, message });

// GET /api/activity — last 100 activity events for this studio
router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const logs = await db.select()
      .from(activityLogsTable)
      .where(eq(activityLogsTable.studioId, studioId))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(100);

    return ok(res, "Activity log fetched", logs);
  } catch (err) { next(err); }
});

export default router;
