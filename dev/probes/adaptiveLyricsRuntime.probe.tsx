import React, { useLayoutEffect, useState } from 'react';
import AdaptiveLyricsControls from '../../src/components/shared/AdaptiveLyricsControls';
import { useAdaptiveLyrics } from '../../src/hooks/useAdaptiveLyrics';
import { useAdaptiveLyricsStore } from '../../src/stores/useAdaptiveLyricsStore';
import { useVisualizerSettingsStore } from '../../src/stores/useVisualizerSettingsStore';
import { useTypographySettingsStore } from '../../src/stores/useTypographySettingsStore';
import { useThemeSettingsStore } from '../../src/stores/useThemeSettingsStore';
import { captureVisualStyle } from '../../src/services/visualStylePresets';
import { selectDisplayLyrics, selectDisplaySong, usePlaybackStore } from '../../src/stores/usePlaybackStore';
import { DEFAULT_THEME } from '../../src/services/baseThemes';
import type { LyricData, SongResult } from '../../src/types';
import type { ProbeDefinition } from './definition';

// dev/probes/adaptiveLyricsRuntime.probe.tsx
// Real hook and stores with local songs; choices do not wait for lyrics or audio sampling.
const SONGS: SongResult[] = [
    { id: 'adaptive-a', name: 'Lonely goodbye', artists: [{ id: 1, name: 'Probe' }], album: { id: 1, name: 'Runtime' }, durationMs: 180000, sourceRef: { kind: 'local', mediaId: 'adaptive-a' } },
    { id: 'adaptive-b', name: 'Dance into the sunshine', artists: [{ id: 1, name: 'Probe' }], album: { id: 1, name: 'Runtime' }, durationMs: 180000, sourceRef: { kind: 'local', mediaId: 'adaptive-b' } },
];
const TEXTS = [
    ['孤独的夜里流泪', '难过的心想念着离别', '悲伤和遗憾留在雨中'],
    ['阳光快乐一起跳舞', '欢笑着奔跑拥抱希望', '梦想与自由闪耀着光'],
];
const LYRICS: LyricData[] = TEXTS.map(lines => ({
    lines: lines.map((fullText, index) => ({
        fullText, startTime: index * 8, endTime: index * 8 + 7,
        words: [{ text: fullText, startTime: index * 8, endTime: index * 8 + 7 }],
    })),
}));

const RENDERER_TUNING_KEYS = [
    'classicTuning', 'cadenzaTuning', 'partitaTuning', 'fumeTuning', 'claddaghTuning',
    'cappellaTuning', 'tiltTuning', 'dioramaTuning', 'monetTuning', 'pendoloTuning',
    'sonnetTuning', 'temperaTuning', 'lumiereTuning',
] as const;

// Record the entire protected scope, including background tuning and subtitle/font settings.
const readRuntimeAppearance = () => {
    const snapshot = captureVisualStyle();
    const protectedVisualizer: Record<string, unknown> = { ...snapshot.visualizer };
    delete protectedVisualizer.visualizerMode;
    for (const key of RENDERER_TUNING_KEYS) delete protectedVisualizer[key];
    return {
        appearance: JSON.stringify(snapshot),
        protectedSettings: JSON.stringify({ visualizer: protectedVisualizer, typography: snapshot.typography, useCoverColorBg: snapshot.useCoverColorBg }),
        rendererTunings: JSON.stringify(Object.fromEntries(RENDERER_TUNING_KEYS.map(key => [key, snapshot.visualizer[key]]))),
    };
};

const RuntimeControls: React.FC = () => {
    const runtime = useAdaptiveLyrics({ wallpaperMode: false });
    const adaptive = useAdaptiveLyricsStore();
    const visualizer = useVisualizerSettingsStore().visualizerMode;
    useTypographySettingsStore();
    useThemeSettingsStore(state => state.useCoverColorBg);
    const manualMode = useVisualizerSettingsStore(state => state.manualVisualizerMode);
    const song = usePlaybackStore(state => state.currentSong);
    const displaySong = usePlaybackStore(selectDisplaySong);
    const displayLyrics = usePlaybackStore(selectDisplayLyrics);
    const held = usePlaybackStore(state => state.transitionDisplay !== null);
    const nextSong = (hold: boolean) => {
        const current = usePlaybackStore.getState();
        const next = current.currentSong?.id === SONGS[0].id ? 1 : 0;
        usePlaybackStore.setState({
            currentSong: SONGS[next], lyrics: LYRICS[next],
            transitionDisplay: hold ? { song: selectDisplaySong(current), lyrics: selectDisplayLyrics(current), coverUrl: null, duration: 180 } : null,
        });
    };
    return (
        <div className="min-h-screen space-y-5 bg-zinc-950 p-6 text-zinc-100">
            <div className="max-w-xl rounded-xl border border-white/10 bg-white/5 p-4">
                <AdaptiveLyricsControls
                    isDaylight={false}
                    theme={DEFAULT_THEME}
                />
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
                <button type="button" onClick={() => adaptive.handleToggleAdaptiveLyrics(!runtime.enabled)}>Toggle song randomization</button>
                <button type="button" onClick={() => useVisualizerSettingsStore.getState().handleSetVisualizerMode('still', { notify: false })}>Manual still</button>
                <button type="button" onClick={adaptive.requestAnotherAdaptiveStyle}>Reroll current style</button>
                <button type="button" onClick={() => nextSong(false)}>Next song</button>
                <button type="button" disabled={held} onClick={() => nextSong(true)}>Hold incoming</button>
                <button type="button" disabled={!held} onClick={() => usePlaybackStore.getState().setTransitionDisplay(null)}>Release hold</button>
            </div>
            <dl className="grid max-w-xl grid-cols-2 gap-2 font-mono text-xs">
                {Object.entries({
                    enabled: String(runtime.enabled), activeSongKey: adaptive.activeSongKey ?? '-',
                    mode: visualizer, selection: adaptive.selection?.mode ?? '-',
                    manualSongKey: adaptive.manualSongKey ?? '-', manualVisualizerMode: manualMode,
                    savedMode: localStorage.getItem('visualizer_mode') ?? '-',
                    rawSong: String(song?.id ?? '-'), displaySong: String(displaySong?.id ?? '-'),
                    displayLyrics: displayLyrics?.lines[0]?.fullText ?? '-',
                    ...readRuntimeAppearance(),
                }).map(([key, value]) => (
                    <React.Fragment key={key}>
                        <dt hidden={['appearance', 'protectedSettings', 'rendererTunings'].includes(key)}>{key}</dt>
                        <dd data-runtime={key} hidden={['appearance', 'protectedSettings', 'rendererTunings'].includes(key)}>{value}</dd>
                    </React.Fragment>
                ))}
            </dl>
        </div>
    );
};

const AdaptiveLyricsRuntimeProbe: React.FC = () => {
    const [ready, setReady] = useState(false);
    useLayoutEffect(() => {
        const adaptive = useAdaptiveLyricsStore.getState();
        adaptive.handleToggleAdaptiveLyrics(false);
        adaptive.handleToggleRandomizeAll(false);
        adaptive.clearAdaptiveStyle();
        useAdaptiveLyricsStore.setState({ rerollSequence: 0, recentModes: [] });
        useVisualizerSettingsStore.getState().handleSetVisualizerMode('classic', { notify: false });
        useVisualizerSettingsStore.getState().handleSetVisualizerOpacity(0.5);
        useVisualizerSettingsStore.getState().handleSetBackgroundOpacity(0.9);
        useVisualizerSettingsStore.setState({ randomVisualizerModePerSong: false });
        usePlaybackStore.setState({ currentSong: SONGS[0], lyrics: LYRICS[0], playQueue: SONGS, transitionDisplay: null, duration: 180 });
        setReady(true);
    }, []);
    return ready ? <RuntimeControls /> : null;
};

const definition: ProbeDefinition = {
    id: 'adaptiveLyricsRuntime',
    title: '随机歌词样式 · 真实运行接线',
    description: '实际 hook、store 和预选缓存，验证切歌、手动覆盖、重选与转场显示。',
    Component: AdaptiveLyricsRuntimeProbe,
};

export default definition;
