import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { studiosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import type { Studio } from "@workspace/db/schema";

const JWT_SECRET = process.env.JWT_SECRET || "dev_fallback_secret_change_me_in_production";

export interface JwtPayload {
  id:       string;
  name:     string;
  role:     string;
  studioId: string | null;
}

export interface AuthContext {
  user:   JwtPayload;
  studio: Studio | null;
}

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

export async function authenticate(req: NextRequest): Promise<AuthContext | Response> {
  const token = extractToken(req);
  if (!token) {
    return Response.json(
      { success: false, message: "Access denied. No authorization token was provided." },
      { status: 401 }
    );
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return Response.json(
      { success: false, message: "Invalid or expired token. Please log in again." },
      { status: 401 }
    );
  }

  if (decoded.role === "superadmin" || !decoded.studioId) {
    return { user: decoded, studio: null };
  }

  try {
    const [studio] = await db
      .select()
      .from(studiosTable)
      .where(eq(studiosTable.id, decoded.studioId))
      .limit(1);

    if (!studio) {
      return Response.json(
        { success: false, message: "Studio not found. Please log in again." },
        { status: 401 }
      );
    }
    if (!studio.isActive) {
      return Response.json(
        { success: false, message: "This studio account has been suspended. Contact support." },
        { status: 403 }
      );
    }

    return { user: decoded, studio };
  } catch (err) {
    console.error("[auth] Authentication error:", err);
    return Response.json(
      { success: false, message: "Authentication error." },
      { status: 500 }
    );
  }
}

export function isAuthContext(result: AuthContext | Response): result is AuthContext {
  return !(result instanceof Response);
}

export function requireRole(ctx: AuthContext, ...roles: string[]): Response | null {
  if (ctx.user.role === "superadmin") return null;
  if (!roles.includes(ctx.user.role)) {
    return Response.json(
      { success: false, message: `Access denied. Required role: ${roles.join(" or ")}.` },
      { status: 403 }
    );
  }
  return null;
}

export function requireSuperAdmin(ctx: AuthContext): Response | null {
  if (ctx.user.role !== "superadmin") {
    return Response.json(
      { success: false, message: "Access denied. Superadmin only." },
      { status: 403 }
    );
  }
  return null;
}

export function ok200(message: string, data?: unknown, status = 200): Response {
  return Response.json({ success: true, message, data }, { status });
}

export function fail(message: string, status = 400): Response {
  return Response.json({ success: false, message }, { status });
}
