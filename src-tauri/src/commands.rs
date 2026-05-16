use crate::api_keys;
use crate::rawg;
use crate::igdb;
use crate::media::{self, GameMediaResponse, MediaImageResponse, TrailerResponse, MediaStatsResponse};
use crate::performance::compatibility::{build_compatibility_report, RankingRow};
use crate::performance::hardware::HardwareSnapshot;
use crate::performance::parse_requirements::parse_full_requirements;
use crate::performance::steam::{fetch_steam_app_details, search_steam_store};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

static WATCHER_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Default)]
pub struct WatcherShared {
    pub paused: AtomicBool,
    pub resync: AtomicBool,
}

pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub watcher: Arc<WatcherShared>,
    pub close_to_tray: Arc<AtomicBool>,
}

#[derive(Serialize, Deserialize)]
pub struct AddGamePayload {
    pub exe_path: String,
    pub process_name: String,
    pub title: String,
    pub rawg_id: Option<i64>,
    pub igdb_id: Option<i64>,
    pub metadata_provider: Option<String>,
    pub summary: Option<String>,
    pub storyline: Option<String>,
    pub release_date: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub platforms: Option<String>,
    pub genres: Option<String>,
    pub artwork_url: Option<String>,
    pub screenshot_url: Option<String>,
    pub trailer_url: Option<String>,
    pub rating_count: Option<i32>,
    pub total_rating: Option<f32>,
    pub total_rating_count: Option<i32>,
    pub similar_games: Option<String>, // JSON string
    pub artworks: Option<String>, // JSON string
    pub screenshots: Option<String>, // JSON string
    pub videos: Option<String>, // JSON string
    pub cover_url: Option<String>,
    pub rating: Option<f32>,
    pub hltb_main_story: Option<i64>,
    pub hltb_main_extras: Option<i64>,
    pub hltb_completionist: Option<i64>,
    pub target_hours: Option<i64>,
    pub completion_status: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateGameProgressPayload {
    pub game_id: i64,
    pub hltb_main_story: Option<i64>,
    pub hltb_main_extras: Option<i64>,
    pub hltb_completionist: Option<i64>,
    pub target_hours: Option<i64>,
    pub completion_status: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_games: i64,
    pub total_playtime_seconds: i64,
    pub games_completed: i64,
    pub games_in_progress: i64,
    pub most_played_game: Option<String>,
    pub currently_running_count: i64,
}

#[derive(Serialize, Deserialize)]
pub struct TopGame {
    pub title: String,
    pub playtime_seconds: i64,
}

#[derive(Serialize, Deserialize)]
pub struct DaySession {
    pub date: String,
    pub session_count: i64,
}

#[derive(Serialize, Deserialize)]
pub struct DayPlaytime {
    pub date: String,
    pub seconds: i64,
}

#[derive(Serialize, Deserialize)]
pub struct WeekPlaytime {
    pub week_start: String,
    pub seconds: i64,
}

#[derive(Serialize, Deserialize)]
pub struct MonthPlaytime {
    pub month: String,
    pub seconds: i64,
}

#[derive(Serialize, Deserialize)]
pub struct RankedLabel {
    pub label: String,
    pub seconds: i64,
}

#[derive(Serialize, Deserialize)]
pub struct RecentGameStat {
    pub id: i64,
    pub title: String,
    pub cover_url: Option<String>,
    pub seconds: i64,
}

#[derive(Serialize, Deserialize)]
pub struct StatsData {
    pub total_playtime_seconds: i64,
    pub total_sessions: i64,
    pub average_session_minutes: i64,
    pub weekly_playtime_seconds: i64,
    pub monthly_playtime_seconds: i64,
    pub top_games: Vec<TopGame>,
    pub sessions_by_day: Vec<DaySession>,
    pub playtime_by_calendar_day: Vec<DayPlaytime>,
    pub weekly_playtime_trend: Vec<WeekPlaytime>,
    pub monthly_playtime_trend: Vec<MonthPlaytime>,
    pub top_genres: Vec<RankedLabel>,
    pub top_developers: Vec<RankedLabel>,
    pub recently_played: Vec<RecentGameStat>,
}

#[derive(Serialize, Deserialize)]
pub struct DebugProcess {
    pub pid: u32,
    pub name: String,
    pub exe_path: Option<String>,
    pub exe_filename: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct DebugSavedGame {
    pub id: i64,
    pub title: String,
    pub process_name: String,
    pub exe_path: String,
}

#[derive(Serialize, Deserialize)]
pub struct UserProfile {
    pub name: String,
    pub avatar_url: Option<String>,
    pub level: i32,
    pub xp: i32,
}

/// Drops `avatar_url` from the DB when it points at a missing local file so the UI
/// does not keep requesting dead paths via the asset protocol.
async fn normalize_stored_avatar_url(
    db: &sqlx::SqlitePool,
    avatar_url: Option<String>,
) -> Result<Option<String>, String> {
    let Some(raw) = avatar_url.filter(|s| !s.trim().is_empty()) else {
        return Ok(None);
    };
    let raw = raw.trim().to_string();
    let lower = raw.to_ascii_lowercase();
    if lower.starts_with("http://") || lower.starts_with("https://") {
        return Ok(Some(raw));
    }
    if std::path::Path::new(&raw).is_file() {
        return Ok(Some(raw));
    }
    sqlx::query("UPDATE user_profile SET avatar_url = NULL WHERE id = 1")
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(None)
}

#[tauri::command]
pub async fn get_user_profile(
    state: tauri::State<'_, AppState>,
) -> Result<UserProfile, String> {
    let row = sqlx::query_as::<_, (String, Option<String>, i32, i32)>(
        "SELECT name, avatar_url, level, xp FROM user_profile WHERE id = 1"
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let avatar_url = normalize_stored_avatar_url(&state.db, row.1).await?;

    Ok(UserProfile {
        name: row.0,
        avatar_url,
        level: row.2,
        xp: row.3,
    })
}

#[tauri::command]
pub async fn update_user_profile(
    state: tauri::State<'_, AppState>,
    name: String,
    avatar_url: Option<String>,
) -> Result<(), String> {
    sqlx::query("UPDATE user_profile SET name = ?, avatar_url = ? WHERE id = 1")
        .bind(name)
        .bind(avatar_url)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeysSettings {
    /// Value stored in the database (environment variables are not shown here).
    pub igdb_client_id: String,
    pub igdb_client_secret_saved: bool,
    pub rawg_api_key_saved: bool,
    pub steamgriddb_api_key_saved: bool,
    /// Effective configuration (env or DB) for quick status in the UI.
    pub igdb_ready: bool,
    pub rawg_ready: bool,
    pub steamgriddb_ready: bool,
    /// True when the corresponding env var is set (values are not echoed into the form).
    pub igdb_client_id_from_environment: bool,
    pub igdb_client_secret_from_environment: bool,
    pub rawg_api_key_from_environment: bool,
    pub steamgriddb_api_key_from_environment: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveApiKeysPayload {
    pub igdb_client_id: String,
    /// New secret; empty string means leave unchanged unless `clear_igdb_client_secret` is true.
    pub igdb_client_secret: String,
    #[serde(default)]
    pub clear_igdb_client_secret: bool,
    pub rawg_api_key: String,
    pub steamgriddb_api_key: String,
    #[serde(default)]
    pub remove_rawg_api_key: bool,
    #[serde(default)]
    pub remove_steamgriddb_api_key: bool,
}

#[tauri::command]
pub async fn get_api_keys_settings(state: tauri::State<'_, AppState>) -> Result<ApiKeysSettings, String> {
    let id = api_keys::read_secret_db(&state.db, api_keys::K_IGDB_CLIENT_ID)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let igdb_secret_saved = api_keys::read_secret_db(&state.db, api_keys::K_IGDB_CLIENT_SECRET)
        .await
        .map_err(|e| e.to_string())?
        .filter(|s| !s.trim().is_empty())
        .is_some();
    let rawg_saved = api_keys::read_secret_db(&state.db, api_keys::K_RAWG_API_KEY)
        .await
        .map_err(|e| e.to_string())?
        .filter(|s| !s.trim().is_empty())
        .is_some();
    let sgdb_saved = api_keys::read_secret_db(&state.db, api_keys::K_STEAMGRIDDB_API_KEY)
        .await
        .map_err(|e| e.to_string())?
        .filter(|s| !s.trim().is_empty())
        .is_some();

    let env_nonempty = |k: &str| {
        std::env::var(k)
            .ok()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
    };

    Ok(ApiKeysSettings {
        igdb_client_id: id,
        igdb_client_secret_saved: igdb_secret_saved,
        rawg_api_key_saved: rawg_saved,
        steamgriddb_api_key_saved: sgdb_saved,
        igdb_ready: api_keys::igdb_ready(),
        rawg_ready: api_keys::rawg_api_key().is_some(),
        steamgriddb_ready: api_keys::steamgriddb_api_key().is_some(),
        igdb_client_id_from_environment: env_nonempty("IGDB_CLIENT_ID"),
        igdb_client_secret_from_environment: env_nonempty("IGDB_CLIENT_SECRET"),
        rawg_api_key_from_environment: env_nonempty("RAWG_API_KEY"),
        steamgriddb_api_key_from_environment: env_nonempty("STEAMGRIDDB_API_KEY"),
    })
}

#[tauri::command]
pub async fn save_api_keys_settings(
    state: tauri::State<'_, AppState>,
    payload: SaveApiKeysPayload,
) -> Result<(), String> {
    let pool = &state.db;

    let id = payload.igdb_client_id.trim();
    if id.is_empty() {
        api_keys::delete_secret(pool, api_keys::K_IGDB_CLIENT_ID)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        api_keys::upsert_secret(pool, api_keys::K_IGDB_CLIENT_ID, id)
            .await
            .map_err(|e| e.to_string())?;
    }

    if payload.clear_igdb_client_secret {
        api_keys::delete_secret(pool, api_keys::K_IGDB_CLIENT_SECRET)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        let s = payload.igdb_client_secret.trim();
        if !s.is_empty() {
            api_keys::upsert_secret(pool, api_keys::K_IGDB_CLIENT_SECRET, s)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    if payload.remove_rawg_api_key {
        api_keys::delete_secret(pool, api_keys::K_RAWG_API_KEY)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        let rawg = payload.rawg_api_key.trim();
        if !rawg.is_empty() {
            api_keys::upsert_secret(pool, api_keys::K_RAWG_API_KEY, rawg)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    if payload.remove_steamgriddb_api_key {
        api_keys::delete_secret(pool, api_keys::K_STEAMGRIDDB_API_KEY)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        let sgdb = payload.steamgriddb_api_key.trim();
        if !sgdb.is_empty() {
            api_keys::upsert_secret(pool, api_keys::K_STEAMGRIDDB_API_KEY, sgdb)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    api_keys::refresh_from_db(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub icon: Option<String>,
    pub is_pinned: bool,
    pub game_count: i64,
}

#[tauri::command]
pub async fn list_playlists(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Playlist>, String> {
    let rows = sqlx::query_as::<_, (i64, String, Option<String>, bool, i64)>(
        "SELECT p.id, p.name, p.icon, p.is_pinned, COUNT(pg.game_id) as game_count 
         FROM playlists p 
         LEFT JOIN playlist_games pg ON p.id = pg.playlist_id 
         GROUP BY p.id"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| Playlist {
        id: r.0,
        name: r.1,
        icon: r.2,
        is_pinned: r.3,
        game_count: r.4,
    }).collect())
}

#[tauri::command]
pub async fn toggle_playlist_pin(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    sqlx::query("UPDATE playlists SET is_pinned = NOT is_pinned WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn toggle_game_pin(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    sqlx::query("UPDATE games SET is_pinned = NOT is_pinned WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_pinned_games(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<(i64, String, Option<String>)>, String> {
    let rows = sqlx::query_as::<_, (i64, String, Option<String>)>(
        "SELECT id, title, cover_url FROM games WHERE is_pinned = 1 ORDER BY title ASC"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub async fn update_game_media(
    state: tauri::State<'_, AppState>,
    id: i64,
    cover_url: Option<String>,
    artwork_url: Option<String>,
    screenshot_url: Option<String>,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    if let Some(cover) = cover_url {
        sqlx::query("UPDATE games SET cover_url = ?, updated_at = ? WHERE id = ?")
            .bind(cover)
            .bind(&now)
            .bind(id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(artwork) = artwork_url {
        sqlx::query("UPDATE games SET artwork_url = ?, updated_at = ? WHERE id = ?")
            .bind(artwork)
            .bind(&now)
            .bind(id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(screenshot) = screenshot_url {
        sqlx::query("UPDATE games SET screenshot_url = ?, updated_at = ? WHERE id = ?")
            .bind(screenshot)
            .bind(&now)
            .bind(id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn update_game_status(
    state: tauri::State<'_, AppState>,
    id: i64,
    status: String,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query("UPDATE games SET completion_status = ?, updated_at = ? WHERE id = ?")
        .bind(status)
        .bind(&now)
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn create_playlist(
    state: tauri::State<'_, AppState>,
    name: String,
    icon: Option<String>,
) -> Result<(), String> {
    sqlx::query("INSERT INTO playlists (name, icon, created_at) VALUES (?, ?, datetime('now'))")
        .bind(name)
        .bind(icon)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_playlist(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    sqlx::query("DELETE FROM playlists WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn debug_processes() -> Result<Vec<DebugProcess>, String> {
    use sysinfo::System;
    let mut system = System::new();
    system.refresh_processes();

    let mut list = Vec::new();
    for (pid, process) in system.processes() {
        list.push(DebugProcess {
            pid: pid.as_u32(),
            name: process.name().to_string(),
            exe_path: process.exe().map(|p| p.to_string_lossy().to_string()),
            exe_filename: process.exe().and_then(|p| p.file_name()).map(|n| n.to_string_lossy().to_lowercase()),
        });
    }
    Ok(list)
}

#[tauri::command]
pub async fn debug_saved_games(
    state: tauri::State<'_, AppState>
) -> Result<Vec<DebugSavedGame>, String> {
    let rows = sqlx::query_as::<_, (i64, String, String, String)>(
        "SELECT id, title, process_name, exe_path FROM games"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| DebugSavedGame {
        id: r.0,
        title: r.1,
        process_name: r.2,
        exe_path: r.3,
    }).collect())
}

#[tauri::command]
pub async fn delete_game(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    sqlx::query("DELETE FROM games WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn search_rawg_games(query: String) -> Result<Vec<rawg::RawgGame>, String> {
    rawg::search_rawg(&query).await
}

#[tauri::command]
pub async fn search_igdb_games(query: String) -> Result<Vec<igdb::IgdbGameMetadata>, String> {
    igdb::search_igdb_games(&query).await
}

#[tauri::command]
pub async fn add_game(
    state: tauri::State<'_, AppState>,
    payload: AddGamePayload,
) -> Result<i64, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let status = payload.completion_status.unwrap_or_else(|| "not_started".to_string());

    let result = sqlx::query(
        "INSERT INTO games (
            title, exe_path, process_name, rawg_id, igdb_id, metadata_provider, 
            summary, storyline, release_date, developer, publisher, platforms, genres,
            artwork_url, screenshot_url, trailer_url, rating_count, total_rating, total_rating_count, similar_games,
            artworks, screenshots, videos,
            cover_url, rating,
            hltb_main_story, hltb_main_extras, hltb_completionist, target_hours, completion_status,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&payload.title)
    .bind(&payload.exe_path)
    .bind(extract_process_name(&payload.exe_path))
    .bind(payload.rawg_id)
    .bind(payload.igdb_id)
    .bind(payload.metadata_provider)
    .bind(payload.summary)
    .bind(payload.storyline)
    .bind(payload.release_date)
    .bind(payload.developer)
    .bind(payload.publisher)
    .bind(payload.platforms)
    .bind(payload.genres)
    .bind(payload.artwork_url)
    .bind(payload.screenshot_url)
    .bind(payload.trailer_url)
    .bind(payload.rating_count)
    .bind(payload.total_rating)
    .bind(payload.total_rating_count)
    .bind(payload.similar_games)
    .bind(payload.artworks)
    .bind(payload.screenshots)
    .bind(payload.videos)
    .bind(&payload.cover_url)
    .bind(payload.rating)
    .bind(payload.hltb_main_story)
    .bind(payload.hltb_main_extras)
    .bind(payload.hltb_completionist)
    .bind(payload.target_hours)
    .bind(&status)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await;

    match result {
        Ok(res) => Ok(res.last_insert_rowid()),
        Err(e) => {
            // Fallback for missing columns igdb_id or metadata_provider
            sqlx::query(
                "INSERT INTO games (
                    title, exe_path, process_name, rawg_id, cover_url, rating,
                    hltb_main_story, hltb_main_extras, hltb_completionist, target_hours, completion_status,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&payload.title)
            .bind(&payload.exe_path)
            .bind(extract_process_name(&payload.exe_path))
            .bind(payload.rawg_id)
            .bind(&payload.cover_url)
            .bind(payload.rating)
            .bind(payload.hltb_main_story)
            .bind(payload.hltb_main_extras)
            .bind(payload.hltb_completionist)
            .bind(payload.target_hours)
            .bind(&status)
            .bind(&now)
            .bind(&now)
            .execute(&state.db)
            .await
            .map(|res| res.last_insert_rowid())
            .map_err(|e2| format!("Failed to add game: {} (Fallback failed: {})", e, e2))
        }
    }
}

#[tauri::command]
pub async fn update_game_progress(
    state: tauri::State<'_, AppState>,
    payload: UpdateGameProgressPayload,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE games SET 
            hltb_main_story = ?, 
            hltb_main_extras = ?, 
            hltb_completionist = ?, 
            target_hours = ?, 
            completion_status = ?,
            updated_at = ?
         WHERE id = ?"
    )
    .bind(payload.hltb_main_story)
    .bind(payload.hltb_main_extras)
    .bind(payload.hltb_completionist)
    .bind(payload.target_hours)
    .bind(payload.completion_status)
    .bind(&now)
    .bind(payload.game_id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_game_full(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<serde_json::Value, String> {
    let row = sqlx::query(
        "SELECT
            g.*,
            COALESCE(g.total_playtime_seconds, 0) + COALESCE(SUM(ps.duration_seconds), 0) as total_time,
            COALESCE(g.last_played_at, MAX(ps.started_at)) as last_played_at
         FROM games g
         LEFT JOIN play_sessions ps ON ps.process_name = g.process_name
         WHERE g.id = ?
         GROUP BY g.id",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    #[derive(Serialize)]
    struct FullGame {
        id: i64,
        title: String,
        exe_path: String,
        process_name: String,
        rawg_id: Option<i64>,
        igdb_id: Option<i64>,
        metadata_provider: Option<String>,
        summary: Option<String>,
        storyline: Option<String>,
        release_date: Option<String>,
        developer: Option<String>,
        publisher: Option<String>,
        platforms: Option<String>,
        genres: Option<String>,
        artwork_url: Option<String>,
        screenshot_url: Option<String>,
        trailer_url: Option<String>,
        total_rating_count: Option<i32>,
        similar_games: Option<String>,
        rating_count: Option<i32>,
        total_rating: Option<f32>,
        cover_url: Option<String>,
        rating: Option<f32>,
        total_time: i64,
        hltb_main_story: Option<i64>,
        hltb_main_extras: Option<i64>,
        hltb_completionist: Option<i64>,
        target_hours: Option<i64>,
        completion_status: String,
        notes: Option<String>,
        artworks: Option<String>,
        screenshots: Option<String>,
        videos: Option<String>,
        last_played: Option<String>,
        is_pinned: bool,
        process_name_aliases: Option<String>,
        steam_app_id: Option<i64>,
    }

    use sqlx::Row;
    let game = FullGame {
        id: row.get("id"),
        title: row.get("title"),
        exe_path: row.get("exe_path"),
        process_name: row.get("process_name"),
        rawg_id: row.try_get("rawg_id").ok(),
        igdb_id: row.try_get("igdb_id").ok(),
        steam_app_id: row.try_get("steam_app_id").ok(),
        metadata_provider: row.try_get("metadata_provider").ok(),
        summary: row.try_get("summary").ok(),
        release_date: row.try_get("release_date").ok(),
        developer: row.try_get("developer").ok(),
        publisher: row.try_get("publisher").ok(),
        platforms: row.try_get("platforms").ok(),
        genres: row.try_get("genres").ok(),
        artwork_url: row.try_get("artwork_url").ok(),
        screenshot_url: row.try_get("screenshot_url").ok(),
        trailer_url: row.try_get("trailer_url").ok(),
        total_rating_count: row.try_get("total_rating_count").ok(),
        similar_games: row.try_get("similar_games").ok(),
        storyline: row.try_get("storyline").ok(),
        rating_count: row.try_get("rating_count").ok(),
        total_rating: row.try_get("total_rating").ok(),
        cover_url: row.try_get("cover_url").ok(),
        rating: row.try_get("rating").ok(),
        total_time: row.get("total_time"),
        hltb_main_story: row.try_get("hltb_main_story").ok(),
        hltb_main_extras: row.try_get("hltb_main_extras").ok(),
        hltb_completionist: row.try_get("hltb_completionist").ok(),
        target_hours: row.try_get("target_hours").ok(),
        completion_status: row.try_get("completion_status").unwrap_or_else(|_| "not_started".to_string()),
        notes: row.try_get("notes").ok(),
        artworks: row.try_get("artworks").ok(),
        screenshots: row.try_get("screenshots").ok(),
        videos: row.try_get("videos").ok(),
        last_played: row.try_get("last_played_at").ok(),
        is_pinned: row.try_get::<i64, _>("is_pinned").unwrap_or(0) != 0,
        process_name_aliases: row.try_get("process_name_aliases").ok(),
    };

    Ok(serde_json::to_value(game).unwrap())
}

#[tauri::command]
pub async fn get_game_sessions(
    state: tauri::State<'_, AppState>,
    process_name: String,
) -> Result<Vec<(String, i64)>, String> {
    let rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT started_at, duration_seconds 
         FROM play_sessions 
         WHERE process_name = ? AND ended_at IS NOT NULL 
         ORDER BY started_at DESC LIMIT 40"
    )
    .bind(process_name)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_dashboard_stats(
    state: tauri::State<'_, AppState>,
) -> Result<DashboardStats, String> {
    let total_games: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM games")
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let total_playtime: (Option<i64>,) = sqlx::query_as(
        "SELECT COALESCE(SUM(t.total_time), 0) FROM (
            SELECT COALESCE(g.total_playtime_seconds, 0) + COALESCE(SUM(ps.duration_seconds), 0) AS total_time
            FROM games g
            LEFT JOIN play_sessions ps ON ps.process_name = g.process_name
            GROUP BY g.id
        ) t"
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let completed: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM games WHERE completion_status = 'completed'")
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let in_progress: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM games WHERE completion_status = 'in_progress'")
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let most_played: (Option<String>,) = sqlx::query_as(
        "SELECT g.title FROM games g
         LEFT JOIN play_sessions ps ON ps.process_name = g.process_name
         GROUP BY g.id
         ORDER BY (COALESCE(g.total_playtime_seconds, 0) + COALESCE(SUM(ps.duration_seconds), 0)) DESC
         LIMIT 1"
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let running_count = detect_running_games_from_db(&state.db).await?.len() as i64;

    Ok(DashboardStats {
        total_games: total_games.0,
        total_playtime_seconds: total_playtime.0.unwrap_or(0),
        games_completed: completed.0,
        games_in_progress: in_progress.0,
        most_played_game: most_played.0,
        currently_running_count: running_count,
    })
}

#[tauri::command]
pub async fn verify_exe_path(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).exists())
}

#[tauri::command]
pub fn launch_game(exe_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&exe_path);
    if !path.is_file() {
        return Err("Executable not found or path is not a file".into());
    }
    let workdir = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or_else(|| std::path::Path::new("."));

    #[cfg(windows)]
    {
        match std::process::Command::new(path)
            .current_dir(workdir)
            .spawn()
        {
            Ok(_) => {}
            Err(e) => {
                let need_shell = e.raw_os_error() == Some(740)
                    || e
                        .to_string()
                        .to_lowercase()
                        .contains("elevation")
                    || e.to_string().contains("740");
                if !need_shell {
                    return Err(format!("Failed to start process: {}", e));
                }
                // ERROR_ELEVATION_REQUIRED (740): many game launchers use ShellExecute.
                // `cmd /C start "" /D <cwd> <exe>` matches Explorer-style launch and prompts UAC when required.
                std::process::Command::new("cmd.exe")
                    .arg("/C")
                    .arg("start")
                    .arg("")
                    .arg("/D")
                    .arg(workdir.as_os_str())
                    .arg(path.as_os_str())
                    .spawn()
                    .map_err(|e2| format!("Failed to start process (shell fallback): {}", e2))?;
            }
        }
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new(path)
            .current_dir(workdir)
            .spawn()
            .map_err(|e| format!("Failed to start process: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_game_id_by_igdb(
    state: tauri::State<'_, AppState>,
    igdb_id: i64,
) -> Result<Option<i64>, String> {
    let row = sqlx::query_as::<_, (i64,)>(
        "SELECT id FROM games WHERE igdb_id = ? LIMIT 1",
    )
    .bind(igdb_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(row.map(|r| r.0))
}

fn profile_storage_dir() -> Result<std::path::PathBuf, String> {
    #[cfg(windows)]
    let base = std::env::var("APPDATA").map_err(|_| "APPDATA not set".to_string())?;
    #[cfg(not(windows))]
    let base = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    let dir = {
        #[cfg(windows)]
        {
            std::path::PathBuf::from(base).join("PitGames").join("profile")
        }
        #[cfg(not(windows))]
        {
            std::path::PathBuf::from(base).join(".local").join("share").join("PitGames").join("profile")
        }
    };
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn import_profile_avatar(source_path: String) -> Result<String, String> {
    let src = std::path::Path::new(&source_path);
    if !src.is_file() {
        return Err("Source image is not a file".into());
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let dir = profile_storage_dir()?;
    let name = format!(
        "avatar_{}.{}",
        chrono::Utc::now().timestamp_millis(),
        ext
    );
    let dest = dir.join(name);
    std::fs::copy(src, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

/// Save a PNG avatar written from the client (e.g. after crop) into app profile storage.
#[tauri::command]
pub fn save_profile_avatar_png(bytes: Vec<u8>) -> Result<String, String> {
    if bytes.len() < 32 || bytes.len() > 6_000_000 {
        return Err("Invalid avatar image size".into());
    }
    if !bytes.starts_with(&[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) {
        return Err("Avatar must be PNG".into());
    }
    let dir = profile_storage_dir()?;
    let name = format!("avatar_{}.png", chrono::Utc::now().timestamp_millis());
    let dest = dir.join(&name);
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn delete_games_bulk(
    state: tauri::State<'_, AppState>,
    ids: Vec<i64>,
) -> Result<(), String> {
    for id in ids {
        sqlx::query("DELETE FROM games WHERE id = ?")
            .bind(id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn export_games_snapshot(
    state: tauri::State<'_, AppState>,
    ids: Vec<i64>,
) -> Result<String, String> {
    #[derive(serde::Serialize)]
    struct RowOut {
        id: i64,
        title: String,
        exe_path: String,
        process_name: String,
        igdb_id: Option<i64>,
        total_playtime_seconds: i64,
        completion_status: String,
        last_played_at: Option<String>,
        genres: Option<String>,
        developer: Option<String>,
    }

    let mut rows: Vec<RowOut> = Vec::new();
    for id in ids {
        let r = sqlx::query_as::<_, (i64, String, String, String, Option<i64>, i64, String, Option<String>, Option<String>, Option<String>)>(
            "SELECT id, title, exe_path, process_name, igdb_id, total_playtime_seconds, completion_status, last_played_at, genres, developer FROM games WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;
        if let Some(t) = r {
            rows.push(RowOut {
                id: t.0,
                title: t.1,
                exe_path: t.2,
                process_name: t.3,
                igdb_id: t.4,
                total_playtime_seconds: t.5,
                completion_status: t.6,
                last_played_at: t.7,
                genres: t.8,
                developer: t.9,
            });
        }
    }
    serde_json::to_string_pretty(&rows).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_game_tracking(
    state: tauri::State<'_, AppState>,
    game_id: i64,
    exe_path: String,
    process_name: String,
    process_name_aliases: Option<String>,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let pn = process_name.trim().to_lowercase();
    let aliases_db: Option<String> = process_name_aliases
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    sqlx::query(
        "UPDATE games SET 
            exe_path = ?, 
            process_name = ?, 
            process_name_aliases = ?,
            updated_at = ?
         WHERE id = ?"
    )
    .bind(exe_path)
    .bind(pn)
    .bind(aliases_db)
    .bind(&now)
    .bind(game_id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_stats_data(
    state: tauri::State<'_, AppState>,
) -> Result<StatsData, String> {
    let total_playtime: (Option<i64>,) = sqlx::query_as(
        "SELECT COALESCE(SUM(t.total_time), 0) FROM (
            SELECT COALESCE(g.total_playtime_seconds, 0) + COALESCE(SUM(ps.duration_seconds), 0) AS total_time
            FROM games g
            LEFT JOIN play_sessions ps ON ps.process_name = g.process_name
            GROUP BY g.id
        ) t",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let total_sessions: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM play_sessions WHERE ended_at IS NOT NULL",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let avg_session_sec: (Option<i64>,) = sqlx::query_as(
        "SELECT CAST(AVG(duration_seconds) AS INTEGER) FROM play_sessions WHERE ended_at IS NOT NULL AND duration_seconds > 0",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let weekly_playtime: (Option<i64>,) = sqlx::query_as(
        "SELECT SUM(duration_seconds) FROM play_sessions WHERE started_at > datetime('now', '-7 days')",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let monthly_playtime: (Option<i64>,) = sqlx::query_as(
        "SELECT SUM(duration_seconds) FROM play_sessions WHERE started_at > datetime('now', '-30 days')",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let top_games_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT g.title, COALESCE(g.total_playtime_seconds, 0) + COALESCE(SUM(ps.duration_seconds), 0) AS pt
         FROM games g
         LEFT JOIN play_sessions ps ON ps.process_name = g.process_name
         GROUP BY g.id
         ORDER BY pt DESC
         LIMIT 10",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let top_games = top_games_rows
        .into_iter()
        .map(|r| TopGame {
            title: r.0,
            playtime_seconds: r.1,
        })
        .collect();

    let sessions_by_day_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT strftime('%Y-%m-%d', started_at) AS date, COUNT(*)
         FROM play_sessions
         WHERE started_at > datetime('now', '-7 days')
         GROUP BY date ORDER BY date ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let mut sessions_map: std::collections::HashMap<String, i64> = sessions_by_day_rows
        .into_iter()
        .map(|r| (r.0, r.1))
        .collect();

    let mut sessions_by_day: Vec<DaySession> = Vec::new();
    for i in (0..7).rev() {
        let day = chrono::Utc::now() - chrono::Duration::days(i);
        let key = day.format("%Y-%m-%d").to_string();
        let count = sessions_map.remove(&key).unwrap_or(0);
        sessions_by_day.push(DaySession {
            date: key,
            session_count: count,
        });
    }

    let playtime_day_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT date(started_at) AS d, SUM(duration_seconds)
         FROM play_sessions
         WHERE started_at > datetime('now', '-370 days') AND ended_at IS NOT NULL
         GROUP BY d ORDER BY d ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let playtime_by_calendar_day: Vec<DayPlaytime> = playtime_day_rows
        .into_iter()
        .map(|r| DayPlaytime {
            date: r.0,
            seconds: r.1,
        })
        .collect();

    let weekly_trend_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT strftime('%Y-W%W', started_at) AS w, SUM(duration_seconds)
         FROM play_sessions
         WHERE started_at > datetime('now', '-70 days') AND ended_at IS NOT NULL
         GROUP BY w ORDER BY w ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let weekly_playtime_trend: Vec<WeekPlaytime> = weekly_trend_rows
        .into_iter()
        .rev()
        .take(8)
        .rev()
        .map(|r| WeekPlaytime {
            week_start: r.0,
            seconds: r.1,
        })
        .collect();

    let monthly_trend_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT strftime('%Y-%m', started_at) AS m, SUM(duration_seconds)
         FROM play_sessions
         WHERE started_at > datetime('now', '-200 days') AND ended_at IS NOT NULL
         GROUP BY m ORDER BY m ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let monthly_playtime_trend: Vec<MonthPlaytime> = monthly_trend_rows
        .into_iter()
        .rev()
        .take(6)
        .rev()
        .map(|r| MonthPlaytime {
            month: r.0,
            seconds: r.1,
        })
        .collect();

    let genre_rows = sqlx::query_as::<_, (Option<String>, i64)>(
        "SELECT g.genres, COALESCE(g.total_playtime_seconds, 0) + COALESCE(SUM(ps.duration_seconds), 0) AS pt
         FROM games g
         LEFT JOIN play_sessions ps ON ps.process_name = g.process_name
         GROUP BY g.id",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let mut genre_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for (genres, sec) in genre_rows {
        if let Some(g) = genres {
            for part in g.split(',') {
                let label = part.trim();
                if label.is_empty() {
                    continue;
                }
                *genre_map.entry(label.to_string()).or_insert(0) += sec;
            }
        }
    }
    let mut top_genres: Vec<RankedLabel> = genre_map
        .into_iter()
        .map(|(label, seconds)| RankedLabel { label, seconds })
        .collect();
    top_genres.sort_by(|a, b| b.seconds.cmp(&a.seconds));
    top_genres.truncate(8);

    let dev_rows = sqlx::query_as::<_, (Option<String>, i64)>(
        "SELECT g.developer, COALESCE(g.total_playtime_seconds, 0) + COALESCE(SUM(ps.duration_seconds), 0) AS pt
         FROM games g
         LEFT JOIN play_sessions ps ON ps.process_name = g.process_name
         GROUP BY g.id",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let mut dev_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for (dev, sec) in dev_rows {
        if let Some(d) = dev {
            let label = d.trim();
            if label.is_empty() {
                continue;
            }
            *dev_map.entry(label.to_string()).or_insert(0) += sec;
        }
    }
    let mut top_developers: Vec<RankedLabel> = dev_map
        .into_iter()
        .map(|(label, seconds)| RankedLabel { label, seconds })
        .collect();
    top_developers.sort_by(|a, b| b.seconds.cmp(&a.seconds));
    top_developers.truncate(8);

    let recent_rows = sqlx::query_as::<_, (i64, String, Option<String>, i64)>(
        "SELECT g.id, g.title, g.cover_url,
            COALESCE(g.total_playtime_seconds, 0) + COALESCE(SUM(ps.duration_seconds), 0) AS pt
         FROM games g
         LEFT JOIN play_sessions ps ON ps.process_name = g.process_name
         WHERE g.last_played_at IS NOT NULL
         GROUP BY g.id
         ORDER BY datetime(g.last_played_at) DESC
         LIMIT 8",
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let recently_played: Vec<RecentGameStat> = if recent_rows.is_empty() {
        let fallback = sqlx::query_as::<_, (i64, String, Option<String>, i64)>(
            "SELECT g.id, g.title, g.cover_url,
                COALESCE(g.total_playtime_seconds, 0) + COALESCE(SUM(ps.duration_seconds), 0) AS pt
             FROM games g
             LEFT JOIN play_sessions ps ON ps.process_name = g.process_name
             GROUP BY g.id
             ORDER BY pt DESC
             LIMIT 8",
        )
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
        fallback
            .into_iter()
            .map(|r| RecentGameStat {
                id: r.0,
                title: r.1,
                cover_url: r.2,
                seconds: r.3,
            })
            .collect()
    } else {
        recent_rows
            .into_iter()
            .map(|r| RecentGameStat {
                id: r.0,
                title: r.1,
                cover_url: r.2,
                seconds: r.3,
            })
            .collect()
    };

    let total_sec = total_playtime.0.unwrap_or(0);
    let avg_min = avg_session_sec.0.map(|v| v / 60).unwrap_or(0);

    Ok(StatsData {
        total_playtime_seconds: total_sec,
        total_sessions: total_sessions.0,
        average_session_minutes: avg_min,
        weekly_playtime_seconds: weekly_playtime.0.unwrap_or(0),
        monthly_playtime_seconds: monthly_playtime.0.unwrap_or(0),
        top_games,
        sessions_by_day,
        playtime_by_calendar_day,
        weekly_playtime_trend,
        monthly_playtime_trend,
        top_genres,
        top_developers,
        recently_played,
    })
}

#[tauri::command]
pub async fn list_games_with_time_full(
    state: tauri::State<'_, AppState>
) -> Result<Vec<(i64, String, Option<String>, Option<f32>, i64, String, Option<i64>, Option<i64>, Option<i64>, Option<i64>, String)>, String> {
    let rows = sqlx::query_as::<_, (i64, String, Option<String>, Option<f32>, i64, String, Option<i64>, Option<i64>, Option<i64>, Option<i64>, String)>(
        "SELECT
            g.id,
            g.title,
            g.cover_url,
            g.rating,
            COALESCE(g.total_playtime_seconds, 0) + COALESCE(SUM(ps.duration_seconds), 0) as total_time,
            g.process_name,
            g.hltb_main_story,
            g.hltb_main_extras,
            g.hltb_completionist,
            g.target_hours,
            g.completion_status
         FROM games g
         LEFT JOIN play_sessions ps ON ps.process_name = g.process_name
         GROUP BY g.id
         ORDER BY g.id DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub async fn list_games(
    state: tauri::State<'_, AppState>
) -> Result<Vec<(i64, String, Option<String>, Option<f32>)>, String> {
    let rows = sqlx::query_as::<_, (i64, String, Option<String>, Option<f32>)>(
        "SELECT id, title, cover_url, rating FROM games ORDER BY id DESC"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub async fn list_games_with_time(
    state: tauri::State<'_, AppState>
) -> Result<
    Vec<(
        i64,
        String,
        Option<String>,
        Option<f32>,
        i64,
        String,
        Option<String>,
        Option<String>,
        Option<i64>,
        Option<String>,
    )>,
    String,
> {
    let rows = sqlx::query_as::<
        _,
        (
            i64,
            String,
            Option<String>,
            Option<f32>,
            i64,
            String,
            Option<String>,
            Option<String>,
            Option<i64>,
            Option<String>,
        ),
    >(
        "SELECT
            g.id,
            g.title,
            g.cover_url,
            g.rating,
            COALESCE(g.total_playtime_seconds, 0) + COALESCE(SUM(ps.duration_seconds), 0) as total_time,
            g.process_name,
            g.artwork_url,
            g.screenshot_url,
            g.target_hours,
            g.last_played_at
         FROM games g
         LEFT JOIN play_sessions ps ON ps.process_name = g.process_name
         GROUP BY g.id
         ORDER BY datetime(COALESCE(g.last_played_at, '1970-01-01T00:00:00Z')) DESC,
                  g.id DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub async fn pick_image(
    app: tauri::AppHandle
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();

    app.dialog()
        .file()
        .add_filter("Images", &["jpg", "jpeg", "png", "webp"])
        .pick_file(move |file| {
            let _ = tx.send(file);
        });

    let file = rx.recv().map_err(|e| e.to_string())?;

    match file {
        Some(path) => Ok(path.to_string()),
        None => Err("No file selected".into()),
    }
}

/// Read a local image file as a data URL so the webview canvas is not tainted (unlike `convertFileSrc` asset URLs).
#[tauri::command]
pub fn read_local_image_as_data_url(path: String) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    if !p.is_file() {
        return Err("Path is not a file".into());
    }
    let len = std::fs::metadata(p).map_err(|e| e.to_string())?.len();
    if len > 12_000_000 {
        return Err("Image exceeds 12MB limit".into());
    }
    let bytes = std::fs::read(p).map_err(|e| e.to_string())?;
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_else(|| "png".into());
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "png" => "image/png",
        "gif" => "image/gif",
        _ => "image/png",
    };
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
pub async fn pick_exe(
    app: tauri::AppHandle
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();

    app.dialog()
        .file()
        .add_filter("Executable", &["exe"])
        .pick_file(move |file| {
            let _ = tx.send(file);
        });

    let file = rx.recv().map_err(|e| e.to_string())?;

    match file {
        Some(path) => Ok(path.to_string()),
        None => Err("No file selected".into()),
    }
}

fn extract_process_name(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .unwrap()
        .to_string_lossy()
        .to_lowercase()
}

/// Map a process key (lowercase exe / sysinfo name) to the canonical `games.process_name` used in `play_sessions`.
fn register_proc_match(map: &mut std::collections::HashMap<String, String>, key: &str, canonical: &str) {
    let k = key.trim().to_lowercase();
    if k.is_empty() {
        return;
    }
    let c = canonical.trim().to_lowercase();
    map.insert(k.clone(), c.clone());
    if let Some(base) = k.strip_suffix(".exe") {
        if !base.is_empty() {
            map.insert(base.to_string(), c.clone());
        }
    }
}

#[tauri::command]
pub async fn detect_running_games(
    state: tauri::State<'_, AppState>
) -> Result<Vec<String>, String> {
    detect_running_games_from_db(&state.db).await
}

#[tauri::command]
pub async fn get_running_sessions(
    state: tauri::State<'_, AppState>
) -> Result<Vec<(String, String)>, String> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT process_name, started_at FROM play_sessions WHERE ended_at IS NULL"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

async fn detect_running_games_from_db(
    db: &sqlx::SqlitePool
) -> Result<Vec<String>, String> {
    use std::collections::{HashMap, HashSet};
    use sysinfo::System;

    let rows = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT process_name, process_name_aliases FROM games",
    )
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    let mut proc_to_canonical: HashMap<String, String> = HashMap::new();
    for (canonical_raw, aliases_json) in rows {
        let canonical = canonical_raw.trim().to_lowercase();
        if canonical.is_empty() {
            continue;
        }
        register_proc_match(&mut proc_to_canonical, &canonical, &canonical);
        if let Some(raw) = aliases_json {
            if let Ok(arr) = serde_json::from_str::<Vec<String>>(&raw) {
                for a in arr {
                    register_proc_match(&mut proc_to_canonical, &a, &canonical);
                }
            }
        }
    }

    let mut system = System::new();
    system.refresh_processes();

    let mut active: HashSet<String> = HashSet::new();
    for process in system.processes().values() {
        let name = process.name().to_lowercase();
        let exe_name = process
            .exe()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().to_lowercase());
        if let Some(canon) = proc_to_canonical
            .get(&name)
            .cloned()
            .or_else(|| exe_name.as_ref().and_then(|e| proc_to_canonical.get(e).cloned()))
        {
            active.insert(canon);
        }
    }

    Ok(active.into_iter().collect())
}

#[tauri::command]
pub async fn start_watcher(state: tauri::State<'_, AppState>) -> Result<(), String> {
    start_watcher_internal(state.db.clone(), state.watcher.clone()).await
}

pub async fn start_watcher_internal(
    db: sqlx::SqlitePool,
    watcher: Arc<WatcherShared>,
) -> Result<(), String> {
    use std::collections::HashSet;

    if WATCHER_RUNNING
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(());
    }

    let now = chrono::Utc::now();
    let now_str = now.to_rfc3339();

    sqlx::query(
        "UPDATE play_sessions
         SET ended_at = ?,
             duration_seconds = MAX(strftime('%s', ?) - strftime('%s', started_at), 0)
         WHERE ended_at IS NULL",
    )
    .bind(&now_str)
    .bind(&now_str)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    tokio::spawn(async move {
        let mut previous: HashSet<String> = HashSet::new();

        loop {
            if watcher.resync.swap(false, Ordering::SeqCst) {
                if let Ok(running) = detect_running_games_from_db(&db).await {
                    previous = running.into_iter().collect();
                }
            }

            if watcher.paused.load(Ordering::SeqCst) {
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                continue;
            }

            if let Ok(running) = detect_running_games_from_db(&db).await {
                let current: HashSet<String> = running.into_iter().collect();

                let started: Vec<String> = current.difference(&previous).cloned().collect();
                let ended: Vec<String> = previous.difference(&current).cloned().collect();

                let now = chrono::Utc::now();
                let now_str = now.to_rfc3339();

                for process_name in started {
                    let _ = sqlx::query(
                        "INSERT INTO play_sessions (process_name, started_at) VALUES (?, ?)",
                    )
                    .bind(process_name)
                    .bind(&now_str)
                    .execute(&db)
                    .await;
                }

                for process_name in ended {
                    let row = sqlx::query_as::<_, (i64, String)>(
                        "SELECT id, started_at FROM play_sessions
                         WHERE process_name = ? AND ended_at IS NULL
                         ORDER BY id DESC LIMIT 1",
                    )
                    .bind(&process_name)
                    .fetch_optional(&db)
                    .await;

                    if let Ok(Some((session_id, started_at))) = row {
                        if let Ok(started_dt) = chrono::DateTime::parse_from_rfc3339(&started_at) {
                            let duration = (now - started_dt.with_timezone(&chrono::Utc))
                                .num_seconds()
                                .max(0);

                            let _ = sqlx::query(
                                "UPDATE play_sessions
                                 SET ended_at = ?, duration_seconds = ?
                                 WHERE id = ?",
                            )
                            .bind(&now_str)
                            .bind(duration)
                            .bind(session_id)
                            .execute(&db)
                            .await;
                        }
                    }
                }

                previous = current;
            }

            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn get_tracking_paused(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    Ok(state.watcher.paused.load(Ordering::SeqCst))
}

#[tauri::command]
pub async fn set_tracking_paused(
    state: tauri::State<'_, AppState>,
    paused: bool,
) -> Result<(), String> {
    state.watcher.paused.store(paused, Ordering::SeqCst);
    if !paused {
        state.watcher.resync.store(true, Ordering::SeqCst);
    }
    log::info!("Playtime tracking paused={}", paused);
    Ok(())
}

#[tauri::command]
pub async fn set_start_minimized_to_tray(
    state: tauri::State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    let v = if enabled { "1" } else { "0" };
    crate::db::set_app_setting(&state.db, "start_minimized_to_tray", v)
        .await
        .map_err(|e| e.to_string())?;
    state
        .close_to_tray
        .store(enabled, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn get_start_minimized_to_tray(
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    Ok(state.close_to_tray.load(Ordering::SeqCst))
}

#[tauri::command]
pub async fn add_game_to_playlist(
    state: tauri::State<'_, AppState>,
    playlist_id: i64,
    game_id: i64,
) -> Result<(), String> {
    sqlx::query(
        "INSERT OR IGNORE INTO playlist_games (playlist_id, game_id) VALUES (?, ?)"
    )
    .bind(playlist_id)
    .bind(game_id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn remove_game_from_playlist(
    state: tauri::State<'_, AppState>,
    playlist_id: i64,
    game_id: i64,
) -> Result<(), String> {
    sqlx::query(
        "DELETE FROM playlist_games WHERE playlist_id = ? AND game_id = ?"
    )
    .bind(playlist_id)
    .bind(game_id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_playlist_games(
    state: tauri::State<'_, AppState>,
    playlist_id: i64,
) -> Result<Vec<(i64, String, Option<String>)>, String> {
    let rows = sqlx::query_as::<_, (i64, String, Option<String>)>(
        "SELECT g.id, g.title, g.cover_url 
         FROM games g
         INNER JOIN playlist_games pg ON g.id = pg.game_id
         WHERE pg.playlist_id = ?
         ORDER BY g.title"
    )
    .bind(playlist_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub async fn get_game_playlists(
    state: tauri::State<'_, AppState>,
    game_id: i64,
) -> Result<Vec<i64>, String> {
    let rows = sqlx::query_as::<_, (i64,)>(
        "SELECT playlist_id FROM playlist_games WHERE game_id = ?"
    )
    .bind(game_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

/// Refresh game metadata from IGDB
#[tauri::command]
pub async fn refresh_game_metadata(
    state: tauri::State<'_, AppState>,
    game_id: i64,
) -> Result<(), String> {
    // Get current game data to find IGDB ID or title
    let game_row = sqlx::query_as::<_, (Option<i64>, String, Option<i64>)>(
        "SELECT igdb_id, title, rawg_id FROM games WHERE id = ?"
    )
    .bind(game_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let (igdb_id, title, _rawg_id) = game_row;

    // Fetch from IGDB
    let metadata = if let Some(id) = igdb_id {
        igdb::get_igdb_game_by_id(id).await
    } else {
        let results = igdb::search_igdb_games(&title).await?;
        results.into_iter().next().ok_or_else(|| "No IGDB results found".to_string())
    };

    let metadata = metadata.map_err(|e| format!("IGDB fetch failed: {}", e))?;

    // Fetch and merge media with fallback
    let (media_data, _stats) = media::fetch_game_media(&metadata, &title).await;

    // Update database with new metadata
    let now = chrono::Utc::now().to_rfc3339();
    
    let release_date_str = metadata.release_date.and_then(|d| {
        chrono::DateTime::from_timestamp(d, 0).map(|dt| dt.to_rfc3339())
    });

    sqlx::query(
        "UPDATE games SET 
            summary = ?,
            storyline = ?,
            release_date = ?,
            genres = ?,
            platforms = ?,
            developer = ?,
            publisher = ?,
            rating = ?,
            rating_count = ?,
            total_rating = ?,
            total_rating_count = ?,
            similar_games = ?,
            artworks = ?,
            screenshots = ?,
            videos = ?,
            updated_at = ?
        WHERE id = ?"
    )
    .bind(&metadata.summary)
    .bind(&metadata.storyline)
    .bind(release_date_str)
    .bind(Some(metadata.genres.join(", ")))
    .bind(Some(metadata.platforms.join(", ")))
    .bind(Some(metadata.developers.join(", ")))
    .bind(Some(metadata.publishers.join(", ")))
    .bind(metadata.rating.map(|r| r as f32))
    .bind(metadata.rating_count)
    .bind(metadata.total_rating.map(|r| r as f32))
    .bind(metadata.total_rating_count)
    .bind(Some(serde_json::to_string(&metadata.similar_games).unwrap_or_default()))
    .bind(Some(serde_json::to_string(&media_data.artworks).unwrap_or_default()))
    .bind(Some(serde_json::to_string(&media_data.screenshots).unwrap_or_default()))
    .bind(Some(serde_json::to_string(&media_data.trailers).unwrap_or_default()))
    .bind(&now)
    .bind(game_id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get game media with fallback enrichment
#[tauri::command]
pub async fn get_game_media_options(
    state: tauri::State<'_, AppState>,
    game_id: i64,
    force_more_options: Option<bool>,
) -> Result<GameMediaResponse, String> {
    // Get game data
    let game_row = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>, Option<String>)>(
        "SELECT title, cover_url, artworks, screenshots, videos FROM games WHERE id = ?"
    )
    .bind(game_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let (title, cover_url, artworks_json, screenshots_json, videos_json) = game_row;

    // Parse stored media
    let mut artworks: Vec<MediaImageResponse> = artworks_json
        .and_then(|a| serde_json::from_str(&a).ok())
        .unwrap_or_default();

    let mut screenshots: Vec<MediaImageResponse> = screenshots_json
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let trailers: Vec<TrailerResponse> = videos_json
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default();

    // Build cover options from stored data
    let mut covers = Vec::new();
    if let Some(cover) = cover_url {
        covers.push(MediaImageResponse {
            id: format!("current_cover_{}", game_id),
            url: cover.clone(),
            thumb_url: cover,
            source: "current".to_string(),
        });
    }

    let igdb_cover_count = if covers.is_empty() { 0 } else { 1 };
    let igdb_artworks_count = artworks.len();
    let igdb_screenshots_count = screenshots.len();
    let force_more = force_more_options.unwrap_or(false);
    let need_sgdb = force_more
        || igdb_cover_count < 3
        || igdb_artworks_count < 3
        || igdb_screenshots_count < 8;

    let mut fallback_source = None;
    let mut fallback_posters = 0usize;
    let mut fallback_backgrounds = 0usize;
    let mut logos = Vec::new();
    let mut icons: Vec<MediaImageResponse> = Vec::new();

    if need_sgdb && crate::steamgriddb::is_configured() {
        match crate::steamgriddb::get_game_media(&title, None).await {
            Ok(sgdb_media) => {
                fallback_source = Some("steamgriddb".to_string());
                fallback_posters = sgdb_media.posters.len();
                fallback_backgrounds = sgdb_media.backgrounds.len();

                for poster in sgdb_media.posters.iter() {
                    covers.push(MediaImageResponse {
                        id: poster.id.clone(),
                        url: poster.url.clone(),
                        thumb_url: poster.thumb_url.clone(),
                        source: "steamgriddb".to_string(),
                    });
                }

                for hero in sgdb_media.backgrounds.iter() {
                    artworks.push(MediaImageResponse {
                        id: hero.id.clone(),
                        url: hero.url.clone(),
                        thumb_url: hero.thumb_url.clone(),
                        source: "steamgriddb".to_string(),
                    });
                }

                if force_more {
                    for hero in sgdb_media.backgrounds.iter() {
                        if !screenshots.iter().any(|s| s.url == hero.url) {
                            screenshots.push(MediaImageResponse {
                                id: format!("{}_shot", hero.id),
                                url: hero.url.clone(),
                                thumb_url: hero.thumb_url.clone(),
                                source: "steamgriddb".to_string(),
                            });
                        }
                    }
                    for poster in sgdb_media.posters.iter().take(30) {
                        if !screenshots.iter().any(|s| s.url == poster.url) {
                            screenshots.push(MediaImageResponse {
                                id: format!("{}_shot", poster.id),
                                url: poster.url.clone(),
                                thumb_url: poster.thumb_url.clone(),
                                source: "steamgriddb".to_string(),
                            });
                        }
                    }
                }

                for logo in sgdb_media.logos {
                    logos.push(MediaImageResponse {
                        id: logo.id,
                        url: logo.url,
                        thumb_url: logo.thumb_url,
                        source: "steamgriddb".to_string(),
                    });
                }

                for icon in sgdb_media.icons {
                    icons.push(MediaImageResponse {
                        id: icon.id,
                        url: icon.url,
                        thumb_url: icon.thumb_url,
                        source: "steamgriddb".to_string(),
                    });
                }

                log::info!(
                    "SteamGridDB media count for '{}': posters={}, heroes={}, logos={}, icons={}",
                    title,
                    fallback_posters,
                    fallback_backgrounds,
                    logos.len(),
                    icons.len()
                );
            }
            Err(e) => {
                log::warn!("SteamGridDB API failed for '{}': {}. Using IGDB only.", title, e);
            }
        }
    }

    // Deduplicate by URL after merge
    let mut seen_cover_urls = std::collections::HashSet::new();
    covers.retain(|img| seen_cover_urls.insert(img.url.clone()));
    let mut seen_artwork_urls = std::collections::HashSet::new();
    artworks.retain(|img| seen_artwork_urls.insert(img.url.clone()));
    let mut seen_logo_urls = std::collections::HashSet::new();
    logos.retain(|img| seen_logo_urls.insert(img.url.clone()));
    let mut seen_icon_urls = std::collections::HashSet::new();
    icons.retain(|img| seen_icon_urls.insert(img.url.clone()));

    log::info!(
        "IGDB media count for '{}': covers={}, artworks={}, screenshots={}",
        title,
        igdb_cover_count,
        igdb_artworks_count,
        screenshots.len()
    );
    log::info!(
        "Final merged media count for '{}': posters={}, heroes={}",
        title,
        covers.len(),
        artworks.len() + screenshots.len()
    );

    let stats = MediaStatsResponse {
        igdb_cover: igdb_cover_count,
        igdb_artworks: igdb_artworks_count,
        igdb_screenshots: screenshots.len(),
        igdb_trailers: trailers.len(),
        fallback_source,
        fallback_posters,
        fallback_backgrounds,
        final_poster_options: covers.len() + artworks.len(),
        final_background_options: artworks.len() + screenshots.len(),
    };

    Ok(GameMediaResponse {
        covers,
        artworks,
        screenshots,
        trailers,
        logos,
        icons,
        stats,
    })
}

#[derive(Debug, Serialize)]
pub struct HomeHeroCandidateImage {
    pub url: String,
    pub thumb_url: String,
    pub source: String,
    pub game_id: i64,
    pub game_title: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

fn push_home_hero_json_media(
    out: &mut Vec<HomeHeroCandidateImage>,
    arr: &[serde_json::Value],
    source: &str,
    gid: i64,
    gtitle: &str,
) {
    for v in arr.iter().take(30) {
        let Some(url) = v.get("url").and_then(|u| u.as_str()) else {
            continue;
        };
        if url.len() < 12 {
            continue;
        }
        let thumb = v.get("thumb_url").and_then(|u| u.as_str()).unwrap_or(url);
        let width = v
            .get("width")
            .and_then(|x| x.as_i64())
            .map(|n| n as i32);
        let height = v
            .get("height")
            .and_then(|x| x.as_i64())
            .map(|n| n as i32);
        out.push(HomeHeroCandidateImage {
            url: url.to_string(),
            thumb_url: thumb.to_string(),
            source: source.to_string(),
            game_id: gid,
            game_title: gtitle.to_string(),
            width,
            height,
        });
    }
}

/// Wide hero images from library (IGDB JSON + single artwork/screenshot URLs + covers) and optionally SteamGridDB heroes for top-played games.
#[tauri::command]
pub async fn list_home_hero_candidate_images(
    state: tauri::State<'_, AppState>,
    include_steamgriddb: Option<bool>,
) -> Result<Vec<HomeHeroCandidateImage>, String> {
    let rows = sqlx::query_as::<
        _,
        (
            i64,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        ),
    >(
        "SELECT id, title, cover_url, artwork_url, screenshot_url, artworks, screenshots FROM games",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let mut out: Vec<HomeHeroCandidateImage> = Vec::new();

    for (gid, gtitle, cover, art, shot, arts_json, shots_json) in rows {
        if let Some(c) = cover.filter(|u| u.len() > 10) {
            out.push(HomeHeroCandidateImage {
                url: c.clone(),
                thumb_url: c.clone(),
                source: "library_cover".into(),
                game_id: gid,
                game_title: gtitle.clone(),
                width: None,
                height: None,
            });
        }
        if let Some(u) = art.filter(|s| s.len() > 10) {
            out.push(HomeHeroCandidateImage {
                url: u.clone(),
                thumb_url: u.clone(),
                source: "library_artwork_url".into(),
                game_id: gid,
                game_title: gtitle.clone(),
                width: None,
                height: None,
            });
        }
        if let Some(u) = shot.filter(|s| s.len() > 10) {
            out.push(HomeHeroCandidateImage {
                url: u.clone(),
                thumb_url: u.clone(),
                source: "library_screenshot_url".into(),
                game_id: gid,
                game_title: gtitle.clone(),
                width: None,
                height: None,
            });
        }
        if let Some(ref raw) = arts_json {
            if let Ok(arr) = serde_json::from_str::<Vec<serde_json::Value>>(raw) {
                push_home_hero_json_media(&mut out, &arr, "igdb_artwork", gid, &gtitle);
            }
        }
        if let Some(ref raw) = shots_json {
            if let Ok(arr) = serde_json::from_str::<Vec<serde_json::Value>>(raw) {
                push_home_hero_json_media(&mut out, &arr, "igdb_screenshot", gid, &gtitle);
            }
        }
    }

    let mut seen = std::collections::HashSet::new();
    out.retain(|i| seen.insert(i.url.clone()));

    if include_steamgriddb.unwrap_or(false) && crate::steamgriddb::is_configured() {
        let top = sqlx::query_as::<_, (i64, String)>(
            "SELECT id, title FROM games ORDER BY COALESCE(total_playtime_seconds, 0) DESC LIMIT 8",
        )
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

        for (gid, gtitle) in top {
            match crate::steamgriddb::get_game_media(&gtitle, None).await {
                Ok(m) => {
                    for h in m.backgrounds.into_iter().take(24) {
                        if seen.insert(h.url.clone()) {
                            out.push(HomeHeroCandidateImage {
                                url: h.url,
                                thumb_url: h.thumb_url,
                                source: "steamgriddb_hero".into(),
                                game_id: gid,
                                game_title: gtitle.clone(),
                                width: h.width,
                                height: h.height,
                            });
                        }
                    }
                }
                Err(e) => log::warn!("SteamGridDB home hero fetch failed for {}: {}", gtitle, e),
            }
            tokio::time::sleep(std::time::Duration::from_millis(120)).await;
        }
    }

    Ok(out)
}

#[derive(Debug, Serialize)]
pub struct GitHubReleaseCheck {
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: String,
    pub html_url: String,
    pub download_url: Option<String>,
    pub update_available: bool,
}

fn parse_semver_parts(s: &str) -> Vec<i32> {
    s.trim()
        .trim_start_matches('v')
        .split(|c| c == '.' || c == '-' || c == '+')
        .filter_map(|p| p.parse::<i32>().ok())
        .collect()
}

fn semver_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let pa = parse_semver_parts(a);
    let pb = parse_semver_parts(b);
    let n = pa.len().max(pb.len());
    for i in 0..n {
        let va = *pa.get(i).unwrap_or(&0);
        let vb = *pb.get(i).unwrap_or(&0);
        match va.cmp(&vb) {
            std::cmp::Ordering::Equal => {}
            o => return o,
        }
    }
    std::cmp::Ordering::Equal
}

/// Compare `current_version` with latest GitHub release (no silent install).
#[tauri::command]
pub async fn check_github_app_release(
    owner: String,
    repo: String,
    current_version: String,
) -> Result<GitHubReleaseCheck, String> {
    let owner = owner.trim().to_string();
    let repo = repo.trim().to_string();
    if owner.is_empty() || repo.is_empty() {
        return Err("GitHub owner or repo is not configured.".into());
    }

    let client = reqwest::Client::builder()
        .user_agent("PitGames-UpdateCheck/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        owner, repo
    );

    let res = client
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if res.status() == reqwest::StatusCode::FORBIDDEN {
        return Err(
            "GitHub API returned 403 (rate limit or private repo). Try again in a few minutes."
                .into(),
        );
    }

    if !res.status().is_success() {
        let txt = res.text().await.unwrap_or_default();
        return Err(format!("GitHub API error: {}", txt));
    }

    let v: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let tag = v
        .get("tag_name")
        .and_then(|t| t.as_str())
        .unwrap_or("0.0.0")
        .trim()
        .trim_start_matches('v');
    let body = v
        .get("body")
        .and_then(|b| b.as_str())
        .unwrap_or("")
        .to_string();
    let html_url = v
        .get("html_url")
        .and_then(|u| u.as_str())
        .unwrap_or("https://github.com")
        .to_string();

    let mut download_url: Option<String> = None;
    if let Some(assets) = v.get("assets").and_then(|a| a.as_array()) {
        for a in assets {
            let name = a.get("name").and_then(|n| n.as_str()).unwrap_or("");
            let lower = name.to_ascii_lowercase();
            if lower.ends_with(".msi")
                || lower.ends_with(".exe")
                || lower.ends_with(".zip")
                || lower.ends_with(".dmg")
            {
                download_url = a
                    .get("browser_download_url")
                    .and_then(|u| u.as_str())
                    .map(|s| s.to_string());
                if download_url.is_some() {
                    break;
                }
            }
        }
    }

    let cur = current_version.trim().trim_start_matches('v');
    let update_available = semver_cmp(tag, cur) == std::cmp::Ordering::Greater;

    Ok(GitHubReleaseCheck {
        current_version: cur.to_string(),
        latest_version: tag.to_string(),
        release_notes: body,
        html_url,
        download_url,
        update_available,
    })
}

/// Update game poster/cover image
#[tauri::command]
pub async fn update_game_poster(
    state: tauri::State<'_, AppState>,
    game_id: i64,
    image_url: String,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    
    sqlx::query("UPDATE games SET cover_url = ?, updated_at = ? WHERE id = ?")
        .bind(&image_url)
        .bind(&now)
        .bind(game_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Update game background/artwork image
#[tauri::command]
pub async fn update_game_cover(
    state: tauri::State<'_, AppState>,
    game_id: i64,
    image_url: String,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    
    sqlx::query("UPDATE games SET artwork_url = ?, updated_at = ? WHERE id = ?")
        .bind(&image_url)
        .bind(&now)
        .bind(game_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Debug: Check media counts for a game
#[tauri::command]
pub async fn debug_game_media(
    state: tauri::State<'_, AppState>,
    game_id: i64,
) -> Result<serde_json::Value, String> {
    let game_row = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>, Option<i64>)>(
        "SELECT title, artworks, screenshots, videos, igdb_id FROM games WHERE id = ?"
    )
    .bind(game_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let (title, artworks_json, screenshots_json, videos_json, igdb_id) = game_row;

    let artworks: Vec<serde_json::Value> = artworks_json
        .and_then(|a| serde_json::from_str(&a).ok())
        .unwrap_or_default();
    let screenshots: Vec<serde_json::Value> = screenshots_json
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    let trailers: Vec<serde_json::Value> = videos_json
        .and_then(|v| serde_json::from_str(&v).ok())
        .unwrap_or_default();

    Ok(serde_json::json!({
        "game_id": game_id,
        "title": title,
        "igdb_id": igdb_id,
        "artworks_count": artworks.len(),
        "screenshots_count": screenshots.len(),
        "trailers_count": trailers.len(),
    }))
}

// --- Performance advisor & hardware ---

async fn load_rankings(pool: &sqlx::SqlitePool) -> Result<Vec<RankingRow>, String> {
    let rows = sqlx::query_as::<_, (String, String, i32)>(
        "SELECT component_type, name_pattern, score FROM hardware_rankings",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|(component_type, name_pattern, score)| RankingRow {
            component_type,
            name_pattern,
            score,
        })
        .collect())
}

fn hardware_snapshot_from_db(
    cpu_name: Option<String>,
    cpu_cores: Option<i64>,
    cpu_threads: Option<i64>,
    ram_gb: Option<f64>,
    gpu_name: Option<String>,
    gpu_vram_gb: Option<f64>,
    os_name: Option<String>,
    directx_version: Option<String>,
    storage_free_gb: Option<f64>,
    screen_resolution: Option<String>,
) -> HardwareSnapshot {
    HardwareSnapshot {
        cpu_name,
        cpu_cores,
        cpu_threads,
        ram_gb,
        gpu_name,
        gpu_vram_gb,
        os_name,
        directx_version,
        storage_free_gb,
        screen_resolution,
    }
}

#[tauri::command]
pub async fn scan_hardware_profile(
    state: tauri::State<'_, AppState>,
    profile_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let snap = tokio::task::spawn_blocking(crate::performance::hardware::scan_hardware_blocking)
        .await
        .map_err(|e| e.to_string())?;

    let scanned_at = chrono::Utc::now().to_rfc3339();
    let name = profile_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "My PC".to_string());

    let active_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM hardware_profiles WHERE is_active = 1")
            .fetch_one(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    let set_active = active_count.0 == 0;

    if set_active {
        let _ = sqlx::query("UPDATE hardware_profiles SET is_active = 0")
            .execute(&state.db)
            .await;
    }

    let id = sqlx::query(
        "INSERT INTO hardware_profiles (
            profile_name, cpu_name, cpu_cores, cpu_threads, ram_gb,
            gpu_name, gpu_vram_gb, os_name, directx_version, storage_free_gb,
            screen_resolution, scanned_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&name)
    .bind(&snap.cpu_name)
    .bind(snap.cpu_cores)
    .bind(snap.cpu_threads)
    .bind(snap.ram_gb)
    .bind(&snap.gpu_name)
    .bind(snap.gpu_vram_gb)
    .bind(&snap.os_name)
    .bind(&snap.directx_version)
    .bind(snap.storage_free_gb)
    .bind(&snap.screen_resolution)
    .bind(&scanned_at)
    .bind(if set_active { 1 } else { 0 })
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .last_insert_rowid();

    Ok(serde_json::json!({
        "id": id,
        "profileName": name,
        "snapshot": snap,
        "scannedAt": scanned_at,
        "isActive": set_active,
    }))
}

#[tauri::command]
pub async fn list_hardware_profiles(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let rows = sqlx::query_as::<
        _,
        (
            i64,
            String,
            Option<String>,
            Option<i64>,
            Option<i64>,
            Option<f64>,
            Option<String>,
            Option<f64>,
            Option<String>,
            Option<String>,
            Option<f64>,
            Option<String>,
            String,
            i64,
        ),
    >(
        "SELECT id, profile_name, cpu_name, cpu_cores, cpu_threads, ram_gb,
                gpu_name, gpu_vram_gb, os_name, directx_version, storage_free_gb,
                screen_resolution, scanned_at, is_active
         FROM hardware_profiles ORDER BY scanned_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(
            |(
                id,
                profile_name,
                cpu_name,
                cpu_cores,
                cpu_threads,
                ram_gb,
                gpu_name,
                gpu_vram_gb,
                os_name,
                directx_version,
                storage_free_gb,
                screen_resolution,
                scanned_at,
                is_active,
            )| {
                serde_json::json!({
                    "id": id,
                    "profileName": profile_name,
                    "cpuName": cpu_name,
                    "cpuCores": cpu_cores,
                    "cpuThreads": cpu_threads,
                    "ramGb": ram_gb,
                    "gpuName": gpu_name,
                    "gpuVramGb": gpu_vram_gb,
                    "osName": os_name,
                    "directxVersion": directx_version,
                    "storageFreeGb": storage_free_gb,
                    "screenResolution": screen_resolution,
                    "scannedAt": scanned_at,
                    "isActive": is_active != 0,
                })
            },
        )
        .collect())
}

#[tauri::command]
pub async fn delete_hardware_profile(
    state: tauri::State<'_, AppState>,
    profile_id: i64,
) -> Result<(), String> {
    // If this was the active profile, activate the most recent remaining one.
    let was_active: bool = sqlx::query_scalar("SELECT is_active FROM hardware_profiles WHERE id = ?")
        .bind(profile_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .unwrap_or(0) != 0;

    sqlx::query("DELETE FROM hardware_profiles WHERE id = ?")
        .bind(profile_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    if was_active {
        let _ = sqlx::query(
            "UPDATE hardware_profiles SET is_active = 1 WHERE id = (SELECT id FROM hardware_profiles ORDER BY id DESC LIMIT 1)"
        )
        .execute(&state.db)
        .await;
    }
    Ok(())
}

#[tauri::command]
pub async fn set_active_hardware_profile(
    state: tauri::State<'_, AppState>,
    profile_id: i64,
) -> Result<(), String> {
    let _ = sqlx::query("UPDATE hardware_profiles SET is_active = 0")
        .execute(&state.db)
        .await;
    sqlx::query("UPDATE hardware_profiles SET is_active = 1 WHERE id = ?")
        .bind(profile_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn active_hardware_snapshot(
    pool: &sqlx::SqlitePool,
) -> Result<Option<HardwareSnapshot>, String> {
    let row = sqlx::query_as::<
        _,
        (
            Option<String>,
            Option<i64>,
            Option<i64>,
            Option<f64>,
            Option<String>,
            Option<f64>,
            Option<String>,
            Option<String>,
            Option<f64>,
            Option<String>,
        ),
    >(
        "SELECT cpu_name, cpu_cores, cpu_threads, ram_gb, gpu_name, gpu_vram_gb,
                os_name, directx_version, storage_free_gb, screen_resolution
         FROM hardware_profiles WHERE is_active = 1 ORDER BY id DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.map(
        |(cn, cc, ct, ram, gn, gv, os, dx, st, sr)| {
            hardware_snapshot_from_db(cn, cc, ct, ram, gn, gv, os, dx, st, sr)
        },
    ))
}

async fn fetch_game_requirements_inner(
    pool: &sqlx::SqlitePool,
    game_id: i64,
) -> Result<serde_json::Value, String> {
    let row = sqlx::query_as::<_, (String, Option<i64>)>(
        "SELECT title, steam_app_id FROM games WHERE id = ?",
    )
    .bind(game_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Game not found".to_string())?;

    let (title, mut steam_app_id) = row;

    if steam_app_id.is_none() {
        let hits = search_steam_store(&title).await.unwrap_or_default();
        if let Some(h) = hits.first() {
            if let Some(id) = h.id {
                steam_app_id = Some(id);
                let _ = sqlx::query("UPDATE games SET steam_app_id = ? WHERE id = ?")
                    .bind(id)
                    .bind(game_id)
                    .execute(pool)
                    .await;
                log::info!(
                    "Requirements: matched {:?} -> Steam app {}",
                    title,
                    id
                );
            }
        }
    }

    let mut source = "unknown";
    let mut app_name = title.clone();
    let mut min_html: Option<String> = None;
    let mut rec_html: Option<String> = None;

    if let Some(app_id) = steam_app_id {
        match fetch_steam_app_details(app_id).await {
            Ok(details) => {
                source = "steam";
                app_name = details.name.unwrap_or(title);
                min_html = details.pc_requirements_minimum.clone();
                rec_html = details.pc_requirements_recommended.clone();
                log::info!(
                    "Steam app {} — minimum present: {}, recommended present: {}",
                    app_id,
                    min_html.is_some(),
                    rec_html.is_some()
                );
            }
            Err(e) => {
                log::warn!("Steam fetch failed for {}: {}", app_id, e);
            }
        }
    }

    let fetched_at = chrono::Utc::now().to_rfc3339();
    let parsed = parse_full_requirements(min_html.as_ref(), rec_html.as_ref());

    sqlx::query(
        "INSERT INTO game_requirements (
            game_id, external_title, steam_app_id, source,
            minimum_raw, recommended_raw,
            min_cpu, min_gpu, min_ram_gb, min_vram_gb, min_storage_gb, min_os, min_directx,
            rec_cpu, rec_gpu, rec_ram_gb, rec_vram_gb, rec_storage_gb, rec_os, rec_directx,
            fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(game_id)
    .bind(&app_name)
    .bind(steam_app_id)
    .bind(source)
    .bind(&min_html)
    .bind(&rec_html)
    .bind(&parsed.minimum.cpu)
    .bind(&parsed.minimum.gpu)
    .bind(parsed.minimum.ram_gb)
    .bind(parsed.minimum.vram_gb)
    .bind(parsed.minimum.storage_gb)
    .bind(&parsed.minimum.os)
    .bind(&parsed.minimum.directx)
    .bind(&parsed.recommended.cpu)
    .bind(&parsed.recommended.gpu)
    .bind(parsed.recommended.ram_gb)
    .bind(parsed.recommended.vram_gb)
    .bind(parsed.recommended.storage_gb)
    .bind(&parsed.recommended.os)
    .bind(&parsed.recommended.directx)
    .bind(&fetched_at)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let storage_txt = parsed
        .minimum
        .storage_gb
        .or(parsed.recommended.storage_gb);
    log::info!(
        "Parsed storage requirement (GB): {:?} — source {}",
        storage_txt,
        source
    );

    Ok(serde_json::json!({
        "gameId": game_id,
        "title": app_name,
        "steamAppId": steam_app_id,
        "source": source,
        "minimumRaw": min_html,
        "recommendedRaw": rec_html,
        "parsed": parsed,
        "fetchedAt": fetched_at,
    }))
}

#[tauri::command]
pub async fn fetch_game_requirements(
    state: tauri::State<'_, AppState>,
    game_id: i64,
) -> Result<serde_json::Value, String> {
    fetch_game_requirements_inner(&state.db, game_id).await
}

#[tauri::command]
pub async fn refresh_all_library_requirements(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM games ORDER BY id")
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let attempted = ids.len();
    let mut ok = 0usize;
    let mut err = 0usize;
    for id in ids {
        match fetch_game_requirements_inner(&state.db, id).await {
            Ok(_) => ok += 1,
            Err(_) => err += 1,
        }
    }

    Ok(serde_json::json!({ "attempted": attempted, "ok": ok, "errors": err }))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvisorSearchHit {
    pub source: String,
    pub title: String,
    pub steam_app_id: Option<i64>,
    pub igdb_id: Option<i64>,
    pub cover_url: Option<String>,
}

#[tauri::command]
pub async fn search_performance_advisor_games(
    query: String,
) -> Result<Vec<AdvisorSearchHit>, String> {
    let steam_hits = search_steam_store(&query).await.unwrap_or_default();
    log::info!(
        "search_performance_advisor_games query={:?} steam_rows={}",
        query.trim(),
        steam_hits.len()
    );
    let out: Vec<AdvisorSearchHit> = steam_hits
        .into_iter()
        .take(12)
        .map(|h| AdvisorSearchHit {
            source: "steam".into(),
            title: h.name.unwrap_or_default(),
            steam_app_id: h.id.filter(|&id| id > 0),
            igdb_id: None,
            cover_url: h.tiny_image,
        })
        .collect();
    Ok(out)
}

#[tauri::command]
pub async fn fetch_requirements_for_steam_app(
    state: tauri::State<'_, AppState>,
    steam_app_id: i64,
    title_hint: Option<String>,
) -> Result<serde_json::Value, String> {
    log::info!(
        "fetch_requirements_for_steam_app received steam_app_id={} title_hint={:?}",
        steam_app_id,
        title_hint
    );
    let details = fetch_steam_app_details(steam_app_id).await?;
    let title = details
        .name
        .clone()
        .or(title_hint)
        .unwrap_or_else(|| format!("Steam {}", steam_app_id));

    let fetched_at = chrono::Utc::now().to_rfc3339();
    let parsed = parse_full_requirements(
        details.pc_requirements_minimum.as_ref(),
        details.pc_requirements_recommended.as_ref(),
    );

    let min_nonempty = details
        .pc_requirements_minimum
        .as_ref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let rec_nonempty = details
        .pc_requirements_recommended
        .as_ref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let parser_any = parsed.minimum.ram_gb.is_some()
        || parsed.minimum.storage_gb.is_some()
        || parsed.recommended.ram_gb.is_some()
        || parsed.recommended.storage_gb.is_some();
    log::info!(
        "fetch_requirements_for_steam_app steam_app_id={} requirements_html min={} rec={} parser_hint_ok={}",
        steam_app_id,
        min_nonempty,
        rec_nonempty,
        parser_any
    );

    sqlx::query(
        "INSERT INTO game_requirements (
            game_id, external_title, steam_app_id, source,
            minimum_raw, recommended_raw,
            min_cpu, min_gpu, min_ram_gb, min_vram_gb, min_storage_gb, min_os, min_directx,
            rec_cpu, rec_gpu, rec_ram_gb, rec_vram_gb, rec_storage_gb, rec_os, rec_directx,
            fetched_at
        ) VALUES (NULL, ?, ?, 'steam', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&title)
    .bind(steam_app_id)
    .bind(&details.pc_requirements_minimum)
    .bind(&details.pc_requirements_recommended)
    .bind(&parsed.minimum.cpu)
    .bind(&parsed.minimum.gpu)
    .bind(parsed.minimum.ram_gb)
    .bind(parsed.minimum.vram_gb)
    .bind(parsed.minimum.storage_gb)
    .bind(&parsed.minimum.os)
    .bind(&parsed.minimum.directx)
    .bind(&parsed.recommended.cpu)
    .bind(&parsed.recommended.gpu)
    .bind(parsed.recommended.ram_gb)
    .bind(parsed.recommended.vram_gb)
    .bind(parsed.recommended.storage_gb)
    .bind(&parsed.recommended.os)
    .bind(&parsed.recommended.directx)
    .bind(&fetched_at)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "steamAppId": steam_app_id,
        "title": title,
        "headerImage": details.header_image,
        "minimumRaw": details.pc_requirements_minimum,
        "recommendedRaw": details.pc_requirements_recommended,
        "parsed": parsed,
        "fetchedAt": fetched_at,
    }))
}

type ReqTuple = (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<f64>,
    Option<f64>,
    Option<f64>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<f64>,
    Option<f64>,
    Option<f64>,
    Option<String>,
    Option<String>,
);

async fn latest_requirements_row(
    pool: &sqlx::SqlitePool,
    game_id: Option<i64>,
    steam_app_id: Option<i64>,
) -> Result<Option<ReqTuple>, String> {
    if let Some(gid) = game_id {
        return sqlx::query_as::<_, ReqTuple>(
            "SELECT minimum_raw, recommended_raw,
                    min_cpu, min_gpu, min_ram_gb, min_vram_gb, min_storage_gb, min_os, min_directx,
                    rec_cpu, rec_gpu, rec_ram_gb, rec_vram_gb, rec_storage_gb, rec_os, rec_directx
             FROM game_requirements WHERE game_id = ? ORDER BY fetched_at DESC LIMIT 1",
        )
        .bind(gid)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string());
    }
    if let Some(sid) = steam_app_id {
        return sqlx::query_as::<_, ReqTuple>(
            "SELECT minimum_raw, recommended_raw,
                    min_cpu, min_gpu, min_ram_gb, min_vram_gb, min_storage_gb, min_os, min_directx,
                    rec_cpu, rec_gpu, rec_ram_gb, rec_vram_gb, rec_storage_gb, rec_os, rec_directx
             FROM game_requirements WHERE steam_app_id = ? AND game_id IS NULL
             ORDER BY fetched_at DESC LIMIT 1",
        )
        .bind(sid)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string());
    }
    Ok(None)
}

fn parsed_from_requirements_row(
    row: &(
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<f64>,
        Option<f64>,
        Option<f64>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<f64>,
        Option<f64>,
        Option<f64>,
        Option<String>,
        Option<String>,
    ),
) -> crate::performance::parse_requirements::ParsedRequirements {
    use crate::performance::parse_requirements::{ParsedRequirements, RequirementSide};
    ParsedRequirements {
        minimum: RequirementSide {
            cpu: row.2.clone(),
            gpu: row.3.clone(),
            ram_gb: row.4,
            vram_gb: row.5,
            storage_gb: row.6,
            os: row.7.clone(),
            directx: row.8.clone(),
        },
        recommended: RequirementSide {
            cpu: row.9.clone(),
            gpu: row.10.clone(),
            ram_gb: row.11,
            vram_gb: row.12,
            storage_gb: row.13,
            os: row.14.clone(),
            directx: row.15.clone(),
        },
    }
}

#[tauri::command]
pub async fn get_compatibility_report_for_game(
    state: tauri::State<'_, AppState>,
    game_id: i64,
) -> Result<serde_json::Value, String> {
    let hw = active_hardware_snapshot(&state.db)
        .await?
        .ok_or_else(|| "No active hardware profile".to_string())?;

    let req_row = latest_requirements_row(&state.db, Some(game_id), None)
        .await?
        .ok_or_else(|| "No stored requirements for this game".to_string())?;

    let parsed = parsed_from_requirements_row(&req_row);
    let rankings = load_rankings(&state.db).await?;
    let stor = parsed.minimum.storage_gb.or(parsed.recommended.storage_gb);
    let report = build_compatibility_report(&hw, &parsed, &rankings, stor);

    Ok(serde_json::to_value(report).map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn get_compatibility_report_for_steam_app(
    state: tauri::State<'_, AppState>,
    steam_app_id: i64,
) -> Result<serde_json::Value, String> {
    log::info!(
        "get_compatibility_report_for_steam_app steam_app_id={}",
        steam_app_id
    );
    let hw = active_hardware_snapshot(&state.db)
        .await?
        .ok_or_else(|| "No active hardware profile".to_string())?;

    let req_row = latest_requirements_row(&state.db, None, Some(steam_app_id))
        .await?
        .ok_or_else(|| {
            "Requirements not loaded — fetch them first".to_string()
        })?;

    let parsed = parsed_from_requirements_row(&req_row);
    let rankings = load_rankings(&state.db).await?;
    let stor = parsed.minimum.storage_gb.or(parsed.recommended.storage_gb);
    let report = build_compatibility_report(&hw, &parsed, &rankings, stor);

    Ok(serde_json::to_value(report).map_err(|e| e.to_string())?)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPerformanceSummary {
    pub game_id: i64,
    pub preset_label: String,
    pub overall: String,
}

#[tauri::command]
pub async fn list_library_performance_summaries(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<LibraryPerformanceSummary>, String> {
    let hw = match active_hardware_snapshot(&state.db).await? {
        Some(h) => h,
        None => return Ok(Vec::new()),
    };

    let rankings = load_rankings(&state.db).await?;

    let game_ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM games")
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for gid in game_ids {
        if let Ok(Some(row)) = latest_requirements_row(&state.db, Some(gid), None).await {
            let parsed = parsed_from_requirements_row(&row);
            let stor = parsed.minimum.storage_gb.or(parsed.recommended.storage_gb);
            let report = build_compatibility_report(&hw, &parsed, &rankings, stor);
            out.push(LibraryPerformanceSummary {
                game_id: gid,
                preset_label: report.preset_label.clone(),
                overall: report.overall.clone(),
            });
        }
    }

    Ok(out)
}

#[tauri::command]
pub async fn get_performance_summary_for_game(
    state: tauri::State<'_, AppState>,
    game_id: i64,
) -> Result<Option<serde_json::Value>, String> {
    let hw = match active_hardware_snapshot(&state.db).await? {
        Some(h) => h,
        None => return Ok(None),
    };

    let row = match latest_requirements_row(&state.db, Some(game_id), None).await? {
        Some(r) => r,
        None => return Ok(None),
    };

    let rankings = load_rankings(&state.db).await?;
    let parsed = parsed_from_requirements_row(&row);
    let stor = parsed.minimum.storage_gb.or(parsed.recommended.storage_gb);
    let report = build_compatibility_report(&hw, &parsed, &rankings, stor);

    Ok(Some(serde_json::json!({
        "presetLabel": report.preset_label,
        "overall": report.overall,
        "confidence": report.confidence,
        "bottlenecks": report.bottlenecks,
        "storageRequiredGb": report.storage_required_gb,
        "explanation": report.explanation,
    })))
}
