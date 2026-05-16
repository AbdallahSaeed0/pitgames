#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod api_keys;
mod rawg;
mod igdb;
mod steamgriddb;
mod media;
mod performance;

use commands::{AppState, WatcherShared};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

fn parse_bool_setting(v: Option<String>) -> bool {
    match v.as_deref() {
        Some("1") | Some("true") | Some("yes") | Some("on") => true,
        _ => false,
    }
}

/// Load `.env` from common locations. The first file in this list that exists sets each variable;
/// later files do not override (dotenv default). OS environment variables always win.
fn load_dotenv_files() {
    let mut paths: Vec<PathBuf> = Vec::new();

    if let Ok(cwd) = std::env::current_dir() {
        paths.push(cwd.join("src-tauri").join(".env"));
        paths.push(cwd.join(".env"));
    }

    if let Ok(appdata) = std::env::var("APPDATA") {
        paths.push(PathBuf::from(appdata).join("PitGames").join(".env"));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            paths.push(dir.join(".env"));
        }
    }

    let mut loaded_any = false;
    for path in paths {
        if path.is_file() {
            match dotenv::from_path(&path) {
                Ok(_) => {
                    log::info!("Loaded environment from {}", path.display());
                    loaded_any = true;
                }
                Err(e) => log::warn!("Could not load {}: {}", path.display(), e),
            }
        }
    }

    if !loaded_any {
        if dotenv::dotenv().is_ok() {
            log::info!("Loaded .env from current working directory");
            loaded_any = true;
        }
    }

    if !loaded_any {
        log::warn!(
            "No .env file found. For IGDB, set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET (Twitch), or add .env under %APPDATA%\\PitGames\\ or next to the app executable."
        );
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_skip_taskbar(false);
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[tokio::main]
async fn main() {
    env_logger::init();

    load_dotenv_files();

    let pool = db::init_db().await.expect("Failed to init DB");
    api_keys::refresh_from_db(&pool)
        .await
        .expect("Failed to load API keys from database");

    let start_minimized =
        parse_bool_setting(db::get_app_setting(&pool, "start_minimized_to_tray").await);
    let close_to_tray = Arc::new(AtomicBool::new(start_minimized));
    let watcher_state = Arc::new(WatcherShared::default());

    let pool_watch = pool.clone();
    let watcher_clone = watcher_state.clone();
    tokio::spawn(async move {
        let _ = commands::start_watcher_internal(pool_watch, watcher_clone).await;
    });

    let close_flag_setup = close_to_tray.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--background".into()]),
        ))
        .on_window_event(move |window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let handle = window.app_handle();
                let flag = handle
                    .try_state::<AppState>()
                    .map(|s| s.close_to_tray.load(Ordering::SeqCst))
                    .unwrap_or(false);
                if flag {
                    api.prevent_close();
                    let _ = window.hide();
                    let _ = window.set_skip_taskbar(true);
                }
            }
        })
        .setup(move |app| {
            let bg = std::env::args().any(|a| a == "--background");
            if bg || start_minimized {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                    let _ = win.set_skip_taskbar(true);
                }
            }

            app.manage(AppState {
                db: pool,
                watcher: watcher_state.clone(),
                close_to_tray: close_flag_setup.clone(),
            });

            let quit_i =
                MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).map_err(|e| e.to_string())?;
            let open_i = MenuItem::with_id(app, "open", "Open PitGames", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let pause_i =
                MenuItem::with_id(app, "pause", "Stop Tracking", true, None::<&str>).map_err(|e| {
                    e.to_string()
                })?;
            let scan_i =
                MenuItem::with_id(app, "scan", "Scan Hardware", true, None::<&str>).map_err(|e| {
                    e.to_string()
                })?;

            let menu = Menu::with_items(app, &[&open_i, &pause_i, &scan_i, &quit_i])
                .map_err(|e| e.to_string())?;

            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or_else(|| "Missing window icon".to_string())?;

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .tooltip("PitGames")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "pause" => {
                        if let Some(st) = app.try_state::<AppState>() {
                            let cur = st.watcher.paused.load(Ordering::SeqCst);
                            st.watcher.paused.store(!cur, Ordering::SeqCst);
                            if cur {
                                st.watcher.resync.store(true, Ordering::SeqCst);
                            }
                            log::info!("Tray: tracking paused={}", !cur);
                        }
                    }
                    "scan" => {
                        let handle = app.clone();
                        tokio::spawn(async move {
                            let Some(st) = handle.try_state::<AppState>() else {
                                return;
                            };
                            let snap =
                                tokio::task::spawn_blocking(crate::performance::hardware::scan_hardware_blocking)
                                    .await
                                    .ok();
                            if let Some(snap) = snap {
                                let scanned_at = chrono::Utc::now().to_rfc3339();
                                let name = "My PC";
                                let active_count: Result<(i64,), sqlx::Error> = sqlx::query_as(
                                    "SELECT COUNT(*) FROM hardware_profiles WHERE is_active = 1",
                                )
                                .fetch_one(&st.db)
                                .await;
                                let set_active = active_count.map(|c| c.0 == 0).unwrap_or(true);
                                if set_active {
                                    let _ = sqlx::query("UPDATE hardware_profiles SET is_active = 0")
                                        .execute(&st.db)
                                        .await;
                                }
                                let _ = sqlx::query(
                                    "INSERT INTO hardware_profiles (
                                        profile_name, cpu_name, cpu_cores, cpu_threads, ram_gb,
                                        gpu_name, gpu_vram_gb, os_name, directx_version, storage_free_gb,
                                        screen_resolution, scanned_at, is_active
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                )
                                .bind(name)
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
                                .execute(&st.db)
                                .await;
                                log::info!("Tray: hardware scan saved");
                            }
                        });
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::DoubleClick { .. } = event {
                        let app = tray.app_handle();
                        show_main_window(app);
                    }
                })
                .build(app)
                .map_err(|e| e.to_string())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::search_rawg_games,
            commands::add_game,
            commands::list_games,
            commands::list_games_with_time,
            commands::pick_exe,
            commands::detect_running_games,
            commands::get_running_sessions,
            commands::start_watcher,
            commands::debug_processes,
            commands::debug_saved_games,
            commands::delete_game,
            commands::update_game_progress,
            commands::get_game_full,
            commands::get_dashboard_stats,
            commands::get_stats_data,
            commands::list_games_with_time_full,
            commands::verify_exe_path,
            commands::launch_game,
            commands::get_game_id_by_igdb,
            commands::import_profile_avatar,
            commands::save_profile_avatar_png,
            commands::delete_games_bulk,
            commands::export_games_snapshot,
            commands::update_game_tracking,
            commands::search_igdb_games,
            commands::get_game_sessions,
            commands::get_user_profile,
            commands::update_user_profile,
            commands::list_playlists,
            commands::toggle_playlist_pin,
            commands::toggle_game_pin,
            commands::list_pinned_games,
            commands::pick_image,
            commands::read_local_image_as_data_url,
            commands::update_game_status,
            commands::update_game_media,
            commands::create_playlist,
            commands::delete_playlist,
            commands::add_game_to_playlist,
            commands::remove_game_from_playlist,
            commands::list_playlist_games,
            commands::get_game_playlists,
            commands::refresh_game_metadata,
            commands::get_game_media_options,
            commands::update_game_poster,
            commands::update_game_cover,
            commands::debug_game_media,
            commands::get_api_keys_settings,
            commands::save_api_keys_settings,
            commands::list_home_hero_candidate_images,
            commands::check_github_app_release,
            commands::get_tracking_paused,
            commands::set_tracking_paused,
            commands::set_start_minimized_to_tray,
            commands::get_start_minimized_to_tray,
            commands::scan_hardware_profile,
            commands::list_hardware_profiles,
            commands::set_active_hardware_profile,
            commands::delete_hardware_profile,
            commands::fetch_game_requirements,
            commands::refresh_all_library_requirements,
            commands::search_performance_advisor_games,
            commands::fetch_requirements_for_steam_app,
            commands::get_compatibility_report_for_game,
            commands::get_compatibility_report_for_steam_app,
            commands::list_library_performance_summaries,
            commands::get_performance_summary_for_game,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
