import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

interface SavedFavorites {
    version: number;
    nextNumber: number;
    presets: Array<{ id: string; name: string; createdAt: number; snapshot: unknown }>;
}

const readSavedFavorites = (page: Page): Promise<SavedFavorites> => page.evaluate(() =>
    JSON.parse(localStorage.getItem('favorite_visual_presets')!) as SavedFavorites);

const readOtherSettings = (page: Page) => page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).filter(key => key !== 'favorite_visual_presets').sort()
        .map(key => [key, localStorage.getItem(key)]),
));

// test/component/favoriteVisualPresets.spec.ts
// Favorite application is verified through the real preview's props and its locally drafted controls.
test('favorite presets apply after editing and refresh the real playground controls', async ({ mount }) => {
    const component = await mount('favoriteVisualPresets');
    await component.getByRole('button', { name: 'Appearance A', exact: true }).click();
    await component.getByRole('button', { name: 'Favorite current preset', exact: true }).click();
    const preset = component.getByRole('button', { name: 'Apply preset: Preset 1', exact: true });
    await expect(preset).toBeVisible();
    await component.getByRole('button', { name: 'Appearance B', exact: true }).click();
    await expect(component.locator('[data-probe-mode]')).toHaveText('tilt');
    await expect(component.locator('[data-probe-font-scale]')).toHaveText('1.2');
    await expect(component.getByRole('button', { name: 'Favorite current preset', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await preset.click();
    await expect(component.locator('[data-probe-mode]')).toHaveText('classic');
    await expect(component.locator('[data-probe-font-scale]')).toHaveText('1');
    await expect(component.getByRole('button', { name: 'Unfavorite current preset', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await component.getByRole('button', { name: 'Common', exact: true }).click();
    const sliders = component.locator('input[type="range"]');
    await expect(sliders.first()).toHaveValue('1');
    // A drag can leave only the local draft changed; applying the same saved values must reset it too.
    await sliders.first().dispatchEvent('pointerdown', { pointerId: 1 });
    await sliders.first().focus();
    await sliders.first().press('ArrowRight');
    await expect(sliders.first()).toHaveValue('1.05');
    await expect(component.locator('[data-probe-font-scale]')).toHaveText('1');
    await component.getByRole('button', { name: 'Favorites', exact: true }).click();
    await preset.click();
    await component.getByRole('button', { name: 'Common', exact: true }).click();
    await expect(sliders.first()).toHaveValue('1');
    await sliders.first().dispatchEvent('pointerup', { pointerId: 1 });
    await expect(component.locator('[data-probe-font-scale]')).toHaveText('1');
});

test('favorite list restores after reloading and saved presets can be deleted', async ({ mount, page }) => {
    let component = await mount('favoriteVisualPresets');
    await component.getByRole('button', { name: 'Appearance A', exact: true }).click();
    await component.getByRole('button', { name: 'Favorite current preset', exact: true }).click();
    await expect(component.getByRole('button', { name: 'Apply preset: Preset 1', exact: true })).toBeVisible();
    // Fixture init scripts clear localStorage on navigation, so preserve the saved browser state explicitly.
    const saved = await page.evaluate(() => localStorage.getItem('favorite_visual_presets'));
    await page.addInitScript(value => localStorage.setItem('favorite_visual_presets', value!), saved);
    await page.reload();
    component = await mount('favoriteVisualPresets');
    await expect(component.getByRole('button', { name: 'Apply preset: Preset 1', exact: true })).toBeVisible();
    await component.getByRole('button', { name: 'Delete preset: Preset 1', exact: true }).click();
    await expect(component.getByRole('button', { name: 'Apply preset: Preset 1', exact: true })).toHaveCount(0);
    await expect(component.getByText('No favorite presets yet. Click the star to save an appearance you like.')).toBeVisible();
});

test('the preview header randomizes independently while preserving subtitle settings', async ({ mount }) => {
    const component = await mount('favoriteVisualPresets');
    await component.getByRole('button', { name: 'Appearance A', exact: true }).click();
    const subtitleBefore = await component.locator('[data-probe-subtitle]').textContent();
    await component.getByRole('button', { name: 'Favorite current preset', exact: true }).click();
    const scope = component.getByRole('switch', { name: 'Randomize all', exact: true });
    await expect(scope).toHaveAttribute('aria-checked', 'false');
    await component.getByRole('button', { name: 'Random style', exact: true }).click();
    await expect(component.locator('[data-probe-mode]')).not.toHaveText('classic');
    await expect(component.locator('[data-probe-font-scale]')).toHaveText('1');
    await expect(component.getByRole('button', { name: 'Favorite current preset', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(component.locator('[data-probe-subtitle]')).toHaveText(subtitleBefore!);
    await scope.click();
    await expect(scope).toHaveAttribute('aria-checked', 'true');
    await component.getByRole('button', { name: 'Random style', exact: true }).click();
    await expect(component.locator('[data-probe-subtitle]')).toHaveText(subtitleBefore!);
});

test('a Chinese favorite name persists without applying or changing its saved appearance', async ({ mount, page }) => {
    let component = await mount('favoriteVisualPresets');
    await component.getByRole('button', { name: 'Appearance A', exact: true }).click();
    await component.getByRole('button', { name: 'Favorite current preset', exact: true }).click();
    const before = await readSavedFavorites(page);
    await component.getByRole('button', { name: 'Appearance B', exact: true }).click();
    const otherSettings = await readOtherSettings(page);

    await component.getByRole('button', { name: 'Rename preset: Preset 1', exact: true }).click();
    const input = component.getByRole('textbox', { name: 'Preset name', exact: true });
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Preset 1');
    expect(await input.evaluate(element => {
        const field = element as HTMLInputElement;
        return { start: field.selectionStart, end: field.selectionEnd };
    })).toEqual({ start: 0, end: 'Preset 1'.length });
    await input.fill('  夜色 · 商籁  ');
    await input.press('Enter');

    const renamed = component.getByRole('button', { name: 'Apply preset: 夜色 · 商籁', exact: true });
    await expect(renamed).toBeVisible();
    await expect(renamed).toHaveAttribute('aria-pressed', 'false');
    await expect(input).toHaveCount(0);
    await expect(component.locator('[data-probe-mode]')).toHaveText('tilt');
    await expect(component.locator('[data-probe-font-scale]')).toHaveText('1.2');
    expect(await readOtherSettings(page)).toEqual(otherSettings);
    expect(await readSavedFavorites(page)).toEqual({
        ...before,
        presets: [{ ...before.presets[0], name: '夜色 · 商籁' }],
    });

    // Keep the renamed favorite through the fixture's navigation-time storage reset.
    const saved = await page.evaluate(() => localStorage.getItem('favorite_visual_presets'));
    await page.addInitScript(value => localStorage.setItem('favorite_visual_presets', value!), saved);
    await page.reload();
    component = await mount('favoriteVisualPresets');
    await expect(component.getByRole('button', { name: 'Apply preset: 夜色 · 商籁', exact: true })).toBeVisible();
    await component.getByRole('button', { name: 'Appearance B', exact: true }).click();
    await component.getByRole('button', { name: 'Apply preset: 夜色 · 商籁', exact: true }).click();
    await expect(component.locator('[data-probe-mode]')).toHaveText('classic');
    await expect(component.locator('[data-probe-font-scale]')).toHaveText('1');
    await component.getByRole('button', { name: 'Delete preset: 夜色 · 商籁', exact: true }).click();
    await expect(component.getByText('No favorite presets yet. Click the star to save an appearance you like.')).toBeVisible();
});

test('Escape and Cancel discard a drafted favorite name', async ({ mount, page }) => {
    const component = await mount('favoriteVisualPresets');
    await component.getByRole('button', { name: 'Appearance A', exact: true }).click();
    await component.getByRole('button', { name: 'Favorite current preset', exact: true }).click();
    const before = await readSavedFavorites(page);
    const rename = component.getByRole('button', { name: 'Rename preset: Preset 1', exact: true });
    const input = component.getByRole('textbox', { name: 'Preset name', exact: true });

    await rename.click();
    await input.fill('Discard with Escape');
    await input.press('Escape');
    await expect(input).toHaveCount(0);
    await expect(component.getByRole('button', { name: 'Apply preset: Preset 1', exact: true })).toBeVisible();
    expect(await readSavedFavorites(page)).toEqual(before);

    await rename.click();
    await expect(input).toHaveValue('Preset 1');
    await input.fill('Discard with Cancel');
    await component.getByRole('button', { name: 'Cancel rename', exact: true }).click();
    await expect(input).toHaveCount(0);
    await expect(component.getByRole('button', { name: 'Apply preset: Preset 1', exact: true })).toBeVisible();
    expect(await readSavedFavorites(page)).toEqual(before);
});

test('a blank favorite name stays editable and does not overwrite the saved name', async ({ mount, page }) => {
    const component = await mount('favoriteVisualPresets');
    await component.getByRole('button', { name: 'Appearance A', exact: true }).click();
    await component.getByRole('button', { name: 'Favorite current preset', exact: true }).click();
    const before = await readSavedFavorites(page);
    await component.getByRole('button', { name: 'Rename preset: Preset 1', exact: true }).click();
    const input = component.getByRole('textbox', { name: 'Preset name', exact: true });
    await input.fill('    ');
    await input.press('Enter');
    await expect(component.getByText('Enter a preset name.', { exact: true })).toBeVisible();
    await expect(input).toBeVisible();
    expect(await readSavedFavorites(page)).toEqual(before);

    await input.fill('Saved after validation');
    await component.getByRole('button', { name: 'Save name', exact: true }).click();
    await expect(component.getByRole('button', { name: 'Apply preset: Saved after validation', exact: true })).toBeVisible();
    await expect(component.getByText('Enter a preset name.', { exact: true })).toHaveCount(0);
});

test('renaming one of several favorites preserves the other favorite and both snapshots', async ({ mount, page }) => {
    const component = await mount('favoriteVisualPresets');
    await component.getByRole('button', { name: 'Appearance A', exact: true }).click();
    await component.getByRole('button', { name: 'Favorite current preset', exact: true }).click();
    await component.getByRole('button', { name: 'Appearance B', exact: true }).click();
    await component.getByRole('button', { name: 'Favorite current preset', exact: true }).click();
    const before = await readSavedFavorites(page);
    await component.getByRole('button', { name: 'Rename preset: Preset 2', exact: true }).click();
    const input = component.getByRole('textbox', { name: 'Preset name', exact: true });
    await expect(input).toHaveValue('Preset 2');
    await input.fill('昼间');
    await component.getByRole('button', { name: 'Save name', exact: true }).click();

    await expect(component.getByRole('button', { name: 'Apply preset: Preset 1', exact: true })).toBeVisible();
    await expect(component.getByRole('button', { name: 'Apply preset: 昼间', exact: true })).toBeVisible();
    expect(await readSavedFavorites(page)).toEqual({
        ...before,
        presets: [before.presets[0], { ...before.presets[1], name: '昼间' }],
    });
    await component.getByRole('button', { name: 'Apply preset: Preset 1', exact: true }).click();
    await expect(component.locator('[data-probe-mode]')).toHaveText('classic');
    await component.getByRole('button', { name: 'Apply preset: 昼间', exact: true }).click();
    await expect(component.locator('[data-probe-mode]')).toHaveText('tilt');
});

test('a long favorite name keeps its action buttons inside the card on a narrow viewport', async ({ mount, page }) => {
    await page.setViewportSize({ width: 420, height: 920 });
    const component = await mount('favoriteVisualPresets');
    await component.getByRole('button', { name: 'Appearance A', exact: true }).click();
    await component.getByRole('button', { name: 'Favorite current preset', exact: true }).click();
    await component.getByRole('button', { name: 'Rename preset: Preset 1', exact: true }).click();
    const name = '沿着银河听晚风'.repeat(8);
    await component.getByRole('textbox', { name: 'Preset name', exact: true }).fill(name);
    await component.getByRole('button', { name: 'Save name', exact: true }).click();

    const apply = component.getByRole('button', { name: `Apply preset: ${name}`, exact: true });
    await expect(apply).toBeVisible();
    const card = await apply.locator('..').boundingBox();
    expect(card).not.toBeNull();
    for (const action of ['Rename preset', 'Delete preset']) {
        const button = component.getByRole('button', { name: `${action}: ${name}`, exact: true });
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(card!.x);
        expect(box!.x + box!.width).toBeLessThanOrEqual(card!.x + card!.width);
        expect(box!.x + box!.width).toBeLessThanOrEqual(420);
    }
});
