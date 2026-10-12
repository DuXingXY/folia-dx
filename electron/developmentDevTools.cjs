// electron/developmentDevTools.cjs
// Opening DevTools disables Electron window transparency and shrinks a docked wallpaper viewport.

function shouldOpenDevelopmentDevTools({ development, transparent, nativeBlur, wallpaper }) {
  return Boolean(development && !transparent && !nativeBlur && !wallpaper);
}

module.exports = { shouldOpenDevelopmentDevTools };
