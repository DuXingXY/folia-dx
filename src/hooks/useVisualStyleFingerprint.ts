import { useSyncExternalStore } from 'react';
import { captureVisualStyle, getVisualStyleFingerprint } from '../services/visualStylePresets';
import { useVisualizerSettingsStore } from '../stores/useVisualizerSettingsStore';
import { useTypographySettingsStore } from '../stores/useTypographySettingsStore';
import { useThemeSettingsStore } from '../stores/useThemeSettingsStore';
import { useFoliumParamStore } from '../mods/folium/paramStore';

// src/hooks/useVisualStyleFingerprint.ts
// Appearance changes are discrete store updates; no playback clock or animation data is observed.
const readFingerprint = () => getVisualStyleFingerprint(captureVisualStyle());
const subscribe = (onChange: () => void) => {
    let previous = readFingerprint();
    const notify = () => {
        const next = readFingerprint();
        if (next === previous) return;
        previous = next;
        onChange();
    };
    const unsubscribers = [
        useVisualizerSettingsStore.subscribe(notify),
        useTypographySettingsStore.subscribe(notify),
        useThemeSettingsStore.subscribe(notify),
        useFoliumParamStore.subscribe(notify),
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
};

export const useVisualStyleFingerprint = () => useSyncExternalStore(subscribe, readFingerprint, readFingerprint);
