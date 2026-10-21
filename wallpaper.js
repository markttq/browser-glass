(() => {
  let lastGeometry = "";
  let moveTimer = 0;

  function updateWallpaperPosition() {
    if (document.hidden) return;
    const style = document.documentElement.style;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    // Inactive/loading Vivaldi tabs can report zero window geometry.
    // Keep the last valid alignment until the window can be measured again.
    if (screenWidth <= 0 || screenHeight <= 0 ||
        window.outerWidth <= 0 || window.outerHeight <= 0) return;
    const geometry = [screenWidth, screenHeight, window.screen.availLeft,
      window.outerWidth, window.outerHeight, window.innerWidth,
      window.innerHeight, window.screenX, window.screenY].join(",");
    if (geometry === lastGeometry) return;
    lastGeometry = geometry;

    // Match a centered desktop wallpaper using the image's 16:9 aspect ratio.
    const wallpaperWidth = Math.max(screenWidth, screenHeight * 16 / 9);
    const wallpaperHeight = wallpaperWidth * 9 / 16;
    const width = `${wallpaperWidth}px`;
    if (style.getPropertyValue("--cgh-wallpaper-width") !== width)
      style.setProperty("--cgh-wallpaper-width", width);

    // Account for the frame between the outer window and the page viewport.
    // Taking the smaller gap avoids treating a docked sidebar as a huge border.
    const border = Math.max(0, Math.min(
      (window.outerWidth - window.innerWidth) / 2,
      (window.outerHeight - window.innerHeight) / 2,
      12,
    ));
    const topInset = Math.max(0, window.outerHeight - window.innerHeight - border);
    const screenLeft = window.screen.availLeft ?? 0;
    const screenTop = 0;
    const x = (screenWidth - wallpaperWidth) / 2 -
      (window.screenX - screenLeft + border);
    const y = (window.screen.height - wallpaperHeight) / 2 -
      (window.screenY - screenTop + topInset);
    const position = `${x}px ${y}px`;
    if (style.getPropertyValue("--cgh-wallpaper-position") !== position)
      style.setProperty("--cgh-wallpaper-position", position);
  }

  function syncVisibility() {
    if (moveTimer) clearInterval(moveTimer);
    moveTimer = 0;
    if (document.hidden) return;
    updateWallpaperPosition();
    // Moving a window does not fire resize. Poll only visible pages, and
    // leave styles untouched unless the window geometry actually changes.
    moveTimer = setInterval(updateWallpaperPosition, 250);
  }

  function initializeWallpaper() {
    // Content-script CSS resolves relative image URLs against the host page.
    // Use the extension URL so every supported site loads the bundled image.
    document.documentElement.style.setProperty(
      "--cgh-wallpaper-image",
      `url("${chrome.runtime.getURL("tahoe-day.jpg")}")`,
    );
    window.addEventListener("resize", updateWallpaperPosition);
    window.addEventListener("pageshow", syncVisibility);
    window.addEventListener("pagehide", () => {
      clearInterval(moveTimer);
      moveTimer = 0;
    });
    window.addEventListener("focus", updateWallpaperPosition);
    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();
  }

  if (document.documentElement) {
    initializeWallpaper();
  } else {
    // document_start can precede <html>. Initialize as soon as it appears,
    // without waiting for the entire page to finish parsing.
    const observer = new MutationObserver(() => {
      if (!document.documentElement) return;
      observer.disconnect();
      initializeWallpaper();
    });
    observer.observe(document, { childList: true });
  }
})();
