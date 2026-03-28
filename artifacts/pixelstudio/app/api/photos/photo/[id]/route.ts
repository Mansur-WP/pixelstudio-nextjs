import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { photosTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  const { id }   = await params;

  try {
    const photo = await db.query.photosTable.findFirst({
      where: studioId
        ? and(eq(photosTable.id, id), eq(photosTable.studioId, studioId))
        : eq(photosTable.id, id),
      with: { client: { columns: { createdById: true, clientName: true } } },
    });

    if (!photo) return Response.json({ success: false, message: "Photo not found" }, { status: 404 });
    if (ctx.user.role === "staff" && photo.client.createdById !== ctx.user.id) {
      return Response.json({ success: false, message: "Access denied. This photo belongs to another staff member's client." }, { status: 403 });
    }

    const filePath = path.join(UPLOAD_DIR, photo.fileName);
    if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}

    await db.delete(photosTable).where(eq(photosTable.id, id));
    return Response.json({ success: true, message: "Photo deleted" });
  } catch (err) {
    console.error("[photos/photo/id DELETE]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
