import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyVisualStyle, captureVisualStyle, getVisualStyleFingerprint, normalizeVisualStyleSnapshot, randomizeVisualStyle } from '@/services/visualStylePresets';
import { useVisualizerSettingsStore } from '@/stores/useVisualizerSettingsStore';
import { useTypographySettingsStore } from '@/stores/useTypographySettingsStore';
import { useThemeSettingsStore } from '@/stores/useThemeSettingsStore';
import { useVisualizerAssetStore } from '@/stores/useVisualizerAssetStore';
import { useAdaptiveLyricsStore } from '@/stores/useAdaptiveLyricsStore';
import { useMotionSettingsStore } from '@/stores/useMotionSettingsStore';
import { useDesktopSettingsStore } from '@/stores/useDesktopSettingsStore';
import { VISUALIZER_REGISTRY } from '@/components/visualizer/registry';
import { VISUALIZER_BACKGROUND_REGISTRY } from '@/components/visualizer/backgrounds/registry';

// test/unit/visualStylePresets.test.ts
// Real setting actions verify complete preset restoration and the subtitle boundary of all-random.

vi.mock('@/components/visualizer/registry', () => ({
    VISUALIZER_REGISTRY: ['classic', 'cadenza', 'partita', 'fume', 'cappella', 'tilt', 'claddagh', 'monet', 'diorama', 'pendolo', 'sonnet', 'tempera', 'lumiere', 'still'].map(mode => ({ mode })),
    getVisualizerModeLabel: (mode: string) => mode,
}));
vi.mock('@/components/visualizer/backgrounds/registry', () => ({
    VISUALIZER_BACKGROUND_REGISTRY: ['common', 'monet', 'nomand', 'latent', 'sora', 'url'].map(mode => ({ mode })),
}));
vi.mock('@/services/customLyricsFont', () => ({
    clearUploadedLyricsFont: vi.fn(), restoreUploadedLyricsFont: vi.fn(async () => null), uploadAndRegisterLyricsFont: vi.fn(),
}));

const resetStores = () => {
    useVisualizerSettingsStore.setState(useVisualizerSettingsStore.getInitialState(), true);
    useTypographySettingsStore.setState(useTypographySettingsStore.getInitialState(), true);
    useThemeSettingsStore.setState(useThemeSettingsStore.getInitialState(), true);
    useVisualizerAssetStore.setState(useVisualizerAssetStore.getInitialState(), true);
    useAdaptiveLyricsStore.setState(useAdaptiveLyricsStore.getInitialState(), true);
    useMotionSettingsStore.setState(useMotionSettingsStore.getInitialState(), true);
    useDesktopSettingsStore.setState(useDesktopSettingsStore.getInitialState(), true);
};
const subtitleFields = (snapshot: ReturnType<typeof captureVisualStyle>) => Object.fromEntries(Object.entries(snapshot.typography).filter(([key]) => !key.startsWith('lyrics')));

describe('visual style presets', () => {
    beforeEach(resetStores);
    afterEach(() => vi.restoreAllMocks());

    it('captures live mode and independent copies of nested tuning/font/url arrays', () => {
        useVisualizerSettingsStore.setState({ visualizerMode: 'tilt', manualVisualizerMode: 'classic', urlBackgroundList: [{ id: 'url-a', url: 'https://example.com/', note: 'a' }], urlBackgroundSelectedId: 'url-a' });
        useTypographySettingsStore.setState({ lyricsFontFallbackFamilies: ['Example Font'] });
        const snapshot = captureVisualStyle();
        expect(snapshot.visualizer.visualizerMode).toBe('tilt');
        snapshot.visualizer.dioramaTuning.geometryVisibility.enabled = false;
        snapshot.visualizer.urlBackgroundList[0].url = 'https://other.example/';
        snapshot.typography.lyricsFontFallbackFamilies.push('Other');
        expect(useVisualizerSettingsStore.getState().dioramaTuning.geometryVisibility.enabled).toBe(true);
        expect(useVisualizerSettingsStore.getState().urlBackgroundList[0].url).toBe('https://example.com/');
        expect(useTypographySettingsStore.getState().lyricsFontFallbackFamilies).toEqual(['Example Font']);
    });

    it('randomizes every tuning group and mode while preserving every subtitle/harmony field and the per-song switch', () => {
        useVisualizerSettingsStore.setState({ randomVisualizerModePerSong: true });
        useTypographySettingsStore.setState({
            subtitleContentMode: 'both', showSubtitleTranslation: true, subtitleFontStyle: 'serif', subtitleFontScale: 1.3,
            subtitleFontWeight: 530, subtitleFontFamily: 'Example Subtitle Font', subtitleFontFallbackFamilies: ['Fallback'],
            subtitleFontInheritsLyrics: false, hidePlayerTranslationSubtitle: true, subtitleOverlayBackground: false,
            subtitleOverlayOpacity: 0.35, subtitleUpcomingLyricsBlur: false, showHarmonySubtitle: false, harmonySubtitleBackground: false,
        });
        const before = captureVisualStyle();
        vi.spyOn(Math, 'random').mockReturnValue(0.1);
        const after = randomizeVisualStyle();
        expect(after.visualizer.visualizerMode).not.toBe(before.visualizer.visualizerMode);
        expect(subtitleFields(after)).toEqual(subtitleFields(before));
        expect(useVisualizerSettingsStore.getState().randomVisualizerModePerSong).toBe(true);
        vi.spyOn(Math, 'random').mockReturnValue(0.8);
        const alternate = randomizeVisualStyle();
        for (const key of Object.keys(after.visualizer).filter(key => key.endsWith('Tuning'))) {
            const tuningKey = key as keyof typeof after.visualizer;
            expect([after, alternate].some(result => JSON.stringify(result.visualizer[tuningKey]) !== JSON.stringify(before.visualizer[tuningKey])), key).toBe(true);
        }
        expect(subtitleFields(alternate)).toEqual(subtitleFields(before));
        expect(after.typography.lyricsFontScale).not.toBe(before.typography.lyricsFontScale);
        expect(after.visualizer.visualizerOpacity).toBeGreaterThanOrEqual(0.75);
        expect(after.visualizer.cappellaTuning.avatarSource).not.toBe('custom');
        expect(after.visualizer.cappellaTuning.emojiPackSource).toBe('builtin');
        expect(after.visualizer.monetTuning.portraitSource).toBe('cover');
        expect(after.visualizer.monetBackgroundTuning.backgroundSource).toBe('cover-derived');
        expect(after.visualizer.visualizerBackgroundMode).not.toBe('url');
    });

    it('fully restores a captured preset, including subtitles, without changing unrelated preferences', () => {
        useAdaptiveLyricsStore.setState({ enabled: true, activeSongKey: 'local:song', manualSongKey: null });
        useVisualizerSettingsStore.setState({ randomVisualizerModePerSong: true, visualizerFrameRate: 90 });
        useVisualizerSettingsStore.getState().handleSetTiltTuning({ colorScheme: 'swap', splitProbability: 0.42 });
        useTypographySettingsStore.getState().handleSetSubtitleContentMode('romanization');
        useTypographySettingsStore.getState().handleSetSubtitleFontFallbackFamilies(['A', 'B']);
        const saved = captureVisualStyle();
        randomizeVisualStyle();
        useTypographySettingsStore.getState().handleToggleShowHarmonySubtitle(false);
        applyVisualStyle(saved);
        expect(captureVisualStyle()).toEqual(saved);
        expect(useVisualizerSettingsStore.getState().randomVisualizerModePerSong).toBe(true);
        expect(useVisualizerSettingsStore.getState().visualizerFrameRate).toBe(90);
        expect(useAdaptiveLyricsStore.getState().enabled).toBe(true);
        expect(useAdaptiveLyricsStore.getState().manualSongKey).toBe('local:song');
    });

    it('lyrics scope changes animations while preserving common settings, backgrounds and the complete typography snapshot', () => {
        useVisualizerSettingsStore.setState({
            visualizerBackgroundMode: 'url', visualizerOpacity: 0.43, backgroundOpacity: 0.31,
            disableVisualizerVignette: true, disableVisualizerGeometricBackground: true,
            urlBackgroundList: [{ id: 'a', url: 'https://a.example/', note: 'A' }], urlBackgroundSelectedId: 'a',
        });
        useTypographySettingsStore.setState({
            lyricsCustomFont: { source: 'uploaded', family: 'Uploaded', fontId: 'keep-id' },
            lyricsFontFallbackFamilies: ['Fallback'], lyricsFontScale: 1.3, lyricsFontWeight: 600,
            subtitleFontInheritsLyrics: true, subtitleContentMode: 'both', hidePlayerTranslationSubtitle: true,
        });
        useThemeSettingsStore.setState({ useCoverColorBg: true });
        const before = captureVisualStyle();
        vi.spyOn(Math, 'random').mockReturnValue(0.1);
        const after = randomizeVisualStyle({ scope: 'lyrics' });
        vi.spyOn(Math, 'random').mockReturnValue(0.8);
        const alternate = randomizeVisualStyle({ scope: 'lyrics' });
        const animationKeys = Object.keys(before.visualizer).filter(key => key.endsWith('Tuning') && !key.endsWith('BackgroundTuning'));
        for (const result of [after, alternate]) {
            expect(result.typography).toEqual(before.typography);
            expect(result.useCoverColorBg).toBe(before.useCoverColorBg);
            const unchanged = (snapshot: typeof before) => Object.fromEntries(Object.entries(snapshot.visualizer).filter(([key]) => key !== 'visualizerMode' && !animationKeys.includes(key)));
            expect(unchanged(result)).toEqual(unchanged(before));
        }
        expect(after.visualizer.visualizerMode).not.toBe(before.visualizer.visualizerMode);
        for (const key of animationKeys) {
            const tuningKey = key as keyof typeof before.visualizer;
            expect([after, alternate].some(result => JSON.stringify(result.visualizer[tuningKey]) !== JSON.stringify(before.visualizer[tuningKey])), key).toBe(true);
        }
    });

    it.each(['lyrics', 'all'] as const)('automatic %s random uses the prepared renderer without overriding the current song or saved mode', (scope) => {
        useAdaptiveLyricsStore.setState({ enabled: true, activeSongKey: 'local:song', manualSongKey: null, selection: { mode: 'tilt', animationIntensity: 'normal' } });
        useVisualizerSettingsStore.setState({ visualizerMode: 'classic', manualVisualizerMode: 'partita' });
        const result = randomizeVisualStyle({ scope, mode: 'tilt', automatic: true });
        expect(result.visualizer.visualizerMode).toBe('tilt');
        expect(useVisualizerSettingsStore.getState().manualVisualizerMode).toBe('partita');
        expect(useAdaptiveLyricsStore.getState()).toMatchObject({ manualSongKey: null, selection: { mode: 'tilt' } });
    });

    it('keeps later saved background URLs when applying an older favorite', () => {
        const a = { id: 'a', url: 'https://a.example/', note: 'A' };
        const b = { id: 'b', url: 'https://b.example/', note: 'B' };
        useVisualizerSettingsStore.setState({ urlBackgroundList: [a], urlBackgroundSelectedId: 'a', visualizerBackgroundMode: 'url' });
        const saved = captureVisualStyle();
        useVisualizerSettingsStore.setState({ urlBackgroundList: [a, b], urlBackgroundSelectedId: 'b' });
        applyVisualStyle(saved);
        const applied = captureVisualStyle();
        expect(applied.visualizer.urlBackgroundList).toEqual([a, b]);
        expect(applied.visualizer.urlBackgroundSelectedId).toBe('a');
        expect(getVisualStyleFingerprint(applied)).toBe(getVisualStyleFingerprint(saved));
    });

    it('retains saved mod IDs before startup registration and applies their original modes after registration', () => {
        const saved = captureVisualStyle();
        saved.visualizer.visualizerMode = 'mod:example:lyrics';
        saved.visualizer.visualizerBackgroundMode = 'mod:example:background';
        const restored = normalizeVisualStyleSnapshot(JSON.parse(JSON.stringify(saved)))!;
        expect(restored).toEqual(saved);
        VISUALIZER_REGISTRY.push({ mode: saved.visualizer.visualizerMode } as typeof VISUALIZER_REGISTRY[number]);
        VISUALIZER_BACKGROUND_REGISTRY.push({ mode: saved.visualizer.visualizerBackgroundMode } as typeof VISUALIZER_BACKGROUND_REGISTRY[number]);
        try {
            applyVisualStyle(restored);
            expect(captureVisualStyle()).toEqual(saved);
            expect(restored).toEqual(saved);
        } finally {
            VISUALIZER_REGISTRY.pop();
            VISUALIZER_BACKGROUND_REGISTRY.pop();
        }
    });

    it('falls back when a saved mod is unavailable without rewriting the saved snapshot', () => {
        const saved = captureVisualStyle();
        saved.visualizer.visualizerMode = 'mod:example:lyrics';
        saved.visualizer.visualizerBackgroundMode = 'mod:example:background';
        const savedJson = JSON.stringify(saved);
        applyVisualStyle(saved);
        expect(captureVisualStyle().visualizer).toMatchObject({ visualizerMode: 'classic', visualizerBackgroundMode: 'common' });
        expect(JSON.stringify(saved)).toBe(savedJson);
        expect(normalizeVisualStyleSnapshot(saved)).toEqual(saved);
        saved.visualizer.visualizerMode = 'mod:example:';
        saved.visualizer.visualizerBackgroundMode = 'mod::background';
        expect(normalizeVisualStyleSnapshot(saved)?.visualizer).toMatchObject({ visualizerMode: 'classic', visualizerBackgroundMode: 'common' });
    });

    it('rejects malformed snapshots and clamps untrusted numbers/enums/URLs before applying', () => {
        expect(normalizeVisualStyleSnapshot(null)).toBeNull();
        expect(normalizeVisualStyleSnapshot({ version: 5 })).toBeNull();
        expect(normalizeVisualStyleSnapshot({ version: 1, visualizer: [], typography: [] })).toBeNull();
        const raw = captureVisualStyle();
        raw.visualizer.tiltTuning.splitProbability = 99;
        raw.visualizer.cadenzaTuning.widthRatio = Number.POSITIVE_INFINITY;
        raw.visualizer.sonnetTuning.cameraIntensity = Number.NaN;
        raw.visualizer.dioramaTuning.geometryVisibility.mode = 'bad' as never;
        raw.visualizer.urlBackgroundList = [{ id: 'bad', url: 'javascript://alert(1)', note: 'bad' }];
        raw.typography.subtitleFontFallbackFamilies = [4, {}, 'Okay'] as never;
        const safe = normalizeVisualStyleSnapshot(raw)!;
        expect(safe.visualizer.tiltTuning.splitProbability).toBe(1);
        expect(safe.visualizer.cadenzaTuning.widthRatio).toBe(0.72);
        expect(safe.visualizer.sonnetTuning.cameraIntensity).toBe(1);
        expect(safe.visualizer.dioramaTuning.geometryVisibility.mode).toBe('clouds');
        expect(safe.visualizer.urlBackgroundList).toEqual([]);
        expect(safe.typography.subtitleFontFallbackFamilies).toEqual(['Okay']);
        applyVisualStyle(raw);
        expect(captureVisualStyle()).toEqual(safe);
    });

    it('preserves existing font stacks, URL pools and finite Cadenza values when saving a snapshot', () => {
        useVisualizerSettingsStore.setState({
            cadenzaTuning: { ...useVisualizerSettingsStore.getState().cadenzaTuning, fontScale: 2.2 },
        });
        useVisualizerSettingsStore.getState().handleSetUrlBackgroundList(Array.from({ length: 101 }, (_, index) => ({ id: String(index), url: `https://example.com/${index}`, note: '' })));
        useTypographySettingsStore.getState().handleSetLyricsFontFallbackFamilies(Array.from({ length: 25 }, (_, index) => `Font ${index}`));
        const saved = captureVisualStyle();
        expect(normalizeVisualStyleSnapshot(saved)).toEqual(saved);
        randomizeVisualStyle();
        applyVisualStyle(saved);
        expect(captureVisualStyle()).toEqual(saved);
    });

    it('selects URL and custom source options only from existing saved resources', () => {
        useVisualizerSettingsStore.setState({ urlBackgroundList: [{ id: 'existing', url: 'https://example.com/', note: 'existing' }] });
        useVisualizerAssetStore.setState({
            storedMonetBackgroundImage: { id: 'background' } as never, storedMonetPortraitImage: { id: 'portrait' } as never,
            storedCappellaAvatarPack: [{ id: 'avatar' }] as never, storedCappellaEmojiPack: [{ id: 'emoji' }] as never,
        });
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        const randomized = randomizeVisualStyle();
        expect(randomized.visualizer.visualizerBackgroundMode).toBe('url');
        expect(randomized.visualizer.urlBackgroundSelectedId).toBe('existing');
        expect(randomized.visualizer.monetBackgroundTuning.backgroundSource).toBe('uploaded-global');
        expect(randomized.visualizer.monetTuning.portraitSource).toBe('custom');
        expect(randomized.visualizer.cappellaTuning.emojiPackSource).toBe('custom');
        expect(randomized.visualizer.cappellaTuning.avatarSource).toBe('custom');
    });

    it('does not delete uploaded font binaries when randomizing away from a custom font', async () => {
        const { clearUploadedLyricsFont } = await import('@/services/customLyricsFont');
        useTypographySettingsStore.setState({ lyricsCustomFont: { source: 'uploaded', family: 'Uploaded', fontId: 'uploaded-id' } });
        vi.spyOn(Math, 'random').mockReturnValue(0.8);
        expect(randomizeVisualStyle().typography.lyricsCustomFont).toBeNull();
        expect(clearUploadedLyricsFont).not.toHaveBeenCalled();
    });

    it('has the same fingerprint regardless of JSON property ordering', () => {
        const snapshot = captureVisualStyle();
        const reordered = { useCoverColorBg: snapshot.useCoverColorBg, typography: Object.fromEntries(Object.entries(snapshot.typography).reverse()), visualizer: Object.fromEntries(Object.entries(snapshot.visualizer).reverse()), version: 1 } as typeof snapshot;
        expect(getVisualStyleFingerprint(reordered)).toBe(getVisualStyleFingerprint(snapshot));
    });

    it.each(['all', 'lyrics'] as const)('manual %s random honors the same motion and wallpaper candidate limits as per-song random', (scope) => {
        vi.spyOn(Math, 'random').mockReturnValue(0.8);
        useMotionSettingsStore.getState().handleToggleReducedMotionSurface('uiMicroMotion', true);
        expect(['still', 'classic', 'monet']).toContain(randomizeVisualStyle({ scope }).visualizer.visualizerMode);
        useMotionSettingsStore.getState().handleToggleReducedMotionSurface('uiMicroMotion', false);
        useDesktopSettingsStore.setState({ wallpaperMode: true });
        expect(['still', 'classic', 'monet', 'fume', 'partita', 'cappella']).toContain(randomizeVisualStyle({ scope }).visualizer.visualizerMode);
    });
});
