# ROLLBACK

## 开包任意翻卡与 Driver 合体视频回退（2026-08-20）

若 motion 遮挡、无法退出或持久化异常：

1. 成组回退 `app/page.tsx` 的五人 motion 字段、`packEntrancePersonaId`、`activationMotionPersonaId`、`revealPackCard/finishPackReveal/revealAllPackCards/triggerActivationMotion` 与对应 JSX；同步回退 `app/globals.css` 的 pack/Driver motion 样式。
2. 保留 `public/personas-motion/` 与 `public/personas-motion-v3-intense/` 原始素材，不删除或改名；回退仅断开运行时引用。
3. 恢复静态卡面时必须保留 revealed/viewed v1 兼容读取；不得清空访客 activation history 或 Navi Run。
4. 运行 `node --test tests/pack-motion-state.test.mjs tests/rendered-html.test.mjs && npm run build`；确认 reduced-motion、error、Escape 和 skip-all 均可退出。
5. 不回退 Driver chassis/rod 几何、audio library 或 Bridge。合体视频只是 activated 的附加视觉，静态合体仍是故障降级终态。

## Driver RodSprite tight-crop 尺寸修复回退（2026-08-20）

若 tight sprite 在某个浏览器中变形或槽内高度异常：

1. 成组回退 `app/driver-closure-layer.tsx`、`app/driver-closure-layer.module.css`、`app/driver-texture-scene.tsx` 与 `tests/driver-closure.test.mjs`。
2. 移除新增 `*-tight-v1.png`，保留 canonical/source rod 图；不要恢复透明画布直接参与 slot shrink-to-fit 的旧路径。
3. 运行 `npm run build && node --test tests/driver-closure.test.mjs`，检查 tight alpha bbox 合同与 `rodViewport` 插入时间线。
4. 以 1440/1792/2560 浏览器截图复核 locked/50%/100%/activated；若回退只为排障，可保留 `browser-geometry/`、`browser-timeline/` 证据目录。
5. 不回退 `page.tsx`、`driver-audio.ts` 或 Bridge；它们不拥有 RodSprite 几何。

## 音频 shuffle bag P0 回退（2026-08-20）

若候选轮换或 fallback 再次异常，先设置 `NEXT_PUBLIC_PERSONA_DRIVER_AUDIO_MODE=public-cleared`，让插卡和装配只走 Web Audio；不要回退 `selectFromShuffleBag()` 的空袋重填、random 归一、candidate 守卫和 `playCardInsertSound()` 异常隔离，这些属于业务安全底线。

如需暂时停用动态 local-test manifest，可保留 `public/audio/local-test/` 证据资产，仅让 `refreshLocalTestManifest()` 返回 seed 状态；不得恢复 `remainingCandidatesByEvent.get(event) ?? [...candidates]`，因为已存在的空数组会再次触发 `undefined.id` 崩溃。

回退后运行：

1. `node --test tests/audio-reliability.test.mjs`，必须通过单候选两次、N+1、random 边界、坏 manifest 和插卡不抛错。
2. 定向 TypeScript 检查 `app/audio-library.ts app/driver-audio.ts`。
3. `npm run build`；若失败来自并发改动的非音频 public 资产，先确认缺失文件恢复，再重跑，禁止为通过构建删除音频防崩逻辑。

## Driver SideChassisAssembly 时间线重构回退（2026-08-20）

若真实浏览器中棒体在中间帧消失、槽沿错位或 reduced-motion final 异常：

1. 回退 `app/driver-closure-layer.tsx` 与 `app/driver-closure-layer.module.css` 到本条目之前版本；不要恢复三个独立 `payloadMotion/frontMaskMotion` wrapper。
2. 保留 `public/driver-textures/assembly/` 的 center-core、left/right chassis 与 slot foreground mask；若需彻底回退，同时移除 `qa/browser-timeline/` 证据目录，不删除原始 belt/rod 源图。
3. 运行 `npm run build && node --test tests/driver-closure.test.mjs`，确认 SideChassisAssembly、slotWindow 和 canonical 资产合同已恢复到同一版本。
4. 检查 `metrics.json`：单棒各采样点必须 `exists=true/display=block/visibility=visible/opacity=1`，交集在 620ms 后稳定；双棒 final 两侧同样必须存在且可见。
5. 不回退 `page.tsx`、`driver-audio.ts` 或 Bridge；这些模块不是本次几何时间线的状态来源。

## Persona Driver 本地等待视频组件

若等待播放器遮挡、无法清理或误出现在公开环境，先由调用方停止渲染 `WaitingVideoPanel`；不取消、不删除任何 `.persona-runs/` 任务。源码回退范围为 `app/waiting-video-panel.tsx`、`app/waiting-video-panel.module.css`、`tests/waiting-video-panel.test.mjs` 与 `public/waiting-media/README.md`。保留本地 MP4 作为离线取证资产，不部署或复制到公开资源；回退后运行 `npm run build && node --test tests/waiting-video-panel.test.mjs`。

## 生产回退

1. 在 Sites 版本列表中选择上一条已验证版本。
2. 将上一版本重新部署为公开生产版本。
3. 回读生产链接，确认根页面与人物卡交互恢复。

## 源码回退

1. 在当前独立 Git 仓库中定位上一条可用提交。
2. 新建回退提交，恢复 `app/` 与 `public/og.png`。
3. 运行 `npm test`。
4. 保存并部署新的 Sites 版本，禁止直接覆盖或删除历史版本。

固定五人卡组出现内容错误时，只回退 `app/page.tsx` 与对应测试；首页主视觉未变。
封面/新手包入口出现问题时，回退 `app/page.tsx` 的 `screen/selectedPackId/packOpened/revealedPackIds/dealRunRef` 状态和 `.persona-cover/.pack-opening` 样式；保留旧 `selectedPackId` 兼容读取，但不要恢复 pack selection 页面或逐张点击揭晓。
「重新开始」出现误清记录问题时，只回退 `restartExperience` 的步骤状态与 `PACK_PROGRESS_KEY` 清理；必须保留 `activationHistory` 和 `ACTIVATION_HISTORY_KEY`。
若开包后卡面不可见，优先保留二维的 `.pack-reveal-face` 背面发牌与正面切换路径；不要恢复依赖 `backface-visibility` 的 3D 翻面实现。
若 sealed pack 出现横向卡背机械面板，回退前只检查 `.sealed-pack-logo` 与 `/brand/persona-gate-logo-v1-256.png`；不得重新嵌套 `PersonaCardBack` 或把 `persona-card-back-base-v1.png` 加回 sealed pack。五张 reveal back 的 `PersonaCardBack` 仍应保留。
若卡架 5/7/12 张布局错乱，先回退 `PersonaCardShelf` hand-layout 自身；不要在 `page.tsx` 加回 `entranceKey`、`workbench-empty-shelf`、固定列或卡数宽度。
action-masked-v3 静态资产出现加载问题时，先停在 deal-cards 并检查五张基线与两张模板 `/personas/*-action-masked-v3.jpg` 是否完整；不要恢复旧 `personas-motion` 视频/海报混用，也不要把 masked-v2 随机池资产接回基线。

若新手包路径回归为选择页：检查 `openStarterPack/tearStarterPack/dealRunRef` 和 `screen` 联合状态；只允许旧 `selectedPackId` 兼容读取，不恢复选择器或逐张点击揭晓。

若 loopback alias 放行范围异常：回退 `assertBrowserRequest` 的 `loopbackAliasPair` 与 `corsHeaders/sendJson` 的 CORP 分支，保留 Host、Origin 和 `/runs` token 三重边界；不要全局设置 `Access-Control-Allow-Origin: *` 或 `Cross-Origin-Resource-Policy: cross-origin`。

若 supervisor 重启异常：先停止 `pnpm dev:persona`，保留 `.persona-runs/bridge-events.ndjson`，再单独运行 `pnpm navi:bridge`；不要并行启动多个 8766 Bridge。日志不含 token、正文或 Prompt，可安全用于 RCA。
若卡组重新缩成图标，恢复 `.pack-reveal-grid { width: 100% }` 与五等分网格；若人物出场被裁切，恢复 `.pack-entrance-video` 的竖幅 `width:auto / object-fit:contain`，不可使用横向填充裁切。
人物出场预设异常时，只回退 `localPackEntrancePresetUrls` 或 `playPackEntrancePreset/stopPackEntrancePreset`；不要恢复浏览器合成鼓点。确认 `outputs/bilibili-audio/decade-candidates/` 的本机静态服务运行后再试听。
入口分流出现问题时，回退 `choice` 页面与 `begin/open-pack/build-cards/back-choice` 四个动作，恢复原 `begin → scope`。
开包动效出现问题时，回退 `pack` 页面、`crackPack/revealPackCard/resetPackOpening` 和对应 CSS，恢复 `open-pack → atlas`。
动态出场层出现加载、性能或焦点问题时，回退 `atlas-entrance` DOM/CSS、`playPackEntrance/closePackEntrance/finishPackReveal` 和人物数据中的 `motion/motionPoster` 字段，再删除 `public/personas-motion/`；原静态卡包与 `public/personas/` 不受影响。
立绘出现问题时，同时回退 `public/personas/`、人物数据中的 `image` 字段与卡面图片 CSS；禁止只删图片留下失效路径。
首页卡盒立绘出现问题时，回退 `app/page.tsx` 的 `Persona.image` 与 `workbench-card-art-image`，恢复原几何占位卡面。

首页主视觉或高度修正出现问题时，回退 `app/` 与 `public/hero-personas.png`，避免 HTML
引用新资产但发布包缺图。回退后至少以一个宽屏和一个窄屏视口确认没有底部白区。

二维 Driver 出现对齐、加载或拖放问题时，优先回退 `app/driver-texture-scene.tsx`、`public/driver-textures/` 与 `app/page.tsx` 的对应引用；旧图鉴已经删除，人物卡和 Navi Bridge 无需回退。若需重生成，只能使用批准元素图的 `compose-persona-driver-texture-sprites.py`。
若必须恢复历史 Three.js 版本，应同时恢复 `package.json`、lockfile、旧 `driver-scene.tsx` 与全部 GLB 运行合同，禁止只恢复组件却漏装依赖。

历史 GLB 或模型材质出现问题时不影响网页运行；不要重新把 GLB 接回浏览器，也不要用模型重新覆盖 `public/driver-textures/`。

身体化场景或双手交互出现遮挡、误吸附或性能问题时：

1. 回退 `app/page.tsx` 的 `heldItem/dropTarget/beginItemGrab` 与页面级 `app/interaction-drag-layer.tsx`，恢复点击和统一拖拽路径；不得恢复已废弃的 `.texture-driver-held` 场景内副本。
3. 保留 `insertPersona/equipRod/activateDriver` 业务函数和可见启动按钮，不因视觉回退修改 Navi、音效或卡片状态机。
4. 运行测试并确认 reduced motion、760px 窄屏和粗指针场景没有残留手部层。

双棒拖拽流程异常时，回退 `app/page.tsx` 的 `DRIVER_RODS`、`equippedRods`、`driver-rod-id` drop 分支和 `.rod-case`，并从 `DriverScene` 移除两个 equipped props；恢复为两根棒随模型预装。不要只移除底部入口而保留 `activateDriver` 的双棒门槛，否则会阻断变身。

离线材质出现过曝或闪烁时，在 Blender 出帧脚本中调整灯光后重新输出全部帧；不要在浏览器重新实现材质、环境光或后处理。

锁定态主按钮再次消失时，先恢复 `phase === "locked"` 分支中的 `.activate-button` 和 `activateDriver` 点击绑定；
不允许只留下图标、拖拽手势或说明文字作为唯一启动入口。

机械把手交互异常时，移除 `app/page.tsx` 的 `handleProgress` 与 `.driver-handle-control`，恢复 locked 阶段的单一启动按钮；同时从 `DriverScene` props 和动画循环移除把手进度映射。该回退不会影响卡片插入、音效或角色实例状态。

音频出现浏览器兼容、音量或误播放问题时，可单独回退 `app/driver-audio.ts` 与 `app/page.tsx` 的声音调用，
保留二维逐帧 Driver 和 DOM 工作台。禁止用影视原声音频文件替代合成层。

本机随机候选覆盖出现问题时，停止 `127.0.0.1:8765` 静态服务即可立即恢复原创合成音；源码回退只需删除
`localActivationClipUrls`、`playRandomLocalActivationClip` 和 `stopDriverAudio` 中的本机播放器清理，不需要改动或删除候选源文件。
公开版本不携带候选音频，因此无需执行 Sites 回退。

三段串行播报出现顺序、发音或音色问题时，可单独回退 `localPersonaAnnouncementUrls`、
`localCommandAnnouncementUrls`、`playLocalClip` 与 `playLocalActivationSequence`，恢复为启动按钮直接随机候选；
`announcer/` 源文件可保留用于重新选音，不影响站点构建。

Persona Navi Bridge 出现误创建、重复任务或本机调用问题时：

1. 先停止 `pnpm navi:bridge`；页面会显示 Bridge 不可用，公开站不受影响。
2. 回退 `scripts/persona-navi-bridge*.mjs`、`app/page.tsx` 的 Navi 状态与请求、`app/globals.css` 的 `.navi-run-*` 样式。
3. 保留 `.persona-runs/` 作为审计证据，不删除已创建的 YouNavi conversation；需要归档/删除时由用户在 YouNavi 明确操作。
4. 五个已安装 Skill 与站点无运行耦合，可以保留；如需卸载，逐一移出 `/Users/zqnw/navi-ai/CHA499/skills/`，不要删除其他用户 Skill。
5. request 存在但 receipt 缺失时不得手工补 receipt 或自动重发；先用 YouNavi 会话历史核对是否已创建任务。

原始访谈素材解析异常时，先停止真实 Navi 创建并检查 `MATERIAL_MANIFEST`、`inspectSourceMaterials`、`resolveSourceMaterials` 和 `PERSONA_NAVI_MATERIAL_ROOT`；不得恢复为只有文件名、无路径的伪素材。四个 TXT 属于用户原始材料，回滚站点时不得删除或改写。

若角色面板变化再次触发 ResizeObserver 错误，保留 `scheduleResize` 的 animation-frame 合并和相同尺寸短路；
只回退该逻辑前必须在开发模式反复展开/收起 Navi 状态面板验证没有错误浮层。

元素图层拆分异常时，回退 `app/driver-texture-scene.tsx` 与四个独立贴图引用，保持腰带底图、人物卡、能量棒和技能棒分离；不得恢复将多个元素烘焙到同一状态帧的旧逻辑。

## 紧急下线

如果公开内容出现隐私、版权或错误数据风险，应先将 Sites 访问权限收紧或停止公开部署，再调查源码。
本版本只有公开 Skill 摘要和浏览器会话状态，正常情况下不需要删除任何访客数据。
# 本轮界面收敛回退

如果需要恢复原始素材、指令卡和任务输入 UI，回退 `app/page.tsx`、`app/globals.css`、`app/driver-audio.ts` 与 `tests/rendered-html.test.mjs` 的本轮提交；不要恢复 `public/persona-body/carrier-human.png`，该模型人物层已按视觉约束移除。

## 贴图组合框清洗回退（2026-08-19）

如果三层贴图出现错位、卡片越出腰带盒子或拖拽预览不回收：

1. 先保留 `public/driver-textures/` 四个独立元素源，不要用旧 Blender/GLB 帧覆盖它们。
2. 回退 `app/driver-texture-scene.tsx`、`app/interaction-drag-layer.tsx` 与 `app/page.tsx` 的 `.driver-assembly` 命中检测和 `heldItem` 预览逻辑。
3. 回退 `app/globals.css` 时必须成组恢复组合框、三层 z-index、拖拽 absolute/clamp 规则；禁止只恢复单个 `clamp()` 尺寸。
4. 运行 `npm run build && node --test tests/rendered-html.test.mjs`，确认固定比例、三层 data-layer、无 `position: fixed` 拖拽预览和无旧视觉选择器。
5. 如果仍需临时禁用拖拽，只移除 `onPointerDown` 入口并保留点击选择与 `insertPersona/equipRod`，不要重新启用原生 HTML 图片拖动。

### 图层漂移紧急处理

如果卡片、棒或前景再次相对腰带漂移：

1. 搜索并移除 `belt-nudge`、各元素独立 `translateY()`、隐藏人体底片和任何已废弃的场景内拖拽副本；唯一允许的拖拽视觉层是 `InteractionDragLayer`。
2. 确认腰带、卡片、双棒、前景与 glow 都在同一个 `.driver-assembly` 中，并以中心锚定。
3. 同步核对 `.driver-drop-guides` 的 `aspect-ratio` 与视口宽度约束，不能只移动腰带图层。
4. 完成后运行构建、渲染测试，并至少检查 1440px 宽屏与 390px 窄屏。

## 启动音与状态检查回退

如果启动音、状态检查或本机服务提示异常：

1. 保留 `playSynthesizedActivationEffect()` 作为唯一必须可听的启动反馈；不要恢复“等待本机 M4A 或 TTS 结束后才播放”的顺序。
2. 必需播报资源是 `public/audio/persona-driver-announcer-v2-expressive.m4a`；如需回退，先替换为经过版权与可播放性核验的同源文件，不能恢复 8765 临时服务依赖。
3. 「检查状态」只读 `/health`；若面板异常，回退 `runSystemCheck` 和 `.system-check-*`，不要改动 `/runs`、Skill、原始转写或已有会话。
4. 需要恢复最终接入时，用 `pnpm navi:bridge` 启动 Bridge，再访问 `/health`；禁止用状态检查替代真实任务创建验证。

## 卡包过场状态回退

如需让用户重新体验所有卡包过场，只删除浏览器 `localStorage` 中的 `persona-driver.pack-progress.v1`。该 key 只保存已开启、已揭晓和已观看的 ID，不保存视频或人物内容；不要删除 `public/personas-motion/` 资源。

## 唤起记录回退

如果历史面板出现数据污染、状态错乱或布局遮挡：

1. 先关闭右上角面板，不删除本机 YouNavi conversation。
2. 回退 `app/page.tsx` 中 `ACTIVATION_HISTORY_KEY`、`ActivationHistoryRecord`、`activationHistory` 状态及历史面板 JSX；Bridge 的真实启动链路不需要回退。
3. 如需清理本机缓存，只删除浏览器 key `persona-driver.activation-history.v1`，不触碰 `.persona-runs/` 审计目录。
4. 运行 `npm run build && node --test tests/rendered-html.test.mjs`，确认公开演示仍不访问 localhost Bridge，且页面不保存 token 或正文。
# 注入式变身棒回退

# 2026-08-20 Persona Driver 管理中心回退

若管理中心出现问题，先由调用方移除 `PersonaManagementPage` 的入口/接线；独立组件不会改变工作台的 `phase`、Persona 卡、双棒、任务或历史状态。

若 Soul 入口或状态条异常，优先移除调用方的 `soulCardWizard` / `onSoulCardReady` props，管理页会退回“等待 SoulCardWizard”空状态；不要在管理页补写 Soul 采集、蒸馏、覆盖率或 Skill 映射逻辑。必要时回退 `PersonaCardEditor` 的 `toolbarActions` 插槽与本次 Soul 状态显示，不回退 `persona-card-model.ts` 的 Skill 安全门。

若随机立绘池异常，先保留用户已上传的 `artSource=uploaded` 图片；可回退 manifest 加载和「换一张」，或删除随机池游标让 shuffle-bag 重开。不要把固定卡、通用空位模板或已上传图片改成随机池。

若 Prompt 列表或旧 normal 迁移提示异常，保留 `rod-content-model.ts` 的当前四项合同与 `migrateRodState()` 兼容迁移；只回退管理页的 warnings 展示，不要把 normal 重新加入管理固定列表。

源码回退范围仅为 `app/persona-management-page.tsx`、`app/persona-management-page.module.css`、`app/persona-management-model.ts` 与 `tests/persona-management-page.test.mjs`。保留 `persona-driver.prompt-presets.v1`、`persona-driver.custom-materials.v1` 作为可兼容的本机记录；若必须清理，只删除对应 key，不删除 `persona-driver.activation-history.v1` 或 `.persona-runs/`。

管理页诊断异常时停止调用该页面即可；不要把 `/health` 检查改成 `/runs` 或通过 Computer Use 代替 Bridge。回退后运行 `npm run build && node --test tests/persona-management-page.test.mjs`，确认工作台和 Bridge 文件未进入回退范围。

如果能量棒/技能棒注入浮窗出现问题，回退 `app/page.tsx`、`app/globals.css`、`scripts/persona-navi-bridge-lib.mjs` 和对应测试到本轮提交前；回退后恢复固定默认素材和 `review` 预设。不要回退人物卡、腰带或统一抓取层。

# 2026-08-20 新入口与 v2 回退

## 人物详情与空位卡 P0 回退

若动画/立绘 lightbox 异常，只回退详情组件；不恢复 Skill、编辑、插卡或播报。若通用空位创建异常，回退 `onCreateFromTemplate` 与 `initialTemplateId/onCardSaved` 接线；空位必须继续保持唯一、无 dragSurface、无 inspect、不可插卡。不得恢复 male/female 两个业务入口。

若人物卡编辑器或双棒面板阻塞工作台：先关闭页面编辑器弹层，确认固定五人卡盒和旧版兼容按钮仍可用；需要整体回退时回退 `app/page.tsx`、`app/globals.css`、`tests/rendered-html.test.mjs`，不要回退 `persona-card-*` / `rod-*` 专项模块本身。

若 v2 请求被拒绝：保留 `.persona-runs/<runId>/request.json` 与 `inputs/<name>` 作为证据，检查 `document` 是否单份、字节数是否 ≤ 1 MiB、custom Prompt 是否 ≤ 4,000 字符，以及 `skill/absolutePaths/instruction` 是否存在。不要恢复把文档正文塞入 CLI prompt；回退 Bridge 时同步回退三段式精确测试和 body envelope 测试。

若 CLI 收到旧长合同：只回退 `renderPersonaPrompt/buildPersonaPromptFields` 与 request 冻结接线，确保最终文本仍严格为 slash Skill → 绝对路径 → instruction。不得把 task、label、Run ID、SHA、前 200 行/EOF 长合同或 Markdown 输出栏目重新加入发送体。

若自建卡误显示为可执行：立即保留 `skillBinding.status=unmapped` 阻断，回退 `page.tsx` 的 `skillName` 检查和对应 warning；不要给卡片填入播报名或猜测 Skill 名称。真实 YouNavi conversation 不由本地回退删除。

若卡片图片点击误开详情：检查 `PersonaCardShelf` 根节点是否仍为无 click 的 article，并保留底部 `inspectButton` 的 `stopPropagation`；不要在 `page.tsx` 恢复旧 `.workbench-card` 或整卡 `onClick`。若 Run 失败时出现大右栏，回退 `page.tsx` 的 `resultSheetOpen`/`run-status-card` 接线，确保失败只显示短错误与重试，且不清理已保存的 task/conversation ID。

若结果窗口标题或来源回归：保留 Bridge `metadata` 与 material `displayName/technicalName` 分离，只回退 `RunResultSheet` 的呈现层。不得恢复“人物名 · REVIEW”标题、默认暴露 ID/Skill/path/SHA，或把 `/runs/:runId/open` 文案误写成“发送到 YouNavi”/conversation 深链。动作失败时应保留当前 Markdown 与 Run，不得重建 conversation。

若中央结果窗回归侧栏，恢复 `place-items:center` 与 1180px/88dvh 合同；不要改 Markdown、关闭、YouNavi 动作或结果自动打开时序。

若 Soul 一键导入异常，先保留现有卡库与 `.persona-runs` 证据，检查 page 注入的 `SoulCardWizard/soulBridgeRequest/onSoulCardReady/onPersonaCardsChange` 和 `/soul-runs` 三条路由。失败、产物不完整或动态索引未确认时不得写入 mapped 卡；不要把本地 frontmatter 匹配恢复成动态索引成功。

若棒体在插卡后自动进入 Driver：检查 `renderRodCase` 是否只对 `equippedRods` 隐藏来源、`onClick` 是否只打开注入面板、`applyItemDrop` 是否仍是唯一 `equipRod` 调用入口；不要通过设置 charged 代替 equipped。若管理中心返回导致 workbench 状态丢失，回退 `openManagement/returnFromManagement` 接线，不能改为 restartExperience/resetDriver。
