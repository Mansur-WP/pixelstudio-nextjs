import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { galleriesTable, photosTable, studiosTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const buildGalleryUrl = (token: string) => `/gallery/${token}`;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const lowerToken = token.toLowerCase();

    if (!/^[a-f0-9]{32}$/.test(lowerToken)) {
      return Response.json({ success: false, message: "Invalid gallery link. Please check the URL and try again." }, { status: 400 });
    }

    const gallery = await db.query.galleriesTable.findFirst({
      where: eq(galleriesTable.token, lowerToken),
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
      return Response.json({ success: false, message: "Gallery not found. The link may be invalid or the photos have been removed." }, { status: 404 });
    }

    const { clientName, orderStatus, createdBy } = gallery.client;
    const photographerName = createdBy ? createdBy.name : "PixelStudio";

    let studioName = "PixelStudio";
    let studioLogoUrl: string | null = null;

    if (gallery.studioId) {
      const [studio] = await db.select({ name: studiosTable.name, logoUrl: studiosTable.logoUrl })
        .from(studiosTable).where(eq(studiosTable.id, gallery.studioId)).limit(1);
      if (studio) {
        studioName    = studio.name;
        studioLogoUrl = studio.logoUrl ?? null;
      }
    }

    if (orderStatus === "PENDING" || orderStatus === "EDITING") {
      return Response.json({
        success: false,
        message: "Your photos are not ready yet. We will notify you when they are available.",
        data: { studioName, studioLogoUrl, clientName, photographerName, orderStatus },
      }, { status: 403 });
    }

    return Response.json({
      success: true, message: "Gallery loaded successfully",
      data: {
        studioName, studioLogoUrl, clientName, photographerName,
        galleryToken: gallery.token, galleryUrl: buildGalleryUrl(lowerToken),
        orderStatus, createdAt: gallery.createdAt,
        photoCount: gallery.photos.length, photos: gallery.photos,
      },
    });
  } catch (err) {
    console.error("[gallery/token GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
