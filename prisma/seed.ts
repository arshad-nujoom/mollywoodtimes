/**
 * Seeds the Turso database with trailers from data/trailers.json.
 * Run with: npx tsx prisma/seed.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/db";

const dataFile = path.join(process.cwd(), "data/trailers.json");

async function main() {
  const trailers: {
    id: string;
    movieTitle: string;
    youtubeId: string;
    releaseDate: string;
    studio: string;
  }[] = JSON.parse(fs.readFileSync(dataFile, "utf-8"));

  console.log(`Seeding ${trailers.length} trailers...`);

  for (const t of trailers) {
    await prisma.trailer.upsert({
      where: { youtubeId: t.youtubeId },
      create: {
        id: t.id,
        movieTitle: t.movieTitle,
        youtubeId: t.youtubeId,
        releaseDate: t.releaseDate ?? "",
        studio: t.studio ?? "",
      },
      update: {
        movieTitle: t.movieTitle,
        releaseDate: t.releaseDate ?? "",
        studio: t.studio ?? "",
      },
    });
    console.log(`  ✓ ${t.movieTitle}`);
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
