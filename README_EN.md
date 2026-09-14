# Hangla Board

[中文](README.md) · [English](README_EN.md) · [日本語](README_JA.md)

A lightweight Tier List board for video creators. It has no build step or third-party dependencies: open the page, add images, rank them, and switch to a clean recording view.

## Features

- Upload or drop multiple images at once
- Drag images between the unranked tray and tier rows
- Five Chinese default tiers: 夯, 顶级, 人上人, NPC, and 拉完了
- Add, remove, and rename tiers
- Reorder complete tier rows with a drag handle
- Colors are locked to row positions rather than moving with tier contents
- Rainbow and red–orange–yellow–white tier themes
- Clean recording mode that hides editing controls while keeping the unranked tray usable
- Press `Esc` to leave recording mode
- Images are processed in the current browser page and are not uploaded to a server

## Quick start

No build step or package installation is required.

1. Download or clone the repository.
2. Open `dist/index.html` in a browser.

Alternatively, run a local static server:

```bash
python3 -m http.server 4173 --directory dist
```

Then visit `http://localhost:4173`.

## Usage

1. Select **上传图片** or drop images onto the page.
2. Drag unranked images into a tier.
3. Select a tier label to rename it.
4. Use the handle on the right to reorder an entire tier row.
5. Choose a color theme from the top bar.
6. Select **干净录制** to start a clean recording view. Ranking remains interactive while recording.

## Current limitations

- Projects are not persisted yet. Refreshing the page clears images and rankings.
- Image and video export are not implemented yet.
- The current experience is primarily designed for desktop browsers and screen recording.

## Project structure

```text
dist/index.html   Complete application: HTML, CSS, and JavaScript
README.md         Chinese documentation
README_EN.md      English documentation
README_JA.md      Japanese documentation
LICENSE           MIT License
```

## Roadmap

- Local autosave and project recovery
- Background images and canvas aspect ratios
- PNG and WebM export
- Asset groups and recording queues
- OBS browser source

## Contributing

Issues and pull requests are welcome. Please keep each change focused and verify image upload, dragging, themes, and recording mode in a browser before submitting.

## License

[MIT License](LICENSE)

