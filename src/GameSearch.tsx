import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface RawgGame {
  id: number;
  name: string;
  background_image: string | null;
  rating: number | null;
}

export default function GameSearch({ onSaved }: { onSaved?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RawgGame[]>([]);
  const [selected, setSelected] = useState<RawgGame | null>(null);
  const [exePath, setExePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isTauriRuntime =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (!isTauriRuntime) {
      setMessage("This action requires Tauri. Start with `npm run tauri dev`.");
      return;
    }
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const games = await invoke<RawgGame[]>("search_rawg_games", { query });
      setResults(games);
      setSelected(null);
    } catch (error) {
      setError(`Search failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!exePath) {
      setError("Please pick the game executable first");
      return;
    }
    if (!isTauriRuntime) {
      setMessage("This action requires Tauri. Start with `npm run tauri dev`.");
      return;
    }
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const fileName = exePath.split("\\").pop()?.toLowerCase() || "";
      await invoke<number>("add_game", {
        payload: {
          exe_path: exePath,
          process_name: fileName,
          title: selected.name,
          rawg_id: selected.id,
          cover_url: selected.background_image,
          rating: selected.rating,
        },
      });
      setMessage("Game saved successfully");
      setSelected(null);
      setExePath(null);
      if (onSaved) onSaved();
    } catch (error) {
      setError(`Save failed: ${error}`);
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="search-page">
      <div className="search-panel">
        <div className="search-row">
          <input
            type="text"
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a game..."
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="primary-button" onClick={handleSearch} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {message && <div className="message-success">{message}</div>}
      {error && <div className="message-error">{error}</div>}

      {results.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <h2 className="debug-section-title">Search Results</h2>
          <div className="library-grid">
            {results.map((game) => (
              <div
                key={game.id}
                className={`game-card ${selected?.id === game.id ? "game-card-running" : ""}`}
                onClick={() => setSelected(game)}
                style={{ cursor: "pointer" }}
              >
                {game.background_image && (
                  <img
                    src={game.background_image}
                    alt={game.name}
                    className="game-cover"
                  />
                )}
                <div className="game-card-content">
                  <h3 className="game-title">{game.name}</h3>
                  <div className="game-meta">
                    Rating: {game.rating ? game.rating.toFixed(1) : "N/A"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="search-panel" style={{ marginTop: 20 }}>
          <h2 className="debug-section-title" style={{ marginTop: 0 }}>Selected Game</h2>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            {selected.background_image && (
              <img 
                src={selected.background_image} 
                alt={selected.name} 
                style={{ width: 120, height: 160, objectFit: "cover", borderRadius: 4 }}
              />
            )}
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 8px 0" }}>{selected.name}</h3>
              <p className="game-meta">Rating: {selected.rating ? selected.rating.toFixed(1) : "N/A"}</p>
              
              {exePath ? (
                <div className="message-success" style={{ padding: "8px 12px", fontSize: 14 }}>
                  Executable selected: <code>{exePath.split("\\").pop()}</code>
                </div>
              ) : (
                <div className="game-meta" style={{ color: "var(--accent-green)" }}>
                  Pick the game executable before saving.
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button className="secondary-button" onClick={handlePickExe} disabled={loading}>
                  {exePath ? "Change Executable" : "Pick Executable"}
                </button>
                <button 
                  className="primary-button" 
                  onClick={handleSave} 
                  disabled={!selected || !exePath || loading}
                >
                  {loading ? "Saving..." : "Save to Library"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
