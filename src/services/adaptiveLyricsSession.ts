import type { AdaptiveLyricsStyle } from '../types/adaptiveLyrics';
import { chooseRandomLyricsStyle, type RandomLyricsStyleContext } from '../utils/randomLyricsStyle';

// src/services/adaptiveLyricsSession.ts
// The display guard also protects a synchronous choice from a skip or manual override.

type SessionPorts = {
    isCurrent: (songKey: string) => boolean;
    readContext: () => RandomLyricsStyleContext;
    apply: (songKey: string, selection: AdaptiveLyricsStyle) => void;
};

export const createAdaptiveLyricsSession = ({ isCurrent, readContext, apply }: SessionPorts) => {
    let revision = 0;
    return {
        cancel: () => { revision += 1; },
        choose(songKey: string): AdaptiveLyricsStyle | null {
            const request = ++revision;
            if (!isCurrent(songKey)) return null;
            const selection = chooseRandomLyricsStyle(readContext());
            if (!selection || request !== revision || !isCurrent(songKey)) return null;
            apply(songKey, selection);
            return selection;
        },
    };
};
