import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freezeManualVisualStyle } from '@/services/manualVisualStyle';
import { consumeAdaptiveLyricsStyle, prepareAdaptiveLyricsStyle } from '@/services/adaptiveLyricsPrefetch';
import { useAdaptiveLyricsStore } from '@/stores/useAdaptiveLyricsStore';
import { useVisualizerSettingsStore } from '@/stores/useVisualizerSettingsStore';

// test/unit/adaptive-lyrics/manualVisualStyle.test.ts
// Manual appearances cancel prepared choices and persist both automatic switches as disabled.
const context = { availableModes: ['classic', 'monet'] as const, currentMode: 'classic' as const };

describe('manual visual style ownership', () => {
    let values: Map<string, string>;
    beforeEach(() => {
        values = new Map();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
            removeItem: (key: string) => values.delete(key),
        };
        vi.stubGlobal('window', { localStorage: storage });
        vi.stubGlobal('localStorage', storage);
        useAdaptiveLyricsStore.setState(useAdaptiveLyricsStore.getInitialState(), true);
        useVisualizerSettingsStore.setState(useVisualizerSettingsStore.getInitialState(), true);
    });
    afterEach(() => { freezeManualVisualStyle(); vi.unstubAllGlobals(); });

    it('disables persisted automatic choices, clears the session and leaves the appearance intact', () => {
        useAdaptiveLyricsStore.setState({ enabled: true, activeSongKey: 'local:a', manualSongKey: null, selection: { mode: 'monet', animationIntensity: 'normal' } });
        useVisualizerSettingsStore.setState({ visualizerMode: 'monet', manualVisualizerMode: 'partita', randomVisualizerModePerSong: true });
        const before = useVisualizerSettingsStore.getState().classicTuning;
        prepareAdaptiveLyricsStyle({ songKey: 'local:b', context });

        freezeManualVisualStyle();

        expect(values.get('adaptive_lyrics_enabled')).toBe('false');
        expect(values.get('random_visualizer_mode_per_song')).toBe('false');
        expect(useAdaptiveLyricsStore.getState()).toMatchObject({ enabled: false, activeSongKey: null, manualSongKey: null, selection: null });
        expect(consumeAdaptiveLyricsStyle('local:b', context)).toBeNull();
        expect(useVisualizerSettingsStore.getState()).toMatchObject({ visualizerMode: 'monet', manualVisualizerMode: 'partita', randomVisualizerModePerSong: false });
        expect(useVisualizerSettingsStore.getState().classicTuning).toBe(before);
    });

    it('ignores a later automatic result after freezing', () => {
        freezeManualVisualStyle();
        useAdaptiveLyricsStore.getState().beginAdaptiveSong('local:b');
        useAdaptiveLyricsStore.getState().applyAdaptiveStyle('local:b', { mode: 'sonnet', animationIntensity: 'normal' });
        expect(useAdaptiveLyricsStore.getState().selection).toBeNull();
    });
});
