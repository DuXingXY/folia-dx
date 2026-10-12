import type { VisualizerMode } from '../types';
import type { AdaptiveLyricsStyle } from '../types/adaptiveLyrics';

// src/utils/randomLyricsStyle.ts
// Uniform renderer selection respects the caller's live registry and motion constraints.

export interface RandomLyricsStyleContext {
    availableModes: readonly VisualizerMode[];
    currentMode?: VisualizerMode | null;
    wallpaperMode?: boolean;
    reducedMotion?: boolean;
    random?: () => number;
}

const REDUCED_MOTION_MODES = new Set(['still', 'classic', 'monet']);
const WALLPAPER_MODES = new Set(['still', 'classic', 'monet', 'fume', 'partita', 'cappella']);

/** Retains the only compatible renderer when excluding it would violate a motion preference. */
export const getRandomLyricsStyleCandidates = (context: RandomLyricsStyleContext): VisualizerMode[] => {
    let candidates = [...new Set(context.availableModes)];
    const preferred = context.reducedMotion ? REDUCED_MOTION_MODES : context.wallpaperMode ? WALLPAPER_MODES : null;
    if (preferred) {
        const restrained = candidates.filter(mode => preferred.has(mode));
        if (restrained.length > 0) candidates = restrained;
    }
    if (candidates.length > 1 && context.currentMode) candidates = candidates.filter(mode => mode !== context.currentMode);
    return candidates;
};

export const chooseRandomLyricsStyle = (context: RandomLyricsStyleContext): AdaptiveLyricsStyle | null => {
    const candidates = getRandomLyricsStyleCandidates(context);
    if (candidates.length === 0) return null;
    const draw = (context.random ?? Math.random)();
    const normalized = Number.isFinite(draw) ? Math.min(1 - Number.EPSILON, Math.max(0, draw)) : 0;
    return { mode: candidates[Math.floor(normalized * candidates.length)], animationIntensity: 'normal' };
};
