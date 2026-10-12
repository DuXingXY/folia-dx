import { useSyncExternalStore } from 'react';
import { captureVisualStyle, getVisualStyleFingerprint } from '../services/visualStylePresets';
import { useVisualizerSettingsStore } from '../stores/useVisualizerSettingsStore';
import { useTypographySettingsStore } from '../stores/useTypographySettingsStore';
import { useThemeSettingsStore } from '../stores/useThemeSettingsStore';

// src/hooks/useVisualStyleFingerprint.ts
// Appearance changes are discrete store updates; no playback clock or animation data is observed.
const readFingerprint = () => getVisualStyleFingerprint(captureVisualStyle());
const subscribe = (onChange: () => void) => {
    const unsubscribers = [
        useVisualizerSettingsStore.subscribe(onChange),
        useTypographySettingsStore.subscribe(onChange),
        useThemeSettingsStore.subscribe(onChange),
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
};

export const useVisualStyleFingerprint = () => useSyncExternalStore(subscribe, readFingerprint, readFingerprint);
