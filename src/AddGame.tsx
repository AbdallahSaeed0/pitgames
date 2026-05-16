import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface RawgGame {
  id: number;
  name: string;
  background_image: string | null;
  rating: number | null;
}

interface AddGameProps {
  onSaved: (id?: number) => void;
}

export default function AddGame({ onSaved }: AddGameProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RawgGame[]>([]);
  const [selected, setSelected] = useState<RawgGame | null>(null);
  const [exePath, setExePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const games = await invoke<RawgGame[]>("search_rawg_games", { query });
      setResults(games);
      setSelected(null);
    } catch (e) {
      setError(`Search failed: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGame = (game: RawgGame) => {
    setSelected(game);
  };

  const handlePickExe = async () => {
    try {
      const path = await invoke<string>("pick_exe");
      if (path) {
        setExePath(path);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!selected || !exePath) return;
    setLoading(true);
    setError("");
    try {
      const fileName = exePath.split(/[\\/]/).pop()?.toLowerCase() || "";
      const id = await invoke<number>("add_game", {
        payload: {
          exe_path: exePath,
          process_name: fileName,
          title: selected.name,
          rawg_id: selected.id,
          cover_url: selected.background_image,
          rating: selected.rating,
        },
      });
      onSaved(id);
    } catch (e) {
      setError(`Save failed: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-game-page">
      <h1 className="section-title">Add New Game</h1>
      
      <div className="card mb-24">
        <div className="input-group">
          <label className="input-label">Search RAWG Database</label>
          <div style={{ display: "flex", gap: 12 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Enter game title..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>
            Search for game metadata first to get covers and ratings.
          </p>
        </div>
      </div>

      {error && <div className="message-error mb-24">{error}</div>}

      <div className="grid-cols-2">
        <section>
          <h2 className="section-title" style={{ fontSize: 18 }}>1. Select Metadata</h2>
          <div style={{ maxHeight: 500, overflowY: "auto", paddingRight: 8 }} className="game-grid">
            {results.map((game) => (
              <div
                key={game.id}
                className={`game-card ${selected?.id === game.id ? "active" : ""}`}
                onClick={() => handleSelectGame(game)}
                style={{ 
                  borderColor: selected?.id === game.id ? "var(--accent)" : "var(--border)",
                  borderWidth: selected?.id === game.id ? 2 : 1
                }}
              >
                {game.background_image && <img src={game.background_image} alt={game.name} className="game-card-img" style={{ aspectRatio: "16/9" }} />}
                <div className="game-card-info">
                  <h3 className="game-card-title">{game.name}</h3>
                </div>
              </div>
            ))}
            {results.length === 0 && !loading && (
              <div className="empty-state" style={{ padding: 40 }}>
                <p>Search results will appear here.</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="section-title" style={{ fontSize: 18 }}>2. Configure & Save</h2>
          <div className="card">
            {!selected ? (
              <div className="empty-state" style={{ padding: 20 }}>
                <p>Select a game from the results to continue.</p>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                  {selected.background_image && (
                    <img src={selected.background_image} alt={selected.name} style={{ width: 80, height: 110, objectFit: "cover", borderRadius: 4 }} />
                  )}
                  <div>
                    <h3 style={{ margin: "0 0 4px 0" }}>{selected.name}</h3>
                    <div className="badge" style={{ background: "var(--bg-surface-light)", color: "var(--text-muted)" }}>
                      ★ {selected.rating?.toFixed(1) || "N/A"}
                    </div>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Game Executable</label>
                  <button className="btn btn-secondary" style={{ width: "100%" }} onClick={handlePickExe}>
                    {exePath ? "Change Executable" : "Pick Game Executable"}
                  </button>
                  {exePath && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--success)" }}>
                        Selected: {exePath.split(/[\\/]/).pop()}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all", marginTop: 4 }}>
                        {exePath}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ width: "100%", marginTop: 12, padding: 16, fontSize: 16 }}
                  disabled={!selected || !exePath || loading}
                  onClick={handleSave}
                >
                  {loading ? "Saving..." : "Add to Library"}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
