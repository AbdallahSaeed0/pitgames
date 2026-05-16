use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::path::Path;
use std::str::FromStr;

pub async fn get_app_setting(pool: &SqlitePool, key: &str) -> Option<String> {
    sqlx::query_scalar::<_, String>("SELECT value FROM app_settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

pub async fn set_app_setting(pool: &SqlitePool, key: &str, value: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn init_db() -> Result<SqlitePool, sqlx::Error> {
    let new_db_path = Path::new("../pitgames.db");
    let old_db_path = Path::new("pitgames.db");
    if !new_db_path.exists() && old_db_path.exists() {
        let _ = std::fs::copy(old_db_path, new_db_path);
    }

    let options = SqliteConnectOptions::from_str("sqlite:../pitgames.db")?.create_if_missing(true);

    let pool = SqlitePool::connect_with(options).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            exe_path TEXT NOT NULL,
            process_name TEXT NOT NULL,
            rawg_id INTEGER,
            cover_url TEXT,
            background_url TEXT,
            description TEXT,
            released TEXT,
            rating REAL,
            genres TEXT,
            platforms TEXT,
            developer TEXT,
            publisher TEXT,
            status TEXT DEFAULT 'backlog',
            user_rating INTEGER,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_played_at TEXT,
            total_playtime_seconds INTEGER DEFAULT 0,
            sessions_count INTEGER DEFAULT 0
        )",
    )
    .execute(&pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_games_process_name ON games(process_name)")
        .execute(&pool)
        .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS play_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            process_name TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            duration_seconds INTEGER DEFAULT 0
        )",
    )
    .execute(&pool)
    .await?;

    // Phase 1: Progress tracking migrations
    let migrations = [
        "ALTER TABLE games ADD COLUMN hltb_main_story INTEGER",
        "ALTER TABLE games ADD COLUMN hltb_main_extras INTEGER",
        "ALTER TABLE games ADD COLUMN hltb_completionist INTEGER",
        "ALTER TABLE games ADD COLUMN target_hours INTEGER",
        "ALTER TABLE games ADD COLUMN completion_status TEXT DEFAULT 'not_started'",
    ];

    for migration in migrations {
        // SQLite doesn't support ADD COLUMN IF NOT EXISTS directly in older versions, 
        // but we can catch the error if the column already exists.
        let _ = sqlx::query(migration).execute(&pool).await;
    }

    // Phase 2: Extended metadata migrations
    let extended_migrations = [
        "ALTER TABLE games ADD COLUMN igdb_id INTEGER",
        "ALTER TABLE games ADD COLUMN metadata_provider TEXT",
        "ALTER TABLE games ADD COLUMN summary TEXT",
        "ALTER TABLE games ADD COLUMN release_date TEXT",
        "ALTER TABLE games ADD COLUMN developer TEXT",
        "ALTER TABLE games ADD COLUMN publisher TEXT",
        "ALTER TABLE games ADD COLUMN platforms TEXT",
        "ALTER TABLE games ADD COLUMN genres TEXT",
        "ALTER TABLE games ADD COLUMN artwork_url TEXT",
        "ALTER TABLE games ADD COLUMN screenshot_url TEXT",
        "ALTER TABLE games ADD COLUMN trailer_url TEXT",
        "ALTER TABLE games ADD COLUMN total_rating_count INTEGER",
        "ALTER TABLE games ADD COLUMN similar_games TEXT", // Store as JSON string
        "ALTER TABLE games ADD COLUMN storyline TEXT",
        "ALTER TABLE games ADD COLUMN rating_count INTEGER",
        "ALTER TABLE games ADD COLUMN total_rating REAL",
        "ALTER TABLE games ADD COLUMN artworks TEXT",
        "ALTER TABLE games ADD COLUMN screenshots TEXT",
        "ALTER TABLE games ADD COLUMN videos TEXT",
        "CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            name TEXT DEFAULT 'User',
            avatar_url TEXT,
            level INTEGER DEFAULT 1,
            xp INTEGER DEFAULT 0
        )",
        "INSERT OR IGNORE INTO user_profile (id, name, level, xp) VALUES (1, 'User', 1, 0)",
        "CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT,
            is_pinned INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )",
        "CREATE TABLE IF NOT EXISTS playlist_games (
            playlist_id INTEGER,
            game_id INTEGER,
            PRIMARY KEY (playlist_id, game_id),
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
        )",
        "INSERT OR IGNORE INTO playlists (id, name, icon, is_pinned, created_at) VALUES (1, 'Favorites', '⭐', 1, datetime('now'))",
        "INSERT OR IGNORE INTO playlists (id, name, icon, is_pinned, created_at) VALUES (2, 'To Play', '🎯', 1, datetime('now'))",
        "ALTER TABLE games ADD COLUMN is_pinned INTEGER DEFAULT 0",
        "CREATE TABLE IF NOT EXISTS app_secrets (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        "ALTER TABLE games ADD COLUMN process_name_aliases TEXT",
    ];

    for migration in extended_migrations {
        let _ = sqlx::query(migration).execute(&pool).await;
    }

    // Fix for existing games that might have data in old 'description' column
    let _ = sqlx::query("UPDATE games SET summary = description WHERE summary IS NULL AND description IS NOT NULL").execute(&pool).await;
    let _ = sqlx::query("UPDATE games SET artwork_url = background_url WHERE artwork_url IS NULL AND background_url IS NOT NULL").execute(&pool).await;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_games_completion_status ON games(completion_status)")
        .execute(&pool)
        .await?;

    let perf_migrations = [
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        "ALTER TABLE games ADD COLUMN steam_app_id INTEGER",
        "CREATE TABLE IF NOT EXISTS hardware_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_name TEXT NOT NULL DEFAULT 'My PC',
            cpu_name TEXT,
            cpu_cores INTEGER,
            cpu_threads INTEGER,
            ram_gb REAL,
            gpu_name TEXT,
            gpu_vram_gb REAL,
            os_name TEXT,
            directx_version TEXT,
            storage_free_gb REAL,
            screen_resolution TEXT,
            scanned_at TEXT NOT NULL,
            is_active INTEGER DEFAULT 0
        )",
        "CREATE TABLE IF NOT EXISTS game_requirements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER,
            external_title TEXT,
            steam_app_id INTEGER,
            source TEXT NOT NULL,
            minimum_raw TEXT,
            recommended_raw TEXT,
            min_cpu TEXT,
            min_gpu TEXT,
            min_ram_gb REAL,
            min_vram_gb REAL,
            min_storage_gb REAL,
            min_os TEXT,
            min_directx TEXT,
            rec_cpu TEXT,
            rec_gpu TEXT,
            rec_ram_gb REAL,
            rec_vram_gb REAL,
            rec_storage_gb REAL,
            rec_os TEXT,
            rec_directx TEXT,
            fetched_at TEXT NOT NULL,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
        )",
        "CREATE INDEX IF NOT EXISTS idx_game_requirements_game_id ON game_requirements(game_id)",
        "CREATE INDEX IF NOT EXISTS idx_game_requirements_steam ON game_requirements(steam_app_id)",
        "CREATE TABLE IF NOT EXISTS hardware_rankings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            component_type TEXT NOT NULL,
            name_pattern TEXT NOT NULL,
            score INTEGER NOT NULL
        )",
        "CREATE INDEX IF NOT EXISTS idx_hw_rank_type ON hardware_rankings(component_type)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_hw_rank_unique ON hardware_rankings(component_type, name_pattern)",
    ];

    for migration in perf_migrations {
        let _ = sqlx::query(migration).execute(&pool).await;
    }

    // Always insert — UNIQUE index silently skips already-present rows.
    let seed: &[(&str, &str, i32)] = &[
        // NVIDIA RTX 40-series
        ("gpu", "RTX 4090", 100),
        ("gpu", "RTX 4080 Super", 97),
        ("gpu", "RTX 4080", 96),
        ("gpu", "RTX 4070 Ti Super", 92),
        ("gpu", "RTX 4070 Ti", 90),
        ("gpu", "RTX 4070 Super", 89),
        ("gpu", "RTX 4070", 88),
        ("gpu", "RTX 4060 Ti", 82),
        ("gpu", "RTX 4060", 78),
        ("gpu", "RTX 4050", 70),
        // NVIDIA RTX 30-series
        ("gpu", "RTX 3090 Ti", 97),
        ("gpu", "RTX 3090", 95),
        ("gpu", "RTX 3080 Ti", 91),
        ("gpu", "RTX 3080", 88),
        ("gpu", "RTX 3070 Ti", 82),
        ("gpu", "RTX 3070", 80),
        ("gpu", "RTX 3060 Ti", 76),
        ("gpu", "RTX 3060", 72),
        ("gpu", "RTX 3050 Ti", 66),
        ("gpu", "RTX 3050", 65),
        // NVIDIA RTX 20-series
        ("gpu", "RTX 2080 Ti", 85),
        ("gpu", "RTX 2080 Super", 80),
        ("gpu", "RTX 2080", 78),
        ("gpu", "RTX 2070 Super", 74),
        ("gpu", "RTX 2070", 72),
        ("gpu", "RTX 2060 Super", 70),
        ("gpu", "RTX 2060", 68),
        // NVIDIA GTX 16-series
        ("gpu", "GTX 1660 Super", 57),
        ("gpu", "GTX 1660 Ti", 58),
        ("gpu", "GTX 1660", 55),
        ("gpu", "GTX 1650 Super", 50),
        ("gpu", "GTX 1650", 48),
        ("gpu", "GTX 1630", 38),
        // NVIDIA GTX 10-series
        ("gpu", "GTX 1080 Ti", 75),
        ("gpu", "GTX 1080", 70),
        ("gpu", "GTX 1070 Ti", 67),
        ("gpu", "GTX 1070", 65),
        ("gpu", "GTX 1060", 52),
        ("gpu", "GTX 1050 Ti", 45),
        ("gpu", "GTX 1050", 40),
        ("gpu", "GTX 1030", 28),
        // NVIDIA GTX 9-series
        ("gpu", "GTX 980 Ti", 68),
        ("gpu", "GTX 980", 62),
        ("gpu", "GTX 970", 55),
        ("gpu", "GTX 960", 42),
        ("gpu", "GTX 950", 38),
        // NVIDIA GTX 7-series and older
        ("gpu", "GTX 780 Ti", 45),
        ("gpu", "GTX 780", 42),
        ("gpu", "GTX 770", 32),
        ("gpu", "GTX 760", 30),
        ("gpu", "GTX 750 Ti", 28),
        ("gpu", "GTX 750", 24),
        // AMD RX 7000-series
        ("gpu", "RX 7900 XTX", 98),
        ("gpu", "RX 7900 XT", 96),
        ("gpu", "RX 7900 GRE", 93),
        ("gpu", "RX 7800 XT", 88),
        ("gpu", "RX 7700 XT", 82),
        ("gpu", "RX 7600 XT", 74),
        ("gpu", "RX 7600", 72),
        ("gpu", "RX 7500 XT", 65),
        // AMD RX 6000-series
        ("gpu", "RX 6950 XT", 92),
        ("gpu", "RX 6900 XT", 90),
        ("gpu", "RX 6800 XT", 84),
        ("gpu", "RX 6800", 82),
        ("gpu", "RX 6750 XT", 76),
        ("gpu", "RX 6700 XT", 75),
        ("gpu", "RX 6700", 74),
        ("gpu", "RX 6650 XT", 70),
        ("gpu", "RX 6600 XT", 69),
        ("gpu", "RX 6600", 68),
        ("gpu", "RX 6500 XT", 56),
        ("gpu", "RX 6400", 46),
        // AMD RX 5000-series
        ("gpu", "RX 5700 XT", 65),
        ("gpu", "RX 5700", 62),
        ("gpu", "RX 5600 XT", 58),
        ("gpu", "RX 5500 XT", 52),
        ("gpu", "RX 5500", 50),
        // AMD RX Vega
        ("gpu", "Radeon VII", 85),
        ("gpu", "Vega 64", 65),
        ("gpu", "Vega 56", 60),
        ("gpu", "RX Vega", 62),
        // AMD RX 500/400-series
        ("gpu", "RX 590", 50),
        ("gpu", "RX 580", 48),
        ("gpu", "RX 570", 46),
        ("gpu", "RX 560", 38),
        ("gpu", "RX 550", 32),
        ("gpu", "RX 480", 48),
        ("gpu", "RX 470", 44),
        ("gpu", "RX 460", 34),
        // Intel Arc
        ("gpu", "Arc A770", 68),
        ("gpu", "Arc A750", 64),
        ("gpu", "Arc A580", 58),
        ("gpu", "Arc A380", 42),
        ("gpu", "Arc A310", 32),
        // CPU families
        ("cpu", "Threadripper", 95),
        ("cpu", "EPYC", 88),
        ("cpu", "Ryzen 9", 92),
        ("cpu", "Ryzen 7", 78),
        ("cpu", "Ryzen 5", 62),
        ("cpu", "Ryzen 3", 48),
        ("cpu", "Core i9", 90),
        ("cpu", "Core i7", 75),
        ("cpu", "Core i5", 58),
        ("cpu", "Core i3", 42),
        ("cpu", "Xeon", 65),
        ("cpu", "Pentium G", 28),
        ("cpu", "Pentium", 22),
        ("cpu", "Celeron", 15),
        ("cpu", "Athlon", 28),
        ("cpu", "FX-8", 36),
        ("cpu", "FX-6", 30),
        ("cpu", "FX-4", 24),
        ("cpu", "FX-", 30),
    ];
    for (ty, pat, score) in seed {
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO hardware_rankings (component_type, name_pattern, score) VALUES (?, ?, ?)",
        )
        .bind(ty)
        .bind(pat)
        .bind(score)
        .execute(&pool)
        .await;
    }

    Ok(pool)
}
