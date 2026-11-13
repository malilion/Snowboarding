# 粉雪狂飆 POWDER RUSH — Google Flow 宣傳片分鏡包

約 40 秒、16:9 的宣傳短片，共 5 個鏡頭（每個約 8 秒）。
提示詞用英文寫（Veo 對英文的理解最穩），直接整段貼進 Flow 即可。

## 使用方式

1. 開啟 [Google Flow](https://labs.google/flow)，建立新專案，畫面比例選 16:9。
2. 先把 `docs/` 裡的三張遊戲截圖上傳成素材：`carve.jpg`、`air.jpg`、`flip.jpg`。
3. 每個鏡頭依下表選擇模式：
   - **Frames to Video**：把指定截圖設為起始畫格，角色與場景會最貼近遊戲實際樣貌。
   - **Ingredients to Video**：把截圖當成角色／風格參考，讓鏡頭運動更自由。
   - **Text to Video**：只靠文字，下方每段提示詞都已把風格寫完整，可單獨使用。
4. 每個鏡頭生成 2–4 個版本，挑角色最一致的那個加入 Scenebuilder 依序排列。
5. 標題字卡（鏡頭 5）的文字建議匯出後在剪輯軟體疊上，AI 生成的中文字容易變形。

## 共用風格描述

每段提示詞都已內含這段；要自己加鏡頭時請沿用，角色才會前後一致。

> Stylized low-poly 3D video game look, flat-shaded faceted geometry, clean bright colors. A snowboarder in a puffy orange jacket, dark teal pants, dark grey helmet and purple goggles, riding a rainbow-gradient snowboard. Smooth white powder snow, low-poly pine trees with pale green tiers, sharp faceted white mountain peaks, deep saturated blue sky with gently falling snowflakes.

## 分鏡

### 鏡頭 1 — 山頂開場（0–8 秒）

模式：Text to Video（或以 `air.jpg` 作 Ingredients 風格參考）

```
Stylized low-poly 3D video game look, flat-shaded faceted geometry, clean bright colors. Wide aerial establishing shot slowly pushing in over sharp faceted white mountain peaks and a snowy valley dotted with low-poly pine trees, deep saturated blue sky, gentle snowflakes drifting. At the top of the slope stands a lone snowboarder in a puffy orange jacket, dark teal pants, dark grey helmet and purple goggles, strapped into a rainbow-gradient snowboard, looking down the run. Calm, anticipatory mood. Audio: soft mountain wind, a single sustained synth note building slowly.
```

### 鏡頭 2 — 出發與刻滑（8–16 秒）

模式：Frames to Video，起始畫格 `carve.jpg`

```
Stylized low-poly 3D video game look, flat-shaded faceted geometry, clean bright colors. Third-person chase camera following close behind a snowboarder in a puffy orange jacket, dark teal pants, dark grey helmet and purple goggles as they carve fast, deep S-turns down a wide powder slope. The rider crouches low and leans hard into each edge, spraying big plumes of white powder and leaving a clean curved trail in the snow. Low-poly pine trees rush past on both sides, faceted white peaks ahead, blue sky. Fast, fluid, exhilarating. Audio: board carving through snow, rushing wind, upbeat electronic drum beat kicking in.
```

### 鏡頭 3 — 跳台大飛躍（16–24 秒）

模式：Frames to Video，起始畫格 `air.jpg`

```
Stylized low-poly 3D video game look, flat-shaded faceted geometry, clean bright colors. A snowboarder in a puffy orange jacket, dark teal pants, dark grey helmet and purple goggles races toward a snow kicker ramp and launches high into the air. Slow motion at the peak: the rider spins a full 720 degrees while reaching down to grab the edge of the rainbow-gradient snowboard, snow crystals sparkling around them, their small shadow far below on the slope. Camera orbits around the rider mid-air against the deep blue sky and faceted white peaks. Audio: whoosh on takeoff, music drops to a muffled bass in slow motion.
```

### 鏡頭 4 — 後空翻與落地（24–32 秒）

模式：Frames to Video，起始畫格 `flip.jpg`

```
Stylized low-poly 3D video game look, flat-shaded faceted geometry, clean bright colors. Side tracking shot of a snowboarder in a puffy orange jacket, dark teal pants, dark grey helmet and purple goggles completing a big backflip off a jump, tucked tight with the rainbow-gradient snowboard overhead, then opening up and stomping a clean landing in deep powder. A huge burst of snow explodes outward on impact and the rider speeds away downhill between low-poly pine trees and blue slalom gate flags. Triumphant, high energy. Audio: heavy thump of the landing, music slams back in at full volume, a short celebratory chime.
```

### 鏡頭 5 — 衝線與標題（32–40 秒）

模式：Text to Video（或以 `carve.jpg` 作 Ingredients 風格參考）

```
Stylized low-poly 3D video game look, flat-shaded faceted geometry, clean bright colors. Low front-facing camera on the snow as a snowboarder in a puffy orange jacket, dark teal pants, dark grey helmet and purple goggles charges straight toward the lens down a powder slope, then throws a hard heel-side stop right in front of the camera, blasting a wall of white powder that fills the entire frame and fades to pure white. No text, no logos. Audio: sharp scrape of the board edge, a final music hit, then silence with soft wind.
```

後製字卡（疊在最後的純白畫面上）：

- 主標：**粉雪狂飆 POWDER RUSH**
- 副標：免安裝，瀏覽器直接開滑
- 網址：`malilion.github.io/Snowboarding`

## 備用提示詞

想要 9:16 直式短影音版本時，把比例改為 9:16，鏡頭 2、3、4 即可單獨成片（約 24 秒），並在每段結尾加上：

```
Vertical framing, rider centered, plenty of sky above for the jump.
```

角色走樣時（顏色跑掉、變成滑雪雙板等），在提示詞最後補上：

```
The rider is on a single snowboard, both feet strapped sideways, never on skis and never holding poles. Orange jacket and rainbow board stay consistent throughout.
```
