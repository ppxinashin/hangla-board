# Hangla Board

[中文](README.md) · [English](README_EN.md) · [日本語](README_JA.md) · [Wiki (Chinese)](https://github.com/ppxinashin/hangla-board/wiki)

A Tier List board for video creators, with solo ranking, clean recording, PNG export, and collaborative rooms for remote video guests.

**Live app: [tier.jehol-ppx.com](https://tier.jehol-ppx.com/)**

## Features

- Upload or drop multiple images at once
- Drag images between the unranked tray and tier rows
- Five Chinese default tiers: 夯, 顶级, 人上人, NPC, and 拉完了
- Add, remove, and rename tiers
- Reorder complete tier rows with a drag handle
- Colors are locked to row positions rather than moving with tier contents
- Rainbow and red–orange–yellow–white tier themes
- Export the finished tier list as a high-resolution PNG
- Name each ranking and use that title for the exported PNG filename
- Create or join an eight-character alphanumeric room so multiple people can adjust one shared ranking
- Show active participants; the host can lock the final ranking or reopen it
- Synchronize room images, titles, themes, and tier changes
- Clean recording mode that hides editing controls while keeping the unranked tray usable
- Press `Esc` to leave recording mode
- Solo images stay in the current page; room images are uploaded to shared room storage so participants can see them

## Quick start

To run the complete app on your own computer, install Node.js 22.5 or newer and Git:

```bash
git clone https://github.com/ppxinashin/hangla-board.git
cd hangla-board
npm ci
npm run build
npm run start:node
```

Open `http://127.0.0.1:3000`. Room data and uploaded images are stored in the local `.data` directory. If you only need solo ranking, you may open `dist/index.html` directly after building.

See the Chinese Wiki for [local deployment](https://github.com/ppxinashin/hangla-board/wiki/本地部署) and [Linux server deployment](https://github.com/ppxinashin/hangla-board/wiki/服务器部署).

## Usage

1. Select **上传图片** or drop images onto the page.
2. Drag unranked images into a tier.
3. Select a tier label to rename it.
4. Use the handle on the right to reorder an entire tier row.
5. Select the board title to name the ranking.
6. Choose a color theme from the top bar.
7. Select **导出图片** to download the final board as a clean PNG. Its heading and filename use the ranking title.
8. Select **联机房间**, enter a nickname, then create a room or join with an eight-character alphanumeric code (case-insensitive).
9. Copy the invitation and send it to remote guests. Everyone's changes synchronize automatically.
10. When the group agrees, the host selects **锁定最终排名**. The host can unlock it for more discussion.
11. Select **干净录制** to start a clean recording view. Ranking remains interactive while recording.

## Current limitations

- Solo state clears after a refresh; an online room is restored during the current browser session.
- Rooms use fast polling. If two people edit the same place almost simultaneously, the newer server version wins.
- Video export is not implemented yet.
- The current experience is primarily designed for desktop browsers and screen recording.

## Project structure

```text
dist/index.html   Browser interface
src/worker.js     Room, synchronization, and image API
server/node.mjs   Local and Linux server runtime
db/schema.ts      Room data schema
drizzle/          Database migrations
deploy/           systemd and Nginx examples
scripts/          Build and collaboration tests
wiki/             GitHub Wiki source pages
README.md         Chinese documentation
README_EN.md      English documentation
README_JA.md      Japanese documentation
LICENSE           MIT License
```

## Roadmap

- Local autosave and project recovery
- Operation history and conflict merging
- Background images and canvas aspect ratios
- WebM video export
- Asset groups and recording queues
- OBS browser source

## Contributing

Issues and pull requests are welcome. Please keep each change focused and verify image upload, dragging, themes, and recording mode in a browser before submitting.

## License

[MIT License](LICENSE)
