use crate::performance::hardware::HardwareSnapshot;
use crate::performance::parse_requirements::{
    parse_directx_version_number, ParsedRequirements,
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompatibilityComponentRow {
    pub component: String,
    pub status: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestedSettings {
    pub resolution: String,
    pub texture_quality: String,
    pub shadows: String,
    pub ray_tracing: String,
    pub upscaling: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompatibilityReport {
    pub overall: String,
    pub preset_label: String,
    pub confidence: String,
    pub bottlenecks: Vec<String>,
    pub explanation: String,
    pub components: Vec<CompatibilityComponentRow>,
    pub suggested_settings: SuggestedSettings,
    pub storage_required_gb: Option<f64>,
}

#[derive(Clone)]
pub struct RankingRow {
    pub component_type: String,
    pub name_pattern: String,
    pub score: i32,
}

fn best_rank_score(name: &str, component_type: &str, rankings: &[RankingRow]) -> Option<i32> {
    let n = name.to_lowercase();
    let mut best: Option<i32> = None;
    for r in rankings {
        if r.component_type != component_type {
            continue;
        }
        let pat = r.name_pattern.to_lowercase();
        if n.contains(&pat) {
            let s = r.score;
            best = Some(best.map(|b| b.max(s)).unwrap_or(s));
        }
    }
    best
}

fn compare_numeric(
    label: &str,
    hw: Option<f64>,
    need: Option<f64>,
    margin: f64,
) -> CompatibilityComponentRow {
    match (hw, need) {
        (Some(h), Some(n)) if n > 0.0 => {
            let ratio = h / n;
            let status = if ratio >= 1.0 + margin {
                "pass"
            } else if ratio >= 1.0 {
                "borderline"
            } else if ratio >= 0.85 {
                "borderline"
            } else {
                "fail"
            };
            CompatibilityComponentRow {
                component: label.to_string(),
                status: status.to_string(),
                detail: format!(
                    "Your {:.1} vs required {:.1} (based on available requirements)",
                    h, n
                ),
            }
        }
        (Some(_), None) => CompatibilityComponentRow {
            component: label.to_string(),
            status: "unknown".to_string(),
            detail: format!("{} not listed in requirements — no comparison possible.", label),
        },
        (None, Some(_)) => CompatibilityComponentRow {
            component: label.to_string(),
            status: "unknown".to_string(),
            detail: "Hardware value not scanned — re-scan in Settings → Hardware Profile.".to_string(),
        },
        _ => CompatibilityComponentRow {
            component: label.to_string(),
            status: "unknown".to_string(),
            detail: format!("{} not listed in requirements.", label),
        },
    }
}

fn compare_directx(hw_dx: Option<&String>, need_dx: Option<&String>) -> CompatibilityComponentRow {
    match (
        hw_dx.and_then(|s| parse_directx_version_number(s)),
        need_dx.and_then(|s| parse_directx_version_number(s)),
    ) {
        (Some(h), Some(n)) => {
            let status = if h + 0.01 >= n {
                "pass"
            } else if h + 0.5 >= n {
                "borderline"
            } else {
                "fail"
            };
            CompatibilityComponentRow {
                component: "DirectX".to_string(),
                status: status.to_string(),
                detail: format!("Your {:?} vs required {:?}", h, n),
            }
        }
        (None, Some(_)) => CompatibilityComponentRow {
            component: "DirectX".to_string(),
            status: "unknown".to_string(),
            detail: "DirectX version missing from hardware profile — re-scan in Settings.".to_string(),
        },
        (_, None) => CompatibilityComponentRow {
            component: "DirectX".to_string(),
            status: "unknown".to_string(),
            detail: "DirectX not listed in requirements.".to_string(),
        },
    }
}

fn compare_os(hw_os: Option<&String>, need_os: Option<&String>) -> CompatibilityComponentRow {
    match (hw_os, need_os) {
        (Some(h), Some(n)) => {
            let hn = h.to_lowercase();
            let nn = n.to_lowercase();
            let status = if nn.contains("windows") && hn.contains("windows") {
                if nn.contains("10") && hn.contains("11") {
                    "pass"
                } else if nn.contains("11") && !hn.contains("11") {
                    "borderline"
                } else {
                    "pass"
                }
            } else if nn.contains("windows") && !hn.contains("windows") {
                "fail"
            } else {
                "unknown"
            };
            CompatibilityComponentRow {
                component: "OS".to_string(),
                status: status.to_string(),
                detail: format!("{} vs {}", h, n),
            }
        }
        _ => CompatibilityComponentRow {
            component: "OS".to_string(),
            status: "unknown".to_string(),
            detail: "OS requirement not parsed.".to_string(),
        },
    }
}

fn compare_named_component(
    label: &str,
    hw_name: Option<&String>,
    req_blob: Option<&String>,
    rankings: &[RankingRow],
    ty: &str,
) -> CompatibilityComponentRow {
    let hw_n = hw_name.map(|s| s.as_str()).unwrap_or("");
    let req_text = req_blob.map(|s| s.as_str()).unwrap_or("");
    let hw_score = if hw_n.is_empty() { None } else { best_rank_score(hw_n, ty, rankings) };
    let req_score = if req_text.is_empty() { None } else { best_rank_score(req_text, ty, rankings) };

    match (hw_score, req_score) {
        (Some(h), Some(r)) => {
            let status = if h >= r + 8 { "pass" } else if h + 15 >= r { "borderline" } else { "fail" };
            CompatibilityComponentRow {
                component: label.to_string(),
                status: status.to_string(),
                detail: format!(
                    "Your {} (tier {}) vs required: {} (tier {})",
                    hw_n, h, req_text, r
                ),
            }
        }
        // Can rank hardware but not the requirement text — show names for manual check
        (Some(h), None) if !req_text.is_empty() => CompatibilityComponentRow {
            component: label.to_string(),
            status: "unknown".to_string(),
            detail: format!(
                "Your {} (tier {}) — requirement \"{}\" not in ranking table; verify manually.",
                hw_n, h, req_text
            ),
        },
        // Can rank requirement but not the hardware — shouldn't happen after a scan
        (None, Some(r)) if !hw_n.is_empty() => CompatibilityComponentRow {
            component: label.to_string(),
            status: "unknown".to_string(),
            detail: format!(
                "Your {} not matched in ranking table (requirement tier {}); verify manually.",
                hw_n, r
            ),
        },
        // At least show both names even when ranking totally fails
        _ if !hw_n.is_empty() && !req_text.is_empty() => CompatibilityComponentRow {
            component: label.to_string(),
            status: "unknown".to_string(),
            detail: format!("Your {} — required: {}. Verify manually.", hw_n, req_text),
        },
        _ => CompatibilityComponentRow {
            component: label.to_string(),
            status: "unknown".to_string(),
            detail: format!("No data available for {}.", label),
        },
    }
}

pub fn build_compatibility_report(
    hw: &HardwareSnapshot,
    parsed: &ParsedRequirements,
    rankings: &[RankingRow],
    storage_required_gb: Option<f64>,
) -> CompatibilityReport {
    let min = &parsed.minimum;
    let rec = &parsed.recommended;

    let ram_row = compare_numeric(
        "RAM",
        hw.ram_gb,
        min.ram_gb.or(rec.ram_gb),
        0.05,
    );
    let vram_row = compare_numeric(
        "VRAM",
        hw.gpu_vram_gb,
        min.vram_gb.or(rec.vram_gb),
        0.08,
    );
    let stor_need = min
        .storage_gb
        .or(rec.storage_gb)
        .or(storage_required_gb);
    let storage_row = compare_numeric(
        "Storage (free space)",
        hw.storage_free_gb,
        stor_need,
        0.0,
    );

    let dx_row = compare_directx(
        hw.directx_version.as_ref(),
        min.directx.as_ref().or(rec.directx.as_ref()),
    );

    let os_row = compare_os(hw.os_name.as_ref(), min.os.as_ref().or(rec.os.as_ref()));

    let cpu_row = compare_named_component(
        "CPU",
        hw.cpu_name.as_ref(),
        min.cpu.as_ref(),
        rankings,
        "cpu",
    );
    let gpu_row = compare_named_component(
        "GPU",
        hw.gpu_name.as_ref(),
        min.gpu.as_ref(),
        rankings,
        "gpu",
    );

    let components = vec![
        cpu_row.clone(),
        gpu_row.clone(),
        ram_row.clone(),
        vram_row.clone(),
        storage_row.clone(),
        dx_row.clone(),
        os_row.clone(),
    ];

    let fails = components
        .iter()
        .filter(|c| c.status == "fail")
        .count();
    let unknowns = components
        .iter()
        .filter(|c| c.status == "unknown")
        .count();
    let borderline = components
        .iter()
        .filter(|c| c.status == "borderline")
        .count();

    let critical_fail = ram_row.status == "fail"
        || storage_row.status == "fail"
        || os_row.status == "fail";

    let mut bottlenecks: Vec<String> = Vec::new();
    for c in &components {
        if c.status == "fail" || c.status == "borderline" {
            bottlenecks.push(format!("{}: {}", c.component, c.detail));
        }
    }

    let (overall, preset_label, explanation, suggested) = if critical_fail {
        (
            "cannot_run",
            "Not Supported".to_string(),
            "Based on available requirements, at least one critical component appears below the stated minimum. This is an estimate — verify against the publisher’s official specs.".to_string(),
            suggested_from_preset("low"),
        )
    } else if fails > 0 {
        (
            "minimum_only",
            "Low".to_string(),
            "Likely playable at reduced settings if non-critical parts are below minimum; estimated settings skew conservative.".to_string(),
            suggested_from_preset("low"),
        )
    } else if borderline > 2 || unknowns >= 4 {
        (
            "unknown",
            "Unknown".to_string(),
            "Several checks are unknown — overall compatibility confidence is limited. Scan hardware again or confirm requirements manually when possible.".to_string(),
            suggested_from_preset("medium"),
        )
    } else if rec.ram_gb.is_some()
        && hw.ram_gb.zip(rec.ram_gb).map(|(h, r)| h >= r * 1.05).unwrap_or(false)
        && gpu_row.status != "fail"
        && cpu_row.status != "fail"
    {
        let ultra_hint = gpu_row.status == "pass" && ram_row.status == "pass" && borderline == 0;
        if ultra_hint && rec.storage_gb.map(|s| hw.storage_free_gb.unwrap_or(0.0) >= s).unwrap_or(true) {
            (
                "ultra_candidate",
                "Ultra Candidate".to_string(),
                "Your hardware appears likely above the stated recommended tier for the fields we could evaluate — still not a promise of exact FPS.".to_string(),
                suggested_from_preset("ultra"),
            )
        } else {
            (
                "recommended",
                "High".to_string(),
                "Recommended requirements appear mostly satisfied where data was available — likely medium–high estimated settings.".to_string(),
                suggested_from_preset("high"),
            )
        }
    } else if fails == 0 && borderline <= 2 {
        (
            "recommended",
            "Medium".to_string(),
            "Minimum requirements look satisfied; recommended tier is partially unknown or borderline — estimated medium settings.".to_string(),
            suggested_from_preset("medium"),
        )
    } else {
        (
            "minimum_only",
            "Low".to_string(),
            "Estimated to meet minimum with mixed unknowns — treat as low-to-medium estimated settings.".to_string(),
            suggested_from_preset("low"),
        )
    };

    let confidence = if unknowns <= 2 && fails == 0 {
        "high"
    } else if unknowns <= 4 {
        "medium"
    } else {
        "low"
    };

    CompatibilityReport {
        overall: overall.to_string(),
        preset_label,
        confidence: confidence.to_string(),
        bottlenecks,
        explanation,
        components,
        suggested_settings: suggested,
        storage_required_gb: stor_need,
    }
}

fn suggested_from_preset(tier: &str) -> SuggestedSettings {
    match tier {
        "ultra" => SuggestedSettings {
            resolution: "Native or high".to_string(),
            texture_quality: "High / Ultra where available".to_string(),
            shadows: "High".to_string(),
            ray_tracing: "Likely on if supported".to_string(),
            upscaling: "Optional (DLSS/FSR quality)".to_string(),
        },
        "high" => SuggestedSettings {
            resolution: "Native".to_string(),
            texture_quality: "High".to_string(),
            shadows: "Medium–High".to_string(),
            ray_tracing: "Try off first if unstable".to_string(),
            upscaling: "Quality mode if GPU borderline".to_string(),
        },
        "medium" => SuggestedSettings {
            resolution: "1080p or 1440p balanced".to_string(),
            texture_quality: "Medium".to_string(),
            shadows: "Medium".to_string(),
            ray_tracing: "Off".to_string(),
            upscaling: "Balanced FSR / DLSS if available".to_string(),
        },
        _ => SuggestedSettings {
            resolution: "1080p".to_string(),
            texture_quality: "Low–Medium".to_string(),
            shadows: "Low".to_string(),
            ray_tracing: "Off".to_string(),
            upscaling: "Performance upscaling recommended".to_string(),
        },
    }
}
