import React from 'react';
import { Shuffle, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../types';
import { captureVisualStyle, getVisualStyleFingerprint, randomizeVisualStyle } from '../../services/visualStylePresets';
import { useVisualStyleFingerprint } from '../../hooks/useVisualStyleFingerprint';
import { useFavoriteVisualPresetsStore } from '../../stores/useFavoriteVisualPresetsStore';
import { useAdaptiveLyricsStore } from '../../stores/useAdaptiveLyricsStore';
import { settingsToggleOffClassFor } from '../modal/settings/settingsCardClasses';

// src/components/shared/VisualStyleActions.tsx
// Randomization scope, a manual reroll and the favorite star share the appearance control row.
interface VisualStyleActionsProps {
    theme?: Theme;
    isDaylight: boolean;
    compact?: boolean;
    onBeforeRandomize?: () => void;
    onBeforeFavorite?: () => void;
}

const VisualStyleActions: React.FC<VisualStyleActionsProps> = ({ theme, isDaylight, compact = false, onBeforeRandomize, onBeforeFavorite }) => {
    const { t } = useTranslation();
    const randomizeAllEnabled = useAdaptiveLyricsStore(state => state.randomizeAllEnabled);
    const handleToggleRandomizeAll = useAdaptiveLyricsStore(state => state.handleToggleRandomizeAll);
    const fingerprint = useVisualStyleFingerprint();
    const presets = useFavoriteVisualPresetsStore(state => state.presets);
    const dismissedFingerprint = useFavoriteVisualPresetsStore(state => state.dismissedFingerprint);
    const favorite = fingerprint !== dismissedFingerprint
        ? presets.find(preset => getVisualStyleFingerprint(preset.snapshot) === fingerprint) : undefined;
    const favoriteLabel = t(favorite ? 'options.unfavoriteVisualPreset' : 'options.favoriteVisualPreset');
    const focusClass = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
    return (
        <div className={`flex min-w-0 items-center gap-2 ${compact ? 'text-[11px]' : 'text-sm'}`}>
            <div className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap font-medium">
                <Shuffle size={compact ? 13 : 15} className="shrink-0 opacity-55" aria-hidden="true" />
                <span>{t('options.randomizeAll')}</span>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={randomizeAllEnabled}
                onClick={() => handleToggleRandomizeAll(!randomizeAllEnabled)}
                title={t('options.randomizeAllDesc')}
                aria-label={t('options.randomizeAll')}
                className={`h-5 w-9 shrink-0 rounded-full p-1 transition-colors ${focusClass} ${!randomizeAllEnabled ? settingsToggleOffClassFor(isDaylight) : ''}`}
                style={{ backgroundColor: randomizeAllEnabled ? theme?.secondaryColor || 'rgba(114, 119, 134, 1)' : undefined }}
            >
                <span className={`block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${randomizeAllEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <button
                type="button"
                onClick={() => {
                    onBeforeRandomize?.();
                    const scope = useAdaptiveLyricsStore.getState().randomizeAllEnabled ? 'all' : 'lyrics';
                    useFavoriteVisualPresetsStore.getState().clearCurrent(randomizeVisualStyle({ scope }));
                }}
                title={t('options.randomizeOnce')}
                aria-label={t('options.randomizeOnce')}
                className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-2 transition-colors ${compact ? 'h-6' : 'h-7'} ${focusClass} ${isDaylight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/10 hover:bg-white/20'}`}
                style={{ color: theme?.primaryColor }}
            >
                {t('options.randomizeOnce')}
            </button>
            <button
                type="button"
                aria-pressed={Boolean(favorite)}
                aria-label={favoriteLabel}
                title={favoriteLabel}
                onClick={() => {
                    onBeforeFavorite?.();
                    const store = useFavoriteVisualPresetsStore.getState();
                    const snapshot = captureVisualStyle();
                    const currentFingerprint = getVisualStyleFingerprint(snapshot);
                    const currentFavorite = currentFingerprint !== store.dismissedFingerprint
                        ? store.presets.find(preset => getVisualStyleFingerprint(preset.snapshot) === currentFingerprint) : undefined;
                    if (currentFavorite) store.remove(currentFavorite.id);
                    else store.save(snapshot);
                }}
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${focusClass} ${isDaylight ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
                style={{ color: favorite ? '#facc15' : (isDaylight ? theme?.primaryColor || '#374151' : '#fff') }}
            >
                <Star size={compact ? 16 : 18} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
        </div>
    );
};

export default VisualStyleActions;
