import type { AdaptiveLyricsStyle } from '../types/adaptiveLyrics';
import { chooseRandomLyricsStyle, getRandomLyricsStyleCandidates, type RandomLyricsStyleContext } from '../utils/randomLyricsStyle';

// src/services/adaptiveLyricsPrefetch.ts
// Prepared random choices are keyed by song and applied only after the display handoff.

export type AdaptiveLyricsPreparationContext = Omit<RandomLyricsStyleContext, 'random'>;

export interface AdaptiveLyricsPreparation {
    songKey: string;
    contextSignature: string;
    selection: AdaptiveLyricsStyle;
}

const prepared = new Map<string, AdaptiveLyricsPreparation>();
const contextSignature = (context: AdaptiveLyricsPreparationContext): string => JSON.stringify([
    context.availableModes,
    context.currentMode ?? null,
    context.wallpaperMode === true,
    context.reducedMotion === true,
]);

export const prepareAdaptiveLyricsStyle = ({ songKey, context }: {
    songKey: string;
    context: AdaptiveLyricsPreparationContext;
}): AdaptiveLyricsPreparation | null => {
    const signature = contextSignature(context);
    const cached = prepared.get(songKey);
    if (cached?.contextSignature === signature) return cached;
    const selection = chooseRandomLyricsStyle(context);
    if (!selection) {
        prepared.delete(songKey);
        return null;
    }
    const entry = { songKey, contextSignature: signature, selection };
    prepared.set(songKey, entry);
    while (prepared.size > 8) {
        const oldestKey = prepared.keys().next().value;
        if (oldestKey === undefined) break;
        prepared.delete(oldestKey);
    }
    return entry;
};

/** Keeps the preloaded renderer unless a live setting made that renderer ineligible. */
export const consumeAdaptiveLyricsStyle = (songKey: string, context: AdaptiveLyricsPreparationContext): AdaptiveLyricsStyle | null => {
    const entry = prepared.get(songKey);
    if (!entry) return null;
    prepared.delete(songKey);
    return getRandomLyricsStyleCandidates(context).includes(entry.selection.mode)
        ? entry.selection
        : chooseRandomLyricsStyle(context);
};

export const retainAdaptiveLyricsPreparations = (songKeys: readonly string[]): void => {
    const retained = new Set(songKeys);
    for (const key of prepared.keys()) if (!retained.has(key)) prepared.delete(key);
};

export const clearAdaptiveLyricsPreparations = (): void => { prepared.clear(); };
