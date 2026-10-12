import { describe, expect, it } from 'vitest';
import { chooseRandomLyricsStyle } from '@/utils/randomLyricsStyle';

// test/unit/adaptive-lyrics/randomLyricsStyle.test.ts
// Uniform draws exclude the current renderer and retain motion-compatible choices.

describe('random lyric styles', () => {
    it.each([[0, 'tilt'], [0.49, 'tilt'], [0.5, 'monet'], [0.99, 'monet']] as const)('draws %s uniformly as %s', (draw, mode) => {
        expect(chooseRandomLyricsStyle({ availableModes: ['classic', 'tilt', 'monet'], currentMode: 'classic', random: () => draw }))
            .toEqual({ mode, animationIntensity: 'normal' });
    });

    it('deduplicates the registry candidates', () => {
        expect(chooseRandomLyricsStyle({ availableModes: ['tilt', 'tilt', 'monet'], random: () => 0.5 })?.mode).toBe('monet');
    });

    it.each(['reducedMotion', 'wallpaperMode'] as const)('preserves the only %s-compatible mode', setting => {
        expect(chooseRandomLyricsStyle({ availableModes: ['tilt', 'classic'], currentMode: 'classic', [setting]: true }))
            .toEqual({ mode: 'classic', animationIntensity: 'normal' });
    });

    it('uses wallpaper-compatible alternatives when available', () => {
        expect(chooseRandomLyricsStyle({ availableModes: ['tilt', 'classic', 'fume'], currentMode: 'classic', wallpaperMode: true })?.mode).toBe('fume');
    });

    it.each([-1, NaN, Infinity])('handles invalid random draws (%s)', draw => {
        expect(chooseRandomLyricsStyle({ availableModes: ['classic', 'tilt'], random: () => draw })?.mode).toBe('classic');
    });

    it('clamps an inclusive upper bound to the final candidate', () => {
        expect(chooseRandomLyricsStyle({ availableModes: ['classic', 'tilt'], random: () => 1 })?.mode).toBe('tilt');
    });

    it('returns no decision for an empty live registry', () => {
        expect(chooseRandomLyricsStyle({ availableModes: [] })).toBeNull();
    });
});
