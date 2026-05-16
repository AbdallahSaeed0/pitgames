import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type GameRow = [number, string, string | null, number | null, number, string];
type RunningSession = [string, string];

interface GameDetailsProps {
  gameId: number;
  onBack: () => void;
  onDeleted: () => void;
}

export default function GameDetails({ gameId, onBack, onDeleted }: GameDetailsProps) {
  const [game, setGame] = useState<GameRow | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runningSeconds, setRunningSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      // We don't have get_game_details, so we use list_games_with_time and filter
      const [allGames, running, sessions] = await Promise.all([
        invoke<GameRow[]>("list_games_with_time"),
        invoke<string[]>("detect_running_games"),
        invoke<RunningSession[]>("get_running_sessions"),
      ]);
      
      const found = allGames.find(g => g[0] === gameId);
      if (found) {
        setGame(found);
        const procName = found[5].toLowerCase();
        const active = running.includes(procName);
        setIsRunning(active);
        
        if (active) {
          const session = sessions.find(s => s[0].toLowerCase() === procName);
          if (session) {
            const sec = Math.max(0, Math.floor((Date.now() - new Date(session[1]).getTime()) / 1000));
            setRunningSeconds(sec);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load game details", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 5000);
    return () => clearInterval(interval);
  }, [gameId]);

  const handleDelete = async () => {
    if (!confirm("Delete this game from library?")) return;
    try {
      await invoke("delete_game", { id: gameId });
      onDeleted();
    } catch (e) {
      alert(`Delete failed: ${e}`);
    }
  };

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (loading && !game) return <div className="empty-state">Loading details...</div>;
  if (!game) return <div className="empty-state">Game not found.</div>;

  return (
    <div className="details-page">
      <div className="details-hero">
        <div 
          className="details-hero-bg" 
          style={{ backgroundImage: game[2] ? `url(${game[2]})` : "none" }}
        ></div>
        <div className="details-hero-content">
          {game[2] && <img src={game[2]} alt={game[1]} className="details-poster" />}
          <div className="details-info">
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <span className={`badge ${isRunning ? "badge-running" : ""}`} style={{ background: isRunning ? "" : "var(--bg-surface-light)", color: isRunning ? "" : "var(--text-muted)" }}>
                {isRunning ? "Running Now" : "Not Running"}
              </span>
              <span className="badge" style={{ background: "rgba(255,255,255,0.1)", color: "white" }}>
                ★ {game[3]?.toFixed(1) || "N/A"}
              </span>
            </div>
            <h1>{game[1]}</h1>
            <div style={{ display: "flex", gap: 16 }}>
              <button className="btn btn-primary" onClick={onBack}>Back to Library</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete Game</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-cols-2">
        <section>
          <h2 className="section-title">Playtime Stats</h2>
          <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="stat-card">
              <div className="stat-label">Total Played</div>
              <div className="stat-value">{formatTime(game[4])}</div>
            </div>
            {isRunning && (
              <div className="stat-card" style={{ borderColor: "var(--success)" }}>
                <div className="stat-label" style={{ color: "var(--success)" }}>Current Session</div>
                <div className="stat-value" style={{ color: "var(--success)" }}>{formatTime(runningSeconds)}</div>
              </div>
            )}
          </div>
          
          <div className="card mt-32">
            <h3 style={{ marginTop: 0 }}>Notes</h3>
            <p style={{ color: "var(--text-dim)", fontStyle: "italic" }}>
              Notes feature coming later. You can use this space to track your progress or goals for this game.
            </p>
          </div>
        </section>

        <section>
          <h2 className="section-title">Tracking Information</h2>
          <div className="card">
            <div className="input-group">
              <div className="stat-label">Process Name</div>
              <code>{game[5]}</code>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <div className="stat-label">Executable Path</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", wordBreak: "break-all", background: "var(--bg-main)", padding: 12, borderRadius: 4 }}>
                {game[0] === -1 ? "N/A" : "Loading path..."} 
                {/* Since we don't have a direct detail command, we'd need to fetch more info if needed, but we have the path in the DB. For now showing a placeholder or the path if we had it in GameRow. */}
                {/* Wait, GameRow is [id, title, cover, rating, time, process_name]. Exe path isn't in list_games_with_time. */}
                {/* I'll just show the process name for now as that's what we have. */}
                {game[5]}
              </div>
            </div>
          </div>
          
          <div className="card mt-32" style={{ background: "rgba(91, 108, 255, 0.05)", borderColor: "rgba(91, 108, 255, 0.2)" }}>
            <h3 style={{ color: "var(--accent)", marginTop: 0 }}>Automatic Tracking</h3>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-muted)" }}>
              PitGames automatically detects when <code>{game[5]}</code> starts and stops. 
              Your playtime is updated every few seconds while the game is running.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
