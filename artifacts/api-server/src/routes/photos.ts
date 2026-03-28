import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { clientsTable, galleriesTable, photosTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authMiddleware, requireRole } from "./middleware";
import { logActivity } from "../lib/activity";

const router = Router();
router.use(authMiddleware);

const FREE_PHOTO_LIMIT = 200;

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  allowed.includes(ext) ? cb(null, true) : cb(new Error("Only image files are allowed"));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

const ok   = (res: Response, message: string, data?: any, status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res: Response, message: string, status = 400) => res.status(status).json({ success: false, message });

const cleanupFiles = (files: Express.Multer.File[]) => {
  files.forEach(file => {
    const p = path.join(UPLOAD_DIR, file.filename);
    if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch {}
  });
};

const galleryUrl = (token: string) => `${process.env.FRONTEND_URL || ""}/gallery/${token}`;

// POST /api/clients/:clientId/photos
router.post("/:clientId/photos",
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const studioId = req.studio?.id;
      if (!studioId) return fail(res, "No studio context", 400);

      const { clientId } = req.params;
      const [client] = await db.select().from(clientsTable)
        .where(and(eq(clientsTable.id, clientId), eq(clientsTable.studioId, studioId))).limit(1);
      if (!client) return fail(res, "Client not found", 404);
      if (req.user.role === "staff" && client.createdById !== req.user.id) {
        return fail(res, "Access denied. This client belongs to a different staff member.", 403);
      }
      (req as any).client = client;
      next();
    } catch (err) { next(err); }
  },
  upload.array("photos"),
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const studioId = req.studio?.id;
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return fail(res, "No files received. Send a multipart/form-data request with a 'photos' field.", 400);
      }

      const { clientId } = req.params;
      const client = (req as any).client;

      if (client.orderStatus === "DELIVERED") {
        cleanupFiles(files);
        return fail(res, "Cannot upload photos. This client's order has already been delivered.", 409);
      }

      // Plan enforcement: photo limit
      if (req.studio?.plan === "free") {
        const [{ count: photoCount }] = await db.select({ count: sql<number>`count(*)` })
          .from(photosTable).where(eq(photosTable.studioId, studioId));
        if (Number(photoCount) + files.length > FREE_PHOTO_LIMIT) {
          cleanupFiles(files);
          return fail(res, `Free plan photo limit (${FREE_PHOTO_LIMIT}) would be exceeded. Upgrade to Pro for unlimited photos.`, 403);
        }
      }

      let [gallery] = await db.select().from(galleriesTable).where(eq(galleriesTable.clientId, clientId)).limit(1);

      if (gallery) {
        await db.update(galleriesTable).set({ uploadedById: req.user.id }).where(eq(galleriesTable.id, gallery.id));
        const existingPhotos = await db.select({ fileName: photosTable.fileName }).from(photosTable).where(eq(photosTable.galleryId, gallery.id));
        await db.delete(photosTable).where(eq(photosTable.galleryId, gallery.id));
        existingPhotos.forEach(p => {
          const fp = path.join(UPLOAD_DIR, p.fileName);
          if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch {}
        });
      } else {
        [gallery] = await db.insert(galleriesTable).values({
          token: client.galleryToken, clientId, uploadedById: req.user.id, studioId,
        }).returning();
      }

      const photos = await Promise.all(files.map(file =>
        db.insert(photosTable).values({
          fileName: file.filename, imageUrl: `/uploads/${file.filename}`,
          publicId: null, clientId, galleryId: gallery.id, studioId,
        }).returning({ id: photosTable.id, imageUrl: photosTable.imageUrl, fileName: photosTable.fileName, createdAt: photosTable.createdAt })
          .then(r => r[0])
      ));

      if (client.orderStatus === "PENDING" || client.orderStatus === "EDITING") {
        await db.update(clientsTable).set({ orderStatus: "READY" }).where(eq(clientsTable.id, clientId));
      }

      const [updatedClient] = await db.select({
        id: clientsTable.id, clientName: clientsTable.clientName, phone: clientsTable.phone,
        orderStatus: clientsTable.orderStatus, paymentStatus: clientsTable.paymentStatus, galleryToken: clientsTable.galleryToken,
      }).from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);

      logActivity({ studioId, userId: req.user.id, userName: req.user.name ?? "Unknown", userRole: req.user.role, action: "photos_uploaded", entityType: "client", entityId: clientId, entityName: client.clientName });
      return ok(res, `${photos.length} photo(s) uploaded successfully`, {
        client: updatedClient,
        gallery: { id: gallery.id, token: gallery.token, url: galleryUrl(gallery.token) },
        photoCount: photos.length, photos,
      }, 201);
    } catch (err) {
      cleanupFiles((req as any).files || []);
      next(err);
    }
  }
);

// DELETE /api/photos/photo/:id
router.delete("/photo/:id", async (req: any, res: Response, next: NextFunction) => {
  try {
    const studioId = req.studio?.id;
    const photo = await db.query.photosTable.findFirst({
      where: studioId ? and(eq(photosTable.id, req.params.id), eq(photosTable.studioId, studioId)) : eq(photosTable.id, req.params.id),
      with: { client: { columns: { createdById: true, clientName: true } } },
    });

    if (!photo) return fail(res, "Photo not found", 404);
    if (req.user.role === "staff" && photo.client.createdById !== req.user.id) {
      return fail(res, "Access denied. This photo belongs to another staff member's client.", 403);
    }

    const filePath = path.join(UPLOAD_DIR, photo.fileName);
    if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}

    await db.delete(photosTable).where(eq(photosTable.id, req.params.id));
    return ok(res, "Photo deleted");
  } catch (err) { next(err); }
});

// DELETE /api/photos — admin-only: wipe all photos for this studio
router.delete("/", requireRole("admin"), async (req: any, res: Response, next: NextFunction) => {
  try {
    const studioId = req.studio?.id;
    if (!studioId) return fail(res, "No studio context", 400);

    const allPhotos = await db.select({ fileName: photosTable.fileName })
      .from(photosTable).where(eq(photosTable.studioId, studioId));

    let removed = 0;
    for (const photo of allPhotos) {
      const filePath = path.join(UPLOAD_DIR, photo.fileName);
      if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); removed++; } catch {} }
    }

    await db.delete(photosTable).where(eq(photosTable.studioId, studioId));

    return ok(res, `${allPhotos.length} photo record(s) deleted (${removed} file(s) removed from disk).`, {
      deletedCount: allPhotos.length,
      filesRemoved: removed,
    });
  } catch (err) { next(err); }
});

export default router;
