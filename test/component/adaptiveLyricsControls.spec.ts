import { expect, test } from './fixtures';

// test/component/adaptiveLyricsControls.spec.ts
// Real shared controls exercise independent randomization, favorite state and keyboard access.
test('random controls share scope without rerolling or enabling per-song random', async ({ mount }) => {
    const component = await mount('adaptiveLyricsControls');
    const switches = component.getByRole('switch', { name: 'Shuffle on song change', exact: true });
    const scopes = component.getByRole('switch', { name: 'Randomize all', exact: true });
    const randomize = component.getByRole('button', { name: 'Random style', exact: true });
    await expect(switches).toHaveCount(1);
    await expect(component.locator('[data-probe-panel]').getByRole('switch')).toHaveCount(1);
    await expect(scopes).toHaveCount(2);
    await expect(randomize).toHaveCount(2);
    await expect(scopes.first()).toHaveAttribute('aria-checked', 'false');
    const initial = await component.locator('[data-probe-settings-snapshot]').textContent();
    await scopes.first().click();
    await expect(scopes.last()).toHaveAttribute('aria-checked', 'true');
    await expect(component.locator('[data-probe-settings-snapshot]')).toHaveText(initial!);
    await expect(switches.first()).toHaveAttribute('aria-checked', 'false');
    await scopes.last().click();
    await expect(scopes.first()).toHaveAttribute('aria-checked', 'false');
    const before = await component.locator('[data-probe-mode]').textContent();
    await randomize.last().click();
    await expect(component.locator('[data-probe-mode]')).not.toHaveText(before!);
    await expect(switches.first()).toHaveAttribute('aria-checked', 'false');
    await switches.click();
    await expect(component.locator('[data-probe-per-song-enabled]')).toHaveText('true');
    await switches.click();
    await expect(component.locator('[data-probe-per-song-enabled]')).toHaveText('false');
});

test('favorite stars share the current preset and clear after randomizing again', async ({ mount }) => {
    const component = await mount('adaptiveLyricsControls');
    const save = component.getByRole('button', { name: 'Favorite current preset', exact: true });
    await save.first().click();
    const remove = component.getByRole('button', { name: 'Unfavorite current preset', exact: true });
    await expect(remove).toHaveCount(2);
    await expect(remove.first()).toHaveAttribute('aria-pressed', 'true');
    await component.getByRole('switch', { name: 'Randomize all', exact: true }).last().click();
    await expect(remove).toHaveCount(2);
    await expect(remove.first()).toHaveAttribute('aria-pressed', 'true');
    await component.getByRole('button', { name: 'Random style', exact: true }).last().click();
    await expect(save).toHaveCount(2);
    await expect(save.first()).toHaveAttribute('aria-pressed', 'false');
});

test('compact controls remain keyboard accessible and fit a narrow daylight panel', async ({ mount, page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const component = await mount('adaptiveLyricsControls');
    await component.getByRole('button', { name: 'Toggle daylight' }).click();
    const panel = component.locator('[data-probe-panel]');
    await expect(panel.getByRole('switch')).toHaveCount(1);
    const scope = panel.getByRole('switch', { name: 'Randomize all', exact: true });
    await scope.focus();
    await scope.press('Space');
    await expect(scope).toHaveAttribute('aria-checked', 'true');
    const randomize = panel.getByRole('button', { name: 'Random style', exact: true });
    const before = await component.locator('[data-probe-mode]').textContent();
    await randomize.focus();
    await randomize.press('Space');
    await expect(component.locator('[data-probe-mode]')).not.toHaveText(before!);
    const bounds = await panel.boundingBox();
    const button = await panel.getByRole('button', { name: 'Favorite current preset', exact: true }).boundingBox();
    const labelBounds = await panel.getByText('Randomize all', { exact: true }).boundingBox();
    const scopeBounds = await scope.boundingBox();
    const randomizeBounds = await randomize.boundingBox();
    expect(labelBounds!.x + labelBounds!.width).toBeLessThanOrEqual(scopeBounds!.x);
    expect(scopeBounds!.x + scopeBounds!.width).toBeLessThanOrEqual(randomizeBounds!.x);
    expect(randomizeBounds!.x + randomizeBounds!.width).toBeLessThanOrEqual(button!.x);
    expect(button!.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(button!.x + button!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    expect(await component.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('randomization scope restores after reloading without enabling automatic random', async ({ mount, page }) => {
    let component = await mount('adaptiveLyricsControls');
    await component.getByRole('switch', { name: 'Randomize all', exact: true }).first().click();
    const saved = await page.evaluate(() => Object.entries(localStorage));
    await page.addInitScript(entries => {
        for (const [key, value] of entries) localStorage.setItem(key, value);
    }, saved);
    await page.reload();
    component = await mount('adaptiveLyricsControls');
    await expect(component.getByRole('switch', { name: 'Randomize all', exact: true }).first()).toHaveAttribute('aria-checked', 'true');
    await expect(component.getByRole('switch', { name: 'Shuffle on song change', exact: true })).toHaveAttribute('aria-checked', 'false');
});

test('Chinese panel orders the all-random label, scope switch, random style button and favorite star', async ({ mount, page }, testInfo) => {
    await page.setViewportSize({ width: 400, height: 640 });
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
    const component = await mount('adaptiveLyricsControls');
    const panel = component.locator('[data-probe-panel]');
    const label = panel.getByText('全随机开关', { exact: true });
    const scope = panel.getByRole('switch', { name: '全随机开关', exact: true });
    const randomize = panel.getByRole('button', { name: '随机样式', exact: true });
    const favorite = panel.getByRole('button', { name: '收藏当前预设', exact: true });
    await expect(panel.getByRole('switch')).toHaveCount(1);
    await expect(label).toBeVisible();
    await expect(randomize).toBeVisible();
    await expect(component.locator('[data-probe-settings]').getByRole('switch', { name: '切歌随机', exact: true })).toBeVisible();
    const boxes = await Promise.all([label, scope, randomize, favorite].map(control => control.boundingBox()));
    for (let index = 1; index < boxes.length; index += 1) {
        expect(boxes[index]!.x).toBeGreaterThanOrEqual(boxes[index - 1]!.x + boxes[index - 1]!.width);
        expect(Math.abs(boxes[index]!.y + boxes[index]!.height / 2 - boxes[0]!.y - boxes[0]!.height / 2)).toBeLessThan(1);
    }
    await scope.click();
    await expect(scope).toHaveAttribute('aria-checked', 'true');
    await panel.screenshot({ path: testInfo.outputPath('random-style-controls-zh.png') });
});
