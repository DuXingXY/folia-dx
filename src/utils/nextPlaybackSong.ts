import type { SongResult, StageLoopMode } from '../types';
import { getPlaybackSongKey } from './appPlaybackGuards';

// src/utils/nextPlaybackSong.ts
// Queue arithmetic for the random lyric renderer's lightweight look-ahead.

/** Resolves a known queue successor; FM's asynchronous top-up remains outside this look-ahead. */
export const resolveNextPlaybackSong = (
    queue: SongResult[],
    currentSong: SongResult | null | undefined,
    loopMode: StageLoopMode,
    options: { firstWhenCurrentMissing?: boolean } = {},
): SongResult | null => {
    if (!currentSong || queue.length === 0) return null;
    const currentKey = getPlaybackSongKey(currentSong);
    const index = queue.findIndex(song => getPlaybackSongKey(song) === currentKey);
    if (index < 0) {
        const first = options.firstWhenCurrentMissing ? queue[0] : null;
        return first && getPlaybackSongKey(first) !== currentKey ? first : null;
    }
    if (queue.length < 2) return null;
    const next = index < queue.length - 1
        ? queue[index + 1]
        : loopMode === 'all' ? queue[0] : null;
    return next && getPlaybackSongKey(next) !== currentKey ? next : null;
};
