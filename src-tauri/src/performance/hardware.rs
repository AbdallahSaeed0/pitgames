use serde::Serialize;
use std::process::Command;
use sysinfo::{CpuRefreshKind, DiskKind, Disks, MemoryRefreshKind, RefreshKind, System};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareSnapshot {
    pub cpu_name: Option<String>,
    pub cpu_cores: Option<i64>,
    pub cpu_threads: Option<i64>,
    pub ram_gb: Option<f64>,
    pub gpu_name: Option<String>,
    pub gpu_vram_gb: Option<f64>,
    pub os_name: Option<String>,
    pub directx_version: Option<String>,
    pub storage_free_gb: Option<f64>,
    pub screen_resolution: Option<String>,
}

/// Blocking sysinfo + optional OS probes. Call from `spawn_blocking`.
pub fn scan_hardware_blocking() -> HardwareSnapshot {
    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );
    sys.refresh_cpu();
    sys.refresh_memory();

    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|s| !s.is_empty());

    let cpu_threads = sys.cpus().len().try_into().ok();
    let cpu_cores = sys
        .physical_core_count()
        .map(|n| n as i64)
        .or_else(|| cpu_threads.map(|t| (t as f64 * 0.5).ceil() as i64));

    let ram_gb = Some(sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0));

    let os_name = Some(System::long_os_version().unwrap_or_else(|| {
        format!(
            "{} {}",
            std::env::consts::OS,
            std::env::consts::ARCH
        )
    }));

    let mut storage_free_gb: f64 = 0.0;
    let disks = Disks::new_with_refreshed_list();
    for disk in disks.list() {
        if disk.kind() == DiskKind::SSD || disk.kind() == DiskKind::HDD {
            storage_free_gb += disk.available_space() as f64 / (1024.0 * 1024.0 * 1024.0);
        }
    }
    let storage_free_gb = if storage_free_gb > 0.01 {
        Some(storage_free_gb)
    } else {
        None
    };

    let (gpu_name, gpu_vram_gb) = probe_gpu();
    let directx_version = probe_directx();
    let screen_resolution = probe_screen_resolution();

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

fn probe_gpu() -> (Option<String>, Option<f64>) {
    #[cfg(windows)]
    {
        windows_gpu_wmi()
    }
    #[cfg(not(windows))]
    {
        (None, None)
    }
}

#[cfg(windows)]
fn windows_gpu_wmi() -> (Option<String>, Option<f64>) {
    // AdapterRAM is uint32 and overflows for GPUs with >4 GB VRAM (reports 4294967295).
    // We detect overflow and fall back to the GPU adapter registry keys for actual VRAM.
    let script = r#"$pick = Get-CimInstance Win32_VideoController |
  Where-Object { $_.Name -and ($_.Name -notmatch '(?i)microsoft|basic render|remote') } |
  Sort-Object { [long]($_.AdapterRAM) } -Descending |
  Select-Object -First 1
if (-not $pick) { $pick = Get-CimInstance Win32_VideoController | Select-Object -First 1 }
if (-not $pick) { Write-Output '__NONE__'; exit 0 }
Write-Output $pick.Name
$ram = [long]($pick.AdapterRAM)
if ($ram -gt 0 -and $ram -lt 4294967295) {
  [math]::Round($ram / 1GB, 2)
} else {
  $best = 0
  Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object {
    $m = (Get-ItemProperty $_.PSPath -Name 'HardwareInformation.MemorySize' -ErrorAction SilentlyContinue).'HardwareInformation.MemorySize'
    if ($m -and [long]$m -gt $best) { $best = [long]$m }
  }
  if ($best -gt 0) { [math]::Round($best / 1GB, 2) } else { Write-Output '' }
}"#;
    let out = match Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
    {
        Some(o) => o,
        None => return (None, None),
    };
    let mut lines = out.lines().map(str::trim).filter(|l| !l.is_empty());
    let first = lines.next().unwrap_or("__NONE__");
    if first == "__NONE__" {
        return (None, None);
    }
    let name = Some(first.to_string());
    let vram_gb = lines
        .next()
        .and_then(|l| l.parse::<f64>().ok())
        .filter(|v| *v > 0.0);
    (name, vram_gb)
}

#[cfg(not(windows))]
fn windows_gpu_wmi() -> (Option<String>, Option<f64>) {
    (None, None)
}

fn probe_directx() -> Option<String> {
    #[cfg(windows)]
    {
        directx_from_registry()
    }
    #[cfg(not(windows))]
    {
        None
    }
}

#[cfg(windows)]
fn directx_from_registry() -> Option<String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    // Windows 10 (build 10240+) and Windows 11 always support DirectX 12.
    if let Ok(cv) = hklm.open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion") {
        if let Ok(build_str) = cv.get_value::<String, _>("CurrentBuildNumber") {
            if build_str.parse::<u32>().unwrap_or(0) >= 10240 {
                return Some("DirectX 12".to_string());
            }
        }
    }
    // Fallback: parse raw registry version string like "4.09.00.0904"
    // where the second segment encodes the major DirectX version.
    for path in [r"SOFTWARE\Microsoft\DirectX", r"SOFTWARE\WOW6432Node\Microsoft\DirectX"] {
        if let Ok(k) = hklm.open_subkey(path) {
            if let Ok(v) = k.get_value::<String, _>("Version") {
                if !v.is_empty() {
                    if let Some(dx_ver) = v.split('.').nth(1).and_then(|s| s.parse::<u32>().ok()) {
                        return Some(format!("DirectX {}", dx_ver));
                    }
                    return Some(v);
                }
            }
        }
    }
    None
}

#[cfg(not(windows))]
fn directx_from_registry() -> Option<String> {
    None
}

fn probe_screen_resolution() -> Option<String> {
    #[cfg(windows)]
    {
        let script = r#"Add-Type -AssemblyName System.Windows.Forms; "$([int][System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width)x$([int][System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)""#;
        Command::new("powershell")
            .args(["-NoProfile", "-Command", script])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .filter(|s| s.contains('x') && !s.is_empty())
    }
    #[cfg(not(windows))]
    {
        None
    }
}
