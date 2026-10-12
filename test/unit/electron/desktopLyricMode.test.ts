import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// test/unit/electron/desktopLyricMode.test.ts
// Execute the real desktop preset functions without starting Electron or reading user settings.
const mainSource = readFileSync(path.resolve(__dirname, '../../../electron/main.cjs'), 'utf8');
const presetStart = mainSource.indexOf('function isDesktopLyricModeActive() {');
const presetEnd = mainSource.indexOf('async function resetMainWindowPresentation()', presetStart);
if (presetStart < 0 || presetEnd <= presetStart) {
  throw new Error('Desktop lyric preset functions were not found in electron/main.cjs');
}
const presetSource = mainSource.slice(presetStart, presetEnd);

type Presentation = {
  wallpaper: boolean;
  transparent: boolean;
  mainWindowAlwaysOnTop: boolean;
  mainWindowSkipTaskbarEnabled: boolean;
  mainWindowClickThroughEnabled: boolean;
};

type DesktopPreset = {
  isDesktopLyricModeActive: () => boolean;
  setDesktopLyricMode: (enabled: boolean) => Promise<boolean>;
};

// The dependency fakes record ordering around the asynchronous transparent-window rebuild.
function createHarness(initial: Partial<Presentation> = {}, waitForRebuild?: () => Promise<void>) {
  const state: Presentation = {
    wallpaper: false,
    transparent: false,
    mainWindowAlwaysOnTop: false,
    mainWindowSkipTaskbarEnabled: false,
    mainWindowClickThroughEnabled: true,
    ...initial,
  };
  const calls: Array<[string, boolean]> = [];
  const setClickThrough = vi.fn((enabled: boolean) => {
    calls.push(['click-through', enabled]);
    state.mainWindowClickThroughEnabled = enabled;
    return enabled;
  });
  const setAlwaysOnTop = vi.fn((enabled: boolean) => {
    calls.push(['always-on-top', enabled]);
    state.mainWindowAlwaysOnTop = enabled;
    return enabled;
  });
  const setSkipTaskbar = vi.fn((enabled: boolean) => {
    calls.push(['skip-taskbar', enabled]);
    state.mainWindowSkipTaskbarEnabled = enabled;
    return enabled;
  });
  const setTransparent = vi.fn(async (enabled: boolean) => {
    calls.push(['transparent', enabled]);
    await waitForRebuild?.();
    state.transparent = enabled;
    return true;
  });
  const context = {
    get mainWindowAlwaysOnTop() { return state.mainWindowAlwaysOnTop; },
    get mainWindowSkipTaskbarEnabled() { return state.mainWindowSkipTaskbarEnabled; },
    get mainWindowClickThroughEnabled() { return state.mainWindowClickThroughEnabled; },
    isWallpaperModeEnabled: () => state.wallpaper,
    isTransparentPlayerBackgroundEnabled: () => state.transparent,
    setMainWindowClickThroughEnabled: setClickThrough,
    setMainWindowAlwaysOnTop: setAlwaysOnTop,
    persistMainWindowSkipTaskbarEnabled: setSkipTaskbar,
    setMainWindowTransparentModeFromRemote: setTransparent,
  };
  const preset = runInNewContext(`${presetSource}\n({ isDesktopLyricModeActive, setDesktopLyricMode });`, context) as DesktopPreset;
  return { state, calls, preset, setClickThrough, setAlwaysOnTop, setSkipTaskbar, setTransparent };
}

describe('desktop lyric mode', () => {
  it('enables click-through by default in an already transparent window without rebuilding it', async () => {
    const harness = createHarness({ transparent: true });

    expect(await harness.preset.setDesktopLyricMode(true)).toBe(true);
    expect(harness.calls).toEqual([
      ['click-through', false],
      ['always-on-top', true],
      ['skip-taskbar', true],
      ['click-through', true],
    ]);
    expect(harness.setTransparent).not.toHaveBeenCalled();
    expect(harness.state.mainWindowClickThroughEnabled).toBe(true);
    expect(harness.preset.isDesktopLyricModeActive()).toBe(true);
  });

  it('unlocks during the transparency rebuild and enables click-through after it completes', async () => {
    let finishRebuild!: () => void;
    const rebuild = new Promise<void>(resolve => { finishRebuild = resolve; });
    const harness = createHarness({}, () => rebuild);
    let completed = false;
    const entering = harness.preset.setDesktopLyricMode(true).then(result => {
      completed = true;
      return result;
    });

    expect(harness.calls).toEqual([
      ['click-through', false],
      ['always-on-top', true],
      ['skip-taskbar', true],
      ['transparent', true],
    ]);
    expect(harness.state.mainWindowClickThroughEnabled).toBe(false);
    expect(completed).toBe(false);
    expect(harness.preset.isDesktopLyricModeActive()).toBe(false);

    finishRebuild();
    expect(await entering).toBe(true);
    expect(harness.calls).toEqual([
      ['click-through', false],
      ['always-on-top', true],
      ['skip-taskbar', true],
      ['transparent', true],
      ['click-through', true],
    ]);
    expect(harness.setClickThrough).toHaveBeenCalledTimes(2);
    expect(harness.state.mainWindowClickThroughEnabled).toBe(true);
    expect(harness.state.transparent).toBe(true);
    expect(harness.preset.isDesktopLyricModeActive()).toBe(true);
  });

  it('keeps desktop lyrics active while the independent mouse lock is toggled', () => {
    const harness = createHarness({
      transparent: true,
      mainWindowAlwaysOnTop: true,
      mainWindowSkipTaskbarEnabled: true,
      mainWindowClickThroughEnabled: false,
    });

    expect(harness.preset.isDesktopLyricModeActive()).toBe(true);
    harness.setClickThrough(true);
    expect(harness.preset.isDesktopLyricModeActive()).toBe(true);
    harness.setClickThrough(false);
    expect(harness.preset.isDesktopLyricModeActive()).toBe(true);
    expect(harness.setAlwaysOnTop).not.toHaveBeenCalled();
    expect(harness.setSkipTaskbar).not.toHaveBeenCalled();
    expect(harness.setTransparent).not.toHaveBeenCalled();
  });

  it.each([true, false])('restores ordinary interaction when leaving with transparency %s', async transparent => {
    const harness = createHarness({
      transparent,
      mainWindowAlwaysOnTop: true,
      mainWindowSkipTaskbarEnabled: true,
    });

    expect(await harness.preset.setDesktopLyricMode(false)).toBe(false);
    expect(harness.calls).toEqual([
      ['click-through', false],
      ['always-on-top', false],
      ['skip-taskbar', false],
      ...(transparent ? [['transparent', false]] : []),
    ]);
    expect(harness.state).toEqual({
      wallpaper: false,
      transparent: false,
      mainWindowAlwaysOnTop: false,
      mainWindowSkipTaskbarEnabled: false,
      mainWindowClickThroughEnabled: false,
    });
    expect(harness.preset.isDesktopLyricModeActive()).toBe(false);
  });

  it('refuses desktop lyrics while wallpaper is active without changing window switches', async () => {
    const harness = createHarness({
      wallpaper: true,
      transparent: true,
      mainWindowAlwaysOnTop: true,
      mainWindowSkipTaskbarEnabled: true,
    });
    const before = { ...harness.state };

    expect(await harness.preset.setDesktopLyricMode(true)).toBe(false);
    expect(harness.calls).toEqual([]);
    expect(harness.state).toEqual(before);
    expect(harness.preset.isDesktopLyricModeActive()).toBe(false);
  });

  it.each(['transparent', 'mainWindowAlwaysOnTop', 'mainWindowSkipTaskbarEnabled'] as const)(
    'requires %s to recognize desktop lyrics', missing => {
      const harness = createHarness({
        transparent: true,
        mainWindowAlwaysOnTop: true,
        mainWindowSkipTaskbarEnabled: true,
        [missing]: false,
      });
      expect(harness.preset.isDesktopLyricModeActive()).toBe(false);
    },
  );
});
