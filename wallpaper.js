(() => {
  function updateWallpaperPosition() {
    // Compare browser and display widths in screen pixels, independent of zoom.
    const side = window.outerWidth < window.screen.availWidth / 2 ? "right" : "left";
    document.documentElement.style.setProperty(
      "--cgh-wallpaper-position",
      `${side} calc(-1 * var(--cgh-wallpaper-crop)) top calc(-1 * var(--cgh-wallpaper-crop))`,
    );
  }

  function initializeWallpaper() {
    document.documentElement.style.setProperty(
      "--cgh-wallpaper-image",
      `url("${chrome.runtime.getURL("tahoe-day.jpg")}")`,
    );
    updateWallpaperPosition();
    window.addEventListener("resize", updateWallpaperPosition);
    window.addEventListener("pageshow", updateWallpaperPosition);
  }

  if (document.documentElement) {
    initializeWallpaper();
  } else {
    document.addEventListener("DOMContentLoaded", initializeWallpaper, { once: true });
  }
})();
