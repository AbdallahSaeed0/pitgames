# PitGames — Project Brief

## What it is
A **local-first PC game library and playtime tracker** built with **Tauri v2** (Rust backend) + **React/TypeScript** frontend. It runs as a native Windows desktop app with a system tray icon.

## Core features
- **Game library** — add games manually or via IGDB/RAWG metadata; browse with cover art from SteamGridDB
- **Playtime tracking** — background watcher detects running games every 5 seconds and logs sessions to SQLite
- **Game details page** — hero banner, stats, screenshots/trailers (opened via `tauri-plugin-opener`), similar games, playlists
- **Performance Advisor** — searches Steam for any game, fetches PC requirements, compares against the user's scanned hardware profile, and gives a compatibility report (CPU/GPU tier ranking, RAM, VRAM, DirectX, storage)
- **Playlists** — user-created game collections
- **Profile page** — avatar, display name, level, and hardware profile management (scan, set active, delete)
- **Stats page** — playtime KPIs, top genres/developers with bar charts
- **Home page** — hero background, recent/pinned games, currently running games

## Tech stack
| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Rust (Tauri v2), `sqlx` + SQLite |
| External APIs | IGDB (metadata), RAWG (metadata fallback), SteamGridDB (artwork), Steam store (requirements) |
| Hardware scan | `sysinfo` crate + Windows Registry (`winreg`) for DirectX |
| Auto-launch | `tauri-plugin-autostart` |
| File/URL open | `tauri-plugin-opener` |
| Notifications | Custom toast hook (`useToast`) |

## Project structure
```
src/                        # React frontend
  pages/                    # Home, Library, GameDetails, Stats, Settings, Profile,
  │                         # Playlists, PerformanceAdvisor
  components/
    Layout/                 # AppShell, Sidebar, MainContent
    GameDetails/            # HeroBanner, MediaCarousel, PerformanceAdvisorCard, …
    AddGame/                # Multi-step AddGameWizard
    common/                 # GlassCard, SafeImage, GameCompatibilityModal, …
    settings/               # UpdateCheckModal
    home/                   # HomeHeroBackgroundModal
  hooks/                    # useToast
  utils/                    # fileUtils, homeHeroBackground, steamAdvisorSearch

src-tauri/src/              # Rust backend
  main.rs                   # Tauri app entry, plugin init, tray, window events
  commands.rs               # All Tauri IPC commands (~2700 lines)
  db.rs                     # SQLite migrations + hardware ranking seed data
  performance/
    compatibility.rs        # CPU/GPU tier comparison logic
    requirements.rs         # Steam requirements parser
  api_keys.rs               # Secure key storage
  igdb.rs / rawg.rs /       # External API clients
  steamgriddb.rs / media.rs
```

## Key conventions
- **IPC naming**: Rust `snake_case` params → Tauri auto-converts to `camelCase` for JS `invoke()` calls
- **Images**: Stored locally; served via `asset://` protocol; `SafeImage` component handles broken URLs
- **DB**: Single SQLite file in app data dir; all migrations in `db.rs`; hardware rankings seeded with `INSERT OR IGNORE` + UNIQUE index
- **No router**: Page state managed in `App.tsx` with a `Page` union type and `renderPage()` switch
- **Styling**: Global CSS classes (`premium-page`, `btn`, `btn-primary`, etc.) + inline styles; accent color via CSS vars (`--accent`, `--accent-rgb`)
