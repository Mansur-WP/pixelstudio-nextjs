import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";

const formatUser = (user: { id: string; name: string; email: string; phone: string; role: string; studioId: string | null; isActive: boolean; createdAt: Date | null }) => ({
  id:        user.id,
  name:      user.name,
  email:     user.email,
  phone:     user.phone,
  role:      user.role.toLowerCase(),
  studioId:  user.studioId ?? null,
  isActive:  user.isActive,
  createdAt: user.createdAt || null,
});

const formatStudio = (studio: { id: string; name: string; slug: string; logoUrl: string | null; phone: string | null; address: string | null; email: string | null; plan: string }) => ({
  id:      studio.id,
  name:    studio.name,
  slug:    studio.slug,
  logoUrl: studio.logoUrl ?? null,
  phone:   studio.phone   ?? null,
  address: studio.address ?? null,
  email:   studio.email   ?? null,
  plan:    studio.plan,
});

export async function GET(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, ctx.user.id)).limit(1);
    if (!user) return Response.json({ success: false, message: "User account no longer exists. Please log in again." }, { status: 401 });
    if (!user.isActive) return Response.json({ success: false, message: "Your account has been deactivated. Contact the admin." }, { status: 403 });

    return Response.json({
      success: true, message: "User profile fetched",
      data: { user: formatUser(user), studio: ctx.studio ? formatStudio(ctx.studio) : null },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[auth/me GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  try {
    const body = await request.json();
    const newName = (body.name || "").trim();
    if (!newName) return Response.json({ success: false, message: "Name cannot be empty." }, { status: 400 });
    if (newName.length > 100) return Response.json({ success: false, message: "Name must be 100 characters or fewer." }, { status: 400 });

    const [updated] = await db.update(usersTable).set({ name: newName }).where(eq(usersTable.id, ctx.user.id)).returning();
    if (!updated) return Response.json({ success: false, message: "User not found." }, { status: 404 });

    return Response.json({ success: true, message: "Profile updated", data: formatUser(updated) });
  } catch (err) {
    console.error("[auth/me PUT]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
