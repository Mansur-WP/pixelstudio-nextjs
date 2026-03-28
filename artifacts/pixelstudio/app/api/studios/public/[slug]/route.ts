import { NextRequest } from "next/server";
import { db } from "@workspace/db";
import { studiosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const cleanSlug = (slug || "").toLowerCase().trim();

    const [studio] = await db.select({
      name:     studiosTable.name,
      logoUrl:  studiosTable.logoUrl,
      isActive: studiosTable.isActive,
    }).from(studiosTable).where(eq(studiosTable.slug, cleanSlug)).limit(1);

    if (!studio) {
      return Response.json({ success: false, message: "Studio not found" }, { status: 404 });
    }
    return Response.json({ success: true, message: "ok", data: { name: studio.name, logoUrl: studio.logoUrl ?? null, isActive: studio.isActive } });
  } catch (err) {
    console.error("[studios/public/slug GET]", err);
    return Response.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
