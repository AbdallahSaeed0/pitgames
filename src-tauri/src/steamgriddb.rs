use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::collections::{HashMap, HashSet};
use log;

#[derive(Debug, Deserialize)]
pub struct SteamGridDbSearchResponse {
    pub data: Vec<SteamGridDbGame>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SteamGridDbGame {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct SteamGridDbImagesResponse {
    pub data: Vec<SteamGridDbImage>,
    #[serde(default)]
    pub success: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SteamGridDbImage {
    pub id: i64,
    pub url: String,
    pub thumb: String,
    #[serde(default)]
    pub width: Option<i32>,
    #[serde(default)]
    pub height: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SteamGridDbMedia {
    pub game_id: i64,
    pub game_name: String,
    pub posters: Vec<SteamGridDbImageData>,
    pub backgrounds: Vec<SteamGridDbImageData>,
    pub logos: Vec<SteamGridDbImageData>,
    pub icons: Vec<SteamGridDbImageData>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SteamGridDbImageData {
    pub id: String,
    pub url: String,
    pub thumb_url: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

fn get_api_key() -> Option<String> {
    crate::api_keys::steamgriddb_api_key()
}

fn is_plausible_image_url(url: &str) -> bool {
    let u = url.trim();
    if u.len() < 12 {
        return false;
    }
    let lower = u.to_ascii_lowercase();
    (lower.starts_with("https://") || lower.starts_with("http://"))
        && !lower.contains(' ')
        && !lower.contains('<')
}

fn normalize_title(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ").trim().to_string()
}

/// Strip common subtitle patterns: "Game: DLC", "Game - Subtitle"
fn strip_subtitle(s: &str) -> String {
    let t = normalize_title(s);
    if let Some((base, _)) = t.split_once(':') {
        let b = normalize_title(base);
        if b.len() >= 3 {
            return b;
        }
    }
    if let Some((base, _)) = t.split_once(" - ") {
        let b = normalize_title(base);
        if b.len() >= 3 {
            return b;
        }
    }
    t
}

/// Letters, digits, spaces only (for alternate search queries)
fn alphanumeric_title(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn title_search_queries(library_title: &str, igdb_title: Option<&str>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut seen = HashSet::new();

    let mut push = |s: String| {
        let n = normalize_title(&s);
        if n.len() < 2 {
            return;
        }
        if seen.insert(n.clone()) {
            out.push(n);
        }
    };

    push(library_title.to_string());
    push(strip_subtitle(library_title));
    push(alphanumeric_title(library_title));

    if let Some(igdb) = igdb_title {
        if !igdb.trim().is_empty() {
            push(igdb.to_string());
            push(strip_subtitle(igdb));
            push(alphanumeric_title(igdb));
        }
    }

    out
}

fn score_match(game_name: &str, query: &str) -> i32 {
    let g = game_name.to_ascii_lowercase();
    let q = query.to_ascii_lowercase();
    if g == q {
        return 1000;
    }
    if g.starts_with(&q) {
        return 800;
    }
    if g.contains(&q) {
        return 500;
    }
    200
}

/// Search autocomplete for one query string (SteamGridDB v2)
pub async fn search_game(title: &str) -> Result<Vec<SteamGridDbGame>, String> {
    let api_key = match get_api_key() {
        Some(key) => key,
        None => {
            log::info!("SteamGridDB API key not configured, skipping search");
            return Ok(Vec::new());
        }
    };

    let client = Client::new();
    let encoded_title = urlencoding::encode(title);
    let url = format!(
        "https://www.steamgriddb.com/api/v2/search/autocomplete/{}?limit=50",
        encoded_title
    );

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("SteamGridDB search failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        log::warn!("SteamGridDB search error: {} - {}", status, text);
        return Ok(Vec::new());
    }

    let search_result = response
        .json::<SteamGridDbSearchResponse>()
        .await
        .map_err(|e| format!("SteamGridDB parse failed: {}", e))?;

    log::info!(
        "SteamGridDB autocomplete '{}' returned {} games",
        title,
        search_result.data.len()
    );
    Ok(search_result.data)
}

/// Merge searches across title variants; pick best SteamGridDB game id.
async fn resolve_best_game_id(
    library_title: &str,
    igdb_title: Option<&str>,
    searched_titles: &mut Vec<String>,
) -> Result<Option<SteamGridDbGame>, String> {
    let queries = title_search_queries(library_title, igdb_title);
    *searched_titles = queries.clone();

    let mut best_by_id: HashMap<i64, (SteamGridDbGame, i32)> = HashMap::new();

    for q in &queries {
        let games = search_game(q).await?;
        for g in games {
            let mut best = score_match(&g.name, q);
            for alt in &queries {
                best = best.max(score_match(&g.name, alt));
            }
            best_by_id
                .entry(g.id)
                .and_modify(|eg| {
                    if best > eg.1 {
                        *eg = (g.clone(), best);
                    }
                })
                .or_insert((g, best));
        }
    }

    let chosen = best_by_id
        .into_values()
        .max_by_key(|(_, score)| *score)
        .map(|(g, _)| g);

    Ok(chosen)
}

async fn fetch_image_page(
    url: &str,
    api_key: &str,
    failed_http: &mut u32,
) -> Result<Vec<SteamGridDbImageData>, String> {
    let client = Client::new();
    let response = client
        .get(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("SteamGridDB request failed: {}", e))?;

    if !response.status().is_success() {
        *failed_http += 1;
        log::warn!("SteamGridDB error: {} for {}", response.status(), url);
        return Ok(Vec::new());
    }

    let images = response
        .json::<SteamGridDbImagesResponse>()
        .await
        .map_err(|e| format!("SteamGridDB parse failed: {}", e))?;

    Ok(images
        .data
        .into_iter()
        .filter(|img| is_plausible_image_url(&img.url) && is_plausible_image_url(&img.thumb))
        .map(|img| SteamGridDbImageData {
            id: format!("sgdb_{}", img.id),
            url: img.url,
            thumb_url: img.thumb,
            width: img.width,
            height: img.height,
        })
        .collect())
}

/// Grid dimensions rotated by page to maximize variety (API accepts comma-separated dimensions).
const GRID_DIMENSION_PAGES: &[&str] = &[
    "600x900,342x482,660x930,512x512",
    "920x430,460x215,1024x1600,800x1200",
    "1920x1080,1280x720,3840x2160",
];

pub async fn get_grids(game_id: i64) -> Result<(Vec<SteamGridDbImageData>, u32), String> {
    let api_key = match get_api_key() {
        Some(key) => key,
        None => {
            log::info!("SteamGridDB API key not configured, skipping grids");
            return Ok((Vec::new(), 0));
        }
    };

    let mut all: Vec<SteamGridDbImageData> = Vec::new();
    let mut seen = HashSet::new();
    let mut failed_http = 0u32;

    for page in 0..16usize {
        let dims = GRID_DIMENSION_PAGES[page % GRID_DIMENSION_PAGES.len()];
        let url = format!(
            "https://www.steamgriddb.com/api/v2/grids/game/{}?dimensions={}&types=static,animated&page={}",
            game_id, dims, page
        );
        let batch = fetch_image_page(&url, &api_key, &mut failed_http).await?;
        if batch.is_empty() {
            break;
        }
        for img in batch {
            if seen.insert(img.url.clone()) {
                all.push(img);
            }
        }
        if all.len() >= 120 {
            break;
        }
    }

    log::info!(
        "SteamGridDB returned {} grids for game {} (failed_http={})",
        all.len(),
        game_id,
        failed_http
    );
    Ok((all, failed_http))
}

pub async fn get_heroes(game_id: i64) -> Result<(Vec<SteamGridDbImageData>, u32), String> {
    let api_key = match get_api_key() {
        Some(key) => key,
        None => {
            log::info!("SteamGridDB API key not configured, skipping heroes");
            return Ok((Vec::new(), 0));
        }
    };

    let mut all: Vec<SteamGridDbImageData> = Vec::new();
    let mut seen = HashSet::new();
    let mut failed_http = 0u32;

    for page in 0..16usize {
        let url = format!(
            "https://www.steamgriddb.com/api/v2/heroes/game/{}?types=static,animated&page={}",
            game_id, page
        );
        let batch = fetch_image_page(&url, &api_key, &mut failed_http).await?;
        if batch.is_empty() {
            break;
        }
        for img in batch {
            if seen.insert(img.url.clone()) {
                all.push(img);
            }
        }
        if all.len() >= 100 {
            break;
        }
    }

    log::info!(
        "SteamGridDB returned {} heroes for game {} (failed_http={})",
        all.len(),
        game_id,
        failed_http
    );
    Ok((all, failed_http))
}

pub async fn get_logos(game_id: i64) -> Result<(Vec<SteamGridDbImageData>, u32), String> {
    let api_key = match get_api_key() {
        Some(key) => key,
        None => {
            log::info!("SteamGridDB API key not configured, skipping logos");
            return Ok((Vec::new(), 0));
        }
    };

    let mut all: Vec<SteamGridDbImageData> = Vec::new();
    let mut seen = HashSet::new();
    let mut failed_http = 0u32;

    for page in 0..14usize {
        let url = format!(
            "https://www.steamgriddb.com/api/v2/logos/game/{}?types=static,animated&page={}",
            game_id, page
        );
        let batch = fetch_image_page(&url, &api_key, &mut failed_http).await?;
        if batch.is_empty() {
            break;
        }
        for img in batch {
            if seen.insert(img.url.clone()) {
                all.push(img);
            }
        }
        if all.len() >= 80 {
            break;
        }
    }

    log::info!(
        "SteamGridDB returned {} logos for game {} (failed_http={})",
        all.len(),
        game_id,
        failed_http
    );
    Ok((all, failed_http))
}

pub async fn get_icons(game_id: i64) -> Result<(Vec<SteamGridDbImageData>, u32), String> {
    let api_key = match get_api_key() {
        Some(key) => key,
        None => {
            log::info!("SteamGridDB API key not configured, skipping icons");
            return Ok((Vec::new(), 0));
        }
    };

    let mut all: Vec<SteamGridDbImageData> = Vec::new();
    let mut seen = HashSet::new();
    let mut failed_http = 0u32;

    for page in 0..14usize {
        let url = format!(
            "https://www.steamgriddb.com/api/v2/icons/game/{}?types=static,animated&page={}",
            game_id, page
        );
        let batch = fetch_image_page(&url, &api_key, &mut failed_http).await?;
        if batch.is_empty() {
            break;
        }
        for img in batch {
            if seen.insert(img.url.clone()) {
                all.push(img);
            }
        }
        if all.len() >= 80 {
            break;
        }
    }

    log::info!(
        "SteamGridDB returned {} icons for game {} (failed_http={})",
        all.len(),
        game_id,
        failed_http
    );
    Ok((all, failed_http))
}

/// Primary library title plus optional IGDB canonical name for better matching.
pub async fn get_game_media(
    library_title: &str,
    igdb_title: Option<&str>,
) -> Result<SteamGridDbMedia, String> {
    let mut searched_titles: Vec<String> = Vec::new();
    let resolved = resolve_best_game_id(library_title, igdb_title, &mut searched_titles).await?;

    let Some(game) = resolved else {
        log::info!(
            "SteamGridDB: no game match for library_title='{}' igdb_title={:?} searched={:?}",
            library_title,
            igdb_title,
            searched_titles
        );
        return Ok(SteamGridDbMedia {
            game_id: 0,
            game_name: library_title.to_string(),
            posters: Vec::new(),
            backgrounds: Vec::new(),
            logos: Vec::new(),
            icons: Vec::new(),
        });
    };

    let (posters_r, heroes_r, logos_r, icons_r) = tokio::join!(
        get_grids(game.id),
        get_heroes(game.id),
        get_logos(game.id),
        get_icons(game.id),
    );

    let (posters, fp) = posters_r.unwrap_or_default();
    let (backgrounds, fh) = heroes_r.unwrap_or_default();
    let (logos, fl) = logos_r.unwrap_or_default();
    let (icons, fi) = icons_r.unwrap_or_default();
    let failed_image_count = fp + fh + fl + fi;

    log::info!(
        "SteamGridDB media fetch searched_titles={:?} steamgriddb_game_id={} steamgriddb_name='{}' grids={} heroes={} logos={} icons={} failed_http={}",
        searched_titles,
        game.id,
        game.name,
        posters.len(),
        backgrounds.len(),
        logos.len(),
        icons.len(),
        failed_image_count
    );

    Ok(SteamGridDbMedia {
        game_id: game.id,
        game_name: game.name.clone(),
        posters,
        backgrounds,
        logos,
        icons,
    })
}

pub fn is_configured() -> bool {
    get_api_key().is_some()
}
