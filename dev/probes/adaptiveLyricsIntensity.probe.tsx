import React, { useLayoutEffect, useState } from 'react';
import AppearanceSection from '../../src/components/panelTab/controls/AppearanceSection';
import { buildThemeSourceModel } from '../../src/hooks/themeControllerState';
import { useAdaptiveLyricsStore } from '../../src/stores/useAdaptiveLyricsStore';
import { useVisualizerSettingsStore } from '../../src/stores/useVisualizerSettingsStore';
import { usePlaybackStore } from '../../src/stores/usePlaybackStore';
import { DAYLIGHT_THEME, DEFAULT_THEME } from '../../src/services/baseThemes';
import type { SongResult } from '../../src/types';
import type { ProbeDefinition } from './definition';

// dev/probes/adaptiveLyricsIntensity.probe.tsx
// Actual appearance panel; the outgoing display song owns a calm automatic style over a normal theme.
const SONG: SongResult = {
    id: 'intensity-a', name: 'Outgoing song', artists: [], album: { id: 1, name: 'Probe' },
    durationMs: 180000, sourceRef: { kind: 'local', mediaId: 'intensity-a' },
};
const SONG_KEY = 'local:intensity-a';
const THEME_SOURCE_MODEL = buildThemeSourceModel({
    bgMode: 'default', aiTheme: null, legacyTheme: null, customTheme: null, isDaylight: false,
    defaultTheme: DEFAULT_THEME, daylightTheme: DAYLIGHT_THEME, currentSongHasLocalAiTheme: false,
});

const IntensityPanel: React.FC = () => {
    const [theme, setTheme] = useState(DEFAULT_THEME);
    const mode = useVisualizerSettingsStore(state => state.visualizerMode);
    const manualSongKey = useAdaptiveLyricsStore(state => state.manualSongKey);
    return (
        <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
            <div className="max-w-[360px] rounded-xl border border-white/10 p-3">
                <AppearanceSection
                    theme={theme}
                    onThemeChange={setTheme}
                    isDaylight={false}
                    visualizerMode={mode}
                    onVisualizerModeChange={next => useVisualizerSettingsStore.getState().handleSetVisualizerMode(next, { notify: false })}
                    useCoverColorBg={false}
                    onToggleCoverColorBg={() => {}}
                    themeSourceModel={THEME_SOURCE_MODEL}
                    onBgModeChange={() => {}}
                    hasCustomTheme={false}
                    defaultTheme={DEFAULT_THEME}
                    daylightTheme={DAYLIGHT_THEME}
                />
            </div>
            <output data-intensity-theme>{theme.animationIntensity}</output>
            <output data-intensity-manual-song>{manualSongKey ?? '-'}</output>
        </div>
    );
};

const AdaptiveLyricsIntensityProbe: React.FC = () => {
    const [ready, setReady] = useState(false);
    useLayoutEffect(() => {
        useVisualizerSettingsStore.getState().handleSetVisualizerMode('classic', { notify: false });
        useAdaptiveLyricsStore.setState({
            enabled: true, activeSongKey: SONG_KEY, manualSongKey: null,
            selection: { mode: 'classic', animationIntensity: 'calm' },
        });
        // Raw playback has advanced; panel controls must continue to follow the outgoing display.
        usePlaybackStore.setState({
            currentSong: { ...SONG, id: 'intensity-b', sourceRef: { kind: 'local', mediaId: 'intensity-b' } },
            transitionDisplay: { song: SONG, lyrics: null, coverUrl: null, duration: 180 },
        });
        setReady(true);
    }, []);
    return ready ? <IntensityPanel /> : null;
};

const definition: ProbeDefinition = {
    id: 'adaptiveLyricsIntensity',
    title: '自动歌词样式 · 强度快捷控件',
    description: '实际外观区显示自动强度；点击后覆盖本首歌，转场期间沿用显示歌曲。',
    Component: AdaptiveLyricsIntensityProbe,
};

export default definition;
