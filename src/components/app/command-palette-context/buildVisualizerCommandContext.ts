import type { CommandPaletteContext } from '../../command-palette/types';
import { useVisualizerSettingsStore } from '../../../stores/useVisualizerSettingsStore';
import { useLyricSegmentationStore } from '../../../stores/useLyricSegmentationStore';
import { useVideoLayerSettingsStore } from '../../../stores/useVideoLayerSettingsStore';
import { getVisualizerRegistryEntry } from '../../visualizer/registry';
import { isLyricSegmentationAiAvailable } from '../../../services/lyricSegmentationAi';
import type { LyricSegmentationActions } from '../playback/createLyricSegmentationActions';
import { useAdaptiveLyricsStore } from '../../../stores/useAdaptiveLyricsStore';
import { captureVisualStyle, getVisualStyleFingerprint, randomizeVisualStyle } from '../../../services/visualStylePresets';
import { findFavoriteVisualPreset, useFavoriteVisualPresetsStore } from '../../../stores/useFavoriteVisualPresetsStore';

// src/components/app/command-palette-context/buildVisualizerCommandContext.ts
// The `visualizer` namespace. Almost entirely store-backed: App.tsx used to relay all seven
// members, and now only supplies the two segmentation actions, which need the lyric setter.

export const buildVisualizerCommandContext = (
    lyricSegmentationActions: LyricSegmentationActions,
): CommandPaletteContext['visualizer'] => {
    const visualizer = useVisualizerSettingsStore.getState();
    return {
        visualizerMode: visualizer.visualizerMode,
        visualizerBackgroundMode: visualizer.visualizerBackgroundMode,
        setVisualizerMode: visualizer.handleSetVisualizerMode,
        toggleRandomVisualizerModePerSong: () => visualizer.handleToggleRandomVisualizerModePerSong(
            !useVisualizerSettingsStore.getState().randomVisualizerModePerSong,
        ),
        adaptiveLyricsEnabled: useAdaptiveLyricsStore.getState().enabled,
        randomizeAllEnabled: useAdaptiveLyricsStore.getState().randomizeAllEnabled,
        handleToggleRandomizeAll: enabled => useAdaptiveLyricsStore.getState().handleToggleRandomizeAll(enabled),
        toggleAdaptiveLyrics: () => {
            const adaptive = useAdaptiveLyricsStore.getState();
            adaptive.handleToggleAdaptiveLyrics(!adaptive.enabled);
        },
        requestAnotherAdaptiveStyle: () => {
            const scope = useAdaptiveLyricsStore.getState().randomizeAllEnabled ? 'all' : 'lyrics';
            const snapshot = randomizeVisualStyle({ scope });
            useFavoriteVisualPresetsStore.getState().clearCurrent(snapshot);
        },
        toggleFavoriteVisualPreset: () => {
            const snapshot = captureVisualStyle();
            const favorites = useFavoriteVisualPresetsStore.getState();
            const existing = favorites.dismissedFingerprint !== getVisualStyleFingerprint(snapshot)
                ? findFavoriteVisualPreset(snapshot, favorites.presets) : undefined;
            if (existing) favorites.remove(existing.id);
            else favorites.save(snapshot);
        },
        toggleGlowBlurQuantize: () => visualizer.handleToggleGlowBlurQuantize(
            !useVisualizerSettingsStore.getState().glowBlurQuantize,
        ),
        setVisualizerBackgroundMode: visualizer.handleSetVisualizerBackgroundMode,
        setMonetBackgroundTuning: visualizer.handleSetMonetBackgroundTuning,
        setLatentBackgroundTuning: visualizer.handleSetLatentBackgroundTuning,
        toggleVideoLayer: () => {
            const videoLayer = useVideoLayerSettingsStore.getState();
            videoLayer.setVideoLayerEnabled(!videoLayer.videoLayerEnabled);
        },
        pickVideoLayerFile: () => useVideoLayerSettingsStore.getState().pickLocalFile(),
        usesWordSegmentation: Boolean(getVisualizerRegistryEntry(visualizer.visualizerMode).usesWordSegmentation),
        lyricSegmentation: {
            record: useLyricSegmentationStore.getState().record,
            isAiAvailable: isLyricSegmentationAiAvailable(),
            save: lyricSegmentationActions.save,
            reset: lyricSegmentationActions.reset,
        },
    };
};
