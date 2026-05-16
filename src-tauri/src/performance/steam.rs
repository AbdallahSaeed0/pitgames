use log::info;
use serde_json::Value;

#[derive(Debug, Clone)]
pub struct SteamSearchHit {
    pub id: Option<i64>,
    pub name: Option<String>,
    pub tiny_image: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SteamAppDetails {
    pub name: Option<String>,
    pub pc_requirements_minimum: Option<String>,
    pub pc_requirements_recommended: Option<String>,
    pub header_image: Option<String>,
}

fn extract_i64(val: Option<&Value>) -> Option<i64> {
    let v = val?;
    if let Some(i) = v.as_i64() {
        return Some(i);
    }
    if let Some(u) = v.as_u64() {
        return i64::try_from(u).ok();
    }
    if let Some(s) = v.as_str() {
        return s.trim().parse::<i64>().ok();
    }
    None
}

fn extract_steam_app_id(item: &Value) -> Option<i64> {
    for key in &[
        "id", "appid", "app_id", "steam_app_id", "steamAppId", "steamAppID",
    ] {
        if let Some(id) = extract_i64(item.get(*key)) {
            if id > 0 {
                return Some(id);
            }
        }
    }
    None
}

pub async fn search_steam_store(query: &str) -> Result<Vec<SteamSearchHit>, String> {
    let q = urlencoding::encode(query.trim());
    let url = format!(
        "https://store.steampowered.com/api/storesearch/?term={}&cc=us&l=en",
        q
    );
    let client = reqwest::Client::builder()
        .user_agent("PitGames/0.1 (local compatibility)")
        .build()
        .map_err(|e| e.to_string())?;
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let root: Value = res.json().await.map_err(|e| e.to_string())?;

    let items = root
        .get("items")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();

    let mut out: Vec<SteamSearchHit> = Vec::new();
    for item in items {
        let id = extract_steam_app_id(&item);
        let name = item
            .get("name")
            .and_then(|x| x.as_str())
            .map(String::from)
            .or_else(|| {
                item.get("localized_name")
                    .and_then(|x| x.as_str())
                    .map(String::from)
            });
        let tiny_image = item
            .get("tiny_image")
            .and_then(|x| x.as_str())
            .map(String::from)
            .or_else(|| {
                item.get("tinyImage")
                    .and_then(|x| x.as_str())
                    .map(String::from)
            });

        info!(
            "Steam storesearch row: parsed app id {:?}, name {:?}",
            id,
            name.as_ref().map(|s| s.as_str())
        );

        out.push(SteamSearchHit {
            id,
            name,
            tiny_image,
        });
    }

    info!(
        "Steam storesearch term={:?} result_rows={}",
        query.trim(),
        out.len()
    );

    Ok(out)
}

pub async fn fetch_steam_app_details(app_id: i64) -> Result<SteamAppDetails, String> {
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={}&l=en",
        app_id
    );
    let client = reqwest::Client::builder()
        .user_agent("PitGames/0.1 (local compatibility)")
        .build()
        .map_err(|e| e.to_string())?;
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let v: Value = res.json().await.map_err(|e| e.to_string())?;
    let key = app_id.to_string();
    let entry = v.get(&key).ok_or_else(|| "Missing app entry".to_string())?;
    let success = entry
        .get("success")
        .and_then(|x| x.as_bool())
        .unwrap_or(false);
    if !success {
        return Err("Steam returned success=false".to_string());
    }
    let data = entry.get("data").ok_or_else(|| "Missing data".to_string())?;
    let name = data.get("name").and_then(|x| x.as_str()).map(String::from);
    let pc = data.get("pc_requirements");
    let min = pc
        .and_then(|p| p.get("minimum"))
        .and_then(|x| x.as_str())
        .map(String::from);
    let rec = pc
        .and_then(|p| p.get("recommended"))
        .and_then(|x| x.as_str())
        .map(String::from);
    let header_image = data
        .get("header_image")
        .and_then(|x| x.as_str())
        .map(String::from);

    info!(
        "Steam appdetails {} — min html: {}, rec html: {}",
        app_id,
        min.is_some(),
        rec.is_some()
    );

    Ok(SteamAppDetails {
        name,
        pc_requirements_minimum: min,
        pc_requirements_recommended: rec,
        header_image,
    })
}
