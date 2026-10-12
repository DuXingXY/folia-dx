import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';

// test/component/adaptiveLyricsRuntime.spec.ts
// Exercise immediate random selection and display handoff without audio or renderer mounts.
const A = 'local:adaptive-a';
const B = 'local:adaptive-b';
const readout = (component: Locator, key: string) => component.locator(`[data-runtime="${key}"]`);
const enable = async (component: Locator) => {
    await component.getByRole('button', { name: 'Toggle song randomization', exact: true }).click();
    await expect(readout(component, 'activeSongKey')).toHaveText(A);
};
const waitForSelection = async (component: Locator) => {
    await expect(readout(component, 'selection')).not.toHaveText('-', { timeout: 800 });
};

test('first random choice is ready while lyrics are loading and leaves the saved manual style intact', async ({ mount }) => {
    const component = await mount('adaptiveLyricsRuntime');
    await enable(component);
    await waitForSelection(component);
    await expect(readout(component, 'mode')).not.toHaveText('classic');
    await expect(readout(component, 'manualVisualizerMode')).toHaveText('classic');
    await expect(readout(component, 'savedMode')).toHaveText('classic');
});

test('manual selection is retained until the next song', async ({ mount, page }) => {
    const component = await mount('adaptiveLyricsRuntime');
    await enable(component);
    await component.getByRole('button', { name: 'Manual still' }).click();
    await expect(readout(component, 'manualSongKey')).toHaveText(A);
    // Later effects and renderer preloads must not undo the explicit selection.
    await page.waitForTimeout(300);
    await expect(readout(component, 'mode')).toHaveText('still');
    await expect(readout(component, 'selection')).toHaveText('-');
    await component.getByRole('button', { name: 'Next song', exact: true }).click();
    await expect(readout(component, 'activeSongKey')).toHaveText(B);
    await waitForSelection(component);
    await expect(readout(component, 'mode')).not.toHaveText('still');
    await expect(readout(component, 'manualSongKey')).toHaveText('-');
    await expect(readout(component, 'savedMode')).toHaveText('still');
});

test('rapid skips settle on the visible song', async ({ mount }) => {
    const component = await mount('adaptiveLyricsRuntime');
    await enable(component);
    const next = component.getByRole('button', { name: 'Next song', exact: true });
    await next.click();
    await next.click();
    await next.click();
    await expect(readout(component, 'activeSongKey')).toHaveText(B);
    await expect(readout(component, 'displaySong')).toHaveText('adaptive-b');
    await waitForSelection(component);
    await expect(readout(component, 'activeSongKey')).toHaveText(B);
    await expect(readout(component, 'savedMode')).toHaveText('classic');
});

test('returning to an already played song starts a fresh random decision', async ({ mount }) => {
    const component = await mount('adaptiveLyricsRuntime');
    await enable(component);
    await waitForSelection(component);
    const next = component.getByRole('button', { name: 'Next song', exact: true });
    await next.click();
    await expect(readout(component, 'activeSongKey')).toHaveText(B);
    await next.click();
    await expect(readout(component, 'activeSongKey')).toHaveText(A);
    await waitForSelection(component);
    await expect(readout(component, 'savedMode')).toHaveText('classic');
});

test('held transition follows the displayed song and lyrics until release', async ({ mount }) => {
    const component = await mount('adaptiveLyricsRuntime');
    await enable(component);
    await waitForSelection(component);
    const outgoingMode = await readout(component, 'selection').innerText();
    await component.getByRole('button', { name: 'Hold incoming' }).click();
    await expect(readout(component, 'rawSong')).toHaveText('adaptive-b');
    await expect(readout(component, 'displaySong')).toHaveText('adaptive-a');
    await expect(readout(component, 'displayLyrics')).toHaveText('孤独的夜里流泪');
    await expect(readout(component, 'activeSongKey')).toHaveText(A);
    await expect(readout(component, 'selection')).toHaveText(outgoingMode);
    await expect(readout(component, 'mode')).toHaveText(outgoingMode);
    await component.getByRole('button', { name: 'Release hold' }).click();
    await expect(readout(component, 'activeSongKey')).toHaveText(B);
    await expect(readout(component, 'displayLyrics')).toHaveText('阳光快乐一起跳舞');
    await expect(readout(component, 'selection')).not.toHaveText(outgoingMode, { timeout: 800 });
    await expect(readout(component, 'mode')).toHaveText(await readout(component, 'selection').innerText());
});

test('reroll chooses another style without persisting it and disabling restores the manual default', async ({ mount }) => {
    const component = await mount('adaptiveLyricsRuntime');
    await enable(component);
    await waitForSelection(component);
    const initialMode = await readout(component, 'selection').innerText();
    await component.getByRole('button', { name: 'Reroll current style', exact: true }).click();
    await expect(readout(component, 'selection')).not.toHaveText(initialMode, { timeout: 800 });
    await expect(readout(component, 'selection')).not.toHaveText('-');
    await expect(readout(component, 'savedMode')).toHaveText('classic');
    await component.getByRole('button', { name: 'Toggle song randomization', exact: true }).click();
    await expect(readout(component, 'mode')).toHaveText('classic');
    await expect(readout(component, 'selection')).toHaveText('-');
    await expect(readout(component, 'manualVisualizerMode')).toHaveText('classic');
});

test('lyrics-only scope changes renderer settings while preserving every other appearance setting', async ({ mount }) => {
    const component = await mount('adaptiveLyricsRuntime');
    const protectedBefore = await readout(component, 'protectedSettings').textContent();
    const tuningsBefore = await readout(component, 'rendererTunings').textContent();
    await enable(component);
    await waitForSelection(component);
    await expect(readout(component, 'protectedSettings')).toHaveText(protectedBefore!);
    await expect(readout(component, 'rendererTunings')).not.toHaveText(tuningsBefore!);
    const initialTunings = await readout(component, 'rendererTunings').textContent();
    await component.getByRole('button', { name: 'Next song', exact: true }).click();
    await expect(readout(component, 'activeSongKey')).toHaveText(B);
    await expect(readout(component, 'protectedSettings')).toHaveText(protectedBefore!);
    await expect(readout(component, 'rendererTunings')).not.toHaveText(initialTunings!);
});

test('scope changes apply at the next song and leave the current appearance intact', async ({ mount }) => {
    const component = await mount('adaptiveLyricsRuntime');
    await enable(component);
    await waitForSelection(component);
    const appearanceBefore = await readout(component, 'appearance').textContent();
    const protectedBefore = await readout(component, 'protectedSettings').textContent();
    const scope = component.getByRole('switch', { name: 'Randomize all', exact: true });
    await scope.click();
    await expect(scope).toHaveAttribute('aria-checked', 'true');
    await expect(readout(component, 'appearance')).toHaveText(appearanceBefore!);
    await component.getByRole('button', { name: 'Next song', exact: true }).click();
    await expect(readout(component, 'activeSongKey')).toHaveText(B);
    await expect(readout(component, 'protectedSettings')).not.toHaveText(protectedBefore!);
    const allScopeAppearance = await readout(component, 'appearance').textContent();
    const allScopeProtected = await readout(component, 'protectedSettings').textContent();
    await scope.click();
    await expect(scope).toHaveAttribute('aria-checked', 'false');
    await expect(readout(component, 'appearance')).toHaveText(allScopeAppearance!);
    await component.getByRole('button', { name: 'Next song', exact: true }).click();
    await expect(readout(component, 'activeSongKey')).toHaveText(A);
    await expect(readout(component, 'protectedSettings')).toHaveText(allScopeProtected!);
});
