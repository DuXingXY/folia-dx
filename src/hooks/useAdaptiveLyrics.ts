import { useLayoutEffect, useMemo, useRef } from 'react';
import { VISUALIZER_REGISTRY } from '../components/visualizer/registry';
import { createAdaptiveLyricsSession } from '../services/adaptiveLyricsSession';
import { randomizeVisualStyle } from '../services/visualStylePresets';
import { useFavoriteVisualPresetsStore } from '../stores/useFavoriteVisualPresetsStore';
import { useAdaptiveLyricsStore } from '../stores/useAdaptiveLyricsStore';
import { useVisualizerSettingsStore } from '../stores/useVisualizerSettingsStore';
import { selectDisplaySong, usePlaybackStore } from '../stores/usePlaybackStore';
import { resolveReducedMotion, useMotionSettingsStore } from '../stores/useMotionSettingsStore';
import { getPlaybackSongKey } from '../utils/appPlaybackGuards';

// src/hooks/useAdaptiveLyrics.ts
// Each displayed song gets a random appearance before paint.

export function useAdaptiveLyrics({ wallpaperMode }: { wallpaperMode: boolean }) {
    const enabled = useAdaptiveLyricsStore(state => state.enabled);
    const rerollSequence = useAdaptiveLyricsStore(state => state.rerollSequence);
    const manualSongKey = useAdaptiveLyricsStore(state => state.manualSongKey);
    const song = usePlaybackStore(selectDisplaySong);
    const reducedMotion = useMotionSettingsStore(state => resolveReducedMotion(state, 'uiMicroMotion'));
    const songKey = song ? getPlaybackSongKey(song) : null;
    const context = useRef({ wallpaperMode, reducedMotion });
    context.current = { wallpaperMode, reducedMotion };
    const completed = useRef<string | null>(null);
    const wasEnabled = useRef(enabled);

    const readRandomContext = () => ({
        ...context.current,
        availableModes: VISUALIZER_REGISTRY.map(entry => entry.mode),
        currentMode: useVisualizerSettingsStore.getState().visualizerMode,
    });
    const session = useMemo(() => createAdaptiveLyricsSession({
        isCurrent: key => {
            const state = useAdaptiveLyricsStore.getState();
            const visibleSong = selectDisplaySong(usePlaybackStore.getState());
            return state.enabled && state.activeSongKey === key && state.manualSongKey !== key
                && Boolean(visibleSong && getPlaybackSongKey(visibleSong) === key);
        },
        readContext: readRandomContext,
        apply: (key, next) => {
            useAdaptiveLyricsStore.getState().applyAdaptiveStyle(key, next);
            const snapshot = randomizeVisualStyle({
                scope: useAdaptiveLyricsStore.getState().randomizeAllEnabled ? 'all' : 'lyrics',
                mode: next.mode,
                automatic: true,
            });
            useFavoriteVisualPresetsStore.getState().clearCurrent(snapshot);
        },
    }), []);

    useLayoutEffect(() => {
        const adaptive = useAdaptiveLyricsStore.getState();
        const visualizer = useVisualizerSettingsStore.getState();
        const shouldRestore = wasEnabled.current && (!enabled || !songKey);
        wasEnabled.current = enabled;
        if (!enabled || !songKey) {
            session.cancel();
            completed.current = null;
            adaptive.clearAdaptiveStyle();
            if (shouldRestore) visualizer.handleSetAutomaticVisualizerMode(visualizer.manualVisualizerMode);
            return;
        }
        // This switch owns per-song randomization, so the legacy renderer shuffle cannot also run.
        if (visualizer.randomVisualizerModePerSong) visualizer.handleToggleRandomVisualizerModePerSong(false);
        adaptive.beginAdaptiveSong(songKey);
        const requestKey = `${songKey}:${rerollSequence}:${wallpaperMode}:${reducedMotion}`;
        if (useAdaptiveLyricsStore.getState().manualSongKey === songKey || completed.current === requestKey) return;
        if (session.choose(songKey)) completed.current = requestKey;
    }, [enabled, manualSongKey, reducedMotion, rerollSequence, session, songKey, wallpaperMode]);

    return {
        enabled,
    };
}
