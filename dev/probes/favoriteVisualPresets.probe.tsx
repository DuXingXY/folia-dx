import React from 'react';
import VisPlayground from '../../src/components/visualizer/VisPlayground';
import { DEFAULT_THEME } from '../../src/services/baseThemes';
import { useVisualizerSettingsStore } from '../../src/stores/useVisualizerSettingsStore';
import { useTypographySettingsStore } from '../../src/stores/useTypographySettingsStore';
import { useThemeSettingsStore } from '../../src/stores/useThemeSettingsStore';
import type { ProbeDefinition } from './definition';

// dev/probes/favoriteVisualPresets.probe.tsx
// The real playground receives subscribed props so applying a favorite must also refresh slider drafts.
const FavoriteVisualPresetsProbe: React.FC = () => {
    const visual = useVisualizerSettingsStore();
    const typography = useTypographySettingsStore();
    const useCoverColorBg = useThemeSettingsStore(state => state.useCoverColorBg);
    return (
        <div style={{ '--text-primary': DEFAULT_THEME.primaryColor, '--text-secondary': DEFAULT_THEME.secondaryColor } as React.CSSProperties}>
            <div className="fixed bottom-4 left-4 z-[170] flex items-center gap-2 rounded-xl bg-black/90 p-3 text-xs text-white">
                <button type="button" onClick={() => {
                    visual.handleSetVisualizerMode('classic', { notify: false });
                    typography.handleSetLyricsFontScale(1);
                    visual.handleSetVisualizerOpacity(1);
                }}>Appearance A</button>
                <button type="button" onClick={() => {
                    visual.handleSetVisualizerMode('tilt', { notify: false });
                    typography.handleSetLyricsFontScale(1.2);
                    visual.handleSetVisualizerOpacity(0.8);
                }}>Appearance B</button>
                <output data-probe-mode>{visual.visualizerMode}</output>
                <output data-probe-font-scale>{typography.lyricsFontScale}</output>
                <output data-probe-subtitle>{JSON.stringify({ contentMode: typography.subtitleContentMode, fontScale: typography.subtitleFontScale, opacity: typography.subtitleOverlayOpacity, family: typography.subtitleFontFamily })}</output>
            </div>
            <VisPlayground
                theme={DEFAULT_THEME}
                isDaylight={false}
                visualizerMode={visual.visualizerMode}
                visualizerOpacity={visual.visualizerOpacity}
                staticMode
                initialEditSection="favorites"
                fontStyle={typography.lyricsFontStyle}
                fontScale={typography.lyricsFontScale}
                fontWeight={typography.lyricsFontWeight}
                subtitleFontScale={typography.subtitleFontScale}
                subtitleContentMode={typography.subtitleContentMode}
                subtitleOverlayOpacity={typography.subtitleOverlayOpacity}
                subtitleOverlayBackground={typography.subtitleOverlayBackground}
                subtitleUpcomingLyricsBlur={typography.subtitleUpcomingLyricsBlur}
                subtitleFontInheritsLyrics={typography.subtitleFontInheritsLyrics}
                subtitleFontStyle={typography.subtitleFontStyle}
                subtitleFontWeight={typography.subtitleFontWeight}
                subtitleFontFamily={typography.subtitleFontFamily}
                customFontFamily={typography.lyricsCustomFont?.family ?? null}
                customFontLabel={typography.lyricsCustomFont?.label ?? null}
                onFontStyleChange={typography.handleSetLyricsFontStyle}
                onFontScaleChange={typography.handleSetLyricsFontScale}
                onFontWeightChange={typography.handleSetLyricsFontWeight}
                onCustomFontChange={typography.handleSetLyricsCustomFont}
                onVisualizerModeChange={visual.handleSetVisualizerMode}
                onVisualizerOpacityChange={visual.handleSetVisualizerOpacity}
                classicTuning={visual.classicTuning}
                tiltTuning={visual.tiltTuning}
                onClassicTuningChange={visual.handleSetClassicTuning}
                onTiltTuningChange={visual.handleSetTiltTuning}
                backgroundConfig={{
                    mode: visual.visualizerBackgroundMode,
                    common: { opacity: visual.backgroundOpacity, useCoverColorBg, disableVignette: visual.disableVisualizerVignette, disableGeometricBackground: visual.disableVisualizerGeometricBackground },
                    monet: { tuning: visual.monetBackgroundTuning },
                    nomand: { tuning: visual.nomandBackgroundTuning },
                    latent: { tuning: visual.latentBackgroundTuning },
                    sora: { tuning: visual.soraBackgroundTuning },
                }}
                onClose={() => undefined}
            />
        </div>
    );
};

const definition: ProbeDefinition = {
    id: 'favoriteVisualPresets',
    title: '收藏外观预设',
    description: '真实收藏按钮与预览面板，验证持久化、应用、删除，以及外部应用后的滑块草稿刷新。',
    Component: FavoriteVisualPresetsProbe,
};

export default definition;
