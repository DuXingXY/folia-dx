import type { Locator } from '@playwright/test';
import type { VisualStyleSnapshot } from '../../src/types/visualStylePresets';
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
const readAppearance = async (component: Locator): Promise<VisualStyleSnapshot> => (
    JSON.parse((await readout(component, 'appearance').textContent())!)
);
const expectManualRandomSaved = async (component: Locator) => {
    await expect(readout(component, 'enabled')).toHaveText('false');
    await expect(readout(component, 'savedEnabled')).toHaveText('false');
    await expect(readout(component, 'legacyEnabled')).toHaveText('false');
    await expect(readout(component, 'selection')).toHaveText('-');
    await expect(readout(component, 'activeSongKey')).toHaveText('-');
    await expect(readout(component, 'savedMode')).toHaveText(await readout(component, 'mode').innerText());
    expect(JSON.parse((await readout(component, 'savedRendererTunings').textContent())!))
        .toEqual(JSON.parse((await readout(component, 'rendererTunings').textContent())!));
};

for (const scope of ['lyrics', 'all'] as const) {
    test(`manual random ${scope} style stays fixed through songs, pause and single-field edits`, async ({ mount, page }) => {
        const component = await mount('adaptiveLyricsRuntime');
        if (scope === 'all') await component.getByRole('switch', { name: 'Randomize all', exact: true }).click();
        await enable(component);
        await waitForSelection(component);
        const automatic = await readAppearance(component);

        // Click the shipped VisualStyleActions button while per-song randomization is running.
        const random = component.getByRole('button', { name: 'Random style', exact: true });
        await random.click();
        await expectManualRandomSaved(component);
        const chosen = await readAppearance(component);
        expect(chosen.visualizer.visualizerMode).not.toBe(automatic.visualizer.visualizerMode);
        expect(chosen.visualizer.classicTuning).not.toEqual(automatic.visualizer.classicTuning);
        const chosenText = await readout(component, 'appearance').textContent();
        await component.getByRole('button', { name: 'Next song', exact: true }).click();
        await expect(readout(component, 'displaySong')).toHaveText('adaptive-b');
        await component.getByRole('button', { name: 'Pause playback', exact: true }).click();
        await expect(readout(component, 'playerState')).toHaveText('PAUSED');
        // Let StrictMode effects finish before comparing the whole appearance.
        await page.waitForTimeout(300);
        await expect(readout(component, 'appearance')).toHaveText(chosenText!);

        await random.click();
        await expectManualRandomSaved(component);
        const rerolled = await readAppearance(component);
        expect(rerolled.visualizer.visualizerMode).not.toBe(chosen.visualizer.visualizerMode);
        const spacing = rerolled.visualizer.classicTuning.wordSpacing === 0.37 ? 0.41 : 0.37;
        await component.getByRole('spinbutton', { name: 'Classic word spacing', exact: true }).fill(String(spacing));
        const expected = structuredClone(rerolled);
        expected.visualizer.classicTuning.wordSpacing = spacing;
        await expect.poll(() => readAppearance(component)).toEqual(expected);
        await expectManualRandomSaved(component);
        await component.getByRole('button', { name: 'Next song', exact: true }).click();
        await expect(readout(component, 'displaySong')).toHaveText('adaptive-a');
        await page.waitForTimeout(300);
        expect(await readAppearance(component)).toEqual(expected);
    });
}

test('manual random disables the live legacy song shuffle and keeps the complete result fixed', async ({ mount, page }) => {
    const component = await mount('adaptiveLyricsRuntime');
    await component.getByRole('button', { name: 'Enable legacy song randomization', exact: true }).click();
    await expect(readout(component, 'enabled')).toHaveText('false');
    await expect(readout(component, 'legacyEnabled')).toHaveText('true');
    await expect(readout(component, 'savedLegacyEnabled')).toHaveText('true');
    // Verify the mounted legacy hook really shuffles a song before asking the manual action to stop it.
    await component.getByRole('button', { name: 'Next song', exact: true }).click();
    await expect(readout(component, 'displaySong')).toHaveText('adaptive-b');
    await expect(readout(component, 'mode')).not.toHaveText('classic');
    const legacyMode = await readout(component, 'mode').innerText();
    await component.getByRole('button', { name: 'Random style', exact: true }).click();
    await expectManualRandomSaved(component);
    await expect(readout(component, 'savedLegacyEnabled')).toHaveText('false');
    await expect(readout(component, 'mode')).not.toHaveText(legacyMode);
    const chosen = await readAppearance(component);
    await component.getByRole('button', { name: 'Next song', exact: true }).click();
    await expect(readout(component, 'displaySong')).toHaveText('adaptive-a');
    await component.getByRole('button', { name: 'Pause playback', exact: true }).click();
    await expect(readout(component, 'playerState')).toHaveText('PAUSED');
    await page.waitForTimeout(300);
    expect(await readAppearance(component)).toEqual(chosen);
    await expectManualRandomSaved(component);
});

test('a manual random result and its tunings hydrate unchanged after browser reload', async ({ mount, page }) => {
    let component = await mount('adaptiveLyricsRuntime');
    await enable(component);
    await component.getByRole('switch', { name: 'Randomize all', exact: true }).click();
    await component.getByRole('button', { name: 'Random style', exact: true }).click();
    await expectManualRandomSaved(component);
    const chosen = await readAppearance(component);
    const saved = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    // The isolation fixture clears storage on navigation. Re-seed every persisted field before module imports.
    await page.addInitScript(entries => {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, saved);
    await page.reload();
    component = await mount('adaptiveLyricsRuntime', { restoreStoredStyle: true });
    await expectManualRandomSaved(component);
    expect(await readAppearance(component)).toEqual(chosen);
    await component.getByRole('button', { name: 'Next song', exact: true }).click();
    await expect(readout(component, 'displaySong')).toHaveText('adaptive-b');
    await page.waitForTimeout(300);
    expect(await readAppearance(component)).toEqual(chosen);
});

test('applying a favorite restores the manual random result and keeps it fixed on the next song', async ({ mount, page }) => {
    const component = await mount('adaptiveLyricsRuntime');
    await component.getByRole('switch', { name: 'Randomize all', exact: true }).click();
    await component.getByRole('button', { name: 'Random style', exact: true }).click();
    const favorite = await readAppearance(component);
    await component.getByRole('button', { name: 'Favorite current preset', exact: true }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('favorite_visual_presets')!));
    expect(saved.presets[0].snapshot).toEqual(favorite);
    await component.getByRole('button', { name: 'Random style', exact: true }).click();
    expect(await readAppearance(component)).not.toEqual(favorite);
    // Applying a favorite must also win over an enabled automatic decision.
    await enable(component);
    await waitForSelection(component);
    await component.getByRole('button', { name: 'Apply preset: Preset 1', exact: true }).click();
    await expectManualRandomSaved(component);
    expect(await readAppearance(component)).toEqual(favorite);
    await expect(component.getByRole('button', { name: 'Unfavorite current preset', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await component.getByRole('button', { name: 'Next song', exact: true }).click();
    await expect(readout(component, 'displaySong')).toHaveText('adaptive-b');
    await page.waitForTimeout(300);
    expect(await readAppearance(component)).toEqual(favorite);
});

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
    // Later effects must not undo the explicit selection.
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

test('editing the queue leaves the displayed song and its appearance intact', async ({ mount, page }) => {
    const component = await mount('adaptiveLyricsRuntime');
    await enable(component);
    await waitForSelection(component);
    const appearance = await readout(component, 'appearance').textContent();
    const selectedMode = await readout(component, 'selection').textContent();
    await component.getByRole('button', { name: 'Reverse queue', exact: true }).click();
    await expect(readout(component, 'queue')).toHaveText('adaptive-b,adaptive-a');
    await page.waitForTimeout(100);
    await expect(readout(component, 'activeSongKey')).toHaveText(A);
    await expect(readout(component, 'displaySong')).toHaveText('adaptive-a');
    await expect(readout(component, 'selection')).toHaveText(selectedMode!);
    await expect(readout(component, 'appearance')).toHaveText(appearance!);
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
