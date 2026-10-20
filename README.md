# Browser Glass

Tahoe wallpaper and glass styling for ChatGPT, DuckDuckGo, YouTube, and Docker, with ChatGPT reasoning shortcuts.

Version 0.8.25.

- Uses a still captured from the desktop's Tahoe wallpaper, sized to the display width.
- Aligns the wallpaper with the window's desktop position, with browser-frame compensation and automatic move/resize updates.
- Gives ChatGPT a glass appearance with Catppuccin colors, blur, and high-contrast text selection.
- Follows DuckDuckGo's light or dark theme and uses JetBrainsMono Nerd Font for search results.
- Gives YouTube a wallpaper background and blurred glass header and sidebar, following its light or dark theme.
- Reveals the wallpaper around YouTube's watch-page player and disables its ambient background glow.
- Adds glass navigation and reading surfaces to Docker Docs, following its light or dark theme, and translucent sections on docker.com.
- Adds a manual Shift+Tab reasoning shortcut to ChatGPT, preserving picker discovery and focus restoration. It does no work until you use the shortcut.
- Uses static extension CSS to hide the picker while the shortcut runs.
- Starts the wallpaper and glass CSS at `document_start`, so the image can load while the page is still loading. ChatGPT reasoning shortcuts keep their stable `document_idle` startup timing.
- Loads the wallpaper directly from extension CSS, pauses alignment polling in hidden tabs, and updates styles only when window geometry changes.

## Install in Vivaldi

1. Open `vivaldi://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Refresh ChatGPT, DuckDuckGo, YouTube, and Docker tabs after loading the extension.

Shortcut: **Shift+Tab** cycles Instant → Medium → High → Instant. XHigh/Pro remain manual-only.

## Verify wallpaper startup

Run `node --test tests/*.test.cjs` to check early wallpaper initialization on all supported sites, hidden-tab polling, window alignment, and idle shortcut behavior and ChatGPT shortcut startup timing.

## Match the Mac desktop wallpaper

The Mac setup script and a copy of this wallpaper live in the sibling
`personal/suitcase` repository. From that checkout, run this in Terminal
in your logged-in desktop session:

```sh
./set-mac-wallpaper.sh
```

The script sets external monitors in the current desktop session to the
extension's exact `tahoe-day.jpg` image with centered **Fill Screen** scaling.
The wallpaper is bundled in Suitcase, so the Mac does not need to have
Tahoe's wallpaper installed or download it separately. The script copies it to
`~/Library/Application Support/Browser Glass/tahoe-day.jpg` so the desktop image
keeps working if the repository moves. It requires Apple's Swift command-line
tools. Run it again on other Spaces if needed,
or after connecting another display. Load Browser Glass from this same folder
in Vivaldi so the browser and desktop use the same image.
