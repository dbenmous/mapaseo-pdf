import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAYOUT, readLayoutPreferences, writeLayoutPreferences } from '../src/lib/preferences';
import type { LayoutPreferences } from '../src/lib/preferences';

describe('persistent workspace layout', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts with both panels available and returns independent defaults for a new workspace', () => {
    expect(readLayoutPreferences()).toEqual({
      leftOpen: true, rightOpen: true, leftMode: 'pages', rightMode: 'assistant',
    });
    const firstRead = readLayoutPreferences();
    firstRead.leftOpen = false;
    expect(readLayoutPreferences()).toEqual(DEFAULT_LAYOUT);
  });

  it('restores separately selected panels, including a folded panel and its selected tab', () => {
    storage.set('mapaseo-layout', JSON.stringify({
      leftOpen: false, rightOpen: true, leftMode: 'outline', rightMode: 'comments',
    }));
    expect(readLayoutPreferences()).toEqual({
      leftOpen: false, rightOpen: true, leftMode: 'outline', rightMode: 'comments',
    });
  });

  it('recovers missing or invalid fields independently without discarding valid preferences', () => {
    storage.set('mapaseo-layout', JSON.stringify({
      leftOpen: false, rightOpen: 'false', leftMode: 'unknown', rightMode: 'tools',
    }));
    expect(readLayoutPreferences()).toEqual({
      leftOpen: false, rightOpen: true, leftMode: 'pages', rightMode: 'tools',
    });
    storage.set('mapaseo-layout', JSON.stringify({ rightOpen: false, leftMode: 'search' }));
    expect(readLayoutPreferences()).toEqual({
      leftOpen: true, rightOpen: false, leftMode: 'search', rightMode: 'assistant',
    });
  });

  it.each(['{broken', 'null', '[]', 'false', '17', '"pages"'])(
    'opens safely with defaults for an unusable saved layout: %s', (saved) => {
      storage.set('mapaseo-layout', saved);
      expect(readLayoutPreferences()).toEqual(DEFAULT_LAYOUT);
    },
  );

  it('rejects coerced booleans, objects, and prototype property names as panel selections', () => {
    storage.set('mapaseo-layout', '{"leftOpen":0,"rightOpen":null,"leftMode":{"name":"search"},"rightMode":"__proto__","__proto__":{"leftOpen":false}}');
    expect(readLayoutPreferences()).toEqual(DEFAULT_LAYOUT);
    expect(Object.prototype).not.toHaveProperty('leftOpen');
  });

  it('does not interpret inherited values as saved user preferences', () => {
    vi.spyOn(JSON, 'parse').mockReturnValue(Object.assign(Object.create({
      leftOpen: false, rightOpen: false, leftMode: 'search', rightMode: 'tools',
    }), { rightMode: 'comments' }));
    expect(readLayoutPreferences()).toEqual({ ...DEFAULT_LAYOUT, rightMode: 'comments' });
  });

  it('continues reading and toggling panels when browser storage rejects access', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new DOMException('Storage blocked', 'SecurityError'); },
      setItem: () => { throw new DOMException('Storage full', 'QuotaExceededError'); },
    });
    expect(readLayoutPreferences()).toEqual(DEFAULT_LAYOUT);
    expect(() => writeLayoutPreferences({ ...DEFAULT_LAYOUT, leftOpen: false })).not.toThrow();
    vi.stubGlobal('localStorage', undefined);
    expect(readLayoutPreferences()).toEqual(DEFAULT_LAYOUT);
    expect(() => writeLayoutPreferences(DEFAULT_LAYOUT)).not.toThrow();
  });

  it('persists all panel preferences and restores the last selection on the next load', () => {
    const preferences: LayoutPreferences = {
      leftOpen: false, rightOpen: false, leftMode: 'search', rightMode: 'tools',
    };
    writeLayoutPreferences(preferences);
    expect(JSON.parse(storage.get('mapaseo-layout')!)).toEqual(preferences);
    expect(readLayoutPreferences()).toEqual(preferences);
    writeLayoutPreferences({ ...preferences, leftOpen: true, leftMode: 'pages' });
    expect(readLayoutPreferences()).toEqual({ ...preferences, leftOpen: true, leftMode: 'pages' });
  });
});
