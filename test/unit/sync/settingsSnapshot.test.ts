import { afterEach, describe, expect, it } from 'vitest';
import { applySyncedVisualSettings, buildSyncedVisualSettings, readSyncableSettingsState } from '@/services/sync/settingsSnapshot';
import { useAdaptiveLyricsStore } from '@/stores/useAdaptiveLyricsStore';

// test/unit/sync/settingsSnapshot.test.ts
// The randomization scope travels with visual settings; older documents leave the local choice alone.

const initialState = useAdaptiveLyricsStore.getState();

afterEach(() => useAdaptiveLyricsStore.setState(initialState));

describe('randomization scope in synced visual settings', () => {
    it('exports and restores both scope choices', () => {
        for (const randomizeAllEnabled of [false, true]) {
            useAdaptiveLyricsStore.setState({ randomizeAllEnabled });
            const document = buildSyncedVisualSettings(readSyncableSettingsState());
            expect(document.randomizeAllEnabled).toBe(randomizeAllEnabled);
            useAdaptiveLyricsStore.setState({ randomizeAllEnabled: !randomizeAllEnabled });
            applySyncedVisualSettings(readSyncableSettingsState(), { randomizeAllEnabled: document.randomizeAllEnabled });
            expect(useAdaptiveLyricsStore.getState().randomizeAllEnabled).toBe(randomizeAllEnabled);
        }
    });

    it('keeps the local scope when an older document does not include it', () => {
        useAdaptiveLyricsStore.setState({ randomizeAllEnabled: true });
        applySyncedVisualSettings(readSyncableSettingsState(), { adaptiveLyricsEnabled: false });
        expect(useAdaptiveLyricsStore.getState().randomizeAllEnabled).toBe(true);
    });
});
