import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Safely converts a file path to a URL that can be used in img/src attributes.
 * Handles Windows paths with backslashes and special characters.
 */
export function getFileUrl(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null;
  
  // If it's already a URL (http/https), return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Normalize Windows backslashes to forward slashes
  const normalizedPath = path.replace(/\\/g, '/');
  
  // Use Tauri's convertFileSrc for local files
  try {
    return convertFileSrc(normalizedPath);
  } catch (e) {
    console.error('Failed to convert file src:', e);
    return null;
  }
}

/**
 * Gets a safe URL for use in CSS background-image property.
 * Wraps the URL in url() if it's a local file.
 */
export function getBackgroundImageUrl(path: string | null | undefined): string {
  if (!path) return '';
  
  const url = getFileUrl(path);
  if (!url) return '';
  
  return `url(${url})`;
}
