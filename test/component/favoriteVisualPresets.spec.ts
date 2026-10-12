import { expect, test } from './fixtures';

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
