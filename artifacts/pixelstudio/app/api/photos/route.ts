import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { photosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, isAuthContext, requireRole } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function DELETE(request: NextRequest) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;
  const roleErr = requireRole(ctx, "admin");
  if (roleErr) return roleErr;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  try {
    const allPhotos = await db.select({ fileName: photosTable.fileName })
      .from(photosTable).where(eq(photosTable.studioId, studioId));

    let removed = 0;
    for (const photo of allPhotos) {
      const filePath = path.join(UPLOAD_DIR, photo.fileName);
      if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); removed++; } catch {} }
    }

    await db.delete(photosTable).where(eq(photosTable.studioId, studioId));

    return Response.json({
      success: true,
      message: `${allPhotos.length} photo record(s) deleted (${removed} file(s) removed from disk).`,
      data: { deletedCount: allPhotos.length, filesRemoved: removed },
    });
  } catch (err) {
    console.error("[photos DELETE]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
