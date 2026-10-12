import React from 'react';
import { Star, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../types';
import { applyVisualStyle, getVisualStyleFingerprint, type VisualStyleSnapshot } from '../../services/visualStylePresets';
import { useFavoriteVisualPresetsStore } from '../../stores/useFavoriteVisualPresetsStore';
import { useVisualStyleFingerprint } from '../../hooks/useVisualStyleFingerprint';
import { getVisualizerModeLabel } from './registry';
import { colorWithAlpha } from './colorMix';

// src/components/visualizer/FavoriteVisualPresetsPanel.tsx
// Saved appearances apply directly to the real stores and the playground's subscribed props.
interface FavoriteVisualPresetsPanelProps {
    theme: Theme;
    isDaylight: boolean;
    controlCardBg: string;
    onBeforeApply?: (snapshot: VisualStyleSnapshot) => void;
}

const FavoriteVisualPresetsPanel: React.FC<FavoriteVisualPresetsPanelProps> = ({ theme, isDaylight, controlCardBg, onBeforeApply }) => {
    const { t } = useTranslation();
    const presets = useFavoriteVisualPresetsStore(state => state.presets);
    const fingerprint = useVisualStyleFingerprint();
    if (!presets.length) return (
        <div className="rounded-[24px] border px-5 py-10 text-center" style={{ backgroundColor: controlCardBg, borderColor: colorWithAlpha(theme.secondaryColor, 0.16) }}>
            <Star size={24} className="mx-auto mb-3 opacity-60" style={{ color: theme.secondaryColor }} aria-hidden="true" />
            <p className="text-sm" style={{ color: theme.primaryColor }}>{t('options.favoriteVisualPresets')}</p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: theme.secondaryColor }}>{t('options.favoriteVisualPresetsEmpty')}</p>
        </div>
    );
    return (
        <div className="space-y-3">
            {presets.map(preset => {
                const active = getVisualStyleFingerprint(preset.snapshot) === fingerprint;
                return (
                    <div key={preset.id} className="flex items-stretch rounded-[24px] border p-1 transition-colors" style={{ backgroundColor: active ? colorWithAlpha(theme.accentColor, isDaylight ? 0.1 : 0.16) : controlCardBg, borderColor: active ? theme.accentColor : colorWithAlpha(theme.secondaryColor, 0.16), boxShadow: active ? `inset 0 0 0 1px ${theme.accentColor}` : undefined }}>
                        <button type="button" aria-label={`${t('options.applyVisualPreset')}: ${preset.name}`} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] px-3 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset" onClick={() => {
                            onBeforeApply?.(preset.snapshot);
                            applyVisualStyle(preset.snapshot);
                            useFavoriteVisualPresetsStore.getState().markApplied();
                        }}>
                            <Star size={18} fill="currentColor" className="shrink-0" style={{ color: '#facc15' }} aria-hidden="true" />
                            <span className="min-w-0 space-y-1">
                                <span className="block truncate text-sm" style={{ color: theme.primaryColor }}>{preset.name}</span>
                                <span className="block text-xs" style={{ color: theme.secondaryColor }}>{getVisualizerModeLabel(preset.snapshot.visualizer.visualizerMode, t)}</span>
                            </span>
                        </button>
                        <button type="button" aria-label={`${t('options.deleteVisualPreset')}: ${preset.name}`} title={t('options.deleteVisualPreset')} className="my-auto mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-65 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2" style={{ color: theme.secondaryColor }} onClick={() => useFavoriteVisualPresetsStore.getState().remove(preset.id)}>
                            <Trash2 size={15} aria-hidden="true" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default FavoriteVisualPresetsPanel;
