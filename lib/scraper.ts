import * as cheerio from "cheerio";

export interface BoxOfficeResult {
  day1India: number | null;
  day1Worldwide: number | null;
  source: string;
  sourceUrl: string;
  rawText: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract a crore figure from a string like "₹12.50 Cr" or "12.5 crore" */
function parseCrore(text: string): number | null {
  const match = text.match(/[\d,]+(?:\.\d+)?/);
  if (!match) return null;
  const val = parseFloat(match[0].replace(/,/g, ""));
  return isNaN(val) ? null : val;
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─── Sacnilk ────────────────────────────────────────────────────────────────

export async function scrapeSacnilk(
  movieTitle: string
): Promise<BoxOfficeResult | null> {
  const searchUrl = `https://sacnilk.com/?s=${encodeURIComponent(movieTitle + " box office collection")}`;

  try {
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MollywoodTimesBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    const searchHtml = await searchRes.text();
    const $s = cheerio.load(searchHtml);

    // Find first article link that matches movie title
    let articleUrl: string | null = null;
    $s("article a, h2 a, h3 a").each((_, el) => {
      const href = $s(el).attr("href") ?? "";
      const text = $s(el).text().toLowerCase();
      if (
        text.includes(movieTitle.toLowerCase().split(" ")[0]) &&
        href.includes("sacnilk.com") &&
        !articleUrl
      ) {
        articleUrl = href;
      }
    });

    // Also try direct URL patterns
    if (!articleUrl) {
      const directUrl = `https://sacnilk.com/${slug(movieTitle)}-box-office-collection/`;
      articleUrl = directUrl;
    }

    const pageRes = await fetch(articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MollywoodTimesBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!pageRes.ok) return null;

    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);
    const bodyText = $("article, .entry-content, .post-content").text();

    // Look for Day 1 figures
    let day1India: number | null = null;
    let day1Worldwide: number | null = null;

    // Common patterns: "Day 1: ₹12.50 Cr" / "First Day: 12.50 Crore"
    const indiaPatterns = [
      /day\s*1[^₹\d]*(?:india[^₹\d]*)?[₹\s]*([\d,.]+)\s*cr/i,
      /first\s*day[^₹\d]*(?:india[^₹\d]*)?[₹\s]*([\d,.]+)\s*cr/i,
      /opening\s*day[^₹\d]*(?:india[^₹\d]*)?[₹\s]*([\d,.]+)\s*cr/i,
    ];
    const wwPatterns = [
      /day\s*1[^₹\d]*worldwide[^₹\d]*[₹\s]*([\d,.]+)\s*cr/i,
      /worldwide[^₹\d]*day\s*1[^₹\d]*[₹\s]*([\d,.]+)\s*cr/i,
      /first\s*day[^₹\d]*worldwide[^₹\d]*[₹\s]*([\d,.]+)\s*cr/i,
    ];

    for (const pattern of indiaPatterns) {
      const m = bodyText.match(pattern);
      if (m) { day1India = parseCrore(m[1]); break; }
    }
    for (const pattern of wwPatterns) {
      const m = bodyText.match(pattern);
      if (m) { day1Worldwide = parseCrore(m[1]); break; }
    }

    if (day1India === null && day1Worldwide === null) return null;

    return {
      day1India,
      day1Worldwide,
      source: "sacnilk",
      sourceUrl: articleUrl,
      rawText: bodyText.slice(0, 2000),
    };
  } catch {
    return null;
  }
}

// ─── Twitter/Nitter ─────────────────────────────────────────────────────────

const NITTER_INSTANCES = [
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
  "https://nitter.cz",
];

const BO_ACCOUNTS = ["Forumkeralam2", "VRFridayMatinee", "AbGeorge_"];

export async function scrapeTwitterBoxOffice(
  movieTitle: string
): Promise<BoxOfficeResult | null> {
  const firstWord = movieTitle.split(" ")[0].toLowerCase();

  for (const instance of NITTER_INSTANCES) {
    for (const account of BO_ACCOUNTS) {
      try {
        const url = `${instance}/${account}/search?q=${encodeURIComponent(movieTitle + " collection")}`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; MollywoodTimesBot/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;

        const html = await res.text();
        const $ = cheerio.load(html);

        let day1India: number | null = null;
        let day1Worldwide: number | null = null;
        let rawText = "";

        $(".tweet-content, .timeline-item .tweet-text").each((_, el) => {
          const text = $(el).text();
          if (!text.toLowerCase().includes(firstWord)) return;

          rawText += text + "\n";

          // Try to find day 1 figures in tweet text
          const indiaMatch = text.match(/(?:day\s*1|first\s*day)[^₹\d]*([\d,.]+)\s*cr/i);
          const wwMatch = text.match(/(?:worldwide|ww)[^₹\d]*([\d,.]+)\s*cr/i);

          if (indiaMatch && day1India === null) day1India = parseCrore(indiaMatch[1]);
          if (wwMatch && day1Worldwide === null) day1Worldwide = parseCrore(wwMatch[1]);
        });

        if (day1India !== null || day1Worldwide !== null) {
          return {
            day1India,
            day1Worldwide,
            source: `twitter/@${account}`,
            sourceUrl: `https://twitter.com/${account}`,
            rawText: rawText.slice(0, 2000),
          };
        }
      } catch {
        // Try next instance/account
        continue;
      }
    }
  }

  return null;
}

// ─── Combined scraper ────────────────────────────────────────────────────────

export async function fetchBoxOffice(
  movieTitle: string
): Promise<BoxOfficeResult | null> {
  // Try Sacnilk first (most structured)
  const sacnilk = await scrapeSacnilk(movieTitle);
  if (sacnilk) return sacnilk;

  // Fall back to Twitter/nitter
  const twitter = await scrapeTwitterBoxOffice(movieTitle);
  if (twitter) return twitter;

  return null;
}
