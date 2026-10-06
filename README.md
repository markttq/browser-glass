# Browser Glass

Tahoe wallpaper and glass styling for ChatGPT and DuckDuckGo, with ChatGPT reasoning shortcuts.

Version 0.8.15.

- Preserves the working Tahoe wallpaper fallback and glass appearance.
- Replaces the large bottom-right foreground boulder with matching lake water while retaining the original image outside the edit mask.
- Keeps the wallpaper proportional when resizing: fullscreen and windows at least half the display width use the top left; narrower windows use the top right. Updates automatically on resize for ChatGPT and DuckDuckGo.
- Crops 12px from each wallpaper edge on ChatGPT and DuckDuckGo without moving the page content.
- Shows the Tahoe wallpaper behind DuckDuckGo search results with a tint that follows its light or dark theme and uses the terminal's JetBrainsMono Nerd Font.
- Uses the Catppuccin mantle tint at 65% opacity and 16px blur for the main pane.
- Applies a high-contrast selection highlight across the main reading pane.
- Keeps the tested picker discovery, focus restoration, and Instant → Medium → High → Instant shortcut cycle.
- Uses static extension CSS to hide the picker while the shortcut runs.
- Removes the permanent document-wide mutation observer and checks navigation events with a low-frequency SPA fallback instead.
- Deduplicates chat-reset timers and retains the first `/` → `/c/<id>` no-reset behavior.
- Starts at `document_idle`, matching the stable v0.8.1 load behavior.

## Install in Vivaldi

1. Open `vivaldi://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Refresh ChatGPT and DuckDuckGo tabs after loading the extension.

Shortcut: **Shift+Tab** cycles Instant → Medium → High → Instant. XHigh/Pro remain manual-only.
