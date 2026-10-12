import type { TypographySettingsState } from '../stores/useTypographySettingsStore';
import type { VisualizerSettingsState } from '../stores/useVisualizerSettingsStore';

// src/types/visualStylePresets.ts
// A favorite stores the visual playground settings, without playback or account preferences.

export const VISUAL_STYLE_VISUALIZER_KEYS = [
    'visualizerMode', 'visualizerBackgroundMode', 'visualizerOpacity', 'backgroundOpacity',
    'disableVisualizerVignette', 'disableVisualizerGeometricBackground', 'urlBackgroundList',
    'urlBackgroundSelectedId', 'classicTuning', 'cadenzaTuning', 'partitaTuning', 'fumeTuning',
    'claddaghTuning', 'cappellaTuning', 'tiltTuning', 'dioramaTuning', 'monetTuning', 'pendoloTuning',
    'sonnetTuning', 'temperaTuning', 'lumiereTuning', 'monetBackgroundTuning',
    'nomandBackgroundTuning', 'latentBackgroundTuning', 'soraBackgroundTuning',
] as const satisfies readonly (keyof VisualizerSettingsState)[];

export const VISUAL_STYLE_TYPOGRAPHY_KEYS = [
    'lyricsFontStyle', 'lyricsFontScale', 'lyricsFontWeight', 'lyricsCustomFont', 'lyricsFontFallbackFamilies',
    'hidePlayerTranslationSubtitle', 'showSubtitleTranslation', 'subtitleContentMode', 'subtitleOverlayOpacity',
    'subtitleOverlayBackground', 'subtitleUpcomingLyricsBlur', 'showHarmonySubtitle', 'harmonySubtitleBackground',
    'subtitleFontInheritsLyrics', 'subtitleFontScale', 'subtitleFontStyle', 'subtitleFontWeight',
    'subtitleFontFamily', 'subtitleFontFallbackFamilies',
] as const satisfies readonly (keyof TypographySettingsState)[];

export type VisualStyleVisualizerSettings = Pick<VisualizerSettingsState, typeof VISUAL_STYLE_VISUALIZER_KEYS[number]>;
export type VisualStyleTypographySettings = Pick<TypographySettingsState, typeof VISUAL_STYLE_TYPOGRAPHY_KEYS[number]>;

export interface VisualStyleSnapshot {
    version: 1;
    visualizer: VisualStyleVisualizerSettings;
    typography: VisualStyleTypographySettings;
    useCoverColorBg: boolean;
}
