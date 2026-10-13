import { describe, expect, it, vi } from 'vitest';
import { createAdaptiveLyricsSession } from '@/services/adaptiveLyricsSession';
import type { RandomLyricsStyleContext } from '@/utils/randomLyricsStyle';

// test/unit/adaptive-lyrics/adaptiveLyricsSession.test.ts
// Choices apply synchronously and remain guarded by the displayed song and manual override.

const readContext = (): RandomLyricsStyleContext => ({ availableModes: ['classic', 'tilt'], currentMode: 'classic', random: () => 0 });

describe('random lyrics session', () => {
    it('applies immediately without waiting for lyrics, audio or profile storage', () => {
        const apply = vi.fn();
        const session = createAdaptiveLyricsSession({ isCurrent: () => true, readContext, apply });
        expect(session.choose('song')).toEqual({ mode: 'tilt', animationIntensity: 'normal' });
        expect(apply).toHaveBeenCalledWith('song', { mode: 'tilt', animationIntensity: 'normal' });
    });

    it.each(['skipped song', 'manual choice', 'disabled randomization'])('ignores a %s rejected by the live display guard', () => {
        const apply = vi.fn();
        const session = createAdaptiveLyricsSession({ isCurrent: () => false, readContext, apply });
        expect(session.choose('old')).toBeNull();
        expect(apply).not.toHaveBeenCalled();
    });

    it('rechecks the display guard after choosing', () => {
        let current = true;
        const apply = vi.fn();
        const session = createAdaptiveLyricsSession({
            isCurrent: () => current,
            readContext: () => ({ ...readContext(), random: () => { current = false; return 0; } }),
            apply,
        });
        expect(session.choose('song')).toBeNull();
        expect(apply).not.toHaveBeenCalled();
    });

    it('cancellation while reading context prevents an obsolete apply', () => {
        const apply = vi.fn();
        const session = createAdaptiveLyricsSession({
            isCurrent: () => true,
            readContext: () => { session.cancel(); return readContext(); },
            apply,
        });
        expect(session.choose('song')).toBeNull();
        expect(apply).not.toHaveBeenCalled();
    });

    it('preserves the existing display when no renderer is available', () => {
        const apply = vi.fn();
        const session = createAdaptiveLyricsSession({ isCurrent: () => true, readContext: () => ({ availableModes: [] }), apply });
        expect(session.choose('song')).toBeNull();
        expect(apply).not.toHaveBeenCalled();
    });

    it.each(['wallpaperMode', 'reducedMotion'] as const)('reads the current %s preference', setting => {
        const apply = vi.fn();
        const session = createAdaptiveLyricsSession({
            isCurrent: () => true,
            readContext: () => ({ availableModes: ['tilt', 'classic'], [setting]: true, random: () => 0 }),
            apply,
        });
        session.choose('song');
        expect(apply).toHaveBeenCalledWith('song', { mode: 'classic', animationIntensity: 'normal' });
    });
});
