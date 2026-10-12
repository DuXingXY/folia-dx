import type { Theme, VisualizerMode } from '../types';

// src/types/adaptiveLyrics.ts
// The song-scoped random renderer choice shared by the runtime and preparation cache.

export interface AdaptiveLyricsStyle {
    mode: VisualizerMode;
    animationIntensity: Theme['animationIntensity'];
}
