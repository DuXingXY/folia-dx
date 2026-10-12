import { create } from 'zustand';
import i18n from '../i18n/config';
import { getVisualStyleFingerprint, normalizeVisualStyleSnapshot, type VisualStyleSnapshot } from '../services/visualStylePresets';

// src/stores/useFavoriteVisualPresetsStore.ts
// Favorite appearance snapshots survive restarts; the current random result stays session-local.
export const FAVORITE_VISUAL_PRESETS_STORAGE_KEY = 'favorite_visual_presets';

export interface FavoriteVisualPreset {
    id: string;
    name: string;
    createdAt: number;
    snapshot: VisualStyleSnapshot;
}

interface FavoriteVisualPresetsState {
    presets: FavoriteVisualPreset[];
    nextNumber: number;
    dismissedFingerprint: string | null;
    save: (snapshot: VisualStyleSnapshot, name?: string) => string;
    remove: (id: string) => void;
    replace: (presets: unknown) => void;
    clear: () => void;
    clearCurrent: (snapshot: VisualStyleSnapshot) => void;
    markApplied: () => void;
}

export const findFavoriteVisualPreset = (snapshot: VisualStyleSnapshot, presets: FavoriteVisualPreset[]) => {
    const fingerprint = getVisualStyleFingerprint(snapshot);
    return presets.find(preset => getVisualStyleFingerprint(preset.snapshot) === fingerprint);
};

/** Validate local storage and imported backups with the same snapshot contract. */
const normalizeFavorites = (entries: unknown): FavoriteVisualPreset[] => {
    if (!Array.isArray(entries)) return [];
    const ids = new Set<string>();
    const presets: FavoriteVisualPreset[] = [];
    for (const entry of entries) {
        const snapshot = normalizeVisualStyleSnapshot(entry?.snapshot);
        if (!snapshot || typeof entry?.id !== 'string' || !entry.id || ids.has(entry.id)
            || typeof entry.name !== 'string' || !entry.name.trim()
            || !Number.isFinite(entry.createdAt)) continue;
        ids.add(entry.id);
        presets.push({ id: entry.id, name: entry.name.trim(), createdAt: entry.createdAt, snapshot });
    }
    return presets;
};

/** Discard invalid entries without losing the other valid saved presets. */
const readFavorites = (): Pick<FavoriteVisualPresetsState, 'presets' | 'nextNumber'> => {
    const fallback = { presets: [], nextNumber: 1 };
    if (typeof window === 'undefined') return fallback;
    try {
        const saved = JSON.parse(localStorage.getItem(FAVORITE_VISUAL_PRESETS_STORAGE_KEY) ?? 'null');
        if (saved?.version !== 1 || !Array.isArray(saved.presets)) return fallback;
        const presets = normalizeFavorites(saved.presets);
        return { presets, nextNumber: Math.max(presets.length + 1, Number.isInteger(saved.nextNumber) ? saved.nextNumber : 1) };
    } catch {
        return fallback;
    }
};

const persistFavorites = (presets: FavoriteVisualPreset[], nextNumber: number) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(FAVORITE_VISUAL_PRESETS_STORAGE_KEY, JSON.stringify({ version: 1, presets, nextNumber }));
    } catch {
        // A full or blocked browser store must not prevent using favorites in this session.
    }
};

export const useFavoriteVisualPresetsStore = create<FavoriteVisualPresetsState>((set, get) => ({
    ...readFavorites(),
    dismissedFingerprint: null,
    save: (snapshot, name) => {
        const state = get();
        const existing = findFavoriteVisualPreset(snapshot, state.presets);
        if (existing) {
            set({ dismissedFingerprint: null });
            return existing.id;
        }
        const normalized = normalizeVisualStyleSnapshot(snapshot);
        if (!normalized) return '';
        const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const preset = {
            id, snapshot: normalized, createdAt: Date.now(),
            name: name?.trim() || i18n.t('options.favoriteVisualPresetName', { number: state.nextNumber }),
        };
        const presets = [...state.presets, preset];
        const nextNumber = state.nextNumber + 1;
        persistFavorites(presets, nextNumber);
        set({ presets, nextNumber, dismissedFingerprint: null });
        return id;
    },
    remove: (id) => {
        const state = get();
        const presets = state.presets.filter(preset => preset.id !== id);
        persistFavorites(presets, state.nextNumber);
        set({ presets });
    },
    replace: (entries) => {
        const presets = normalizeFavorites(entries);
        const nextNumber = Math.max(get().nextNumber, presets.length + 1);
        persistFavorites(presets, nextNumber);
        set({ presets, nextNumber, dismissedFingerprint: null });
    },
    clear: () => {
        persistFavorites([], 1);
        set({ presets: [], nextNumber: 1, dismissedFingerprint: null });
    },
    clearCurrent: snapshot => set({ dismissedFingerprint: getVisualStyleFingerprint(snapshot) }),
    markApplied: () => set({ dismissedFingerprint: null }),
}));
