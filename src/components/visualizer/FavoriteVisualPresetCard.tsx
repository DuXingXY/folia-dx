import React, { useLayoutEffect, useRef, useState } from 'react';
import { Check, Pencil, Star, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../types';
import { useFavoriteVisualPresetsStore, type FavoriteVisualPreset } from '../../stores/useFavoriteVisualPresetsStore';
import { getVisualizerModeLabel } from './registry';
import { colorWithAlpha } from './colorMix';

// src/components/visualizer/FavoriteVisualPresetCard.tsx
// Inline naming changes only the saved label; applying the appearance remains a separate action.
interface FavoriteVisualPresetCardProps {
    preset: FavoriteVisualPreset;
    active: boolean;
    theme: Theme;
    isDaylight: boolean;
    controlCardBg: string;
    onApply: () => void;
}

const FavoriteVisualPresetCard: React.FC<FavoriteVisualPresetCardProps> = ({ preset, active, theme, isDaylight, controlCardBg, onApply }) => {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState(preset.name);
    const [nameRequired, setNameRequired] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const renameRef = useRef<HTMLButtonElement>(null);
    const wasEditing = useRef(false);

    useLayoutEffect(() => {
        if (editing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        } else if (wasEditing.current) {
            renameRef.current?.focus();
        }
        wasEditing.current = editing;
    }, [editing]);

    const saveName = () => {
        if (!useFavoriteVisualPresetsStore.getState().rename(preset.id, draftName)) {
            setNameRequired(true);
            inputRef.current?.focus();
            return;
        }
        setEditing(false);
    };
    const modeLabel = getVisualizerModeLabel(preset.snapshot.visualizer.visualizerMode, t);
    const actionClass = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-65 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2';
    const star = <Star size={18} fill="currentColor" className="shrink-0" style={{ color: '#facc15' }} aria-hidden="true" />;

    return (
        <div className="flex items-stretch rounded-[24px] border p-1 transition-colors" style={{ backgroundColor: active ? colorWithAlpha(theme.accentColor, isDaylight ? 0.1 : 0.16) : controlCardBg, borderColor: active ? theme.accentColor : colorWithAlpha(theme.secondaryColor, 0.16), boxShadow: active ? `inset 0 0 0 1px ${theme.accentColor}` : undefined }}>
            {editing ? (
                <form className="flex min-w-0 flex-1 items-center gap-3 px-3 py-4" onSubmit={event => { event.preventDefault(); saveName(); }}>
                    {star}
                    <div className="min-w-0 flex-1 space-y-1">
                        <input
                            ref={inputRef}
                            type="text"
                            aria-label={t('options.visualPresetName')}
                            aria-invalid={nameRequired}
                            value={draftName}
                            className="w-full min-w-0 rounded-md border bg-transparent px-2 py-1 text-sm outline-none focus-visible:ring-2"
                            style={{ color: theme.primaryColor, borderColor: theme.secondaryColor, '--tw-ring-color': theme.accentColor } as React.CSSProperties}
                            onChange={event => { setDraftName(event.target.value); setNameRequired(false); }}
                            onKeyDown={event => {
                                // IME confirmation must not submit an unfinished Chinese name or close the playground.
                                if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
                                    if (event.key === 'Enter') event.preventDefault();
                                    return;
                                }
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setEditing(false);
                                } else if (event.key === 'Enter') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    saveName();
                                }
                            }}
                        />
                        {nameRequired && <p role="alert" className="text-xs" style={{ color: theme.accentColor }}>{t('options.visualPresetNameRequired')}</p>}
                        <span className="block text-xs" style={{ color: theme.secondaryColor }}>{modeLabel}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1" style={{ color: theme.secondaryColor }}>
                        <button type="submit" aria-label={t('options.saveVisualPresetName')} title={t('options.saveVisualPresetName')} className={actionClass}><Check size={15} aria-hidden="true" /></button>
                        <button type="button" aria-label={t('options.cancelVisualPresetRename')} title={t('options.cancelVisualPresetRename')} className={actionClass} onClick={() => setEditing(false)}><X size={15} aria-hidden="true" /></button>
                    </div>
                </form>
            ) : (
                <button type="button" aria-label={`${t('options.applyVisualPreset')}: ${preset.name}`} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] px-3 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset" onClick={onApply}>
                    {star}
                    <span className="min-w-0 space-y-1">
                        <span className="block truncate text-sm" title={preset.name} style={{ color: theme.primaryColor }}>{preset.name}</span>
                        <span className="block text-xs" style={{ color: theme.secondaryColor }}>{modeLabel}</span>
                    </span>
                </button>
            )}
            <div className="my-auto mr-2 flex shrink-0 items-center gap-1" style={{ color: theme.secondaryColor }}>
                {!editing && <button ref={renameRef} type="button" aria-label={`${t('options.renameVisualPreset')}: ${preset.name}`} title={t('options.renameVisualPreset')} className={actionClass} onClick={() => { setDraftName(preset.name); setNameRequired(false); setEditing(true); }}><Pencil size={15} aria-hidden="true" /></button>}
                <button type="button" aria-label={`${t('options.deleteVisualPreset')}: ${preset.name}`} title={t('options.deleteVisualPreset')} className={actionClass} onClick={() => useFavoriteVisualPresetsStore.getState().remove(preset.id)}><Trash2 size={15} aria-hidden="true" /></button>
            </div>
        </div>
    );
};

export default FavoriteVisualPresetCard;
