import React, { useState } from "react";
import Map from "./components/Map";
import axios from "axios";

const PRIORITY_BADGE = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-emerald-50 text-emerald-700",
};

export default function App() {
  const [points, setPoints] = useState([]); // {id, lat, lon, priority}
  const [optimized, setOptimized] = useState([]);
  const [legDistances, setLegDistances] = useState([]); // distances between successive optimized points (km)
  const [totalDistance, setTotalDistance] = useState(0); // km from backend
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("optimized"); // strict | optimized
  const [algorithm, setAlgorithm] = useState("auto"); // auto | dp | heuristic
  const [dpLimit, setDpLimit] = useState(12);

  async function handleOptimize() {
    if (!points.length) return alert("Add some points first");
    setLoading(true);
    try {
      const res = await axios.post("/api/optimize", {
        points: points.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, priority: p.priority })),
        options: { mode, algorithm, dp_limit: dpLimit },
      });

      // backend should return ordered_points and total_distance (km)
      const ordered = res.data.ordered_points ?? [];
      const backendTotal = Number(res.data.total_distance ?? 0);

      // compute per-leg distances using haversine (km)
      const legs = [];
      for (let i = 1; i < ordered.length; i++) {
        const a = ordered[i - 1];
        const b = ordered[i];
        const d = haversineKm(a.lat, a.lon, b.lat, b.lon);
        legs.push(Number(d.toFixed(3)));
      }

      setOptimized(ordered);
      setLegDistances(legs);
      setTotalDistance(Number(backendTotal.toFixed(3)));
    } catch (err) {
      console.error(err);
      alert("Optimize failed: " + (err?.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  }

  // Clears only the optimized route (keeps points)
  function handleResetRoute() {
    setOptimized([]);
    setLegDistances([]);
    setTotalDistance(0);
  }

  // Clears points + optimized route (full reset)
  function handleClearAll() {
    setPoints([]);
    setOptimized([]);
    setLegDistances([]);
    setTotalDistance(0);
  }

  function exportJSON() {
    const payload = {
      ordered_points: optimized,
      total_distance_km: totalDistance,
      leg_distances_km: legDistances,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "route.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    // CSV with per-row step distance to next stop (last row has blank distance)
    const rows = ["id,lat,lon,priority,leg_distance_to_next_km"];
    optimized.forEach((p, idx) => {
      const leg = idx < legDistances.length ? legDistances[idx] : "";
      rows.push(`${p.id},${p.lat},${p.lon},${p.priority},${leg}`);
    });
    // summary row
    rows.push(`,, ,total_distance_km,${totalDistance}`);
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "route.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Haversine formula — returns kilometers between two lat/lon points
  function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371.0; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
    return R * c;
  }


  return (
    <div className="min-h-screen antialiased">
      {/* Header */}
      <header className="bg-white border-b py-4">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/src/assets/logo.jpg" alt="Logo" className="h-9 w-9 rounded-md object-cover shadow-sm" />
            <div>
              <div className="text-lg font-semibold text-slate-900">Smart Delivery · Route Planner</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-muted">Mode</div>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="px-3 py-1 rounded-md border text-sm">
              <option value="optimized">Optimized</option>
              <option value="strict">Strict</option>
            </select>

            <div className="text-sm text-muted">Algorithm</div>
            <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} className="px-3 py-1 rounded-md border text-sm">
              <option value="auto">Auto</option>
              <option value="dp">DP (exact)</option>
              <option value="heuristic">Heuristic</option>
            </select>

            <button
              onClick={handleOptimize}
              disabled={loading}
              className={`ml-4 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition ${loading ? "bg-slate-300 text-slate-700" : "bg-brand-500 text-white hover:bg-brand-600"
                }`}
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" strokeOpacity="0.2" /><path d="M4 12a8 8 0 0 1 8-8" stroke="white" strokeWidth="4" strokeLinecap="round" /></svg>
              ) : null}
              {loading ? "Optimizing…" : "Optimize"}
            </button>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left: controls */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="bg-white card rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold">Points</h3>
                  <p className="text-sm text-muted">Click map to add. Edit priority or remove.</p>
                </div>
                <div className="text-sm text-muted">{points.length} items</div>
              </div>

              <div className="space-y-2 max-h-72 overflow-auto">
                {points.length === 0 ? (
                  <div className="text-sm text-muted">No points yet. Click on map to add stops.</div>
                ) : (
                  points.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-2 rounded border">
                      <div>
                        <div className="text-sm font-medium">#{p.id}</div>
                        <div className="text-xs text-muted">{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={p.priority}
                          onChange={(e) => setPoints(prev => prev.map(x => x.id === p.id ? { ...x, priority: e.target.value } : x))}
                          className="px-2 py-1 text-sm rounded-md border"
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <button onClick={() => setPoints(prev => prev.filter(x => x.id !== p.id))} className="text-sm text-rose-600">Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted">DP limit</div>
                <input type="number" min={3} max={16} value={dpLimit} onChange={(e) => setDpLimit(Number(e.target.value))} className="w-20 px-2 py-1 border rounded-md" />
              </div>

              <div className="flex gap-2">
                <button onClick={handleClearAll} className="flex-1 px-3 py-2 rounded-md border text-sm">Clear all</button>
                <button onClick={exportJSON} className="flex-1 px-3 py-2 rounded-md bg-slate-900 text-white text-sm">Export JSON</button>
              </div>
            </div>
          </aside>

          {/* Center: map */}
          <section className="col-span-12 lg:col-span-6 h-[72vh]">
            <div className="h-full rounded-lg overflow-hidden border card">
              <Map points={points} setPoints={setPoints} optimizedRoute={optimized} />
            </div>
          </section>

          {/* Right: route summary */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="bg-white card rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold">Route summary</h3>
                  <div className="text-sm text-muted">Stops: <strong>{points.length}</strong></div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">Distance (km)</div>
                  <div className="text-lg font-semibold">{totalDistance.toFixed(3)}</div>
                </div>
              </div>

              <div className="divide-y">
                {optimized.length === 0 ? (
                  <div className="py-4 text-sm text-muted">No optimized route yet. Click Optimize to compute.</div>
                ) : (
                  optimized.map((p, i) => (
                    <div key={p.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${p.priority === 'high' ? 'bg-red-50 text-red-700' : p.priority === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {p.priority[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium">Stop {i + 1}</div>
                          <div className="text-xs text-muted">{p.lat.toFixed(5)}, {p.lon.toFixed(5)}</div>
                        </div>
                      </div>
                      <div className="text-sm text-muted">
                        {i < legDistances.length ? `${legDistances[i].toFixed(3)} km` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleOptimize} disabled={loading} className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold ${loading ? 'bg-slate-300' : 'bg-green-500 text-white'}`}>{loading ? 'Optimizing…' : 'Optimize'}</button>
                <button onClick={handleResetRoute} className="px-3 py-2 rounded-md border text-sm">Reset</button>
              </div>
            </div>

            <div className="mt-4 bg-white card rounded-lg p-3 text-sm text-muted">
              <strong>Pro tip</strong>: Backend distance is the real geographic distance in km (Haversine). The front-end shows per-leg distances computed with the same formula.
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
