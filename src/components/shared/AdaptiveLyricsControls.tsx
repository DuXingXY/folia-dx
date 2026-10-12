import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../types';
import VisualStyleActions from './VisualStyleActions';
import { settingsToggleOffClassFor } from '../modal/settings/settingsCardClasses';

// src/components/shared/AdaptiveLyricsControls.tsx
// The same randomization row fits the player panel and the appearance settings card.
interface AdaptiveLyricsControlsProps {
    isDaylight: boolean;
    theme?: Theme;
    compact?: boolean;
    showPerSongToggle?: boolean;
    enabled?: boolean;
    onToggle?: (enabled: boolean) => void;
}

const AdaptiveLyricsControls: React.FC<AdaptiveLyricsControlsProps> = ({
    isDaylight,
    theme,
    compact = false,
    showPerSongToggle = false,
    enabled = false,
    onToggle,
}) => {
    const { t } = useTranslation();
    return (
        <div className={`space-y-1 ${compact ? 'px-4 py-1.5' : ''}`}>
            <VisualStyleActions theme={theme} isDaylight={isDaylight} compact={compact} />
            {!compact && (
                <div className="max-w-[420px] text-xs opacity-70" style={{ color: 'var(--text-primary)' }}>
                    {t('options.randomizeAllDesc')}
                </div>
            )}
            {showPerSongToggle && onToggle && (
                <div className="flex items-center gap-3 pt-3">
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-sm font-medium">{t('options.adaptiveLyrics')}</div>
                        <div className="max-w-[420px] text-xs opacity-70" style={{ color: 'var(--text-primary)' }}>
                            {t('options.adaptiveLyricsDesc')}
                        </div>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-label={t('options.adaptiveLyrics')}
                        aria-checked={enabled}
                        onClick={() => onToggle(!enabled)}
                        className={`h-5 w-9 shrink-0 rounded-full p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${!enabled ? settingsToggleOffClassFor(isDaylight) : ''}`}
                        style={{ backgroundColor: enabled ? theme?.secondaryColor || 'rgba(114, 119, 134, 1)' : undefined }}
                    >
                        <span className={`block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default AdaptiveLyricsControls;
