import type { RandomVisualStyleScope } from '@/types/randomVisualStyle';
import { chooseVisualStyleValue } from '@/utils/randomVisualStyle';
import type { FoliumParam, FoliumParamAccess } from './contract';
import { resolveFoliumParamDefault, resolveFoliumParamStep } from './params';

// src/mods/folium/randomVisualizerSettings.ts
// Random draws use existing plugin schemas and the ordinary validated, persisted writer.

/** Keep known plugins within readable settings without requiring a new Folium contract. */
const resolveRandomRange = (id: string, param: FoliumParam, scope: RandomVisualStyleScope) => {
    if (id === 'visualizer52hz:rings' && param.key === 'fontScale' && scope === 'all') return null;
    if (param.min === undefined || param.max === undefined) return null;
    let max = param.max;
    if (id === 'cinerama:cinerama-screen' && ['fontScale', 'italicChance'].includes(param.key)) {
        // Cinerama documents intentional clipping above its default type size and
        // excessive synthetic CJK slant. Never exceed its declared default here.
        const fallback = resolveFoliumParamDefault(param);
        if (typeof fallback === 'number') max = Math.min(max, fallback);
    }
    return max >= param.min ? { min: param.min, max } : null;
};

/** Sample the slider's min-anchored grid, including the last legal step below max. */
const sampleNumber = (param: FoliumParam, min: number, max: number, random: () => number): number | null => {
    const step = resolveFoliumParamStep(param);
    const intervals = (max - min) / step;
    if (!Number.isFinite(intervals) || intervals > Number.MAX_SAFE_INTEGER - 1) return null;
    const nearest = Math.round(intervals);
    const lastStep = Math.abs(intervals - nearest) < 1e-9 ? nearest : Math.floor(intervals);
    const draw = random();
    const normalized = Number.isFinite(draw) ? Math.min(1 - Number.EPSILON, Math.max(0, draw)) : 0;
    const next = min + Math.min(lastStep, Math.floor(normalized * (lastStep + 1))) * step;
    // Remove floating-point tails without rounding small declared steps to zero.
    return Math.max(min, Math.min(max, Number(next.toPrecision(15))));
};

/** Only the chosen visualizer's bounded numbers and declared choices are changed. */
export const randomizeFoliumVisualizerSettings = (
    id: string,
    access: FoliumParamAccess,
    scope: RandomVisualStyleScope,
    random: () => number,
): void => {
    const patch: Record<string, unknown> = {};
    for (const param of access.schema) {
        if (param.type === 'select' && param.options?.length) {
            patch[param.key] = chooseVisualStyleValue(param.options, random).value;
        } else if (param.type === 'number') {
            const range = resolveRandomRange(id, param, scope);
            if (!range) continue;
            const next = sampleNumber(param, range.min, range.max, random);
            if (next !== null) patch[param.key] = next;
        }
        // Text, URLs, switches and unbounded numbers lack safe random semantics.
    }
    if (Object.keys(patch).length) access.set(patch);
};
