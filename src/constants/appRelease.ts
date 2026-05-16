import packageJson from '../../package.json';

/** Mirrors `package.json` / `tauri.conf.json` — bump together for releases. */
export const APP_VERSION: string = packageJson.version;

/** Set in `.env` as `VITE_GITHUB_OWNER` / `VITE_GITHUB_REPO` for “Check for updates”. */
export const GITHUB_OWNER: string = (import.meta.env.VITE_GITHUB_OWNER as string | undefined)?.trim() ?? '';
export const GITHUB_REPO: string = (import.meta.env.VITE_GITHUB_REPO as string | undefined)?.trim() ?? '';
