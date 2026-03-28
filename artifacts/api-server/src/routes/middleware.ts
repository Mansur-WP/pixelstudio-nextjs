import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { studiosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import type { Studio } from "@workspace/db/schema";

const SECRET = process.env.JWT_SECRET || "dev_fallback_secret_change_me_in_production";

export interface AuthRequest extends Request {
  user?:   { id: string; name: string; role: string; studioId: string | null };
  studio?: Studio | null; // null only for SUPERADMIN
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ success: false, message: "Access denied. No authorization token was provided." });
  if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ success: false, message: "Invalid token format." });

  const token = authHeader.split(" ")[1];
  if (!token || token.trim() === "") return res.status(401).json({ success: false, message: "Access denied. Token is empty." });

  let decoded: { id: string; name: string; role: string; studioId: string | null };
  try {
    decoded = jwt.verify(token, SECRET) as any;
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token. Please log in again." });
  }

  req.user = decoded;

  // Superadmin has no studio — skip lookup
  if (decoded.role === "superadmin" || decoded.studioId === null || decoded.studioId === undefined) {
    req.studio = null;
    return next();
  }

  try {
    const [studio] = await db.select().from(studiosTable)
      .where(eq(studiosTable.id, decoded.studioId)).limit(1);

    if (!studio) return res.status(403).json({ success: false, message: "Studio not found. Please log in again." });
    if (!studio.isActive) return res.status(403).json({ success: false, message: "This studio account has been suspended. Contact support." });

    req.studio = studio;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated." });
  // Superadmin can do everything
  if (req.user.role === "superadmin") return next();
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: `Access denied. Required role: ${roles.join(" or ")}.` });
  }
  next();
};

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ success: false, message: "Access denied. Superadmin only." });
  }
  next();
};
