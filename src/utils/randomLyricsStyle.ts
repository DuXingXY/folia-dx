import type { VisualizerMode } from '../types';

// src/utils/randomLyricsStyle.ts
// Filter live renderer choices without reading state or creating a per-song session.

export interface RandomLyricsStyleContext {
    availableModes: readonly VisualizerMode[];
    currentMode?: VisualizerMode | null;
    wallpaperMode?: boolean;
    reducedMotion?: boolean;
    avoidCurrent?: boolean;
}

const REDUCED_MOTION_MODES = new Set(['still', 'classic', 'monet']);
const WALLPAPER_MODES = new Set([
    'still', 'classic', 'monet', 'fume', 'partita', 'cappella',
    // Host-reviewed wallpaper-compatible plugins; candidates still come from the
    // live registry, and reduced-motion filtering remains independent of this list.
    'mod:visualizer52hz:rings', 'mod:cinerama:cinerama-screen',
]);

/** Keep the only compatible renderer when excluding it would break a motion preference. */
export const getRandomLyricsStyleCandidates = (context: RandomLyricsStyleContext): VisualizerMode[] => {
    let candidates = [...new Set(context.availableModes)].filter(mode => (
        (!context.reducedMotion || REDUCED_MOTION_MODES.has(mode))
        && (!context.wallpaperMode || WALLPAPER_MODES.has(mode))
    ));
    if (context.avoidCurrent !== false && candidates.length > 1 && context.currentMode) {
        candidates = candidates.filter(mode => mode !== context.currentMode);
    }
    return candidates;
};
