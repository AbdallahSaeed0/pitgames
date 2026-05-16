import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type GameRow = [number, string, string | null, number | null, number, string];

interface HomeProps {
  onAddGame: () => void;
  onViewLibrary: () => void;
  onSelectGame: (id: number) => void;
}

export default function Home({ onAddGame, onViewLibrary, onSelectGame }: HomeProps) {
  const [games, setGames] = useState<GameRow[]>([]);
  const [runningCount, setRunningCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [allGames, running] = await Promise.all([
          invoke<GameRow[]>("list_games_with_time"),
          invoke<string[]>("detect_running_games"),
        ]);
        setGames(allGames);
        setRunningCount(running.length);
      } catch (e) {
        console.error("Failed to load home data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const totalPlaytime = games.reduce((acc, g) => acc + g[4], 0);
  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const mostPlayed = [...games].sort((a, b) => b[4] - a[4])[0];
  const recentlyAdded = [...games].slice(-4).reverse();

  if (loading) return <div className="empty-state">Loading dashboard...</div>;

  return (
    <div className="home-page">
      <section className="hero">
        <h1 className="hero-title">Welcome back to PitGames</h1>
        <p className="hero-subtitle">
          Track your playtime and build your personal game library. 
          You have spent <strong>{formatTime(totalPlaytime)}</strong> across <strong>{games.length}</strong> games.
        </p>
        <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
          <button className="btn btn-primary" onClick={onAddGame}>Add New Game</button>
          <button className="btn btn-secondary" onClick={onViewLibrary}>View Library</button>
        </div>
      </section>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Games</div>
          <div className="stat-value">{games.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Playtime</div>
          <div className="stat-value">{formatTime(totalPlaytime)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Currently Running</div>
          <div className="stat-value" style={{ color: runningCount > 0 ? "var(--success)" : "inherit" }}>
            {runningCount}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Most Played</div>
          <div className="stat-value" style={{ fontSize: 18, marginTop: 8 }}>
            {mostPlayed ? mostPlayed[1] : "N/A"}
          </div>
        </div>
      </div>

      {recentlyAdded.length > 0 && (
        <section className="mt-32">
          <div className="flex-between mb-24">
            <h2 className="section-title" style={{ margin: 0 }}>Recently Added</h2>
            <button className="btn btn-secondary" onClick={onViewLibrary}>See All</button>
          </div>
          <div className="game-grid">
            {recentlyAdded.map((game) => (
              <div key={game[0]} className="game-card" onClick={() => onSelectGame(game[0])}>
                {game[2] && <img src={game[2]} alt={game[1]} className="game-card-img" />}
                <div className="game-card-info">
                  <h3 className="game-card-title">{game[1]}</h3>
                  <div className="game-card-meta">
                    <span>{formatTime(game[4])}</span>
                    <span>★ {game[3]?.toFixed(1) || "N/A"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
