import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { preloadVisualizerMode, VISUALIZER_REGISTRY } from '../components/visualizer/registry';
import {
    clearAdaptiveLyricsPreparations,
    consumeAdaptiveLyricsStyle,
    prepareAdaptiveLyricsStyle,
    retainAdaptiveLyricsPreparations,
} from '../services/adaptiveLyricsPrefetch';
import { createAdaptiveLyricsSession } from '../services/adaptiveLyricsSession';
import { randomizeVisualStyle } from '../services/visualStylePresets';
import { useFavoriteVisualPresetsStore } from '../stores/useFavoriteVisualPresetsStore';
import { useAdaptiveLyricsStore } from '../stores/useAdaptiveLyricsStore';
import { useVisualizerSettingsStore } from '../stores/useVisualizerSettingsStore';
import { selectDisplaySong, usePlaybackStore } from '../stores/usePlaybackStore';
import { useAudioSettingsStore } from '../stores/useAudioSettingsStore';
import { resolveReducedMotion, useMotionSettingsStore } from '../stores/useMotionSettingsStore';
import { getPlaybackSongKey } from '../utils/appPlaybackGuards';
import { resolveNextPlaybackSong } from '../utils/nextPlaybackSong';

// src/hooks/useAdaptiveLyrics.ts
// Each displayed song gets a random appearance before paint; queue successors preload their renderer code.

export function useAdaptiveLyrics({ wallpaperMode }: { wallpaperMode: boolean }) {
    const enabled = useAdaptiveLyricsStore(state => state.enabled);
    const rerollSequence = useAdaptiveLyricsStore(state => state.rerollSequence);
    const manualSongKey = useAdaptiveLyricsStore(state => state.manualSongKey);
    const song = usePlaybackStore(selectDisplaySong);
    const rawSong = usePlaybackStore(state => state.currentSong);
    const playQueue = usePlaybackStore(state => state.playQueue);
    const loopMode = useAudioSettingsStore(state => state.loopMode);
    const currentMode = useVisualizerSettingsStore(state => state.visualizerMode);
    const reducedMotion = useMotionSettingsStore(state => resolveReducedMotion(state, 'uiMicroMotion'));
    const songKey = song ? getPlaybackSongKey(song) : null;
    const rawSongKey = rawSong ? getPlaybackSongKey(rawSong) : null;
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
            clearAdaptiveLyricsPreparations();
            if (shouldRestore) visualizer.handleSetAutomaticVisualizerMode(visualizer.manualVisualizerMode);
            return;
        }
        // This switch owns per-song randomization, so the legacy renderer shuffle cannot also run.
        if (visualizer.randomVisualizerModePerSong) visualizer.handleToggleRandomVisualizerModePerSong(false);
        adaptive.beginAdaptiveSong(songKey);
        const requestKey = `${songKey}:${rerollSequence}:${wallpaperMode}:${reducedMotion}`;
        if (useAdaptiveLyricsStore.getState().manualSongKey === songKey || completed.current === requestKey) return;
        const prepared = consumeAdaptiveLyricsStyle(songKey, readRandomContext());
        if (session.choose(songKey, prepared)) completed.current = requestKey;
    }, [enabled, manualSongKey, reducedMotion, rerollSequence, session, songKey, wallpaperMode]);

    const preparationSongs = useMemo(() => {
        if (!enabled) return [];
        const candidates = new Map<string, NonNullable<typeof rawSong>>();
        if (rawSong && rawSongKey !== songKey) candidates.set(rawSongKey!, rawSong);
        const next = resolveNextPlaybackSong(playQueue, rawSong ?? song, loopMode, { firstWhenCurrentMissing: true });
        if (next) candidates.set(getPlaybackSongKey(next), next);
        return [...candidates.entries()];
    }, [enabled, loopMode, playQueue, rawSong, rawSongKey, song, songKey]);

    useEffect(() => {
        if (!enabled) {
            clearAdaptiveLyricsPreparations();
            return;
        }
        retainAdaptiveLyricsPreparations(preparationSongs.map(([key]) => key));
        const preparationContext = readRandomContext();
        for (const [key] of preparationSongs) {
            const preparation = prepareAdaptiveLyricsStyle({ songKey: key, context: preparationContext });
            if (preparation) {
                void preloadVisualizerMode(preparation.selection.mode)
                    .catch(error => console.warn('[Random lyrics] Could not preload the selected renderer', error));
            }
        }
    }, [enabled, preparationSongs, currentMode, wallpaperMode, reducedMotion]);

    return {
        enabled,
    };
}
