import { Router } from "express";
import { db } from "@workspace/db";
import { galleriesTable, photosTable, studiosTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

const ok   = (res: any, message: string, data?: any, status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res: any, message: string, status = 400) => res.status(status).json({ success: false, message });

const buildGalleryUrl = (token: string) => {
  const base = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  return base ? `${base}/gallery/${token}` : `/gallery/${token}`;
};

// GET /api/gallery/:token  (public, no auth required)
router.get("/:token", async (req, res, next) => {
  try {
    const token = req.params.token.toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return fail(res, "Invalid gallery link. Please check the URL and try again.", 400);
    }

    const gallery = await db.query.galleriesTable.findFirst({
      where: eq(galleriesTable.token, token),
      with: {
        client: {
          columns: { clientName: true, orderStatus: true },
          with: { createdBy: { columns: { name: true } } },
        },
        photos: {
          columns: { id: true, imageUrl: true, fileName: true, createdAt: true },
          orderBy: [asc(photosTable.createdAt)],
        },
      },
    });

    if (!gallery) {
      return fail(res, "Gallery not found. The link may be invalid or the photos have been removed.", 404);
    }

    const { clientName, orderStatus, createdBy } = gallery.client;
    const photographerName = createdBy ? createdBy.name : "PixelStudio";

    // Resolve studio branding from the gallery's studioId
    let studioName: string = process.env.STUDIO_NAME || "PixelStudio";
    let studioLogoUrl: string | null = null;

    if (gallery.studioId) {
      const [studio] = await db.select({ name: studiosTable.name, logoUrl: studiosTable.logoUrl })
        .from(studiosTable).where(eq(studiosTable.id, gallery.studioId)).limit(1);
      if (studio) {
        studioName    = studio.name;
        studioLogoUrl = studio.logoUrl ?? null;
      }
    }

    const galleryUrl  = buildGalleryUrl(token);

    if (orderStatus === "PENDING" || orderStatus === "EDITING") {
      return res.status(403).json({
        success: false,
        message: "Your photos are not ready yet. We will notify you when they are available.",
        data: { studioName, studioLogoUrl, clientName, photographerName, orderStatus },
      });
    }

    return ok(res, "Gallery loaded successfully", {
      studioName, studioLogoUrl, clientName, photographerName,
      galleryToken: gallery.token, galleryUrl,
      orderStatus, createdAt: gallery.createdAt,
      photoCount: gallery.photos.length, photos: gallery.photos,
    });
  } catch (err) { next(err); }
});

export default router;
