# 夯拉板（Hangla Board）

[中文](README.md) · [English](README_EN.md) · [日本語](README_JA.md) · [使用 Wiki](https://github.com/ppxinashin/hangla-board/wiki)

夯拉板是一款专门为视频创作者、直播连麦和多人讨论准备的开源 Tier List（分档榜单）工具。把人物、作品、产品或任何图片拖进不同档位，边讨论边调整；确认后可以进入干净录制界面，或把最终榜单导出为高清 PNG。

**在线使用：[tier.jehol-ppx.com](https://tier.jehol-ppx.com/)**

## 它适合做什么

- 视频选题：角色强度、游戏排行、影视作品、年度盘点
- 直播与连麦：主持人和嘉宾进入同一个房间共同排序
- 播客或圆桌：把讨论过程变成直观的可视化结果
- 团队评审：对方案、产品或候选项快速形成一致意见

| 模式 | 适用场景 | 数据位置 |
| --- | --- | --- |
| 单机模式 | 一个人快速排序、录屏和导出 | 当前浏览器页面 |
| 联机房间 | 连麦嘉宾或团队共同调整 | 房间服务器 |
| 干净录制 | OBS、系统录屏或直播采集 | 隐藏编辑按钮，保留可拖动看板 |

## 核心功能

- 批量上传或拖入 PNG、JPEG、WebP、GIF 图片
- 在待分档区和任意档位之间拖动图片
- 默认提供“夯、顶级、人上人、NPC、拉完了”五档
- 新增、删除、改名和拖动整个档位
- 档位颜色与行位置绑定，移动档位后颜色规则保持不变
- 彩虹色、红橙黄白渐变两套主题
- 自定义榜单标题，并用标题命名导出的 PNG
- 导出不包含编辑控件的高清榜单图片
- 8 位字母数字房间号和带房间号的邀请链接
- 多人同步图片、标题、主题、档位和排序结果
- 房主锁定最终排名、重新解锁、转让房主或解散房间
- 干净录制模式；按 `Esc` 随时退出

## 三分钟上手

1. 打开[在线版](https://tier.jehol-ppx.com/)，点击“上传图片”，也可以直接拖入多张图片。
2. 把待分档图片拖进对应档位；点击档位名称可以改名。
3. 使用档位右侧的拖动手柄调整整行顺序，使用加减按钮增删档位。
4. 点击看板标题给这期视频命名，选择喜欢的主题。
5. 录视频时点击“干净录制”；制作封面或分享结果时点击“导出图片”。
6. 需要连麦时打开“联机房间”，创建房间并把邀请链接发给嘉宾。

完整说明请阅读 Wiki：[快速上手](https://github.com/ppxinashin/hangla-board/wiki/快速上手) · [联机房间](https://github.com/ppxinashin/hangla-board/wiki/联机房间) · [录制与导出](https://github.com/ppxinashin/hangla-board/wiki/录制与导出)

## 在自己的电脑运行

需要 [Node.js 22.5 或更高版本](https://nodejs.org/) 和 Git。

```bash
git clone https://github.com/ppxinashin/hangla-board.git
cd hangla-board
npm ci
npm run build
npm run start:node
```

浏览器打开 `http://127.0.0.1:3000`。本机房间数据和图片默认保存在项目的 `.data` 目录，不需要管理员权限。

只需要单机排序、不使用联机房间时，也可以直接用浏览器打开 `dist/index.html`。

Windows、macOS、局域网共享和开机自启的详细步骤见 Wiki：[本地部署](https://github.com/ppxinashin/hangla-board/wiki/本地部署)。公网服务器部署见：[服务器部署](https://github.com/ppxinashin/hangla-board/wiki/服务器部署)。

## 开发与测试

```bash
npm ci
npm run check
npm test
```

项目同时提供两种运行入口：

- `src/worker.js`：Cloudflare Workers / OpenAI Sites 兼容入口
- `server/node.mjs`：普通电脑和 Linux 服务器使用的 Node.js 入口

## 项目结构

```text
dist/index.html        浏览器界面
src/worker.js          房间、同步和图片 API
server/node.mjs        本机与服务器运行入口
db/ 与 drizzle/        SQLite / D1 数据结构与迁移
deploy/                systemd 和 Nginx 部署配置
scripts/               构建及自动化测试
wiki/                  GitHub Wiki 源文件
```

## 数据与限制

- 单机图片只存在于当前页面，刷新页面会清空。
- 联机房间图片会上传到部署该服务的服务器，请不要上传敏感内容。
- 多人同时修改同一位置时，服务器会拒绝过期版本并拉取最新结果。
- 自行部署时请备份 `.data` 或服务器上的 `/var/lib/tier-board`。
- 当前主要面向桌面浏览器、OBS 和系统录屏；尚未直接导出视频文件。

## 参与贡献

欢迎提交 [Issue](https://github.com/ppxinashin/hangla-board/issues) 和 Pull Request。提交前请运行 `npm test`，并检查上传、拖动、主题、联机房间、录制模式和图片导出。

## 开源协议

[MIT License](LICENSE)
