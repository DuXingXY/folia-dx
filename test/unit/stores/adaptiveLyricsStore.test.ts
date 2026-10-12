import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADAPTIVE_LYRICS_STORAGE_KEY, RANDOMIZE_ALL_STORAGE_KEY, useAdaptiveLyricsStore } from '@/stores/useAdaptiveLyricsStore';
import { useVisualizerSettingsStore } from '@/stores/useVisualizerSettingsStore';
import { useStatusMessageStore } from '@/stores/useStatusMessageStore';

// test/unit/stores/adaptiveLyricsStore.test.ts
// Song-scoped decisions must respect manual selection and never replace the saved default mode.

const initial = {
    enabled: false, randomizeAllEnabled: false, activeSongKey: null, manualSongKey: null, selection: null,
    rerollSequence: 0, recentModes: [],
};

describe('adaptive lyric preferences', () => {
    let values: Map<string, string>;

    beforeEach(() => {
        values = new Map();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
            removeItem: (key: string) => values.delete(key),
        };
        vi.stubGlobal('localStorage', storage);
        vi.stubGlobal('window', { localStorage: storage });
        useAdaptiveLyricsStore.setState(initial);
        useVisualizerSettingsStore.setState({
            visualizerMode: 'classic', manualVisualizerMode: 'classic', randomVisualizerModePerSong: false,
        });
        useStatusMessageStore.setState({ message: null });
    });

    afterEach(() => {
        useAdaptiveLyricsStore.setState(initial);
        vi.unstubAllGlobals();
    });

    it('defaults off and reloads only the saved opt-in preference', async () => {
        vi.resetModules();
        const fresh = await import('@/stores/useAdaptiveLyricsStore');
        expect(fresh.useAdaptiveLyricsStore.getState().enabled).toBe(false);
        useAdaptiveLyricsStore.getState().handleToggleAdaptiveLyrics(true);
        expect(values.get(ADAPTIVE_LYRICS_STORAGE_KEY)).toBe('true');
        vi.resetModules();
        const restored = await import('@/stores/useAdaptiveLyricsStore');
        expect(restored.useAdaptiveLyricsStore.getState()).toMatchObject({
            enabled: true, activeSongKey: null, manualSongKey: null, selection: null,
        });
    });

    it('ignores results for an old song and for a disabled feature', () => {
        const state = useAdaptiveLyricsStore.getState();
        state.handleToggleAdaptiveLyrics(true);
        state.beginAdaptiveSong('netease:1');
        state.beginAdaptiveSong('netease:2');
        state.applyAdaptiveStyle('netease:1', { mode: 'monet', animationIntensity: 'calm' });
        expect(useAdaptiveLyricsStore.getState().selection).toBeNull();
        state.handleToggleAdaptiveLyrics(false);
        state.applyAdaptiveStyle('netease:2', { mode: 'sonnet', animationIntensity: 'chaotic' });
        expect(useAdaptiveLyricsStore.getState().selection).toBeNull();
    });

    it('defaults to lyrics scope and restores the range without enabling per-song random', async () => {
        expect(useAdaptiveLyricsStore.getState().randomizeAllEnabled).toBe(false);
        useAdaptiveLyricsStore.getState().handleToggleRandomizeAll(true);
        expect(values.get(RANDOMIZE_ALL_STORAGE_KEY)).toBe('true');
        expect(useAdaptiveLyricsStore.getState().enabled).toBe(false);
        vi.resetModules();
        const restored = await import('@/stores/useAdaptiveLyricsStore');
        expect(restored.useAdaptiveLyricsStore.getState()).toMatchObject({ enabled: false, randomizeAllEnabled: true });
        restored.useAdaptiveLyricsStore.getState().handleToggleRandomizeAll(false);
        expect(values.get(RANDOMIZE_ALL_STORAGE_KEY)).toBe('false');
    });

    it('changing range leaves this song and its manual override intact', () => {
        useAdaptiveLyricsStore.setState({ enabled: true, activeSongKey: 'song:1', manualSongKey: 'song:1', rerollSequence: 2 });
        useAdaptiveLyricsStore.getState().handleToggleRandomizeAll(true);
        expect(useAdaptiveLyricsStore.getState()).toMatchObject({ activeSongKey: 'song:1', manualSongKey: 'song:1', rerollSequence: 2 });
    });

    it('keeps a manual choice for this song until rerolled or the song changes', () => {
        const state = useAdaptiveLyricsStore.getState();
        state.handleToggleAdaptiveLyrics(true);
        state.beginAdaptiveSong('local:1');
        useVisualizerSettingsStore.getState().handleSetVisualizerMode('tilt', { notify: false });
        state.beginAdaptiveSong('local:1');
        state.applyAdaptiveStyle('local:1', { mode: 'monet', animationIntensity: 'calm' });
        expect(useAdaptiveLyricsStore.getState()).toMatchObject({ manualSongKey: 'local:1', selection: null });

        state.requestAnotherAdaptiveStyle();
        state.applyAdaptiveStyle('local:1', { mode: 'monet', animationIntensity: 'calm' });
        expect(useAdaptiveLyricsStore.getState()).toMatchObject({
            manualSongKey: null, rerollSequence: 1, selection: { mode: 'monet', animationIntensity: 'calm' },
        });
        state.overrideAdaptiveSong();
        state.beginAdaptiveSong('local:2');
        expect(useAdaptiveLyricsStore.getState()).toMatchObject({ manualSongKey: null, selection: null });
    });

    it('keeps automatic choices transient and leaves the persisted manual choice intact', () => {
        const visualizer = useVisualizerSettingsStore.getState();
        visualizer.handleSetVisualizerMode('partita', { notify: false });
        visualizer.handleSetAutomaticVisualizerMode('sonnet');
        expect(useVisualizerSettingsStore.getState()).toMatchObject({
            visualizerMode: 'sonnet', manualVisualizerMode: 'partita',
        });
        expect(values.get('visualizer_mode')).toBe('partita');
        expect(useStatusMessageStore.getState().message).toBeNull();
    });

    it('switching to random mode disables automatic matching', () => {
        useAdaptiveLyricsStore.getState().handleToggleAdaptiveLyrics(true);
        useVisualizerSettingsStore.getState().handleToggleRandomVisualizerModePerSong(true);
        expect(useAdaptiveLyricsStore.getState().enabled).toBe(false);
        expect(values.get(ADAPTIVE_LYRICS_STORAGE_KEY)).toBe('false');
        expect(useVisualizerSettingsStore.getState().randomVisualizerModePerSong).toBe(true);
    });

    it('limits mode history to six decisions and keeps it when leaving a song', () => {
        const state = useAdaptiveLyricsStore.getState();
        state.handleToggleAdaptiveLyrics(true);
        const modes = ['classic', 'monet', 'partita', 'tilt', 'sonnet', 'claddagh', 'pendolo'] as const;
        modes.forEach((mode, index) => {
            state.beginAdaptiveSong(`song:${index}`);
            state.applyAdaptiveStyle(`song:${index}`, { mode, animationIntensity: 'normal' });
        });
        state.clearAdaptiveStyle();
        expect(useAdaptiveLyricsStore.getState().recentModes).toEqual([...modes.slice(1)].reverse());
        expect(useAdaptiveLyricsStore.getState().activeSongKey).toBeNull();
        expect([...values.keys()]).toEqual([ADAPTIVE_LYRICS_STORAGE_KEY]);
    });
});
