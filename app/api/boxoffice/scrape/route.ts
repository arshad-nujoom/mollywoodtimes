import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { fetchBoxOffice } from "@/lib/scraper";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { trailerId, movieTitle } = await req.json();
    if (!trailerId || !movieTitle) {
      return NextResponse.json({ error: "trailerId and movieTitle required" }, { status: 400 });
    }

    const result = await fetchBoxOffice(movieTitle);
    if (!result) {
      return NextResponse.json(
        { error: "No box office data found. Try again after release or enter manually." },
        { status: 404 }
      );
    }

    const boxOffice = await prisma.boxOffice.upsert({
      where: { trailerId },
      create: {
        trailerId,
        day1India: result.day1India,
        day1Worldwide: result.day1Worldwide,
        source: result.source,
        sourceUrl: result.sourceUrl,
        rawText: result.rawText,
      },
      update: {
        day1India: result.day1India,
        day1Worldwide: result.day1Worldwide,
        source: result.source,
        sourceUrl: result.sourceUrl,
        rawText: result.rawText,
      },
    });

    return NextResponse.json({
      success: true,
      day1India: boxOffice.day1India,
      day1Worldwide: boxOffice.day1Worldwide,
      source: boxOffice.source,
    });
  } catch (err) {
    console.error("Box office scrape error:", err);
    return NextResponse.json({ error: "Scrape failed" }, { status: 500 });
  }
}
