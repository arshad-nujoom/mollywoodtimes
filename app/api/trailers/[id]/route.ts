import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { movieTitle, youtubeId, releaseDate, studio, movieReleaseDate } =
      await req.json();

    const trailer = await prisma.trailer.update({
      where: { id },
      data: {
        movieTitle,
        youtubeId,
        releaseDate: releaseDate || "",
        studio: studio || "",
        movieReleaseDate: movieReleaseDate || null,
      },
    });

    // Invalidate stats cache for this trailer so fresh stats are fetched
    await prisma.statsCache.deleteMany({ where: { youtubeId: trailer.youtubeId } });

    return NextResponse.json({ success: true, trailer });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Delete related box office + stats cache first
    const trailer = await prisma.trailer.findUnique({ where: { id } });
    if (trailer) {
      await prisma.boxOffice.deleteMany({ where: { trailerId: id } });
      await prisma.statsCache.deleteMany({ where: { youtubeId: trailer.youtubeId } });
    }
    await prisma.trailer.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
