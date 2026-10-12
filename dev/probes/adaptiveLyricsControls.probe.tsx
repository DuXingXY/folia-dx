import React, { useState } from 'react';
import AdaptiveLyricsControls from '../../src/components/shared/AdaptiveLyricsControls';
import { DAYLIGHT_THEME, DEFAULT_THEME } from '../../src/services/baseThemes';
import { settingsCardClassFor } from '../../src/components/modal/settings/settingsCardClasses';
import type { ProbeDefinition } from './definition';
import { useVisualizerSettingsStore } from '../../src/stores/useVisualizerSettingsStore';
import { useTypographySettingsStore } from '../../src/stores/useTypographySettingsStore';
import { useThemeSettingsStore } from '../../src/stores/useThemeSettingsStore';
import { captureVisualStyle } from '../../src/services/visualStylePresets';
import { useAdaptiveLyricsStore } from '../../src/stores/useAdaptiveLyricsStore';

// dev/probes/adaptiveLyricsControls.probe.tsx
// Shared state lets the two real control layouts exercise switching, empty playback and rerolling.
const AdaptiveLyricsControlsProbe: React.FC = () => {
    const enabled = useAdaptiveLyricsStore(state => state.enabled);
    const toggleEnabled = useAdaptiveLyricsStore(state => state.handleToggleAdaptiveLyrics);
    const [daylight, setDaylight] = useState(false);
    const mode = useVisualizerSettingsStore().visualizerMode;
    useTypographySettingsStore();
    useThemeSettingsStore(state => state.useCoverColorBg);
    const theme = daylight ? DAYLIGHT_THEME : DEFAULT_THEME;
    const controls = {
        isDaylight: daylight,
        theme,
    };
    return (
        <div
            className="min-h-screen space-y-6 p-4"
            style={{
                backgroundColor: theme.backgroundColor,
                color: theme.primaryColor,
                '--text-primary': theme.primaryColor,
                '--text-secondary': theme.secondaryColor,
            } as React.CSSProperties}
        >
            <div className="flex flex-wrap gap-3 text-xs">
                <button type="button" onClick={() => setDaylight(value => !value)}>Toggle daylight</button>
                <output data-probe-mode>{mode}</output>
                <output data-probe-per-song-enabled hidden>{String(enabled)}</output>
                <output data-probe-settings-snapshot hidden>{JSON.stringify(captureVisualStyle())}</output>
            </div>
            <section data-probe-settings className={`max-w-xl rounded-xl border p-4 ${settingsCardClassFor(daylight)}`}>
                <AdaptiveLyricsControls {...controls} enabled={enabled} onToggle={toggleEnabled} showPerSongToggle />
            </section>
            <section data-probe-panel className="max-w-[340px] rounded-xl border border-white/10 py-3">
                <AdaptiveLyricsControls {...controls} compact />
            </section>
        </div>
    );
};

const definition: ProbeDefinition = {
    id: 'adaptiveLyricsControls',
    title: '随机样式 · 设置与面板',
    description: '共用全随机开关、单次随机与收藏按钮，以及设置页的切歌随机开关、明暗主题和窄屏布局。',
    Component: AdaptiveLyricsControlsProbe,
};

export default definition;
