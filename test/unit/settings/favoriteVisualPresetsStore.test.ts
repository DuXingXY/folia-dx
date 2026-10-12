import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisualStyleSnapshot } from '../../../src/services/visualStylePresets';

// test/unit/settings/favoriteVisualPresetsStore.test.ts
// Storage failures and restart recovery are tested independently of the appearance engine.
vi.mock('../../../src/i18n/config', () => ({ default: { t: (_key: string, values: { number: number }) => `Preset ${values.number}` } }));
vi.mock('../../../src/services/visualStylePresets', () => ({
    getVisualStyleFingerprint: (snapshot: unknown) => JSON.stringify(snapshot),
    normalizeVisualStyleSnapshot: (value: any) => value?.version === 1 && typeof value?.visualizer?.visualizerMode === 'string'
        ? structuredClone(value) : null,
}));

const snapshot = (mode = 'classic') => ({ version: 1, visualizer: { visualizerMode: mode }, typography: {}, useCoverColorBg: false }) as unknown as VisualStyleSnapshot;
const key = 'favorite_visual_presets';
let storage: Map<string, string>;
let getItem: ReturnType<typeof vi.fn>;
let setItem: ReturnType<typeof vi.fn>;
const load = async () => (await import('../../../src/stores/useFavoriteVisualPresetsStore')).useFavoriteVisualPresetsStore;

beforeEach(() => {
    vi.resetModules();
    storage = new Map();
    getItem = vi.fn((storageKey: string) => storage.get(storageKey) ?? null);
    setItem = vi.fn((storageKey: string, value: string) => storage.set(storageKey, value));
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem, setItem });
});
afterEach(() => vi.unstubAllGlobals());

describe('favorite visual presets', () => {
    it('persists a copied snapshot and restores it after a module restart', async () => {
        const store = await load();
        const captured = snapshot();
        const id = store.getState().save(captured);
        captured.visualizer.visualizerMode = 'tilt';
        expect(store.getState().presets[0].snapshot.visualizer.visualizerMode).toBe('classic');
        vi.resetModules();
        const restored = await load();
        expect(restored.getState().presets).toMatchObject([{ id, name: 'Preset 1', snapshot: { visualizer: { visualizerMode: 'classic' } } }]);
        expect(restored.getState().nextNumber).toBe(2);
    });

    it('persists optional Folium parameters independently and distinguishes different visual values', async () => {
        const store = await load();
        const saved = { ...snapshot(), foliumParams: { 'visualizer:example:lyrics': { speed: 2 } } };
        const id = store.getState().save(saved);
        saved.foliumParams['visualizer:example:lyrics'].speed = 4;
        expect(store.getState().presets[0].snapshot.foliumParams).toEqual({ 'visualizer:example:lyrics': { speed: 2 } });
        expect(store.getState().save(saved)).not.toBe(id);
        vi.resetModules();
        expect((await load()).getState().presets.map(preset => preset.snapshot.foliumParams)).toEqual([
            { 'visualizer:example:lyrics': { speed: 2 } }, { 'visualizer:example:lyrics': { speed: 4 } },
        ]);
    });

    it('reuses an existing favorite and persists removal', async () => {
        const store = await load();
        const first = store.getState().save(snapshot());
        expect(store.getState().save(snapshot())).toBe(first);
        expect(store.getState().presets).toHaveLength(1);
        store.getState().remove(first);
        vi.resetModules();
        expect((await load()).getState().presets).toEqual([]);
    });

    it('persists a renamed favorite without changing its appearance, identity or selection', async () => {
        const store = await load();
        const firstId = store.getState().save(snapshot());
        store.getState().save(snapshot('tilt'), 'Another favorite');
        store.getState().clearCurrent(snapshot());
        const before = store.getState();
        const first = before.presets[0];
        const second = before.presets[1];
        setItem.mockClear();

        expect(before.rename(firstId, '夜行歌词')).toBe(true);
        const after = store.getState();
        expect(after.presets[0]).toEqual({ ...first, name: '夜行歌词' });
        expect(after.presets[0].snapshot).toBe(first.snapshot);
        expect(after.presets[1]).toBe(second);
        expect(after.nextNumber).toBe(before.nextNumber);
        expect(after.dismissedFingerprint).toBe(before.dismissedFingerprint);
        expect(setItem).toHaveBeenCalledTimes(1);
        expect(JSON.parse(storage.get(key)!)).toEqual({ version: 1, presets: after.presets, nextNumber: before.nextNumber });

        vi.resetModules();
        const restored = (await load()).getState();
        expect(restored.presets).toEqual(after.presets);
        expect(restored.nextNumber).toBe(before.nextNumber);
    });

    it('trims names and accepts the same name without notifying or rewriting storage', async () => {
        const store = await load();
        const id = store.getState().save(snapshot());
        expect(store.getState().rename(id, '  夜行歌词\t ')).toBe(true);
        expect(store.getState().presets[0].name).toBe('夜行歌词');
        const before = store.getState();
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        setItem.mockClear();

        expect(before.rename(id, '\t夜行歌词  ')).toBe(true);
        expect(store.getState()).toBe(before);
        expect(listener).not.toHaveBeenCalled();
        expect(setItem).not.toHaveBeenCalled();
        unsubscribe();
    });

    it.each(['', ' \t\r\n ', '　'])('rejects a blank name %j without changing favorites or storage', async (name) => {
        const store = await load();
        const id = store.getState().save(snapshot());
        store.getState().clearCurrent(snapshot());
        const before = store.getState();
        const persisted = storage.get(key);
        setItem.mockClear();

        expect(before.rename(id, name)).toBe(false);
        expect(store.getState()).toBe(before);
        expect(storage.get(key)).toBe(persisted);
        expect(setItem).not.toHaveBeenCalled();
    });

    it('rejects an unknown favorite without changing favorites or storage', async () => {
        const store = await load();
        store.getState().save(snapshot());
        const before = store.getState();
        const persisted = storage.get(key);
        setItem.mockClear();

        expect(before.rename('missing', 'A new name')).toBe(false);
        expect(store.getState()).toBe(before);
        expect(storage.get(key)).toBe(persisted);
        expect(setItem).not.toHaveBeenCalled();
    });

    it('renames an existing version 1 backup without changing its sequence or snapshot', async () => {
        const preset = { id: 'old-favorite', name: 'Preset 7', createdAt: 12, snapshot: snapshot() };
        storage.set(key, JSON.stringify({ version: 1, presets: [preset], nextNumber: 8 }));
        const store = await load();
        expect(store.getState().rename(preset.id, 'My original favorite')).toBe(true);

        vi.resetModules();
        const restoredStore = await load();
        const restored = restoredStore.getState();
        expect(restored.presets).toEqual([{ ...preset, name: 'My original favorite' }]);
        expect(restored.nextNumber).toBe(8);
        expect(restored.save(snapshot('tilt'))).not.toBe(preset.id);
        expect(restoredStore.getState().presets[1].name).toBe('Preset 8');
    });

    it('recovers from corrupt or unreadable browser storage', async () => {
        storage.set(key, '{invalid json');
        expect((await load()).getState().presets).toEqual([]);
        vi.resetModules();
        getItem.mockImplementation(() => { throw new Error('blocked'); });
        expect((await load()).getState().presets).toEqual([]);
    });

    it('keeps favorites usable when browser storage is full', async () => {
        setItem.mockImplementation(() => { throw new Error('quota'); });
        const store = await load();
        expect(() => store.getState().save(snapshot())).not.toThrow();
        expect(store.getState().presets).toHaveLength(1);
        expect(() => store.getState().remove(store.getState().presets[0].id)).not.toThrow();
        expect(store.getState().presets).toEqual([]);
    });

    it('clears the star for another random result and restores it when a favorite is applied', async () => {
        const store = await load();
        store.getState().save(snapshot());
        store.getState().clearCurrent(snapshot());
        expect(store.getState().dismissedFingerprint).toBe(JSON.stringify(snapshot()));
        store.getState().markApplied();
        expect(store.getState().dismissedFingerprint).toBeNull();
    });

    it('validates imported entries, deduplicates ids and restores the imported list', async () => {
        const store = await load();
        const valid = { id: 'valid', name: 'A favorite', snapshot: snapshot(), createdAt: 1 };
        store.getState().replace([null, valid, { ...valid, name: 'Duplicate' }, { ...valid, id: 'broken', snapshot: {} }]);
        expect(store.getState().presets).toEqual([valid]);
        vi.resetModules();
        expect((await load()).getState().presets).toEqual([valid]);
    });

    it('restores every valid favorite from a large backup without truncating it', async () => {
        const store = await load();
        const presets = Array.from({ length: 120 }, (_, index) => ({ id: String(index), name: `Preset ${index}`, snapshot: snapshot(), createdAt: index }));
        store.getState().replace(presets);
        expect(store.getState().presets).toEqual(presets);
        vi.resetModules();
        expect((await load()).getState().presets).toEqual(presets);
    });
});
