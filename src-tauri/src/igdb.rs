use serde::{Deserialize, Serialize};
use reqwest::Client;
use log;

#[derive(Debug, Deserialize)]
struct IgdbAuthResponse {
    access_token: String,
}

/// IGDB Image Size Options
#[allow(dead_code)]
pub enum IgdbImageSize {
    CoverBig,
    Cover2x,
    ScreenshotBig,
    ScreenshotHuge,
    Size1080p,
}

impl IgdbImageSize {
    pub fn as_str(&self) -> &'static str {
        match self {
            IgdbImageSize::CoverBig => "cover_big",
            IgdbImageSize::Cover2x => "cover_big_2x",
            IgdbImageSize::ScreenshotBig => "screenshot_big",
            IgdbImageSize::ScreenshotHuge => "screenshot_huge",
            IgdbImageSize::Size1080p => "1080p",
        }
    }
}

/// Generate IGDB image URL from image_id
pub fn get_igdb_image_url(image_id: &str, size: IgdbImageSize) -> String {
    format!("https://images.igdb.com/igdb/image/upload/t_{}/{}.jpg", size.as_str(), image_id)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct IgdbGameMetadata {
    pub igdb_id: i64,
    pub title: String,
    pub summary: Option<String>,
    pub storyline: Option<String>,
    pub release_date: Option<i64>,
    pub cover: Option<IgdbCover>,
    pub artworks: Vec<IgdbImage>,
    pub screenshots: Vec<IgdbImage>,
    pub trailers: Vec<IgdbTrailer>,
    pub rating: Option<f64>,
    pub rating_count: Option<i32>,
    pub total_rating: Option<f64>,
    pub total_rating_count: Option<i32>,
    pub genres: Vec<String>,
    pub platforms: Vec<String>,
    pub developers: Vec<String>,
    pub publishers: Vec<String>,
    pub similar_games: Vec<IgdbSimilarGame>,
    pub time_to_beat: Option<IgdbTimeToBeat>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct IgdbCover {
    pub image_id: String,
    pub url: String,
    pub thumb_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct IgdbImage {
    pub id: String,
    pub image_id: String,
    pub url: String,
    pub thumb_url: String,
    pub source: String,
}

impl IgdbImage {
    pub fn from_igdb(image_id: &str, size: IgdbImageSize, thumb_size: IgdbImageSize) -> Self {
        Self {
            id: format!("igdb_{}", image_id),
            image_id: image_id.to_string(),
            url: get_igdb_image_url(image_id, size),
            thumb_url: get_igdb_image_url(image_id, thumb_size),
            source: "igdb".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct IgdbTrailer {
    pub id: String,
    pub name: String,
    pub video_id: String,
    pub youtube_url: String,
    pub thumbnail_url: String,
}

impl IgdbTrailer {
    pub fn from_igdb(video_id: &str, name: Option<String>) -> Self {
        let name = name.unwrap_or_else(|| "Trailer".to_string());
        Self {
            id: format!("youtube_{}", video_id),
            name,
            video_id: video_id.to_string(),
            youtube_url: format!("https://www.youtube.com/watch?v={}", video_id),
            thumbnail_url: format!("https://img.youtube.com/vi/{}/hqdefault.jpg", video_id),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct IgdbSimilarGame {
    pub id: i64,
    pub name: String,
    pub cover: Option<IgdbCover>,
    pub first_release_date: Option<i64>,
    pub rating: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct IgdbTimeToBeat {
    pub main_story: Option<i64>,
    pub main_extras: Option<i64>,
    pub completionist: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct IgdbGameResponse {
    id: i64,
    name: String,
    summary: Option<String>,
    storyline: Option<String>,
    first_release_date: Option<i64>,
    cover: Option<IgdbCoverResponse>,
    artworks: Option<Vec<IgdbImageResponse>>,
    screenshots: Option<Vec<IgdbImageResponse>>,
    videos: Option<Vec<IgdbVideoResponse>>,
    genres: Option<Vec<IgdbName>>,
    platforms: Option<Vec<IgdbName>>,
    involved_companies: Option<Vec<IgdbInvolvedCompany>>,
    rating: Option<f64>,
    rating_count: Option<i32>,
    total_rating: Option<f64>,
    total_rating_count: Option<i32>,
    similar_games: Option<Vec<IgdbSimilarGameResponse>>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct IgdbCoverResponse {
    id: i64,
    image_id: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct IgdbImageResponse {
    id: i64,
    image_id: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct IgdbVideoResponse {
    id: i64,
    name: Option<String>,
    video_id: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct IgdbName {
    name: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct IgdbInvolvedCompany {
    company: IgdbName,
    developer: bool,
    publisher: bool,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct IgdbSimilarGameResponse {
    id: i64,
    name: String,
    first_release_date: Option<i64>,
    rating: Option<f64>,
    cover: Option<IgdbCoverResponse>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct IgdbTimeToBeatResponse {
    hastily: Option<i64>,
    normally: Option<i64>,
    completely: Option<i64>,
}

async fn get_igdb_access_token() -> Result<String, String> {
    let client_id = crate::api_keys::igdb_client_id().ok_or_else(|| {
        "IGDB Client ID is not set. Open Settings → API keys and add your Twitch Client ID, or set IGDB_CLIENT_ID in the environment.".to_string()
    })?;
    let client_secret = crate::api_keys::igdb_client_secret().ok_or_else(|| {
        "IGDB Client Secret is not set. Open Settings → API keys and add your Twitch Client Secret, or set IGDB_CLIENT_SECRET in the environment.".to_string()
    })?;

    let client = Client::new();
    let resp = client
        .post("https://id.twitch.tv/oauth2/token")
        .query(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("grant_type", "client_credentials"),
        ])
        .send()
        .await
        .map_err(|e| format!("Twitch token request failed: {}", e))?;

    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("Twitch token response read failed: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "Twitch OAuth failed (HTTP {}): {}. Check IGDB_CLIENT_ID / IGDB_CLIENT_SECRET on dev.twitch.tv (Client ID + Client Secret).",
            status, body.trim()
        ));
    }

    let parsed: IgdbAuthResponse = serde_json::from_str(&body).map_err(|e| {
        format!(
            "Twitch token JSON parse failed: {}. Body: {}",
            e,
            body.chars().take(500).collect::<String>()
        )
    })?;

    Ok(parsed.access_token)
}

/// Search games on IGDB with full metadata
pub async fn search_igdb_games(query: &str) -> Result<Vec<IgdbGameMetadata>, String> {
    let client_id = crate::api_keys::igdb_client_id()
        .ok_or_else(|| "IGDB Client ID is not set (Settings → API keys or environment).".to_string())?;
    let access_token = get_igdb_access_token().await?;

    let client = Client::new();
    
    // Complete fields query as specified
    let body = format!(
        r#"search "{}"; 
        fields 
            id,
            name,
            summary,
            storyline,
            first_release_date,
            genres.name,
            platforms.name,
            involved_companies.company.name,
            involved_companies.developer,
            involved_companies.publisher,
            cover.image_id,
            artworks.image_id,
            screenshots.image_id,
            videos.name,
            videos.video_id,
            rating,
            rating_count,
            total_rating,
            total_rating_count,
            similar_games.name,
            similar_games.cover.image_id,
            similar_games.first_release_date,
            similar_games.rating;
        limit 10;"#,
        query.replace("\"", "\\\"")
    );

    log::info!("IGDB search query for: {}", query);

    let response = client
        .post("https://api.igdb.com/v4/games")
        .header("Client-ID", &client_id)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Accept", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("IGDB request failed: {}", e))?;

    let games_response = response
        .json::<Vec<IgdbGameResponse>>()
        .await
        .map_err(|e| format!("IGDB parse failed: {}", e))?;

    log::info!("IGDB returned {} games", games_response.len());

    let mut games = Vec::new();
    for g in games_response {
        let metadata = process_igdb_game(g, &client_id, &access_token).await?;
        games.push(metadata);
    }

    Ok(games)
}

/// Get single game by ID with full metadata
pub async fn get_igdb_game_by_id(igdb_id: i64) -> Result<IgdbGameMetadata, String> {
    let client_id = crate::api_keys::igdb_client_id()
        .ok_or_else(|| "IGDB Client ID is not set (Settings → API keys or environment).".to_string())?;
    let access_token = get_igdb_access_token().await?;

    let client = Client::new();
    
    let body = format!(
        r#"fields 
            id,
            name,
            summary,
            storyline,
            first_release_date,
            genres.name,
            platforms.name,
            involved_companies.company.name,
            involved_companies.developer,
            involved_companies.publisher,
            cover.image_id,
            artworks.image_id,
            screenshots.image_id,
            videos.name,
            videos.video_id,
            rating,
            rating_count,
            total_rating,
            total_rating_count,
            similar_games.name,
            similar_games.cover.image_id,
            similar_games.first_release_date,
            similar_games.rating;
        where id = {};"#,
        igdb_id
    );

    let response = client
        .post("https://api.igdb.com/v4/games")
        .header("Client-ID", &client_id)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Accept", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("IGDB request failed: {}", e))?;

    let mut games = response
        .json::<Vec<IgdbGameResponse>>()
        .await
        .map_err(|e| format!("IGDB parse failed: {}", e))?;

    if games.is_empty() {
        return Err(format!("Game with ID {} not found in IGDB", igdb_id));
    }

    process_igdb_game(games.remove(0), &client_id, &access_token).await
}

/// Process raw IGDB response into structured metadata
async fn process_igdb_game(
    g: IgdbGameResponse,
    client_id: &str,
    access_token: &str,
) -> Result<IgdbGameMetadata, String> {
    // Process companies
    let mut developers = Vec::new();
    let mut publishers = Vec::new();

    if let Some(companies) = g.involved_companies {
        for comp in companies {
            if comp.developer {
                developers.push(comp.company.name.clone());
            }
            if comp.publisher {
                publishers.push(comp.company.name);
            }
        }
    }

    // Process cover
    let cover = g.cover.map(|c| IgdbCover {
        image_id: c.image_id.clone(),
        url: get_igdb_image_url(&c.image_id, IgdbImageSize::CoverBig),
        thumb_url: get_igdb_image_url(&c.image_id, IgdbImageSize::CoverBig),
    });

    // Process artworks with multiple sizes
    let artworks: Vec<IgdbImage> = g.artworks.unwrap_or_default()
        .into_iter()
        .map(|img| IgdbImage::from_igdb(&img.image_id, IgdbImageSize::Size1080p, IgdbImageSize::ScreenshotBig))
        .collect();

    // Process screenshots
    let screenshots: Vec<IgdbImage> = g.screenshots.unwrap_or_default()
        .into_iter()
        .map(|img| IgdbImage::from_igdb(&img.image_id, IgdbImageSize::ScreenshotHuge, IgdbImageSize::ScreenshotBig))
        .collect();

    // Process trailers/videos
    let trailers: Vec<IgdbTrailer> = g.videos.unwrap_or_default()
        .into_iter()
        .map(|vid| IgdbTrailer::from_igdb(&vid.video_id, vid.name))
        .collect();

    // Process similar games
    let similar_games: Vec<IgdbSimilarGame> = g.similar_games.unwrap_or_default()
        .into_iter()
        .map(|sg| IgdbSimilarGame {
            id: sg.id,
            name: sg.name,
            cover: sg.cover.map(|c| IgdbCover {
                image_id: c.image_id.clone(),
                url: get_igdb_image_url(&c.image_id, IgdbImageSize::CoverBig),
                thumb_url: get_igdb_image_url(&c.image_id, IgdbImageSize::CoverBig),
            }),
            first_release_date: sg.first_release_date,
            rating: sg.rating,
        })
        .collect();

    // Fetch Time To Beat
    let time_to_beat = fetch_time_to_beat(g.id, client_id, access_token).await.ok();

    log::info!(
        "IGDB Game '{}' - Cover: {}, Artworks: {}, Screenshots: {}, Trailers: {}",
        g.name,
        if cover.is_some() { "yes" } else { "no" },
        artworks.len(),
        screenshots.len(),
        trailers.len()
    );

    Ok(IgdbGameMetadata {
        igdb_id: g.id,
        title: g.name,
        summary: g.summary,
        storyline: g.storyline,
        release_date: g.first_release_date,
        cover,
        artworks,
        screenshots,
        trailers,
        rating: g.rating,
        rating_count: g.rating_count,
        total_rating: g.total_rating,
        total_rating_count: g.total_rating_count,
        genres: g.genres.unwrap_or_default().into_iter().map(|gn| gn.name).collect(),
        platforms: g.platforms.unwrap_or_default().into_iter().map(|pn| pn.name).collect(),
        developers,
        publishers,
        similar_games,
        time_to_beat,
    })
}

async fn fetch_time_to_beat(game_id: i64, client_id: &str, access_token: &str) -> Result<IgdbTimeToBeat, String> {
    let client = Client::new();
    let body = format!("fields game_id,hastily,normally,completely,count; where game_id = {}; limit 1;", game_id);
    
    let response = client
        .post("https://api.igdb.com/v4/game_time_to_beats")
        .header("Client-ID", client_id)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Accept", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let time_data = response
        .json::<Vec<IgdbTimeToBeatResponse>>()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(t) = time_data.first() {
        // IGDB returns seconds, convert to hours
        Ok(IgdbTimeToBeat {
            main_story: t.hastily.map(|s| s / 3600),
            main_extras: t.normally.map(|s| s / 3600),
            completionist: t.completely.map(|s| s / 3600),
        })
    } else {
        Err("No time to beat data found".to_string())
    }
}
