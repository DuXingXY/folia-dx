import { describe, expect, it } from 'vitest';
import type { SongResult } from '@/types';
import { resolveNextPlaybackSong } from '@/utils/nextPlaybackSong';

// test/unit/adaptive-lyrics/nextPlaybackSong.test.ts
// Look-ahead must follow the same source-aware queue order as normal playback.

const song = (id: string, providerId: 'netease' | 'qq' = 'netease'): SongResult => ({
    id,
    name: id,
    artists: [],
    album: { id: 'album', name: 'album' },
    durationMs: 120000,
    sourceRef: { kind: 'online', providerId, mediaId: id },
});

describe('resolveNextPlaybackSong', () => {
    it('returns the next queue item and wraps only in loop-all mode', () => {
        const queue = [song('a'), song('b'), song('c')];
        expect(resolveNextPlaybackSong(queue, queue[0], 'off')).toBe(queue[1]);
        expect(resolveNextPlaybackSong(queue, queue[2], 'off')).toBeNull();
        expect(resolveNextPlaybackSong(queue, queue[2], 'all')).toBe(queue[0]);
    });

    it('does not mistake the same media id on another provider for the current queue entry', () => {
        const sameIdOtherProvider = song('same', 'qq');
        const current = song('same', 'netease');
        const queue = [current, sameIdOtherProvider];
        expect(resolveNextPlaybackSong(queue, current, 'off')).toBe(sameIdOtherProvider);
    });

    it('does not preselect the current track for a one-item repeat queue', () => {
        const current = song('only');
        expect(resolveNextPlaybackSong([current], current, 'all')).toBeNull();
    });

    it('prepares the queue head when playback is outside the queue', () => {
        const current = song('active');
        const first = song('queued');
        expect(resolveNextPlaybackSong([first], current, 'off')).toBeNull();
        expect(resolveNextPlaybackSong([first], current, 'off', { firstWhenCurrentMissing: true })).toBe(first);
    });
});
