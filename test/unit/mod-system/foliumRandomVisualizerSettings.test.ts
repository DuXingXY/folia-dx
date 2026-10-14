// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoliumParam } from '@/mods/folium/contract';
import { randomizeFoliumVisualizerSettings } from '@/mods/folium/randomVisualizerSettings';
import { sanitizeFoliumParams } from '@/mods/folium/params';
import { createFoliumParamAccess, flushFoliumParamsSave, importFoliumParams, snapshotFoliumParams } from '@/mods/folium/paramStore';
import { visualizersRegistry } from '@/mods/folium/registries/visualizers';
import { hasVisualizerMode } from '@/components/visualizer/registry';
import { randomizeVisualStyle } from '@/components/visualizer/randomVisualStyle';
import { useVisualizerSettingsStore } from '@/stores/useVisualizerSettingsStore';
import { useTypographySettingsStore } from '@/stores/useTypographySettingsStore';
import { useDesktopSettingsStore } from '@/stores/useDesktopSettingsStore';
import { useMotionSettingsStore } from '@/stores/useMotionSettingsStore';

// test/unit/mod-system/foliumRandomVisualizerSettings.test.ts
// Exercise existing plugin schemas through live registration, selection and persistence.

vi.hoisted(() => {
    const items = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => { items.set(key, String(value)); },
        removeItem: (key: string) => { items.delete(key); },
        clear: () => items.clear(),
    } });
});

const number = (key: string, min: number, max: number, step = 0.05, defaultValue = 1): FoliumParam =>
    ({ key, type: 'number', label: {}, min, max, step, defaultValue });
const schema: FoliumParam[] = [
    number('size', 0.2, 0.95, 0.2, 0.6),
    { key: 'count', type: 'number', label: {}, min: 2, max: 5 },
    { key: 'fraction', type: 'number', label: {}, min: 0.1, max: 0.3 },
    { key: 'choice', type: 'select', label: {}, defaultValue: 'a', options: [
        { value: 'a', label: {} }, { value: 'b', label: {} },
    ] },
    { key: 'url', type: 'text', label: {}, defaultValue: 'https://example.com/image' },
    { key: 'switch', type: 'boolean', label: {}, defaultValue: true },
    { key: 'unbounded', type: 'number', label: {}, min: 0, defaultValue: 7 },
];
const register = (modId: string, id: string, settings = schema) => {
    visualizersRegistry.register(modId, { id, label: { en: id }, mount: () => {}, settings });
    return visualizersRegistry.get(`${modId}:${id}`)!.def.settingsAccess!;
};

beforeEach(() => {
    importFoliumParams({});
    localStorage.clear();
    useVisualizerSettingsStore.setState(useVisualizerSettingsStore.getInitialState(), true);
    useTypographySettingsStore.setState(useTypographySettingsStore.getInitialState(), true);
    useDesktopSettingsStore.setState(useDesktopSettingsStore.getInitialState(), true);
    useMotionSettingsStore.setState(useMotionSettingsStore.getInitialState(), true);
});
afterEach(() => {
    visualizersRegistry.list().forEach(entry => visualizersRegistry.unregister(entry.id));
    flushFoliumParamsSave();
    vi.restoreAllMocks();
});

describe('schema-backed visualizer random settings', () => {
    it('uses slider steps and declared choices while preserving text, switches and unbounded values', () => {
        const access = createFoliumParamAccess('test', sanitizeFoliumParams(schema));
        access.set({ url: 'file:///custom.png', switch: false, unbounded: 12 });
        const listener = vi.fn();
        access.subscribe(listener);
        randomizeFoliumVisualizerSettings('unknown:mode', access, 'lyrics', () => 1);
        expect(access.get()).toEqual({ size: 0.8, count: 5, fraction: 0.3, choice: 'b',
            url: 'file:///custom.png', switch: false, unbounded: 12 });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('normalizes invalid draws (%s)', draw => {
        const access = createFoliumParamAccess('test', sanitizeFoliumParams(schema));
        randomizeFoliumVisualizerSettings('unknown:mode', access, 'lyrics', () => draw);
        expect(access.get()).toMatchObject({ size: 0.2, count: 2, fraction: 0.1, choice: 'a' });
    });

    it('handles decimal endpoints, tiny steps and singleton ranges without invalid values', () => {
        const access = createFoliumParamAccess('test', sanitizeFoliumParams([
            number('decimal', 0.1, 0.3, 0.1), number('tiny', 0, 0.000003, 0.000001),
            number('fixed', 3, 3, 1),
        ]));
        randomizeFoliumVisualizerSettings('unknown:mode', access, 'lyrics', () => 1);
        expect(access.get()).toEqual({ decimal: 0.3, tiny: 0.000003, fixed: 3 });
    });

    it('varies 52Hz font size only when the host font scale is outside the random scope', () => {
        const access = createFoliumParamAccess('test', [number('fontScale', 0.6, 1.6), number('reach', 0.4, 2)]);
        access.set({ fontScale: 1.1 });
        randomizeFoliumVisualizerSettings('visualizer52hz:rings', access, 'all', () => 1);
        expect(access.get()).toEqual({ fontScale: 1.1, reach: 2 });
        randomizeFoliumVisualizerSettings('visualizer52hz:rings', access, 'lyrics', () => 0);
        expect(access.get().fontScale).toBe(0.6);
    });

    it('caps Cinerama clipping and synthetic italic risks without applying name heuristics to other mods', () => {
        const access = createFoliumParamAccess('test', [number('fontScale', 0.8, 1.3, 0.02),
            number('italicChance', 0, 1, 0.05, 0.35)]);
        randomizeFoliumVisualizerSettings('cinerama:cinerama-screen', access, 'lyrics', () => 1);
        expect(access.get()).toEqual({ fontScale: 1, italicChance: 0.35 });
        randomizeFoliumVisualizerSettings('another:cinerama-screen', access, 'lyrics', () => 1);
        expect(access.get()).toEqual({ fontScale: 1.3, italicChance: 1 });
    });
});

describe('live plugin random style integration', () => {
    it('randomizes only the selected plugin and persists through the existing store', () => {
        const chosen = register('chosen', 'animation');
        const other = register('other', 'animation');
        other.set({ size: 0.4 });
        const otherBefore = other.get();
        randomizeVisualStyle({ preferredMode: 'mod:chosen:animation', random: () => 1 });
        expect(useVisualizerSettingsStore.getState().visualizerMode).toBe('mod:chosen:animation');
        expect(chosen.get()).toMatchObject({ size: 0.8, choice: 'b' });
        expect(other.get()).toBe(otherBefore);
        flushFoliumParamsSave();
        expect(JSON.parse(localStorage.getItem('folia_folium_params_v1')!))
            .toEqual(snapshotFoliumParams());
        expect(createFoliumParamAccess('visualizer:chosen:animation', schema).get()).toEqual(chosen.get());
    });

    it('includes newly registered plugins in an ordinary draw and excludes unloaded ones', () => {
        register('fresh', 'animation');
        randomizeVisualStyle({ random: () => 1 });
        expect(useVisualizerSettingsStore.getState().visualizerMode).toBe('mod:fresh:animation');
        visualizersRegistry.unregisterAll('fresh');
        expect(hasVisualizerMode('mod:fresh:animation')).toBe(false);
        randomizeVisualStyle({ preferredMode: 'mod:fresh:animation', random: () => 1 });
        expect(useVisualizerSettingsStore.getState().visualizerMode).not.toBe('mod:fresh:animation');
    });

    it.each([
        ['visualizer52hz', 'rings'], ['cinerama', 'cinerama-screen'],
    ])('draws the reviewed %s plugin in wallpaper mode until disabled or motion-filtered', (modId, id) => {
        const access = register(modId, id);
        const mode = `mod:${modId}:${id}` as const;
        useDesktopSettingsStore.setState({ wallpaperMode: true });
        randomizeVisualStyle({ random: () => 1 });
        expect(useVisualizerSettingsStore.getState().visualizerMode).toBe(mode);
        expect(access.get()).toMatchObject({ size: 0.8, choice: 'b' });

        const before = access.get();
        useMotionSettingsStore.getState().handleToggleReducedMotionSurface('uiMicroMotion', true);
        randomizeVisualStyle({ preferredMode: mode, random: () => 0 });
        expect(useVisualizerSettingsStore.getState().visualizerMode).not.toBe(mode);
        expect(access.get()).toBe(before);

        useMotionSettingsStore.getState().handleToggleReducedMotionSurface('uiMicroMotion', false);
        visualizersRegistry.unregisterAll(modId);
        randomizeVisualStyle({ preferredMode: mode, random: () => 1 });
        expect(useVisualizerSettingsStore.getState().visualizerMode).not.toBe(mode);
    });

    it.each(['reducedMotion', 'wallpaper'] as const)('does not change a plugin excluded by %s', preference => {
        const access = register('filtered', 'animation');
        const before = access.get();
        if (preference === 'reducedMotion') useMotionSettingsStore.getState().handleToggleReducedMotionSurface('uiMicroMotion', true);
        else useDesktopSettingsStore.setState({ wallpaperMode: true });
        randomizeVisualStyle({ preferredMode: 'mod:filtered:animation', random: () => 1 });
        expect(useVisualizerSettingsStore.getState().visualizerMode).not.toBe('mod:filtered:animation');
        expect(access.get()).toBe(before);
    });
});
