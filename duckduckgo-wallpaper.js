function setWallpaperUrl() {
  document.documentElement.style.setProperty(
    "--cgh-wallpaper-image",
    `url("${chrome.runtime.getURL("tahoe-day.jpg")}")`,
  );
}

if (document.documentElement) {
  setWallpaperUrl();
} else {
  document.addEventListener("DOMContentLoaded", setWallpaperUrl, { once: true });
}
