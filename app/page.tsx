"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { VideoStats } from "@/lib/youtube";

interface BoxOffice {
  day1India: number | null;
  day1Worldwide: number | null;
  source: string;
}

interface TrailerWithStats {
  id: string;
  movieTitle: string;
  youtubeId: string;
  releaseDate: string;
  studio: string;
  movieReleaseDate?: string | null;
  boxOffice?: BoxOffice | null;
  stats: VideoStats | null;
}

type SortKey = "views" | "likes" | "comments" | "likesPerView" | "commentsPerView";

const METRIC_LABELS: Record<SortKey, string> = {
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  likesPerView: "Likes / View",
  commentsPerView: "Comments / View",
};

const METRIC_SHORT: Record<SortKey, string> = {
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  likesPerView: "L/V ratio",
  commentsPerView: "C/V ratio",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Warm editorial bar colours
const BAR_COLORS = [
  "#c41e3a", "#9b1c2e", "#d97706", "#92400e",
  "#1e3a8a", "#065f46", "#6b21a8", "#be185d",
  "#0f766e", "#a16207",
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtRatio(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

function fmtStat(key: SortKey, val: number): string {
  return key === "likesPerView" || key === "commentsPerView"
    ? fmtRatio(val)
    : fmt(val);
}

function parseDate(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length < 2) return null;
  return { year: parseInt(parts[0]), month: parseInt(parts[1]) };
}

function formatDisplayDate(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return "—";
  return `${MONTH_SHORT[d.month - 1]} ${d.year}`;
}

function ThumbImage({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className="w-full h-full bg-[#e8ddd0] flex items-center justify-center">
        <span className="text-[#a0917f] text-xs text-center px-2">{title}</span>
      </div>
    );
  }
  return (
    <Image
      src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
      alt={title}
      fill
      className="object-cover"
      onError={() => setErr(true)}
      unoptimized
    />
  );
}

export default function Dashboard() {
  const [trailers, setTrailers] = useState<TrailerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [activeMetric, setActiveMetric] = useState<SortKey>("views");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");

  useEffect(() => {
    fetch("/api/trailers")
      .then((r) => r.json())
      .then((d) => { setTrailers(d.trailers ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load data"); setLoading(false); });
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    trailers.forEach((t) => { const d = parseDate(t.releaseDate); if (d) years.add(d.year); });
    return Array.from(years).sort();
  }, [trailers]);

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    trailers.forEach((t) => {
      const d = parseDate(t.releaseDate);
      if (!d) return;
      if (filterYear !== "all" && d.year !== parseInt(filterYear)) return;
      months.add(d.month);
    });
    return Array.from(months).sort((a, b) => a - b);
  }, [trailers, filterYear]);

  function handleYearChange(year: string) {
    setFilterYear(year);
    setFilterMonth("all");
  }

  const filtered = useMemo(() => {
    return trailers.filter((t) => {
      const d = parseDate(t.releaseDate);
      if (filterYear !== "all" && (!d || d.year !== parseInt(filterYear))) return false;
      if (filterMonth !== "all" && (!d || d.month !== parseInt(filterMonth))) return false;
      return true;
    });
  }, [trailers, filterYear, filterMonth]);

  const sorted = useMemo(() => (
    [...filtered].sort((a, b) => {
      const av = (a.stats?.[sortKey] as number) ?? 0;
      const bv = (b.stats?.[sortKey] as number) ?? 0;
      return bv - av;
    })
  ), [filtered, sortKey]);

  const isFiltered = filterYear !== "all" || filterMonth !== "all";
  const [cover, ...rest] = sorted;
  const isRatio = activeMetric === "likesPerView" || activeMetric === "commentsPerView";
  const chartData = sorted.map((t) => ({
    name: t.movieTitle,
    value: (t.stats?.[activeMetric] as number) ?? 0,
  }));

  // Today's date for masthead
  const today = new Date();
  const issueDate = today.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen font-[family-name:var(--font-inter)] bg-[#faf8f4] text-[#1a1108]">

      {/* ── MASTHEAD ─────────────────────────────────────────── */}
      <header className="border-b-2 border-[#1a1108] px-6 pt-6 pb-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between mb-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8c7b6e] font-medium">
              Est. 2026 · The Malayalam Cinema Intelligence Report
            </p>
            <a href="/admin" className="text-[10px] text-[#c0b0a0] hover:text-[#c41e3a] tracking-wider uppercase transition-colors">
              Admin ↗
            </a>
          </div>

          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight text-[#1a1108] leading-none">
              MOLLYWOOD<br />
              <span className="text-[#c41e3a]">TIMES</span>
            </h1>
            <div className="text-right pb-1">
              <p className="text-xs text-[#8c7b6e] uppercase tracking-widest">Trailer Intelligence</p>
              <p className="text-xs text-[#8c7b6e] mt-0.5">{issueDate}</p>
              <p className="text-xs text-[#8c7b6e] mt-0.5">{trailers.length} trailers tracked</p>
            </div>
          </div>

          <div className="h-px bg-[#1a1108] mt-4" />
          <div className="h-px bg-[#1a1108] mt-0.5" />
        </div>
      </header>

      {loading && (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="w-8 h-8 border-2 border-[#c41e3a] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#8c7b6e] font-[family-name:var(--font-playfair)] italic">
            Fetching from the archives…
          </p>
        </div>
      )}

      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-6">
          <div className="border border-[#c41e3a] bg-[#fff5f5] rounded p-4 text-[#c41e3a] text-sm">{error}</div>
        </div>
      )}

      {!loading && !error && (
        <main className="max-w-7xl mx-auto px-6 py-6 space-y-8">

          {/* ── FILTERS + METRIC BAR ─────────────────────────── */}
          <section className="flex flex-wrap gap-y-3 items-center justify-between border-b border-[#e8ddd0] pb-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {/* Year */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-[#8c7b6e] font-semibold">Year</span>
                <div className="flex gap-1">
                  {["all", ...availableYears.map(String)].map((y) => (
                    <button key={y}
                      onClick={() => handleYearChange(y)}
                      className={`px-2.5 py-0.5 text-xs border transition-colors ${
                        filterYear === y
                          ? "bg-[#1a1108] text-[#faf8f4] border-[#1a1108]"
                          : "border-[#d0c4b8] text-[#8c7b6e] hover:border-[#1a1108] hover:text-[#1a1108]"
                      }`}>
                      {y === "all" ? "All" : y}
                    </button>
                  ))}
                </div>
              </div>

              {/* Month */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-[#8c7b6e] font-semibold">Month</span>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setFilterMonth("all")}
                    className={`px-2.5 py-0.5 text-xs border transition-colors ${
                      filterMonth === "all"
                        ? "bg-[#c41e3a] text-white border-[#c41e3a]"
                        : "border-[#d0c4b8] text-[#8c7b6e] hover:border-[#c41e3a] hover:text-[#c41e3a]"
                    }`}>All</button>
                  {availableMonths.map((m) => (
                    <button key={m} onClick={() => setFilterMonth(String(m))}
                      className={`px-2.5 py-0.5 text-xs border transition-colors ${
                        filterMonth === String(m)
                          ? "bg-[#c41e3a] text-white border-[#c41e3a]"
                          : "border-[#d0c4b8] text-[#8c7b6e] hover:border-[#c41e3a] hover:text-[#c41e3a]"
                      }`}>
                      {MONTH_SHORT[m - 1]}
                    </button>
                  ))}
                  {isFiltered && (
                    <button onClick={() => { setFilterYear("all"); setFilterMonth("all"); }}
                      className="px-2.5 py-0.5 text-xs border border-dashed border-[#d0c4b8] text-[#8c7b6e] hover:text-[#c41e3a] hover:border-[#c41e3a] transition-colors">
                      ✕ Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Metric selector */}
            <div className="flex gap-3 flex-wrap">
              {(Object.keys(METRIC_LABELS) as SortKey[]).map((key) => (
                <button key={key}
                  onClick={() => { setActiveMetric(key); setSortKey(key); }}
                  className={`text-xs uppercase tracking-wider font-semibold pb-0.5 border-b-2 transition-colors ${
                    activeMetric === key
                      ? "border-[#c41e3a] text-[#c41e3a]"
                      : "border-transparent text-[#8c7b6e] hover:text-[#1a1108] hover:border-[#d0c4b8]"
                  }`}>
                  {METRIC_SHORT[key]}
                </button>
              ))}
            </div>
          </section>

          {sorted.length === 0 ? (
            <div className="border border-dashed border-[#d0c4b8] rounded p-16 text-center">
              <p className="text-[#8c7b6e] font-[family-name:var(--font-playfair)] italic">
                No trailers match the selected filters.
              </p>
            </div>
          ) : (
            <>
              {/* ── COVER STORY ────────────────────────────────── */}
              {cover && (
                <section>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#c41e3a]">
                      Cover Story
                    </span>
                    <div className="flex-1 h-px bg-[#e8ddd0]" />
                    <span className="text-[10px] text-[#8c7b6e] uppercase tracking-widest">
                      #{1} by {METRIC_SHORT[activeMetric]}
                    </span>
                  </div>

                  <div className="border border-[#e8ddd0] bg-white grid md:grid-cols-2 overflow-hidden group">
                    {/* Thumbnail */}
                    <div className="relative aspect-video md:aspect-auto">
                      <ThumbImage youtubeId={cover.youtubeId} title={cover.movieTitle} />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10 md:to-white/60 hidden md:block" />
                      <a
                        href={`https://www.youtube.com/watch?v=${cover.youtubeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-3 left-3 bg-[#c41e3a] text-white text-[10px] uppercase tracking-widest px-3 py-1.5 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ▶ Watch Trailer
                      </a>
                    </div>

                    {/* Content */}
                    <div className="p-6 md:p-8 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="bg-[#c41e3a] text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5">
                            #1 Most {METRIC_SHORT[activeMetric]}
                          </span>
                          {cover.releaseDate && (
                            <span className="text-[10px] text-[#8c7b6e] uppercase tracking-wider">
                              {formatDisplayDate(cover.releaseDate)}
                            </span>
                          )}
                        </div>

                        <h2 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl font-bold leading-tight text-[#1a1108] mb-4">
                          {cover.movieTitle}
                        </h2>

                        {cover.studio && (
                          <p className="text-xs text-[#8c7b6e] uppercase tracking-wider mb-4">{cover.studio}</p>
                        )}

                        {/* Big stat */}
                        <div className="border-l-4 border-[#c41e3a] pl-4 mb-5">
                          <p className="font-[family-name:var(--font-playfair)] text-4xl font-black text-[#c41e3a]">
                            {cover.stats ? fmtStat(activeMetric, cover.stats[activeMetric] as number) : "—"}
                          </p>
                          <p className="text-xs text-[#8c7b6e] uppercase tracking-widest mt-0.5">{METRIC_LABELS[activeMetric]}</p>
                        </div>
                      </div>

                      {/* Stat pills grid */}
                      {cover.stats && (
                        <div className="grid grid-cols-2 gap-2">
                          {(Object.keys(METRIC_LABELS) as SortKey[]).map((k) => (
                            <div key={k} className={`border px-3 py-2 ${k === activeMetric ? "border-[#c41e3a] bg-[#fff5f5]" : "border-[#e8ddd0]"}`}>
                              <p className="text-[10px] uppercase tracking-wider text-[#8c7b6e]">{METRIC_SHORT[k]}</p>
                              <p className="font-semibold text-sm text-[#1a1108] mt-0.5 tabular-nums">
                                {fmtStat(k, cover.stats![k] as number)}
                              </p>
                            </div>
                          ))}
                          {cover.boxOffice?.day1India != null && (
                            <div className="border border-[#e8ddd0] px-3 py-2 col-span-2">
                              <p className="text-[10px] uppercase tracking-wider text-[#8c7b6e]">Day 1 Box Office</p>
                              <p className="font-semibold text-sm text-[#065f46] mt-0.5">
                                ₹{cover.boxOffice.day1India}Cr India
                                {cover.boxOffice.day1Worldwide != null && ` · ₹${cover.boxOffice.day1Worldwide}Cr WW`}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* ── STORY GRID ─────────────────────────────────── */}
              {rest.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#1a1108]">
                      In This Issue
                    </span>
                    <div className="flex-1 h-px bg-[#e8ddd0]" />
                    <span className="text-[10px] text-[#8c7b6e] uppercase tracking-widest">
                      {rest.length} trailers
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rest.map((t, i) => (
                      <article key={t.id} className="bg-white border border-[#e8ddd0] group hover:border-[#c41e3a] transition-colors overflow-hidden">
                        {/* Thumb */}
                        <div className="relative aspect-video overflow-hidden">
                          <ThumbImage youtubeId={t.youtubeId} title={t.movieTitle} />
                          <div className="absolute top-2 left-2 bg-[#1a1108] text-[#faf8f4] text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                            #{i + 2}
                          </div>
                          <a
                            href={`https://www.youtube.com/watch?v=${t.youtubeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <span className="bg-[#c41e3a] text-white text-[10px] uppercase tracking-widest px-3 py-1.5 font-bold">
                              ▶ Watch
                            </span>
                          </a>
                        </div>

                        {/* Content */}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-[family-name:var(--font-playfair)] font-bold text-[#1a1108] leading-tight line-clamp-2">
                              {t.movieTitle}
                            </h3>
                          </div>

                          {t.releaseDate && (
                            <p className="text-[10px] text-[#8c7b6e] uppercase tracking-wider mb-3">
                              {formatDisplayDate(t.releaseDate)}
                              {t.movieReleaseDate && ` · Release: ${formatDisplayDate(t.movieReleaseDate)}`}
                            </p>
                          )}

                          {/* Key metric highlight */}
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="font-[family-name:var(--font-playfair)] text-2xl font-black text-[#c41e3a] tabular-nums">
                              {t.stats ? fmtStat(activeMetric, t.stats[activeMetric] as number) : "—"}
                            </span>
                            <span className="text-[10px] text-[#8c7b6e] uppercase tracking-wider">{METRIC_SHORT[activeMetric]}</span>
                          </div>

                          {/* Secondary stats row */}
                          {t.stats && (
                            <div className="grid grid-cols-3 gap-1 border-t border-[#e8ddd0] pt-3">
                              <div>
                                <p className="text-[9px] text-[#8c7b6e] uppercase tracking-wider">Views</p>
                                <p className="text-xs font-semibold tabular-nums">{fmt(t.stats.views)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-[#8c7b6e] uppercase tracking-wider">Likes</p>
                                <p className="text-xs font-semibold tabular-nums">{fmt(t.stats.likes)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-[#8c7b6e] uppercase tracking-wider">L/V</p>
                                <p className="text-xs font-semibold tabular-nums">{fmtRatio(t.stats.likesPerView)}</p>
                              </div>
                            </div>
                          )}

                          {t.boxOffice?.day1India != null && (
                            <div className="mt-2 bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-1.5">
                              <p className="text-[10px] text-[#065f46] font-semibold">
                                Day 1: ₹{t.boxOffice.day1India}Cr
                                {t.boxOffice.day1Worldwide != null && ` · ₹${t.boxOffice.day1Worldwide}Cr WW`}
                              </p>
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* ── BY THE NUMBERS ─────────────────────────────── */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#1a1108]">
                    By The Numbers
                  </span>
                  <div className="flex-1 h-px bg-[#e8ddd0]" />
                  <span className="text-[10px] text-[#8c7b6e] uppercase tracking-widest">
                    {METRIC_LABELS[activeMetric]}
                  </span>
                </div>

                <div className="bg-white border border-[#e8ddd0] p-6">
                  <p className="font-[family-name:var(--font-playfair)] text-xl font-bold text-[#1a1108] mb-1">
                    {METRIC_LABELS[activeMetric]} Comparison
                  </p>
                  {isFiltered && (
                    <p className="text-xs text-[#8c7b6e] mb-4">
                      Filtered: {filterYear !== "all" ? filterYear : "All years"}
                      {filterMonth !== "all" ? ` · ${MONTH_NAMES[parseInt(filterMonth) - 1]}` : ""}
                    </p>
                  )}
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 64 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#e8ddd0" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#8c7b6e", fontSize: 11, fontFamily: "var(--font-inter)" }}
                        angle={-40}
                        textAnchor="end"
                        interval={0}
                        axisLine={{ stroke: "#d0c4b8" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#8c7b6e", fontSize: 11 }}
                        tickFormatter={(v: number) => isRatio ? fmtRatio(v) : fmt(v)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v) => [isRatio ? fmtRatio(Number(v)) : fmt(Number(v)), METRIC_LABELS[activeMetric]]}
                        contentStyle={{
                          background: "#fff",
                          border: "1px solid #e8ddd0",
                          borderRadius: 0,
                          fontFamily: "var(--font-inter)",
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#1a1108", fontWeight: 700, fontFamily: "var(--font-playfair)" }}
                        cursor={{ fill: "#faf8f4" }}
                      />
                      <Bar dataKey="value" radius={0} maxBarSize={52}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "#c41e3a" : BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* ── FULL RANKINGS TABLE ─────────────────────────── */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#1a1108]">
                    Full Rankings
                  </span>
                  <div className="flex-1 h-px bg-[#e8ddd0]" />
                  <span className="text-[10px] text-[#8c7b6e] uppercase tracking-widest">
                    Click column header to sort
                  </span>
                </div>

                <div className="bg-white border border-[#e8ddd0] overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-[#1a1108] text-[10px] uppercase tracking-widest text-[#8c7b6e]">
                        <th className="text-left px-4 py-3 font-semibold w-6">#</th>
                        <th className="text-left px-4 py-3 font-semibold">Movie</th>
                        <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Trailer</th>
                        <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Release</th>
                        <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Day 1 BO</th>
                        {(Object.keys(METRIC_LABELS) as SortKey[]).map((key) => (
                          <th key={key}
                            onClick={() => setSortKey(key)}
                            className={`px-4 py-3 text-right font-semibold cursor-pointer select-none transition-colors ${
                              sortKey === key
                                ? "text-[#c41e3a]"
                                : "hover:text-[#1a1108]"
                            }`}>
                            {METRIC_SHORT[key]} {sortKey === key ? "↓" : ""}
                          </th>
                        ))}
                        <th className="px-4 py-3 font-semibold text-right hidden sm:table-cell">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((t, i) => {
                        const s = t.stats;
                        const isTop3 = i < 3;
                        return (
                          <tr key={t.id}
                            className={`border-b border-[#e8ddd0] transition-colors hover:bg-[#faf8f4] ${
                              i === 0 ? "bg-[#fff5f5]" : ""
                            }`}>
                            <td className="px-4 py-3 font-[family-name:var(--font-playfair)]">
                              <span className={`font-black text-base ${
                                i === 0 ? "text-[#c41e3a]" :
                                i === 1 ? "text-[#8c7b6e]" :
                                i === 2 ? "text-[#92400e]" :
                                "text-[#d0c4b8]"
                              }`}>
                                {i === 0 ? "①" : i === 1 ? "②" : i === 2 ? "③" : i + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-[family-name:var(--font-playfair)] font-bold text-[#1a1108] ${isTop3 ? "text-base" : ""}`}>
                                {t.movieTitle}
                              </span>
                              {t.studio && <span className="block text-[10px] text-[#8c7b6e] uppercase tracking-wider">{t.studio}</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-[#8c7b6e] hidden md:table-cell">
                              {t.releaseDate ? formatDisplayDate(t.releaseDate) : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-[#8c7b6e] hidden md:table-cell">
                              {t.movieReleaseDate ? formatDisplayDate(t.movieReleaseDate) : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs hidden lg:table-cell">
                              {t.boxOffice?.day1India != null ? (
                                <span className="text-[#065f46] font-semibold">
                                  ₹{t.boxOffice.day1India}Cr
                                  {t.boxOffice.day1Worldwide != null && <span className="text-[#8c7b6e] font-normal"> / ₹{t.boxOffice.day1Worldwide}Cr WW</span>}
                                </span>
                              ) : "—"}
                            </td>
                            <td className={`px-4 py-3 text-right tabular-nums font-semibold ${sortKey === "views" ? "text-[#c41e3a]" : "text-[#1a1108]"}`}>
                              {s ? fmt(s.views) : "—"}
                            </td>
                            <td className={`px-4 py-3 text-right tabular-nums font-semibold ${sortKey === "likes" ? "text-[#c41e3a]" : "text-[#1a1108]"}`}>
                              {s ? fmt(s.likes) : "—"}
                            </td>
                            <td className={`px-4 py-3 text-right tabular-nums font-semibold ${sortKey === "comments" ? "text-[#c41e3a]" : "text-[#1a1108]"}`}>
                              {s ? fmt(s.comments) : "—"}
                            </td>
                            <td className={`px-4 py-3 text-right tabular-nums text-xs ${sortKey === "likesPerView" ? "text-[#c41e3a] font-semibold" : "text-[#8c7b6e]"}`}>
                              {s ? fmtRatio(s.likesPerView) : "—"}
                            </td>
                            <td className={`px-4 py-3 text-right tabular-nums text-xs ${sortKey === "commentsPerView" ? "text-[#c41e3a] font-semibold" : "text-[#8c7b6e]"}`}>
                              {s ? fmtRatio(s.commentsPerView) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right hidden sm:table-cell">
                              <a href={`https://www.youtube.com/watch?v=${t.youtubeId}`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-[10px] uppercase tracking-wider text-[#c41e3a] hover:underline font-semibold">
                                Watch ↗
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ── FOOTER ─────────────────────────────────────────── */}
          <footer className="border-t-2 border-[#1a1108] pt-4 pb-8">
            <div className="flex items-center justify-between">
              <p className="font-[family-name:var(--font-playfair)] text-sm font-bold text-[#1a1108]">
                MOLLYWOOD TIMES
              </p>
              <p className="text-[10px] text-[#8c7b6e] uppercase tracking-widest">
                Stats refresh weekly · Powered by YouTube Data API
              </p>
            </div>
          </footer>
        </main>
      )}
    </div>
  );
}
