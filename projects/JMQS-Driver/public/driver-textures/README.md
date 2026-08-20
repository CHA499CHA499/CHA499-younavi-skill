# Texture Driver Assets

- `belt-v1.png`：透明腰带本体，含中央空卡槽与两侧空棒槽。
- `belt-foreground-v1.png`：中央卡槽边框、扫描灯和锁扣的前景遮罩层。
- `energy-rod-v1.png`：独立青色能量棒贴图。
- `energy-rod-empty-v1.png`：能量棒 loose-empty 灰色熄灭态，保留与 charged 相同的 RGBA 画布和轮廓。
- `energy-rod-charged-v1.png`：能量棒 loose-charged / equipped 彩色充能态；与 `energy-rod-empty-v1.png` alpha 边界逐像素一致。
- `skill-rod-v1.png`：独立琥珀色技能棒贴图。

首页由 `app/page.tsx` 负责 loose empty/charged 状态，`app/driver-texture-scene.tsx` 仅在 equipped 后加载 charged 能量棒。贴图全部同源加载，不使用外部图片服务。

## Energy Rod canonical contract

`energy-rod-empty-v1.png` 与 `energy-rod-charged-v1.png` 必须保持同一画布、同一 alpha mask 和同一主体坐标，禁止为某一状态单独 crop 或扩边：

- 画布：`1024 × 1536` RGBA。
- alpha 非零 bbox：`x=359..625`、`y=16..1499`（半开区间 bbox 为 `(359, 16, 626, 1500)`）。
- 主体尺寸：`267 × 1484 px`，占画布 `26.0742% × 96.6146%`。
- 透明边：左 `359 px / 35.0586%`，右 `398 px / 38.8672%`，上 `16 px / 1.0417%`，下 `36 px / 2.3438%`。
- 主体 bbox 中心：`(492.5, 758.0)`；两态必须一致。alpha ≥ `16/128/254` 时 bbox 也必须一致。
