# Browser Glass

Tahoe wallpaper and glass styling for ChatGPT, DuckDuckGo, YouTube, Docker, and GitHub, with ChatGPT reasoning shortcuts and Markentum daily reading lessons on the new tab page.

Version 0.9.0.

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
- Loads the wallpaper directly from extension CSS with a runtime extension URL override, pauses alignment polling in hidden tabs, and updates styles only when window geometry changes.

## Install in Vivaldi

1. Open `vivaldi://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Refresh ChatGPT, DuckDuckGo, YouTube, Docker, and GitHub tabs after loading the extension.

Shortcut: **Shift+Tab** cycles Instant → Medium → High → Instant. XHigh/Pro remain manual-only.

## Vivaldi window frame

The optional `vivaldi-ui/frame.css` stylesheet reduces Vivaldi 8.2’s auto-hide
window surround from 6px to 0px. Suitcase’s `vivaldi-setup.py` selects this folder
for both profiles when Browser Glass is checked out beside Suitcase. This
stylesheet styles browser chrome; it is separate from extension content scripts.

## Markentum start page

Markentum is now part of this extension. New tabs use the same bundled Tahoe
wallpaper, desktop alignment, dark tint, and 16px glass blur as Browser Glass.
Daily lessons, the **next** button / **n** shortcut, and per-profile theme choices
are retained. The start page works offline and makes no photo-feed requests.

Reload Browser Glass at `vivaldi://extensions`, then disable the separate
Markentum extension so only Browser Glass controls new tabs. In Vivaldi Settings
→ Tabs → New Tab Page, select **Start Page** and enable **Controlled by Extension**.
For startup windows, use **Last Session**, or add the unified page under
Settings → General → Startup with → Specific Pages. Copy Browser Glass's ID
from `vivaldi://extensions` and use `chrome-extension://<that-ID>/index.html`;
old Markentum startup URLs still point to the separate extension.

Generate or refresh lessons from your local reading vault:

```sh
python3 -B build-lessons.py
# Optional: --vault /path/to/books
```

`lessons.json` is a local, git-ignored cache of reading notes. Without it, the
wallpaper and theme controls still work and the page shows a setup hint.
Theme and rotation storage belongs to Browser Glass, so choose your theme once
per profile after switching from the separate Markentum extension.

## Verify wallpaper startup

Run `node --test tests/*.test.cjs` to check early wallpaper initialization on all supported sites, hidden-tab polling, window alignment, and idle shortcut behavior and ChatGPT shortcut startup timing.

Run `python3 -B -m unittest discover -s tests -v` for the reading-note parser.
The Node suite also checks daily selection, rotation, themes, and missing lessons.

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
