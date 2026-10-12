import { VISUALIZER_REGISTRY } from '../components/visualizer/registry';
import { VISUALIZER_BACKGROUND_REGISTRY } from '../components/visualizer/backgrounds/registry';
import type { VisualizerMode } from '../types';
import { useVisualizerSettingsStore } from '../stores/useVisualizerSettingsStore';
import { useTypographySettingsStore, resolveStoredCustomLyricsFont } from '../stores/useTypographySettingsStore';
import { useThemeSettingsStore } from '../stores/useThemeSettingsStore';
import { useVisualizerAssetStore } from '../stores/useVisualizerAssetStore';
import { useDesktopSettingsStore } from '../stores/useDesktopSettingsStore';
import { resolveReducedMotion, useMotionSettingsStore } from '../stores/useMotionSettingsStore';
import { getRandomLyricsStyleCandidates } from '../utils/randomLyricsStyle';
import { restoreUploadedLyricsFont } from './customLyricsFont';
import { freezeManualVisualStyle } from './manualVisualStyle';
import { normalizeFoliumParamsPayload, useFoliumParamStore } from '../mods/folium/paramStore';
import { normalizeFontFamilyStack, normalizeFontWeight } from '../utils/fontStacks';
import { mergeUrlBackgroundList, sanitizeUrlBackgroundList } from '../utils/urlBackground';
import {
    chooseVisualStyleValue, normalizeVisualStyleTunings, randomizeVisualStyleTunings,
    randomVisualStyleNumber, visualStyleRecord,
} from '../utils/randomVisualStyle';
import {
    VISUAL_STYLE_TYPOGRAPHY_KEYS, VISUAL_STYLE_VISUALIZER_KEYS,
    type VisualStyleFoliumParams, type VisualStyleSnapshot, type VisualStyleTypographySettings, type VisualStyleVisualizerSettings,
} from '../types/visualStylePresets';

// src/services/visualStylePresets.ts
// Captures and applies favorite presets; randomization always leaves subtitle settings alone.

export type { VisualStyleSnapshot } from '../types/visualStylePresets';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const pick = <T extends object, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> => (
    Object.fromEntries(keys.map(key => [key, source[key]])) as Pick<T, K>
);
const number = (value: unknown, fallback: number, min: number, max: number): number => (
    typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
);
const boolean = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;
const fontStyle = (value: unknown): VisualStyleTypographySettings['lyricsFontStyle'] => (
    value === 'serif' || value === 'mono' ? value : 'sans'
);
const families = (value: unknown): string[] => normalizeFontFamilyStack(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);
// Folium entries register after eager store initialization; retain their namespaced IDs in saved snapshots.
const isSavedModMode = (value: unknown): value is string => typeof value === 'string'
    && /^mod:[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/.test(value);
const isVisualFoliumScope = (scope: string): boolean => /^(visualizer|background|tuning):.+$/.test(scope);
const visualFoliumParams = (raw: unknown): VisualStyleFoliumParams => Object.fromEntries(
    Object.entries(normalizeFoliumParamsPayload(raw)).filter(([scope]) => isVisualFoliumScope(scope)),
);

/** Replace visual values as a group so fields reset since capture return to their saved defaults. */
const applyFoliumParams = (saved: VisualStyleFoliumParams): void => {
    const state = useFoliumParamStore.getState();
    const unrelated = Object.fromEntries(Object.entries(state.byScope).filter(([scope]) => !isVisualFoliumScope(scope)));
    state.replaceAll({ ...unrelated, ...clone(saved) });
};

export const captureVisualStyle = (): VisualStyleSnapshot => clone({
    version: 1,
    visualizer: pick(useVisualizerSettingsStore.getState(), VISUAL_STYLE_VISUALIZER_KEYS),
    typography: pick(useTypographySettingsStore.getState(), VISUAL_STYLE_TYPOGRAPHY_KEYS),
    useCoverColorBg: useThemeSettingsStore.getState().useCoverColorBg,
    foliumParams: visualFoliumParams(useFoliumParamStore.getState().byScope),
});

/** Persisted presets are untrusted: copy recognized fields and validate their types before applying. */
export const normalizeVisualStyleSnapshot = (value: unknown): VisualStyleSnapshot | null => {
    try {
        const raw = visualStyleRecord(value);
        if (raw.version !== 1 || !raw.visualizer || !raw.typography
            || typeof raw.visualizer !== 'object' || Array.isArray(raw.visualizer)
            || typeof raw.typography !== 'object' || Array.isArray(raw.typography)) return null;
        const v = visualStyleRecord(raw.visualizer);
        const t = visualStyleRecord(raw.typography);
        const mode = VISUALIZER_REGISTRY.find(entry => entry.mode === v.visualizerMode)?.mode
            ?? (isSavedModMode(v.visualizerMode) ? v.visualizerMode : 'classic');
        const backgroundMode = v.visualizerBackgroundMode === null ? null
            : VISUALIZER_BACKGROUND_REGISTRY.find(entry => entry.mode === v.visualizerBackgroundMode)?.mode
                ?? (isSavedModMode(v.visualizerBackgroundMode) ? v.visualizerBackgroundMode : 'common');
        const urls = sanitizeUrlBackgroundList(v.urlBackgroundList);
        const custom = visualStyleRecord(t.lyricsCustomFont);
        const customFont = typeof custom.family === 'string'
            ? resolveStoredCustomLyricsFont({
                source: custom.source === 'uploaded' ? 'uploaded' : 'system', family: custom.family,
                label: typeof custom.label === 'string' ? custom.label : undefined,
                fontId: typeof custom.fontId === 'string' ? custom.fontId : undefined,
            }) : null;
        const subtitleContentMode = ['translation', 'romanization', 'both', 'none'].includes(String(t.subtitleContentMode))
            ? t.subtitleContentMode as VisualStyleTypographySettings['subtitleContentMode'] : 'translation';
        return clone({
            version: 1,
            useCoverColorBg: boolean(raw.useCoverColorBg, false),
            ...(raw.foliumParams === undefined ? {} : { foliumParams: visualFoliumParams(raw.foliumParams) }),
            visualizer: {
                ...normalizeVisualStyleTunings(v), visualizerMode: mode, visualizerBackgroundMode: backgroundMode,
                visualizerOpacity: number(v.visualizerOpacity, 1, 0.2, 1), backgroundOpacity: number(v.backgroundOpacity, 0.75, 0, 1),
                disableVisualizerVignette: boolean(v.disableVisualizerVignette, false),
                disableVisualizerGeometricBackground: boolean(v.disableVisualizerGeometricBackground, false),
                urlBackgroundList: urls, urlBackgroundSelectedId: urls.some(item => item.id === v.urlBackgroundSelectedId) ? v.urlBackgroundSelectedId as string : null,
            },
            typography: {
                lyricsFontStyle: fontStyle(t.lyricsFontStyle), lyricsFontScale: number(t.lyricsFontScale, 1, 0.85, 1.4),
                lyricsFontWeight: normalizeFontWeight(typeof t.lyricsFontWeight === 'number' ? t.lyricsFontWeight : null),
                lyricsCustomFont: customFont, lyricsFontFallbackFamilies: families(t.lyricsFontFallbackFamilies),
                hidePlayerTranslationSubtitle: boolean(t.hidePlayerTranslationSubtitle, false),
                showSubtitleTranslation: subtitleContentMode !== 'none', subtitleContentMode,
                subtitleOverlayOpacity: number(t.subtitleOverlayOpacity, 0.6, 0.2, 1),
                subtitleOverlayBackground: boolean(t.subtitleOverlayBackground, true), subtitleUpcomingLyricsBlur: boolean(t.subtitleUpcomingLyricsBlur, true),
                showHarmonySubtitle: boolean(t.showHarmonySubtitle, true), harmonySubtitleBackground: boolean(t.harmonySubtitleBackground, true),
                subtitleFontInheritsLyrics: boolean(t.subtitleFontInheritsLyrics, true), subtitleFontScale: number(t.subtitleFontScale, 1, 0.85, 1.4),
                subtitleFontStyle: fontStyle(t.subtitleFontStyle), subtitleFontWeight: normalizeFontWeight(typeof t.subtitleFontWeight === 'number' ? t.subtitleFontWeight : null),
                subtitleFontFamily: typeof t.subtitleFontFamily === 'string' ? t.subtitleFontFamily.trim() || null : null,
                subtitleFontFallbackFamilies: families(t.subtitleFontFallbackFamilies),
            },
        });
    } catch {
        return null;
    }
};

/** A stable comparison ignores property ordering introduced by JSON imports. */
export const getVisualStyleFingerprint = (snapshot: VisualStyleSnapshot): string => {
    const sort = (value: unknown): unknown => Array.isArray(value) ? value.map(sort)
        : value !== null && typeof value === 'object'
            ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort((value as Record<string, unknown>)[key])])) : value;
    // Adding another saved URL does not change this appearance; only the selected resource participates.
    const selectedUrl = snapshot.visualizer.urlBackgroundList.find(item => item.id === snapshot.visualizer.urlBackgroundSelectedId);
    return JSON.stringify(sort({
        ...snapshot,
        foliumParams: visualFoliumParams(snapshot.foliumParams),
        visualizer: {
            ...snapshot.visualizer,
            urlBackgroundList: selectedUrl ? [{ id: selectedUrl.id, url: selectedUrl.url }] : [],
        },
    }));
};

const applyLyricsAnimation = (v: VisualStyleVisualizerSettings, automatic = false): void => {
    const state = useVisualizerSettingsStore.getState();
    const assets = useVisualizerAssetStore.getState();
    // Manual operations freeze automatic randomization before this setter; automatic choices preserve the saved mode.
    if (automatic) state.handleSetAutomaticVisualizerMode(v.visualizerMode);
    else state.handleSetVisualizerMode(v.visualizerMode, { notify: false });
    state.handleSetClassicTuning(v.classicTuning);
    state.handleSetCadenzaTuning(v.cadenzaTuning);
    state.handleSetPartitaTuning(v.partitaTuning);
    state.handleSetFumeTuning(v.fumeTuning);
    state.handleSetCladdaghTuning(v.claddaghTuning);
    state.handleSetCappellaTuning({
        ...v.cappellaTuning,
        emojiPackSource: v.cappellaTuning.emojiPackSource === 'custom' && assets.storedCappellaEmojiPack.length === 0 ? 'builtin' : v.cappellaTuning.emojiPackSource,
        avatarSource: v.cappellaTuning.avatarSource === 'custom' && assets.storedCappellaAvatarPack.length === 0 ? 'cover' : v.cappellaTuning.avatarSource,
    });
    state.handleSetTiltTuning(v.tiltTuning);
    state.handleSetDioramaTuning(v.dioramaTuning);
    state.handleSetMonetTuning({ ...v.monetTuning, portraitSource: v.monetTuning.portraitSource === 'custom' && !assets.storedMonetPortraitImage ? 'cover' : v.monetTuning.portraitSource });
    state.handleSetPendoloTuning(v.pendoloTuning);
    state.handleSetSonnetTuning(v.sonnetTuning);
    state.handleSetTemperaTuning(v.temperaTuning);
    state.handleSetLumiereTuning(v.lumiereTuning);
};

const applyVisualizer = (v: VisualStyleVisualizerSettings, automatic = false): void => {
    const state = useVisualizerSettingsStore.getState();
    const assets = useVisualizerAssetStore.getState();
    applyLyricsAnimation(v, automatic);
    state.handleSetVisualizerOpacity(v.visualizerOpacity);
    state.handleSetBackgroundOpacity(v.backgroundOpacity);
    state.handleToggleDisableVisualizerVignette(v.disableVisualizerVignette);
    state.handleToggleDisableVisualizerGeometricBackground(v.disableVisualizerGeometricBackground);
    // Old v1 favorites stored the entire pool; only their selected resource belongs to this appearance.
    const selectedUrl = v.urlBackgroundList.find(item => item.id === v.urlBackgroundSelectedId);
    state.handleSetUrlBackgroundList(mergeUrlBackgroundList(state.urlBackgroundList, selectedUrl ? [selectedUrl] : []));
    state.handleSetUrlBackgroundSelectedId(v.urlBackgroundSelectedId);
    if (v.visualizerBackgroundMode === null) state.handleResetVisualizerBackgroundMode();
    else state.handleSetVisualizerBackgroundMode(v.visualizerBackgroundMode === 'url' && v.urlBackgroundList.length === 0 ? 'common' : v.visualizerBackgroundMode);
    state.handleSetMonetBackgroundTuning({ ...v.monetBackgroundTuning, backgroundSource: v.monetBackgroundTuning.backgroundSource === 'uploaded-global' && !assets.storedMonetBackgroundImage ? 'cover-derived' : v.monetBackgroundTuning.backgroundSource });
    state.handleSetNomandBackgroundTuning({ ...v.nomandBackgroundTuning, imageSource: v.nomandBackgroundTuning.imageSource === 'uploaded-global' && !assets.storedMonetBackgroundImage ? 'cover-derived' : v.nomandBackgroundTuning.imageSource });
    state.handleSetLatentBackgroundTuning(v.latentBackgroundTuning);
    state.handleSetSoraBackgroundTuning(v.soraBackgroundTuning);
};

const applyTypography = (t: VisualStyleTypographySettings, includeSubtitles: boolean): void => {
    const state = useTypographySettingsStore.getState();
    state.handleSetLyricsFontStyle(t.lyricsFontStyle);
    state.handleSetLyricsFontScale(t.lyricsFontScale);
    // Selecting a built-in font must not invoke the upload-clearing action: favorites retain the local font reference.
    useTypographySettingsStore.setState({ lyricsCustomFont: clone(t.lyricsCustomFont) });
    if (typeof window !== 'undefined') {
        if (t.lyricsCustomFont) localStorage.setItem('lyrics_custom_font', JSON.stringify(t.lyricsCustomFont));
        else localStorage.removeItem('lyrics_custom_font');
    }
    if (t.lyricsCustomFont?.source === 'uploaded' && t.lyricsCustomFont.fontId) {
        const fontId = t.lyricsCustomFont.fontId;
        void restoreUploadedLyricsFont(fontId).then(font => {
            if (font || useTypographySettingsStore.getState().lyricsCustomFont?.fontId !== fontId) return;
            useTypographySettingsStore.setState({ lyricsCustomFont: null });
            if (typeof window !== 'undefined') localStorage.removeItem('lyrics_custom_font');
        }).catch(() => { /* Keep metadata when the local font store is temporarily unavailable. */ });
    }
    state.handleSetLyricsFontFallbackFamilies(t.lyricsFontFallbackFamilies);
    state.handleSetLyricsFontWeight(t.lyricsFontWeight);
    if (!includeSubtitles) return;
    state.handleToggleHidePlayerTranslationSubtitle(t.hidePlayerTranslationSubtitle);
    state.handleSetSubtitleContentMode(t.subtitleContentMode);
    state.handleSetSubtitleOverlayOpacity(t.subtitleOverlayOpacity);
    state.handleToggleSubtitleOverlayBackground(t.subtitleOverlayBackground);
    state.handleToggleSubtitleUpcomingLyricsBlur(t.subtitleUpcomingLyricsBlur);
    state.handleToggleShowHarmonySubtitle(t.showHarmonySubtitle);
    state.handleToggleHarmonySubtitleBackground(t.harmonySubtitleBackground);
    state.handleSetSubtitleFontInheritsLyrics(t.subtitleFontInheritsLyrics);
    state.handleSetSubtitleFontScale(t.subtitleFontScale);
    state.handleSetSubtitleFontStyle(t.subtitleFontStyle);
    state.handleSetSubtitleFontWeight(t.subtitleFontWeight);
    state.handleSetSubtitleFontFamily(t.subtitleFontFamily);
    state.handleSetSubtitleFontFallbackFamilies(t.subtitleFontFallbackFamilies);
};

export const applyVisualStyle = (snapshot: VisualStyleSnapshot): void => {
    const safe = normalizeVisualStyleSnapshot(snapshot);
    if (!safe) return;
    freezeManualVisualStyle();
    // Missing mods affect only this application; the favorite keeps its original IDs for a later reload.
    const visualizer = {
        ...safe.visualizer,
        visualizerMode: VISUALIZER_REGISTRY.some(entry => entry.mode === safe.visualizer.visualizerMode)
            ? safe.visualizer.visualizerMode : 'classic',
        visualizerBackgroundMode: safe.visualizer.visualizerBackgroundMode === null ? null
            : VISUALIZER_BACKGROUND_REGISTRY.some(entry => entry.mode === safe.visualizer.visualizerBackgroundMode)
                ? safe.visualizer.visualizerBackgroundMode : 'common',
    };
    applyVisualizer(visualizer);
    applyTypography(safe.typography, true);
    useThemeSettingsStore.getState().handleToggleCoverColorBg(safe.useCoverColorBg);
    if (safe.foliumParams !== undefined) applyFoliumParams(safe.foliumParams);
};

/** Lyrics scope applies only renderer settings; all scope also applies common settings and backgrounds. */
export const randomizeVisualStyle = ({ scope = 'all', mode, automatic = false }: {
    scope?: 'all' | 'lyrics';
    mode?: VisualizerMode;
    automatic?: boolean;
} = {}): VisualStyleSnapshot => {
    if (!automatic) freezeManualVisualStyle();
    const snapshot = captureVisualStyle();
    snapshot.visualizer.urlBackgroundList = sanitizeUrlBackgroundList(snapshot.visualizer.urlBackgroundList);
    const assets = useVisualizerAssetStore.getState();
    const tunings = randomizeVisualStyleTunings(snapshot.visualizer);
    const modes = getRandomLyricsStyleCandidates({
        availableModes: VISUALIZER_REGISTRY.map(entry => entry.mode),
        currentMode: snapshot.visualizer.visualizerMode,
        wallpaperMode: useDesktopSettingsStore.getState().wallpaperMode,
        reducedMotion: resolveReducedMotion(useMotionSettingsStore.getState(), 'uiMicroMotion'),
    });
    const backgrounds = VISUALIZER_BACKGROUND_REGISTRY.map(entry => entry.mode).filter(mode => mode !== 'url' || snapshot.visualizer.urlBackgroundList.length > 0);
    const hasBackgroundImage = Boolean(assets.storedMonetBackgroundImage);
    tunings.monetBackgroundTuning.backgroundSource = hasBackgroundImage ? chooseVisualStyleValue(['cover-derived', 'uploaded-global']) : 'cover-derived';
    tunings.nomandBackgroundTuning.imageSource = hasBackgroundImage ? chooseVisualStyleValue(['cover-derived', 'uploaded-global']) : 'cover-derived';
    tunings.monetTuning.portraitSource = assets.storedMonetPortraitImage ? chooseVisualStyleValue(['cover', 'custom']) : 'cover';
    tunings.cappellaTuning.emojiPackSource = assets.storedCappellaEmojiPack.length ? chooseVisualStyleValue(['builtin', 'custom']) : 'builtin';
    tunings.cappellaTuning.avatarSource = chooseVisualStyleValue(assets.storedCappellaAvatarPack.length ? ['cover', 'builtin', 'color', 'custom'] as const : ['cover', 'builtin', 'color'] as const);
    const lyrics = {
        ...snapshot.visualizer, ...tunings,
        visualizerMode: mode ?? (modes.length ? chooseVisualStyleValue(modes) : snapshot.visualizer.visualizerMode),
    };
    if (scope === 'lyrics') {
        applyLyricsAnimation(lyrics, automatic);
        return captureVisualStyle();
    }
    const v: VisualStyleVisualizerSettings = {
        ...lyrics,
        visualizerBackgroundMode: chooseVisualStyleValue(backgrounds), visualizerOpacity: randomVisualStyleNumber(0.75, 1), backgroundOpacity: randomVisualStyleNumber(0.45, 0.85),
        disableVisualizerVignette: Math.random() < 0.5, disableVisualizerGeometricBackground: Math.random() < 0.5,
        urlBackgroundSelectedId: snapshot.visualizer.urlBackgroundList.length ? chooseVisualStyleValue(snapshot.visualizer.urlBackgroundList).id : null,
    };
    const useCustomFont = snapshot.typography.lyricsCustomFont && Math.random() < 0.25;
    const t: VisualStyleTypographySettings = {
        ...snapshot.typography, lyricsFontStyle: chooseVisualStyleValue(['sans', 'serif', 'mono'] as const),
        lyricsFontScale: chooseVisualStyleValue([0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2]),
        lyricsFontWeight: chooseVisualStyleValue([null, 300, 400, 500, 600, 700]),
        lyricsCustomFont: useCustomFont ? snapshot.typography.lyricsCustomFont : null,
        lyricsFontFallbackFamilies: useCustomFont ? snapshot.typography.lyricsFontFallbackFamilies : [],
    };
    applyVisualizer(v, automatic);
    applyTypography(t, false);
    useThemeSettingsStore.getState().handleToggleCoverColorBg(Math.random() < 0.5);
    return captureVisualStyle();
};
