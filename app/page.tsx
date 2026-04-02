"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Trailer } from "@/lib/trailers";
import { VideoStats } from "@/lib/youtube";

interface TrailerWithStats extends Trailer {
  stats: VideoStats | null;
}

type SortKey = "views" | "likes" | "comments" | "likesPerView" | "commentsPerView";

const METRIC_LABELS: Record<SortKey, string> = {
  views: "Views", likes: "Likes", comments: "Comments",
  likesPerView: "Likes / View", commentsPerView: "Comments / View",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtRatio(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

const COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#3b82f6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

function extractYoutubeId(input: string): string {
  try {
    const url = new URL(input);
    return url.searchParams.get("v") || input;
  } catch {
    return input;
  }
}

function parseDate(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length < 2) return null;
  return { year: parseInt(parts[0]), month: parseInt(parts[1]) };
}

export default function Dashboard() {
  const [trailers, setTrailers] = useState<TrailerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [activeMetric, setActiveMetric] = useState<SortKey>("views");

  // Filters
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ movieTitle: "", youtubeUrl: "", releaseDate: "", studio: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function loadTrailers() {
    setLoading(true);
    fetch("/api/trailers")
      .then((r) => r.json())
      .then((d) => { setTrailers(d.trailers ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load data"); setLoading(false); });
  }

  useEffect(() => { loadTrailers(); }, []);

  async function handleAddTrailer() {
    setSubmitting(true);
    setSubmitError(null);
    const youtubeId = extractYoutubeId(form.youtubeUrl.trim());
    const res = await fetch("/api/trailers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, youtubeId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSubmitError(data.error || "Something went wrong");
      setSubmitting(false);
      return;
    }
    setShowModal(false);
    setForm({ movieTitle: "", youtubeUrl: "", releaseDate: "", studio: "" });
    setSubmitting(false);
    loadTrailers();
  }

  // Derive available years and months from the data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    trailers.forEach((t) => {
      const d = parseDate(t.releaseDate);
      if (d) years.add(d.year);
    });
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

  // Reset month when year changes
  function handleYearChange(year: string) {
    setFilterYear(year);
    setFilterMonth("all");
  }

  // Filtered + sorted trailers
  const filtered = useMemo(() => {
    return trailers.filter((t) => {
      const d = parseDate(t.releaseDate);
      if (filterYear !== "all") {
        if (!d || d.year !== parseInt(filterYear)) return false;
      }
      if (filterMonth !== "all") {
        if (!d || d.month !== parseInt(filterMonth)) return false;
      }
      return true;
    });
  }, [trailers, filterYear, filterMonth]);

  const sorted = [...filtered].sort((a, b) => {
    const av = (a.stats?.[sortKey] as number) ?? 0;
    const bv = (b.stats?.[sortKey] as number) ?? 0;
    return bv - av;
  });

  const chartData = sorted.map((t) => ({ name: t.movieTitle, value: t.stats?.[activeMetric] ?? 0 }));
  const isRatio = activeMetric === "likesPerView" || activeMetric === "commentsPerView";

  const isFiltered = filterYear !== "all" || filterMonth !== "all";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Malayalam Trailer Dashboard</h1>
          <p className="text-gray-400 mt-1">2026 trailers — YouTube engagement comparison</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-lg"
        >
          <span className="text-lg leading-none">+</span> Add Trailer
        </button>
      </header>

      {/* Add Trailer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Add New Trailer</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Movie Title *</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Marco"
                  value={form.movieTitle}
                  onChange={(e) => setForm({ ...form, movieTitle: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">YouTube URL or Video ID *</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="https://youtube.com/watch?v=... or video ID"
                  value={form.youtubeUrl}
                  onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Release Date</label>
                <input
                  type="date"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  value={form.releaseDate}
                  onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Studio</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Aashirvad Cinemas"
                  value={form.studio}
                  onChange={(e) => setForm({ ...form, studio: e.target.value })}
                />
              </div>
              {submitError && <p className="text-red-400 text-xs">{submitError}</p>}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setShowModal(false); setSubmitError(null); }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTrailer}
                  disabled={submitting || !form.movieTitle || !form.youtubeUrl}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? "Adding..." : "Add Trailer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 animate-pulse">Loading stats...</div>
        </div>
      )}
      {error && (
        <div className="bg-red-900/40 border border-red-600 rounded-lg p-4 text-red-300">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Date Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-gray-900 border border-gray-800 rounded-2xl">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filter by</span>

            {/* Year */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Year</label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleYearChange("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filterYear === "all"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  All
                </button>
                {availableYears.map((y) => (
                  <button
                    key={y}
                    onClick={() => handleYearChange(String(y))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filterYear === String(y)
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-gray-700">|</span>

            {/* Month */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Month</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterMonth("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filterMonth === "all"
                      ? "bg-violet-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  All
                </button>
                {availableMonths.map((m) => (
                  <button
                    key={m}
                    onClick={() => setFilterMonth(String(m))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filterMonth === String(m)
                        ? "bg-violet-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {MONTH_NAMES[m - 1]}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear filter */}
            {isFiltered && (
              <button
                onClick={() => { setFilterYear("all"); setFilterMonth("all"); }}
                className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* Result count */}
          {isFiltered && (
            <p className="text-xs text-gray-500 mb-4">
              Showing {sorted.length} of {trailers.length} trailers
              {filterYear !== "all" ? ` · ${filterYear}` : ""}
              {filterMonth !== "all" ? ` · ${MONTH_NAMES[parseInt(filterMonth) - 1]}` : ""}
            </p>
          )}

          {/* Metric tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {(Object.keys(METRIC_LABELS) as SortKey[]).map((key) => (
              <button key={key} onClick={() => { setActiveMetric(key); setSortKey(key); }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeMetric === key ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}>
                {METRIC_LABELS[key]}
              </button>
            ))}
          </div>

          {/* Bar chart */}
          {sorted.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl p-12 mb-8 border border-gray-800 flex items-center justify-center">
              <p className="text-gray-500 text-sm">No trailers match the selected filters.</p>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-2xl p-6 mb-8 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4 text-gray-200">
                {METRIC_LABELS[activeMetric]} Comparison
                {isFiltered && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({filterYear !== "all" ? filterYear : "All years"}
                    {filterMonth !== "all" ? `, ${MONTH_NAMES[parseInt(filterMonth) - 1]}` : ""})
                  </span>
                )}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 0, right: 20, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={(v: number) => isRatio ? fmtRatio(v) : fmt(v)} />
                  <Tooltip
                    formatter={(v) => [isRatio ? fmtRatio(Number(v)) : fmt(Number(v)), METRIC_LABELS[activeMetric]]}
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    labelStyle={{ color: "#f3f4f6" }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Movie</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Released</th>
                  {(Object.keys(METRIC_LABELS) as SortKey[]).map((key) => (
                    <th key={key} onClick={() => setSortKey(key)}
                      className={`px-4 py-3 text-right font-medium cursor-pointer select-none transition-colors ${
                        sortKey === key ? "text-indigo-400" : "text-gray-400 hover:text-gray-200"
                      }`}>
                      {METRIC_LABELS[key]} {sortKey === key ? "↓" : ""}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Link</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500 text-sm">
                      No trailers match the selected filters.
                    </td>
                  </tr>
                ) : (
                  sorted.map((t, i) => {
                    const s = t.stats;
                    return (
                      <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                            {t.movieTitle}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{t.releaseDate}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{s ? fmt(s.views) : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{s ? fmt(s.likes) : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{s ? fmt(s.comments) : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{s ? fmtRatio(s.likesPerView) : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{s ? fmtRatio(s.commentsPerView) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <a href={`https://www.youtube.com/watch?v=${t.youtubeId}`} target="_blank" rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 transition-colors">Watch</a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
