/**
 * Cron job: refresh YouTube stats every Tuesday at 3 AM IST (21:30 UTC Monday).
 * Vercel passes Authorization: Bearer <CRON_SECRET> automatically.
 * Fetches all trailers from DB, hits YouTube API, upserts stats into StatsCache.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchVideoStats } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const trailers = await prisma.trailer.findMany();
    const videoIds = trailers.map((t) => t.youtubeId);

    const stats = await fetchVideoStats(videoIds);
    const now = new Date();

    await Promise.all(
      Object.entries(stats).map(([youtubeId, s]) =>
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

    return NextResponse.json({
      success: true,
      refreshedAt: now.toISOString(),
      count: videoIds.length,
    });
  } catch (err) {
    console.error("Cron refresh failed:", err);
    return NextResponse.json(
      { error: "Refresh failed", detail: String(err) },
      { status: 500 }
    );
  }
}
