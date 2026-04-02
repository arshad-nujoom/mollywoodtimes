import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchVideoStats, VideoStats } from "@/lib/youtube";

// How old a cached stat can be before it's considered stale (7 days)
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const trailers = await prisma.trailer.findMany({
      orderBy: { createdAt: "asc" },
    });

    const videoIds = trailers.map((t) => t.youtubeId);

    // Load all cached stats that are still fresh
    const freshThreshold = new Date(Date.now() - CACHE_MAX_AGE_MS);
    const cachedRows = await prisma.statsCache.findMany({
      where: {
        youtubeId: { in: videoIds },
        refreshedAt: { gte: freshThreshold },
      },
    });

    const cachedMap = new Map(cachedRows.map((r) => [r.youtubeId, r]));

    // Fetch live stats for any IDs missing from cache
    const missingIds = videoIds.filter((id) => !cachedMap.has(id));
    if (missingIds.length > 0) {
      const freshStats = await fetchVideoStats(missingIds);
      const now = new Date();

      await Promise.all(
        Object.entries(freshStats).map(([youtubeId, s]) =>
          prisma.statsCache.upsert({
            where: { youtubeId },
            create: {
              youtubeId,
              views: s.views,
              likes: s.likes,
              comments: s.comments,
              likesPerView: s.likesPerView,
              commentsPerView: s.commentsPerView,
              title: s.title,
              publishedAt: s.publishedAt,
              thumbnailUrl: s.thumbnailUrl,
              refreshedAt: now,
            },
            update: {
              views: s.views,
              likes: s.likes,
              comments: s.comments,
              likesPerView: s.likesPerView,
              commentsPerView: s.commentsPerView,
              title: s.title,
              publishedAt: s.publishedAt,
              thumbnailUrl: s.thumbnailUrl,
              refreshedAt: now,
            },
          })
        )
      );

      // Merge newly fetched into the map
      for (const [id, s] of Object.entries(freshStats)) {
        cachedMap.set(id, {
          youtubeId: id,
          views: s.views,
          likes: s.likes,
          comments: s.comments,
          likesPerView: s.likesPerView,
          commentsPerView: s.commentsPerView,
          title: s.title,
          publishedAt: s.publishedAt,
          thumbnailUrl: s.thumbnailUrl,
          refreshedAt: new Date(),
        });
      }
    }

    const data = trailers.map((trailer) => {
      const s = cachedMap.get(trailer.youtubeId) ?? null;
      return {
        ...trailer,
        stats: s
          ? ({
              youtubeId: s.youtubeId,
              views: s.views,
              likes: s.likes,
              comments: s.comments,
              likesPerView: s.likesPerView,
              commentsPerView: s.commentsPerView,
              title: s.title,
              publishedAt: s.publishedAt,
              thumbnailUrl: s.thumbnailUrl,
            } satisfies VideoStats)
          : null,
      };
    });

    return NextResponse.json({ trailers: data });
  } catch (err) {
    console.error("Error fetching trailers:", err);
    return NextResponse.json(
      { error: "Failed to fetch trailer stats" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { movieTitle, youtubeId, releaseDate, studio } = await req.json();
    if (!movieTitle || !youtubeId) {
      return NextResponse.json(
        { error: "movieTitle and youtubeId are required" },
        { status: 400 }
      );
    }

    // Prevent duplicates
    const existing = await prisma.trailer.findUnique({ where: { youtubeId } });
    if (existing) {
      return NextResponse.json(
        { error: "This trailer is already in the dashboard" },
        { status: 409 }
      );
    }

    const trailer = await prisma.trailer.create({
      data: {
        id: Date.now().toString(),
        movieTitle,
        youtubeId,
        releaseDate: releaseDate || "",
        studio: studio || "",
      },
    });

    return NextResponse.json({ success: true, trailer });
  } catch (err) {
    console.error("Error adding trailer:", err);
    return NextResponse.json(
      { error: "Failed to add trailer" },
      { status: 500 }
    );
  }
}
