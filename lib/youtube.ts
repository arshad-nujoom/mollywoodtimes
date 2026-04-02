import { google } from "googleapis";

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

export interface VideoStats {
  youtubeId: string;
  views: number;
  likes: number;
  comments: number;
  likesPerView: number;
  commentsPerView: number;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export async function fetchVideoStats(
  videoIds: string[]
): Promise<Record<string, VideoStats>> {
  if (!process.env.YOUTUBE_API_KEY) {
    // Return mock data in dev when no API key is set
    return Object.fromEntries(
      videoIds.map((id, i) => [
        id,
        generateMockStats(id, i),
      ])
    );
  }

  const res = await youtube.videos.list({
    part: ["statistics", "snippet"],
    id: videoIds,
    maxResults: 50,
  });

  const result: Record<string, VideoStats> = {};

  for (const item of res.data.items ?? []) {
    const id = item.id!;
    const stats = item.statistics!;
    const snippet = item.snippet!;

    const views = Number(stats.viewCount ?? 0);
    const likes = Number(stats.likeCount ?? 0);
    const comments = Number(stats.commentCount ?? 0);

    result[id] = {
      youtubeId: id,
      views,
      likes,
      comments,
      likesPerView: views > 0 ? likes / views : 0,
      commentsPerView: views > 0 ? comments / views : 0,
      title: snippet.title ?? "",
      publishedAt: snippet.publishedAt ?? "",
      thumbnailUrl:
        snippet.thumbnails?.medium?.url ??
        snippet.thumbnails?.default?.url ??
        "",
    };
  }

  return result;
}

function generateMockStats(id: string, index: number): VideoStats {
  const seed = id.charCodeAt(0) + index;
  const views = 500000 + seed * 137000;
  const likes = Math.floor(views * (0.04 + (seed % 5) * 0.01));
  const comments = Math.floor(views * (0.005 + (seed % 3) * 0.002));

  return {
    youtubeId: id,
    views,
    likes,
    comments,
    likesPerView: likes / views,
    commentsPerView: comments / views,
    title: `Mock Title ${index + 1}`,
    publishedAt: "2026-01-01T00:00:00Z",
    thumbnailUrl: "",
  };
}
