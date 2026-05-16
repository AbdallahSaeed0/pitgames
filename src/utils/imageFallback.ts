import { FullGameData, MediaImage } from '../types';

export const getBestPoster = (
  game: Partial<FullGameData>,
  media?: { covers?: MediaImage[]; artworks?: MediaImage[]; screenshots?: MediaImage[] } | null
): string | null => {
  if (game.poster_url) return game.poster_url;
  if (game.cover_url) return game.cover_url;
  if (media?.covers && media.covers.length > 0) return media.covers[0].url;
  if (media?.artworks && media.artworks.length > 0) return media.artworks[0].url;
  if (media?.screenshots && media.screenshots.length > 0) return media.screenshots[0].url;
  return null;
};

export const getBestBackground = (
  game: Partial<FullGameData>,
  media?: { artworks?: MediaImage[]; screenshots?: MediaImage[] } | null
): string | null => {
  if (game.background_url) return game.background_url;
  if (game.artwork_url) return game.artwork_url;
  if (media?.artworks && media.artworks.length > 0) return media.artworks[0].url;
  if (media?.screenshots && media.screenshots.length > 0) return media.screenshots[0].url;
  if (game.cover_url) return game.cover_url;
  return null;
};
