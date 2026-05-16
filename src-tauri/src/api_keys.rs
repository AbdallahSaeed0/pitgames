//! API keys from environment (preferred) or SQLite `app_secrets`. Call [`refresh_from_db`] after DB init and after saves.

use sqlx::{Row, SqlitePool};
use std::sync::{OnceLock, RwLock};

pub const K_IGDB_CLIENT_ID: &str = "igdb_client_id";
pub const K_IGDB_CLIENT_SECRET: &str = "igdb_client_secret";
pub const K_RAWG_API_KEY: &str = "rawg_api_key";
pub const K_STEAMGRIDDB_API_KEY: &str = "steamgriddb_api_key";

#[derive(Clone, Default)]
struct StoredKeys {
    igdb_client_id: Option<String>,
    igdb_client_secret: Option<String>,
    rawg_api_key: Option<String>,
    steamgriddb_api_key: Option<String>,
}

static STORED: OnceLock<RwLock<StoredKeys>> = OnceLock::new();

fn cache() -> &'static RwLock<StoredKeys> {
    STORED.get_or_init(|| RwLock::new(StoredKeys::default()))
}

fn nonempty_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn igdb_client_id() -> Option<String> {
    nonempty_env("IGDB_CLIENT_ID").or_else(|| {
        cache()
            .read()
            .ok()?
            .igdb_client_id
            .clone()
            .filter(|s| !s.trim().is_empty())
    })
}

pub fn igdb_client_secret() -> Option<String> {
    nonempty_env("IGDB_CLIENT_SECRET").or_else(|| {
        cache()
            .read()
            .ok()?
            .igdb_client_secret
            .clone()
            .filter(|s| !s.trim().is_empty())
    })
}

pub fn rawg_api_key() -> Option<String> {
    nonempty_env("RAWG_API_KEY").or_else(|| {
        cache()
            .read()
            .ok()?
            .rawg_api_key
            .clone()
            .filter(|s| !s.trim().is_empty())
    })
}

pub fn steamgriddb_api_key() -> Option<String> {
    nonempty_env("STEAMGRIDDB_API_KEY").or_else(|| {
        cache()
            .read()
            .ok()?
            .steamgriddb_api_key
            .clone()
            .filter(|s| !s.trim().is_empty())
    })
}

pub fn igdb_ready() -> bool {
    igdb_client_id().is_some() && igdb_client_secret().is_some()
}

pub async fn refresh_from_db(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let mut keys = StoredKeys::default();
    let rows = sqlx::query("SELECT key, value FROM app_secrets")
        .fetch_all(pool)
        .await?;

    for row in rows {
        let k: String = row.try_get("key")?;
        let v: String = row.try_get("value")?;
        match k.as_str() {
            K_IGDB_CLIENT_ID => keys.igdb_client_id = Some(v),
            K_IGDB_CLIENT_SECRET => keys.igdb_client_secret = Some(v),
            K_RAWG_API_KEY => keys.rawg_api_key = Some(v),
            K_STEAMGRIDDB_API_KEY => keys.steamgriddb_api_key = Some(v),
            _ => {}
        }
    }

    if let Ok(mut w) = cache().write() {
        *w = keys;
    }

    Ok(())
}

pub async fn upsert_secret(pool: &SqlitePool, key: &str, value: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO app_secrets (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_secret(pool: &SqlitePool, key: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM app_secrets WHERE key = ?")
        .bind(key)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn read_secret_db(pool: &SqlitePool, key: &str) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar::<_, String>("SELECT value FROM app_secrets WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
}
