import { expect, test } from './fixtures';

// test/component/adaptiveLyricsIntensity.spec.ts
// The chip must describe the actual outgoing-song intensity and make a manual click effective.
test('random styles preserve the saved intensity and a manual click overrides the displayed song', async ({ mount }) => {
    const component = await mount('adaptiveLyricsIntensity');
    await expect(component.locator('[data-intensity-theme]')).toHaveText('normal');
    const normal = component.getByRole('button', { name: 'Animation Intensity: normal', exact: true });
    await expect(normal).toHaveText('normal');
    await normal.click();
    await expect(component.locator('[data-intensity-manual-song]')).toHaveText('local:intensity-a');
    await expect(component.locator('[data-intensity-theme]')).toHaveText('chaotic');
    await expect(component.getByRole('button', { name: 'Animation Intensity: chaotic', exact: true })).toHaveText('chaotic');
});
