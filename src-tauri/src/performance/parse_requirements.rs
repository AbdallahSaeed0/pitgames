use regex::Regex;
use serde::Serialize;
use std::sync::OnceLock;

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequirementSide {
    pub cpu: Option<String>,
    pub gpu: Option<String>,
    pub ram_gb: Option<f64>,
    pub vram_gb: Option<f64>,
    pub storage_gb: Option<f64>,
    pub os: Option<String>,
    pub directx: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedRequirements {
    pub minimum: RequirementSide,
    pub recommended: RequirementSide,
}

fn strip_html(raw: &str) -> String {
    static RE_BR: OnceLock<Regex> = OnceLock::new();
    static RE_TAG: OnceLock<Regex> = OnceLock::new();
    let re_br = RE_BR.get_or_init(|| Regex::new(r"(?i)<br\s*/?>").unwrap());
    let re_tag = RE_TAG.get_or_init(|| Regex::new(r"<[^>]+>").unwrap());
    let s = re_br.replace_all(raw, "\n");
    let s = re_tag.replace_all(&s, " ");
    html_entity_decode(&s)
}

fn html_entity_decode(s: &str) -> String {
    s.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn extract_ram_gb(text: &str) -> Option<f64> {
    static RE: OnceLock<Regex> = OnceLock::new();
    static RE2: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r"(?i)(?:memory|ram)\s*[:\s]*(?:requires\s*)?(\d+)\s*GB").unwrap()
    });
    let re2 = RE2.get_or_init(|| {
        Regex::new(r"(?i)(\d+)\s*GB\s*(?:RAM|memory|system memory)").unwrap()
    });
    re.captures(text)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<f64>().ok())
        .or_else(|| {
            re2.captures(text)
                .and_then(|c| c.get(1))
                .and_then(|m| m.as_str().parse::<f64>().ok())
        })
}

fn extract_vram_gb(text: &str) -> Option<f64> {
    static RE: OnceLock<Regex> = OnceLock::new();
    static RE_GPU_PAREN: OnceLock<Regex> = OnceLock::new();
    // Explicit label: "VRAM: 8 GB" / "Video RAM: 8 GB"
    let re = RE.get_or_init(|| {
        Regex::new(r"(?i)(?:video ram|vram|graphics memory)\s*[:\s]*(\d+(?:\.\d+)?)\s*GB").unwrap()
    });
    if let Some(v) = re.captures(text).and_then(|c| c.get(1)).and_then(|m| m.as_str().parse::<f64>().ok()) {
        return Some(v);
    }
    // Parenthetical in GPU name: "RTX 3060 (12 GB)" / "RX 5700 XT (8 GB)"
    // Only match when preceded by a GPU-like token to avoid matching storage/RAM fields.
    let re2 = RE_GPU_PAREN.get_or_init(|| {
        Regex::new(r"(?i)(?:gtx|rtx|rx|arc|radeon|geforce|intel)\b[^(\n]*\((\d+(?:\.\d+)?)\s*GB\)").unwrap()
    });
    re2.captures(text)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<f64>().ok())
}

fn extract_storage_gb(text: &str) -> Option<f64> {
    static RE: OnceLock<Regex> = OnceLock::new();
    static RE2: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r"(?i)(?:available space|hard drive|storage|disk space)\s*[:\s]*(\d+(?:\.\d+)?)\s*GB")
            .unwrap()
    });
    let re2 = RE2.get_or_init(|| {
        Regex::new(r"(?i)(\d+(?:\.\d+)?)\s*GB\s*(?:available|free space|storage|hard drive)").unwrap()
    });
    if let Some(c) = re.captures(text) {
        return c.get(1).and_then(|m| m.as_str().parse::<f64>().ok());
    }
    re2.captures(text)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<f64>().ok())
}

fn extract_directx(text: &str) -> Option<String> {
    static RE: OnceLock<Regex> = OnceLock::new();
    // Handles "DirectX 12", "DirectX: 12", "DirectX Version 12", "DirectX: Version 12"
    let re = RE.get_or_init(|| {
        Regex::new(r"(?i)DirectX[:\s]*(?:Version\s*)?(\d+(?:\.\d+)?)").unwrap()
    });
    re.captures(text)
        .and_then(|c| c.get(1))
        .map(|m| format!("DirectX {}", m.as_str()))
}

fn extract_os_line(text: &str) -> Option<String> {
    static RE: OnceLock<Regex> = OnceLock::new();
    // "OS *:" and "OS:" and "Operating System:" — require colon to avoid matching mid-sentence
    let re = RE.get_or_init(|| {
        Regex::new(r"(?i)(?:OS\b|Operating System)\s*\*?\s*:\s*([^\n\r]+)").unwrap()
    });
    re.captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
        .filter(|s| !s.is_empty())
}

fn extract_cpu_line(text: &str) -> Option<String> {
    static RE: OnceLock<Regex> = OnceLock::new();
    // Require colon so "Requires a 64-bit processor and operating system" does NOT match.
    let re = RE.get_or_init(|| {
        Regex::new(r"(?i)(?:Processor|CPU)\s*:\s*([^\n\r]+)").unwrap()
    });
    re.captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
        .filter(|s| !s.is_empty())
}

fn extract_gpu_line(text: &str) -> Option<String> {
    static RE: OnceLock<Regex> = OnceLock::new();
    // Require colon so "graphics" as a generic noun can't match.
    let re = RE.get_or_init(|| {
        Regex::new(r"(?i)(?:Graphics|Video Card|GPU)\s*:\s*([^\n\r]+)").unwrap()
    });
    re.captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn parse_steam_pc_block(raw: Option<&String>) -> RequirementSide {
    let Some(raw) = raw else {
        return RequirementSide::default();
    };
    let plain = strip_html(raw);
    RequirementSide {
        cpu: extract_cpu_line(&plain),
        gpu: extract_gpu_line(&plain),
        ram_gb: extract_ram_gb(&plain),
        vram_gb: extract_vram_gb(&plain),
        storage_gb: extract_storage_gb(&plain),
        os: extract_os_line(&plain),
        directx: extract_directx(&plain),
    }
}

pub fn parse_full_requirements(min_html: Option<&String>, rec_html: Option<&String>) -> ParsedRequirements {
    ParsedRequirements {
        minimum: parse_steam_pc_block(min_html),
        recommended: parse_steam_pc_block(rec_html),
    }
}

pub fn parse_directx_version_number(dx: &str) -> Option<f64> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r"(?i)DirectX[:\s]*(?:Version\s*)?(\d+(?:\.\d+)?)").unwrap()
    });
    re.captures(dx)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<f64>().ok())
}
