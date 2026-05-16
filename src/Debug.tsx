import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface DebugProcess {
  pid: number;
  name: string;
  exe_path: string | null;
  exe_filename: string | null;
}

interface DebugSavedGame {
  id: number;
  title: string;
  process_name: string;
  exe_path: string;
}

export default function Debug() {
  const [processes, setProcesses] = useState<DebugProcess[]>([]);
  const [savedGames, setSavedGames] = useState<DebugSavedGame[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDebugData = async () => {
    setLoading(true);
    try {
      const [procList, gameList] = await Promise.all([
        invoke<DebugProcess[]>("debug_processes"),
        invoke<DebugSavedGame[]>("debug_saved_games"),
      ]);
      setProcesses(procList);
      setSavedGames(gameList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebugData();
  }, []);

  const filteredProcesses = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.exe_filename?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="debug-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 className="debug-section-title" style={{ margin: 0 }}>Debug Tool</h2>
        <button className="secondary-button" onClick={loadDebugData}>Refresh Data</button>
      </div>
      
      <div className="search-panel">
        <input
          type="text"
          className="search-input"
          placeholder="Filter processes by name or filename..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="empty-state">Loading debug data...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <section>
            <h3 className="debug-section-title">Saved Games</h3>
            <table className="debug-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Process Name</th>
                  <th>Executable Path</th>
                </tr>
              </thead>
              <tbody>
                {savedGames.length > 0 ? (
                  savedGames.map((g) => (
                    <tr key={g.id}>
                      <td>{g.title}</td>
                      <td><code>{g.process_name}</code></td>
                      <td style={{ fontSize: 12, color: "var(--text-dim)" }}>{g.exe_path}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "var(--text-dim)" }}>No games saved in database.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="debug-section-title">Running Processes ({filteredProcesses.length})</h3>
            <div style={{ maxHeight: 600, overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: 8 }}>
              <table className="debug-table">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>PID</th>
                    <th>Name</th>
                    <th>Exe Filename</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcesses.length > 0 ? (
                    filteredProcesses.map((p) => (
                      <tr key={p.pid}>
                        <td>{p.pid}</td>
                        <td>{p.name}</td>
                        <td><code>{p.exe_filename || "N/A"}</code></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", color: "var(--text-dim)" }}>No matching processes found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
