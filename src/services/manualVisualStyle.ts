import { clearAdaptiveLyricsPreparations } from './adaptiveLyricsPrefetch';
import { useAdaptiveLyricsStore } from '../stores/useAdaptiveLyricsStore';
import { useVisualizerSettingsStore } from '../stores/useVisualizerSettingsStore';

// src/services/manualVisualStyle.ts
// An explicit appearance becomes the saved default until the listener enables automatic styles again.
export const freezeManualVisualStyle = (): void => {
    const adaptive = useAdaptiveLyricsStore.getState();
    if (adaptive.enabled) adaptive.handleToggleAdaptiveLyrics(false);
    adaptive.clearAdaptiveStyle();
    clearAdaptiveLyricsPreparations();
    const visualizer = useVisualizerSettingsStore.getState();
    if (visualizer.randomVisualizerModePerSong) visualizer.handleToggleRandomVisualizerModePerSong(false);
};
