# 粉雪狂飆 POWDER RUSH

單板滑雪 3D 網頁動作遊戲（Three.js + Vite）。從 3,200 公尺的山頂衝到終點，飛越跳台、做轉體 / 空翻 / 抓板、穿過旗門拿分。

## 開始

```bash
npm install
npm run dev
```

## 操作

| 按鍵 | 地面 | 空中 |
| --- | --- | --- |
| A / D、← / → | 轉彎 | 轉體 |
| W、↑ | 蹲低加速 | 前空翻 |
| S、↓ | 煞車 | 後空翻 |
| Space | 按住蓄力、放開起跳 | — |
| Shift / E | — | 抓板 |

R 重來、P 暫停、M 靜音。觸控裝置會顯示螢幕按鈕。

## 架構

- `src/terrain.js`：解析式高度場（賽道、跳台、旗門）、分塊地形網格、樹木與岩石
- `src/main.js`：滑行物理、花式判定與計分、相機、HUD
- `src/rider.js`：程序化滑雪者；若 `public/models/rider.glb` 存在則自動改用該模型
- `src/effects.js`：雪霧、板痕、飄雪
- `src/audio.js`：WebAudio 程序化音效
