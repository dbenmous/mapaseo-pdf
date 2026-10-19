export type LayoutPreferences = {
  leftOpen: boolean;
  rightOpen: boolean;
  leftMode: 'pages' | 'outline' | 'search';
  rightMode: 'assistant' | 'tools' | 'comments';
};

export const DEFAULT_LAYOUT: LayoutPreferences = Object.freeze({
  leftOpen: true,
  rightOpen: true,
  leftMode: 'pages',
  rightMode: 'assistant',
});

const STORAGE_KEY = 'mapaseo-layout';

export function readLayoutPreferences(): LayoutPreferences {
  const preferences = { ...DEFAULT_LAYOUT };
  try {
    const stored: unknown = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return preferences;
    const value = stored as Record<string, unknown>;
    const has = (key: keyof LayoutPreferences) => Object.prototype.hasOwnProperty.call(value, key);

    if (has('leftOpen') && typeof value.leftOpen === 'boolean') preferences.leftOpen = value.leftOpen;
    if (has('rightOpen') && typeof value.rightOpen === 'boolean') preferences.rightOpen = value.rightOpen;
    if (has('leftMode') && (value.leftMode === 'pages' || value.leftMode === 'outline' || value.leftMode === 'search')) {
      preferences.leftMode = value.leftMode;
    }
    if (has('rightMode') && (value.rightMode === 'assistant' || value.rightMode === 'tools' || value.rightMode === 'comments')) {
      preferences.rightMode = value.rightMode;
    }
  } catch {
    // Reading remains available when storage is disabled or its saved data is corrupt.
  }
  return preferences;
}

export function writeLayoutPreferences(value: LayoutPreferences): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      leftOpen: value.leftOpen,
      rightOpen: value.rightOpen,
      leftMode: value.leftMode,
      rightMode: value.rightMode,
    }));
  } catch {
    // A storage restriction must not interrupt a panel toggle or document work.
  }
}
