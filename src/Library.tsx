import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type GameRow = [number, string, string | null, number | null, number, string];
type RunningSession = [string, string];

interface LibraryProps {
  onSelectGame: (id: number) => void;
}

export default function Library({ onSelectGame }: LibraryProps) {
  const [games, setGames] = useState<GameRow[]>([]);
  const [running, setRunning] = useState<string[]>([]);
  const [runningSessions, setRunningSessions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "idle">("all");

  const loadGames = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [data, active, sessions] = await Promise.all([
        invoke<GameRow[]>("list_games_with_time"),
        invoke<string[]>("detect_running_games"),
        invoke<RunningSession[]>("get_running_sessions"),
      ]);
      setGames(data);
      setRunning(active);
      const map: Record<string, string> = {};
      for (const [processName, startedAt] of sessions) {
        map[processName.toLowerCase()] = startedAt;
      }
      setRunningSessions(map);
    } catch (e) {
      console.error("Failed to load library", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
    const interval = setInterval(() => loadGames(false), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this game from library?")) return;
    try {
      await invoke("delete_game", { id });
      await loadGames(false);
    } catch (e) {
      alert(`Delete failed: ${e}`);
    }
  };

  const filteredGames = games.filter((g) => {
    const matchesSearch = g[1].toLowerCase().includes(filter.toLowerCase());
    const isRunning = running.includes(g[5].toLowerCase());
    if (statusFilter === "running") return matchesSearch && isRunning;
    if (statusFilter === "idle") return matchesSearch && !isRunning;
    return matchesSearch;
  });

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (loading && games.length === 0) return <div className="empty-state">Loading library...</div>;

  return (
    <div className="library-page">
      <div className="flex-between mb-24">
        <h1 className="section-title" style={{ margin: 0 }}>My Library</h1>
        <button className="btn btn-secondary" onClick={() => loadGames(true)}>Refresh</button>
      </div>

      <div className="card mb-24" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <input
          type="text"
          className="input-field"
          placeholder="Search library..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            className={`btn ${statusFilter === "all" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setStatusFilter("all")}
          >All</button>
          <button 
            className={`btn ${statusFilter === "running" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setStatusFilter("running")}
          >Running</button>
          <button 
            className={`btn ${statusFilter === "idle" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setStatusFilter("idle")}
          >Idle</button>
        </div>
      </div>

      {filteredGames.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎮</div>
          <p>{filter ? "No games match your search." : "No games yet. Add your first game."}</p>
        </div>
      ) : (
        <div className="game-grid">
          {filteredGames.map((g) => {
            const isRunning = running.includes(g[5].toLowerCase());
            const processName = g[5].toLowerCase();
            const startedAt = runningSessions[processName];
            const runningSeconds = startedAt
              ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
              : 0;

            return (
              <div
                key={g[0]}
                className={`game-card ${isRunning ? "running" : ""}`}
                onClick={() => onSelectGame(g[0])}
              >
                {g[2] && <img src={g[2]} alt={g[1]} className="game-card-img" />}
                <div className="game-card-info">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span className={`badge ${isRunning ? "badge-running" : ""}`} style={{ background: isRunning ? "" : "var(--bg-surface-light)", color: isRunning ? "" : "var(--text-dim)" }}>
                      {isRunning ? "Running" : "Idle"}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>★ {g[3]?.toFixed(1) || "N/A"}</span>
                  </div>
                  <h3 className="game-card-title">{g[1]}</h3>
                  <div className="game-card-meta">
                    <span style={{ color: isRunning ? "var(--success)" : "inherit", fontWeight: isRunning ? "700" : "inherit" }}>
                      {isRunning ? formatTime(runningSeconds) : formatTime(g[4])}
                    </span>
                    <button className="btn btn-danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={(e) => handleDelete(e, g[0])}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
