import React from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../types';
import { applyVisualStyle, getVisualStyleFingerprint, type VisualStyleSnapshot } from '../../services/visualStylePresets';
import { useFavoriteVisualPresetsStore } from '../../stores/useFavoriteVisualPresetsStore';
import { useVisualStyleFingerprint } from '../../hooks/useVisualStyleFingerprint';
import { colorWithAlpha } from './colorMix';
import FavoriteVisualPresetCard from './FavoriteVisualPresetCard';

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
                    <FavoriteVisualPresetCard
                        key={preset.id}
                        preset={preset}
                        active={active}
                        theme={theme}
                        isDaylight={isDaylight}
                        controlCardBg={controlCardBg}
                        onApply={() => {
                            onBeforeApply?.(preset.snapshot);
                            applyVisualStyle(preset.snapshot);
                            useFavoriteVisualPresetsStore.getState().markApplied();
                        }}
                    />
                );
            })}
        </div>
    );
};

export default FavoriteVisualPresetsPanel;
