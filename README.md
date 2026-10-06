# ChatGPT Thinking Helper v0.8.10

Aligned build based on the known-working v0.8.1 behavior, with the lower-overhead navigation tracking from v0.8.0.

- Preserves the working Tahoe wallpaper fallback and glass appearance.
- Replaces the large bottom-right foreground boulder with matching lake water while retaining the original image outside the edit mask.
- Keeps the wallpaper proportional when resizing, anchored at the left so a narrower window crops the right edge.
- Shows the Tahoe wallpaper behind DuckDuckGo search results with a tint that follows its light or dark theme.
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
4. Reload ChatGPT after loading the extension.

Shortcut: **Shift+Tab** cycles Instant → Medium → High → Instant. XHigh/Pro remain manual-only.
