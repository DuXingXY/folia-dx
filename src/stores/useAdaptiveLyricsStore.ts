import { create } from 'zustand';
import type { VisualizerMode } from '../types';
import type { AdaptiveLyricsStyle } from '../types/adaptiveLyrics';
import { getStoredBoolean, setStoredBoolean } from './storagePrimitives';

// src/stores/useAdaptiveLyricsStore.ts
// Random preferences are persisted. Song decisions and manual overrides belong to the session.

export const ADAPTIVE_LYRICS_STORAGE_KEY = 'adaptive_lyrics_enabled';
export const RANDOMIZE_ALL_STORAGE_KEY = 'randomize_all_enabled';

export type AdaptiveLyricsSelection = AdaptiveLyricsStyle;

export type AdaptiveLyricsState = {
    enabled: boolean;
    randomizeAllEnabled: boolean;
    activeSongKey: string | null;
    manualSongKey: string | null;
    selection: AdaptiveLyricsSelection | null;
    rerollSequence: number;
    recentModes: VisualizerMode[];
    handleToggleAdaptiveLyrics: (enabled: boolean) => void;
    handleToggleRandomizeAll: (enabled: boolean) => void;
    requestAnotherAdaptiveStyle: () => void;
    beginAdaptiveSong: (songKey: string) => void;
    applyAdaptiveStyle: (songKey: string, selection: AdaptiveLyricsSelection) => void;
    overrideAdaptiveSong: () => void;
    clearAdaptiveStyle: () => void;
};

export const useAdaptiveLyricsStore = create<AdaptiveLyricsState>((set, get) => ({
    enabled: getStoredBoolean(ADAPTIVE_LYRICS_STORAGE_KEY, false),
    randomizeAllEnabled: getStoredBoolean(RANDOMIZE_ALL_STORAGE_KEY, false),
    activeSongKey: null,
    manualSongKey: null,
    selection: null,
    rerollSequence: 0,
    recentModes: [],
    handleToggleAdaptiveLyrics: (enabled) => {
        setStoredBoolean(ADAPTIVE_LYRICS_STORAGE_KEY, enabled);
        set({ enabled, ...(!enabled ? { selection: null } : {}) });
    },
    handleToggleRandomizeAll: (enabled) => {
        setStoredBoolean(RANDOMIZE_ALL_STORAGE_KEY, enabled);
        set({ randomizeAllEnabled: enabled });
    },
    requestAnotherAdaptiveStyle: () => {
        const state = get();
        if (!state.enabled || !state.activeSongKey) return;
        set({ manualSongKey: null, rerollSequence: state.rerollSequence + 1 });
    },
    beginAdaptiveSong: (songKey) => {
        if (get().activeSongKey === songKey) return;
        set({ activeSongKey: songKey, manualSongKey: null, selection: null });
    },
    // A delayed decision must never replace a newer song or the listener's explicit choice.
    applyAdaptiveStyle: (songKey, selection) => {
        const state = get();
        if (!state.enabled || state.activeSongKey !== songKey || state.manualSongKey === songKey) return;
        if (state.selection?.mode === selection.mode
            && state.selection.animationIntensity === selection.animationIntensity) return;
        set({ selection, recentModes: [selection.mode, ...state.recentModes].slice(0, 6) });
    },
    overrideAdaptiveSong: () => {
        const state = get();
        if (!state.enabled || !state.activeSongKey) return;
        set({ manualSongKey: state.activeSongKey, selection: null });
    },
    clearAdaptiveStyle: () => set({ activeSongKey: null, manualSongKey: null, selection: null }),
}));
