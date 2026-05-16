export type CompletionStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'backlog'
  | 'dropped';

export interface Game {
  id: number;
  title: string;
  cover_url: string | null;
  rating: number | null;
  total_playtime_seconds: number;
  process_name: string;
  /** JSON string array of extra .exe basenames that map to this game's playtime (optional). */
  process_name_aliases?: string | null;
  hltb_main_story: number | null;
  hltb_main_extras: number | null;
  hltb_completionist: number | null;
  target_hours: number | null;
  completion_status: CompletionStatus;
}

export interface MediaImage {
  id: string;
  type?: "cover" | "poster" | "hero" | "artwork" | "screenshot" | "external";
  url: string;
  thumb_url?: string;
  source: "igdb" | "steamgriddb" | "rawg" | "manual" | "current" | string;
  width?: number;
  height?: number;
}

export interface Trailer {
  id?: string;
  name?: string;
  video_id?: string;
  youtube_url?: string;
  thumbnail_url?: string;
  source: "igdb" | "youtube" | string;
}

export interface GameMediaResponse {
  covers: MediaImage[];
  artworks: MediaImage[];
  screenshots: MediaImage[];
  trailers: Trailer[];
  logos?: MediaImage[];
  icons?: MediaImage[];
  stats: any;
}

export interface FullGameData extends Game {
  summary: string | null;
  storyline: string | null;
  release_date: string | null;
  developer: string | null;
  publisher: string | null;
  platforms: string | null;
  genres: string | null;
  
  artwork_url: string | null;
  background_url: string | null;
  poster_url: string | null;
  screenshot_url: string | null;
  trailer_url: string | null;
  
  rating_count: number | null;
  total_rating: number | null;
  total_rating_count: number | null;
  
  similar_games: string | null; // JSON string
  artworks: string | null; // JSON string
  screenshots: string | null; // JSON string
  videos: string | null; // JSON string
  
  total_time: number;
  last_played: string | null;
  exe_path: string;
  is_pinned?: boolean;
  process_name_aliases?: string | null;
  steam_app_id?: number | null;
}

export interface GameProgressPayload {
  game_id: number;
  hltb_main_story?: number | null;
  hltb_main_extras?: number | null;
  hltb_completionist?: number | null;
  target_hours?: number | null;
  completion_status?: string;
}

export interface ProgressStats {
  actual_playtime_hours: number;
  target_hours: number | null;
  completion_percentage: number;
  time_remaining: number | null;
  on_track: boolean;
}

export interface DashboardStats {
  total_games: number;
  total_playtime_seconds: number;
  games_completed: number;
  games_in_progress: number;
  most_played_game: string | null;
  currently_running_count: number;
}

export interface TopGame {
  title: string;
  playtime_seconds: number;
}

export interface DaySession {
  date: string;
  session_count: number;
}

export interface DayPlaytime {
  date: string;
  seconds: number;
}

export interface WeekPlaytime {
  week_start: string;
  seconds: number;
}

export interface MonthPlaytime {
  month: string;
  seconds: number;
}

export interface RankedLabel {
  label: string;
  seconds: number;
}

export interface RecentGameStat {
  id: number;
  title: string;
  cover_url: string | null;
  seconds: number;
}

export interface StatsData {
  total_playtime_seconds: number;
  total_sessions: number;
  average_session_minutes: number;
  weekly_playtime_seconds: number;
  monthly_playtime_seconds: number;
  top_games: TopGame[];
  sessions_by_day: DaySession[];
  playtime_by_calendar_day: DayPlaytime[];
  weekly_playtime_trend: WeekPlaytime[];
  monthly_playtime_trend: MonthPlaytime[];
  top_genres: RankedLabel[];
  top_developers: RankedLabel[];
  recently_played: RecentGameStat[];
}
