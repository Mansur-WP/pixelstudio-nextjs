import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { studiosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, isAuthContext, requireRole } from "@/lib/auth";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const roleErr = requireRole(ctx, "admin");
  if (roleErr) return roleErr;

  if (!ctx.studio) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    const formData = await request.formData();
    const file = formData.get("logo") as File | null;

    if (!file) return Response.json({ success: false, message: "No logo file uploaded" }, { status: 400 });
    if (!file.type.startsWith("image/")) {
      return Response.json({ success: false, message: "Only image files are allowed for logos" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ success: false, message: "Logo must be under 2 MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/png";
    const logoUrl = `data:${mimeType};base64,${base64}`;

    const [updated] = await db.update(studiosTable).set({ logoUrl })
      .where(eq(studiosTable.id, ctx.studio.id)).returning({ logoUrl: studiosTable.logoUrl });

    return Response.json({ success: true, message: "Logo uploaded successfully", data: { logoUrl: updated.logoUrl } });
  } catch (err) {
    console.error("[studios/me/logo POST]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
