import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    clearAdaptiveLyricsPreparations,
    consumeAdaptiveLyricsStyle,
    prepareAdaptiveLyricsStyle,
    retainAdaptiveLyricsPreparations,
    type AdaptiveLyricsPreparationContext,
} from '@/services/adaptiveLyricsPrefetch';

// test/unit/adaptive-lyrics/adaptiveLyricsPrefetch.test.ts
// Prepared choices use only the song key and live renderer constraints, and are consumed once.

const context: AdaptiveLyricsPreparationContext = {
    availableModes: ['classic', 'tilt'],
    currentMode: 'classic',
    wallpaperMode: false,
    reducedMotion: false,
};

describe('random lyrics prefetch', () => {
    afterEach(() => { clearAdaptiveLyricsPreparations(); vi.restoreAllMocks(); });

    it('prepares without lyrics or audio and consumes the same preloaded choice once', () => {
        const prepared = prepareAdaptiveLyricsStyle({ songKey: 'online:netease:next', context });
        expect(prepared?.selection).toEqual({ mode: 'tilt', animationIntensity: 'normal' });
        expect(consumeAdaptiveLyricsStyle('online:netease:next', context)).toBe(prepared?.selection);
        expect(consumeAdaptiveLyricsStyle('online:netease:next', context)).toBeNull();
    });

    it('keeps a compatible preloaded choice even when other candidates changed', () => {
        const prepared = prepareAdaptiveLyricsStyle({ songKey: 'next', context });
        const liveContext = { ...context, availableModes: ['classic', 'tilt', 'monet'] as const };
        expect(consumeAdaptiveLyricsStyle('next', liveContext)).toBe(prepared?.selection);
    });

    it('reselects if the prepared renderer is unavailable at handoff', () => {
        prepareAdaptiveLyricsStyle({ songKey: 'next', context });
        expect(consumeAdaptiveLyricsStyle('next', { ...context, availableModes: ['classic'] })).toEqual({
            mode: 'classic', animationIntensity: 'normal',
        });
    });

    it('reselects if a manual choice made the prepared renderer the current one', () => {
        prepareAdaptiveLyricsStyle({ songKey: 'next', context });
        expect(consumeAdaptiveLyricsStyle('next', { ...context, currentMode: 'tilt' })).toEqual({
            mode: 'classic', animationIntensity: 'normal',
        });
    });

    it('reselects when reduced motion disallows the preloaded renderer', () => {
        prepareAdaptiveLyricsStyle({ songKey: 'next', context });
        expect(consumeAdaptiveLyricsStyle('next', { ...context, reducedMotion: true })).toEqual({
            mode: 'classic', animationIntensity: 'normal',
        });
    });

    it('drops abandoned queue preparations and keeps source-specific keys separate', () => {
        prepareAdaptiveLyricsStyle({ songKey: 'online:netease:123', context });
        const kept = prepareAdaptiveLyricsStyle({ songKey: 'online:kugou:123', context });
        retainAdaptiveLyricsPreparations(['online:kugou:123']);
        expect(consumeAdaptiveLyricsStyle('online:netease:123', context)).toBeNull();
        expect(consumeAdaptiveLyricsStyle('online:kugou:123', context)).toBe(kept?.selection);
    });

    it('reuses the cached draw until a renderer context changes', () => {
        const random = vi.spyOn(Math, 'random');
        const first = prepareAdaptiveLyricsStyle({ songKey: 'next', context });
        const second = prepareAdaptiveLyricsStyle({ songKey: 'next', context });
        expect(first).toBe(second);
        expect(random).toHaveBeenCalledOnce();
    });
});
