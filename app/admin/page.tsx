"use client";

import { useEffect, useState, useCallback } from "react";

interface BoxOffice {
  day1India: number | null;
  day1Worldwide: number | null;
  source: string;
  collectedAt: string;
}

interface Trailer {
  id: string;
  movieTitle: string;
  youtubeId: string;
  releaseDate: string;
  studio: string;
  movieReleaseDate: string | null;
  boxOffice: BoxOffice | null;
}

const EMPTY_FORM = {
  movieTitle: "",
  youtubeId: "",
  releaseDate: "",
  studio: "",
  movieReleaseDate: "",
};

function extractYoutubeId(input: string): string {
  try {
    const url = new URL(input);
    return url.searchParams.get("v") || input;
  } catch {
    return input;
  }
}

export default function AdminPage() {
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM, youtubeUrl: "" });
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [scrapeResult, setScrapeResult] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/trailers")
      .then((r) => r.json())
      .then((d) => { setTrailers(d.trailers ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(t: Trailer) {
    setEditingId(t.id);
    setEditForm({
      movieTitle: t.movieTitle,
      youtubeId: t.youtubeId,
      releaseDate: t.releaseDate,
      studio: t.studio,
      movieReleaseDate: t.movieReleaseDate ?? "",
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const res = await fetch(`/api/trailers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) { setEditingId(null); load(); }
    else setError("Save failed");
    setSaving(false);
  }

  async function deleteTrailer(id: string) {
    if (!confirm("Delete this trailer?")) return;
    const res = await fetch(`/api/trailers/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else setError("Delete failed");
  }

  async function addTrailer() {
    setSaving(true);
    const youtubeId = extractYoutubeId(addForm.youtubeUrl.trim());
    const res = await fetch("/api/trailers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addForm, youtubeId }),
    });
    if (res.ok) { setShowAddModal(false); setAddForm({ ...EMPTY_FORM, youtubeUrl: "" }); load(); }
    else { const d = await res.json(); setError(d.error || "Add failed"); }
    setSaving(false);
  }

  async function scrapeBoxOffice(trailer: Trailer) {
    setScrapingId(trailer.id);
    setScrapeResult((p) => ({ ...p, [trailer.id]: "Scraping…" }));
    const res = await fetch("/api/boxoffice/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trailerId: trailer.id, movieTitle: trailer.movieTitle }),
    });
    const data = await res.json();
    if (res.ok) {
      setScrapeResult((p) => ({ ...p, [trailer.id]: `✅ Day 1 India: ₹${data.day1India}Cr | Worldwide: ₹${data.day1Worldwide}Cr (${data.source})` }));
      load();
    } else {
      setScrapeResult((p) => ({ ...p, [trailer.id]: `❌ ${data.error}` }));
    }
    setScrapingId(null);
  }

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Manage Trailers</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
        >
          + Add Trailer
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm mb-4 flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 animate-pulse">Loading…</div>
      ) : (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="px-4 py-3">Movie Title</th>
                <th className="px-4 py-3">YouTube ID</th>
                <th className="px-4 py-3">Trailer Date</th>
                <th className="px-4 py-3">Release Date</th>
                <th className="px-4 py-3">Studio</th>
                <th className="px-4 py-3">Box Office</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trailers.map((t) => (
                <tr key={t.id} className="border-b border-gray-800/50">
                  {editingId === t.id ? (
                    <>
                      <td className="px-4 py-2"><input className={inputCls} value={editForm.movieTitle} onChange={(e) => setEditForm({ ...editForm, movieTitle: e.target.value })} /></td>
                      <td className="px-4 py-2"><input className={inputCls} value={editForm.youtubeId} onChange={(e) => setEditForm({ ...editForm, youtubeId: e.target.value })} /></td>
                      <td className="px-4 py-2"><input type="date" className={inputCls} value={editForm.releaseDate} onChange={(e) => setEditForm({ ...editForm, releaseDate: e.target.value })} /></td>
                      <td className="px-4 py-2"><input type="date" className={inputCls} value={editForm.movieReleaseDate} onChange={(e) => setEditForm({ ...editForm, movieReleaseDate: e.target.value })} /></td>
                      <td className="px-4 py-2"><input className={inputCls} value={editForm.studio} onChange={(e) => setEditForm({ ...editForm, studio: e.target.value })} /></td>
                      <td className="px-4 py-2 text-gray-500 text-xs">—</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => saveEdit(t.id)} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs">Save</button>
                          <button onClick={() => setEditingId(null)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-lg text-xs">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-white">{t.movieTitle}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        <a href={`https://youtube.com/watch?v=${t.youtubeId}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{t.youtubeId}</a>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{t.releaseDate || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{t.movieReleaseDate || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{t.studio || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {t.boxOffice ? (
                          <span className="text-green-400">
                            ₹{t.boxOffice.day1India ?? "?"}Cr India<br />
                            ₹{t.boxOffice.day1Worldwide ?? "?"}Cr WW
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => scrapeBoxOffice(t)}
                              disabled={scrapingId === t.id}
                              className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white px-2 py-1 rounded text-xs"
                            >
                              {scrapingId === t.id ? "Scraping…" : "Fetch BO"}
                            </button>
                            {scrapeResult[t.id] && (
                              <span className={scrapeResult[t.id].startsWith("✅") ? "text-green-400" : "text-red-400"}>
                                {scrapeResult[t.id]}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => startEdit(t)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-lg text-xs">Edit</button>
                          <button onClick={() => deleteTrailer(t.id)} className="bg-red-800 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs">Delete</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Trailer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Add New Trailer</h2>
            <div className="flex flex-col gap-3">
              {[
                { label: "Movie Title *", key: "movieTitle", placeholder: "e.g. Empuraan" },
                { label: "YouTube URL or Video ID *", key: "youtubeUrl", placeholder: "https://youtube.com/watch?v=... or ID" },
                { label: "Studio", key: "studio", placeholder: "e.g. Aashirvad Cinemas" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                  <input
                    className={inputCls}
                    placeholder={placeholder}
                    value={addForm[key as keyof typeof addForm]}
                    onChange={(e) => setAddForm({ ...addForm, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Trailer Release Date</label>
                <input type="date" className={inputCls} value={addForm.releaseDate} onChange={(e) => setAddForm({ ...addForm, releaseDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Movie Release Date (theatrical)</label>
                <input type="date" className={inputCls} value={addForm.movieReleaseDate} onChange={(e) => setAddForm({ ...addForm, movieReleaseDate: e.target.value })} />
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button
                  onClick={addTrailer}
                  disabled={saving || !addForm.movieTitle || !addForm.youtubeUrl}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {saving ? "Adding…" : "Add Trailer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
