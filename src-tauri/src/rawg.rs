use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct RawgSearchResponse {
    results: Vec<RawgGame>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct RawgGame {
    pub id: i64,
    pub name: String,
    pub background_image: Option<String>,
    pub rating: Option<f32>,
}

pub async fn search_rawg(query: &str) -> Result<Vec<RawgGame>, String> {
    let api_key = crate::api_keys::rawg_api_key().ok_or_else(|| {
        "RAWG API key is not set. Open Settings → API keys or set RAWG_API_KEY in the environment.".to_string()
    })?;

    let encoded_query = urlencoding::encode(query);
    let url = format!(
        "https://api.rawg.io/api/games?key={}&search={}&page_size=10",
        api_key, encoded_query
    );

    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json::<RawgSearchResponse>()
        .await
        .map_err(|e| e.to_string())?;

    Ok(response.results)
}
