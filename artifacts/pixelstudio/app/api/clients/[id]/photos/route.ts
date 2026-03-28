import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { clientsTable, galleriesTable, photosTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, isAuthContext } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const FREE_PHOTO_LIMIT = 200;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const MAX_SIZE = 20 * 1024 * 1024;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request);
  if (!isAuthContext(ctx)) return ctx;

  const studioId = ctx.studio?.id;
  if (!studioId) return Response.json({ success: false, message: "No studio context" }, { status: 400 });

  const { id: clientId } = await params;
  try {
    const [client] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.studioId, studioId))).limit(1);
    if (!client) return Response.json({ success: false, message: "Client not found" }, { status: 404 });
    if (ctx.user.role === "staff" && client.createdById !== ctx.user.id) {
      return Response.json({ success: false, message: "Access denied. This client belongs to a different staff member." }, { status: 403 });
    }
    if (client.orderStatus === "DELIVERED") {
      return Response.json({ success: false, message: "Cannot upload photos. This client's order has already been delivered." }, { status: 409 });
    }

    const formData = await request.formData();
    const fileEntries = formData.getAll("photos") as File[];

    if (!fileEntries || fileEntries.length === 0) {
      return Response.json({ success: false, message: "No files received. Send a multipart/form-data request with a 'photos' field." }, { status: 400 });
    }

    // Validate each file
    for (const file of fileEntries) {
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        return Response.json({ success: false, message: `Only image files are allowed. Got: ${file.name}` }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return Response.json({ success: false, message: `File too large (max 20 MB): ${file.name}` }, { status: 400 });
      }
    }

    // Plan limit check
    if (ctx.studio?.plan === "free") {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(photosTable).where(eq(photosTable.studioId, studioId));
      if (Number(count) + fileEntries.length > FREE_PHOTO_LIMIT) {
        return Response.json({ success: false, message: `Free plan photo limit (${FREE_PHOTO_LIMIT}) would be exceeded. Upgrade to Pro for unlimited photos.` }, { status: 403 });
      }
    }

    // Get or create gallery
    let [gallery] = await db.select().from(galleriesTable).where(eq(galleriesTable.clientId, clientId)).limit(1);

    if (gallery) {
      await db.update(galleriesTable).set({ uploadedById: ctx.user.id }).where(eq(galleriesTable.id, gallery.id));
      const existingPhotos = await db.select({ fileName: photosTable.fileName }).from(photosTable).where(eq(photosTable.galleryId, gallery.id));
      await db.delete(photosTable).where(eq(photosTable.galleryId, gallery.id));
      existingPhotos.forEach(p => {
        const fp = path.join(UPLOAD_DIR, p.fileName);
        if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch {}
      });
    } else {
      [gallery] = await db.insert(galleriesTable).values({
        token: client.galleryToken, clientId, uploadedById: ctx.user.id, studioId,
      }).returning();
    }

    // Write files and insert records
    const photos = await Promise.all(fileEntries.map(async file => {
      const ext      = path.extname(file.name).toLowerCase();
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const buffer   = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

      const [photo] = await db.insert(photosTable).values({
        fileName:  filename,
        imageUrl:  `/uploads/${filename}`,
        publicId:  null,
        clientId,
        galleryId: gallery.id,
        studioId,
      }).returning({ id: photosTable.id, imageUrl: photosTable.imageUrl, fileName: photosTable.fileName, createdAt: photosTable.createdAt });
      return photo;
    }));

    if (client.orderStatus === "PENDING" || client.orderStatus === "EDITING") {
      await db.update(clientsTable).set({ orderStatus: "READY" }).where(eq(clientsTable.id, clientId));
    }

    const [updatedClient] = await db.select({
      id: clientsTable.id, clientName: clientsTable.clientName, phone: clientsTable.phone,
      orderStatus: clientsTable.orderStatus, paymentStatus: clientsTable.paymentStatus, galleryToken: clientsTable.galleryToken,
    }).from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);

    logActivity({ studioId, userId: ctx.user.id, userName: ctx.user.name ?? "Unknown", userRole: ctx.user.role, action: "photos_uploaded", entityType: "client", entityId: clientId, entityName: client.clientName });

    return Response.json({
      success: true, message: `${photos.length} photo(s) uploaded successfully`,
      data: {
        client: updatedClient,
        gallery: { id: gallery.id, token: gallery.token, url: `/gallery/${gallery.token}` },
        photoCount: photos.length, photos,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[clients/id/photos POST]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
