import theme, { Theme } from './index';

/**
 * Retrieves a color from the theme using a dot-notated path (e.g., 'background.primary')
 */
export const getColor = (path: string): string => {
  const parts = path.split('.');
  let current: any = theme;
  for (const part of parts) {
    if (current[part] === undefined) {
      console.warn(`Theme color not found: ${path}`);
      return '';
    }
    current = current[part];
  }
  return current as string;
};

/**
 * Retrieves a spacing value from the theme
 */
export const getSpacing = (size: keyof Theme['spacing']): string => {
  return theme.spacing[size];
};

/**
 * Retrieves a shadow definition from the theme
 */
export const getShadow = (level: keyof Theme['shadows']): string => {
  return theme.shadows[level];
};

/**
 * Retrieves a border radius value from the theme
 */
export const getBorderRadius = (size: keyof Theme['borderRadius']): string => {
  return theme.borderRadius[size];
};

/**
 * Animation definitions for transitions
 */
export const transitions = {
  fast: '150ms ease-out',
  normal: '300ms ease-in-out',
  slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  page: 'fade-in 0.3s ease-out',
  modal: 'scale-in 0.2s ease-out',
};
