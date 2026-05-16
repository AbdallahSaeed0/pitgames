use serde::{Deserialize, Serialize};
use crate::igdb::{IgdbGameMetadata, IgdbImage, IgdbTrailer, IgdbImageSize, get_igdb_image_url};
use crate::steamgriddb::{SteamGridDbImageData, get_game_media as get_steamgriddb_media};
use log;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaImage {
    pub id: String,
    pub image_id: Option<String>,
    pub url: String,
    pub thumb_url: String,
    pub source: String, // "igdb", "steamgriddb", "rawg", "manual"
    pub width: Option<i32>,
    pub height: Option<i32>,
}

impl MediaImage {
    pub fn from_igdb(img: &IgdbImage) -> Self {
        Self {
            id: img.id.clone(),
            image_id: Some(img.image_id.clone()),
            url: img.url.clone(),
            thumb_url: img.thumb_url.clone(),
            source: img.source.clone(),
            width: None,
            height: None,
        }
    }

    pub fn from_steamgriddb(img: &SteamGridDbImageData, _media_type: &str) -> Self {
        Self {
            id: img.id.clone(),
            image_id: None,
            url: img.url.clone(),
            thumb_url: img.thumb_url.clone(),
            source: "steamgriddb".to_string(),
            width: img.width,
            height: img.height,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Trailer {
    pub id: String,
    pub name: String,
    pub video_id: String,
    pub youtube_url: String,
    pub thumbnail_url: String,
    pub source: String,
}

impl Trailer {
    pub fn from_igdb(t: &IgdbTrailer) -> Self {
        Self {
            id: t.id.clone(),
            name: t.name.clone(),
            video_id: t.video_id.clone(),
            youtube_url: t.youtube_url.clone(),
            thumbnail_url: t.thumbnail_url.clone(),
            source: "igdb".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameMedia {
    pub covers: Vec<MediaImage>,      // Portrait/cover images for posters
    pub artworks: Vec<MediaImage>,  // Background/artwork images
    pub screenshots: Vec<MediaImage>, // Screenshot images
    pub trailers: Vec<Trailer>,     // Video trailers
    pub logos: Vec<MediaImage>,     // Logos
    pub icons: Vec<MediaImage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaStats {
    pub igdb_cover: usize,
    pub igdb_artworks: usize,
    pub igdb_screenshots: usize,
    pub igdb_trailers: usize,
    pub fallback_source: Option<String>,
    pub fallback_posters: usize,
    pub fallback_backgrounds: usize,
    pub final_poster_options: usize,
    pub final_background_options: usize,
}

#[derive(Serialize, Deserialize)]
pub struct GameMediaResponse {
    pub covers: Vec<MediaImageResponse>,
    pub artworks: Vec<MediaImageResponse>,
    pub screenshots: Vec<MediaImageResponse>,
    pub trailers: Vec<TrailerResponse>,
    pub logos: Vec<MediaImageResponse>,
    #[serde(default)]
    pub icons: Vec<MediaImageResponse>,
    pub stats: MediaStatsResponse,
}

#[derive(Serialize, Deserialize)]
pub struct MediaImageResponse {
    pub id: String,
    pub url: String,
    pub thumb_url: String,
    pub source: String,
}

#[derive(Serialize, Deserialize)]
pub struct TrailerResponse {
    pub id: String,
    pub name: String,
    pub video_id: String,
    pub youtube_url: String,
    pub thumbnail_url: String,
}

#[derive(Serialize, Deserialize)]
pub struct MediaStatsResponse {
    pub igdb_cover: usize,
    pub igdb_artworks: usize,
    pub igdb_screenshots: usize,
    pub igdb_trailers: usize,
    pub fallback_source: Option<String>,
    pub fallback_posters: usize,
    pub fallback_backgrounds: usize,
    pub final_poster_options: usize,
    pub final_background_options: usize,
}

/// Fetch and merge media from all sources
/// IGDB is primary, SteamGridDB is fallback
pub async fn fetch_game_media(
    igdb_metadata: &IgdbGameMetadata,
    library_title: &str,
) -> (GameMedia, MediaStats) {
    let mut media = GameMedia {
        covers: Vec::new(),
        artworks: Vec::new(),
        screenshots: Vec::new(),
        trailers: Vec::new(),
        logos: Vec::new(),
        icons: Vec::new(),
    };

    let mut stats = MediaStats {
        igdb_cover: if igdb_metadata.cover.is_some() { 1 } else { 0 },
        igdb_artworks: igdb_metadata.artworks.len(),
        igdb_screenshots: igdb_metadata.screenshots.len(),
        igdb_trailers: igdb_metadata.trailers.len(),
        fallback_source: None,
        fallback_posters: 0,
        fallback_backgrounds: 0,
        final_poster_options: 0,
        final_background_options: 0,
    };

    // Add IGDB cover
    if let Some(ref cover) = igdb_metadata.cover {
        media.covers.push(MediaImage {
            id: format!("igdb_cover_{}", cover.image_id),
            image_id: Some(cover.image_id.clone()),
            url: cover.url.clone(),
            thumb_url: cover.thumb_url.clone(),
            source: "igdb".to_string(),
            width: None,
            height: None,
        });
    }

    // Add IGDB artworks (for both backgrounds and cover fallbacks)
    for artwork in &igdb_metadata.artworks {
        media.artworks.push(MediaImage::from_igdb(artwork));
        // Also add to covers as fallback option
        media.covers.push(MediaImage::from_igdb(artwork));
    }

    // Add IGDB screenshots
    for screenshot in &igdb_metadata.screenshots {
        media.screenshots.push(MediaImage::from_igdb(screenshot));
        // Also add to artworks as fallback
        media.artworks.push(MediaImage::from_igdb(screenshot));
    }

    // Add IGDB trailers
    for trailer in &igdb_metadata.trailers {
        media.trailers.push(Trailer::from_igdb(trailer));
    }

    log::info!(
        "IGDB media counts for '{}': cover={}, artworks={}, screenshots={}, trailers={}",
        library_title,
        stats.igdb_cover,
        stats.igdb_artworks,
        stats.igdb_screenshots,
        stats.igdb_trailers
    );

    // Trigger fallback using IGDB-only counts (as required by product logic)
    let need_poster_fallback = stats.igdb_cover < 3;
    let need_background_fallback = stats.igdb_artworks < 3;

    if need_poster_fallback || need_background_fallback {
        log::info!(
            "Need fallback for '{}': posters={}/3, backgrounds={}/3",
            library_title,
            media.covers.len(),
            media.artworks.len()
        );

        // Try SteamGridDB fallback (library title + IGDB canonical name)
        if crate::steamgriddb::is_configured() {
            match get_steamgriddb_media(library_title, Some(igdb_metadata.title.as_str())).await {
                Ok(sgdb_media) => {
                    stats.fallback_source = Some("steamgriddb".to_string());
                    stats.fallback_posters = sgdb_media.posters.len();
                    stats.fallback_backgrounds = sgdb_media.backgrounds.len();

                    // Add SteamGridDB posters if needed
                    if need_poster_fallback {
                        for poster in &sgdb_media.posters {
                            media.covers.push(MediaImage::from_steamgriddb(poster, "poster"));
                        }
                    }

                    // Add SteamGridDB backgrounds if needed
                    if need_background_fallback {
                        for background in &sgdb_media.backgrounds {
                            media.artworks.push(MediaImage::from_steamgriddb(background, "background"));
                        }
                    }

                    // Add SteamGridDB logos
                    for logo in &sgdb_media.logos {
                        media.logos.push(MediaImage::from_steamgriddb(logo, "logo"));
                    }

                    for icon in &sgdb_media.icons {
                        media.icons.push(MediaImage::from_steamgriddb(icon, "icon"));
                    }

                    log::info!(
                        "SteamGridDB media counts for '{}': posters={}, heroes={}, logos={}, icons={}",
                        library_title,
                        sgdb_media.posters.len(),
                        sgdb_media.backgrounds.len(),
                        sgdb_media.logos.len(),
                        sgdb_media.icons.len()
                    );
                }
                Err(e) => {
                    log::warn!("SteamGridDB fallback failed: {}", e);
                }
            }
        } else {
            log::info!("SteamGridDB not configured; continuing with IGDB-only media");
        }
    } else {
        log::info!("No fallback needed for '{}' - sufficient IGDB media", library_title);
    }

    // Deduplicate by URL
    media.covers = deduplicate_images(media.covers);
    media.artworks = deduplicate_images(media.artworks);
    media.screenshots = deduplicate_images(media.screenshots);
    media.logos = deduplicate_images(media.logos);
    media.icons = deduplicate_images(media.icons);

    // Update final stats
    stats.final_poster_options = media.covers.len();
    stats.final_background_options = media.artworks.len();

    log::info!(
        "Final media counts for '{}': covers={}, artworks={}, screenshots={}, trailers={}, fallback={:?}",
        library_title,
        stats.final_poster_options,
        stats.final_background_options,
        media.screenshots.len(),
        media.trailers.len(),
        stats.fallback_source
    );

    (media, stats)
}

fn deduplicate_images(images: Vec<MediaImage>) -> Vec<MediaImage> {
    let mut seen = std::collections::HashSet::new();
    images.into_iter().filter(|img| seen.insert(img.url.clone())).collect()
}

/// Get poster options (for Change Poster feature)
/// Priority: IGDB cover -> IGDB Artworks -> IGDB Screenshots -> Fallback
#[allow(dead_code)]
pub fn get_poster_options(media: &GameMedia) -> Vec<&MediaImage> {
    media.covers.iter().collect()
}

/// Get background/cover options (for Change Cover feature)
/// Priority: IGDB Artworks -> IGDB Screenshots -> IGDB Cover -> Fallback
#[allow(dead_code)]
pub fn get_background_options(media: &GameMedia) -> Vec<&MediaImage> {
    media.artworks.iter().collect()
}

/// Generate IGDB image URL from stored image_id
#[allow(dead_code)]
pub fn get_igdb_url_from_id(image_id: &str, size: &str) -> String {
    let igdb_size = match size {
        "cover_big" => IgdbImageSize::CoverBig,
        "cover_2x" => IgdbImageSize::Cover2x,
        "screenshot_big" => IgdbImageSize::ScreenshotBig,
        "screenshot_huge" => IgdbImageSize::ScreenshotHuge,
        "1080p" => IgdbImageSize::Size1080p,
        _ => IgdbImageSize::CoverBig,
    };
    get_igdb_image_url(image_id, igdb_size)
}
