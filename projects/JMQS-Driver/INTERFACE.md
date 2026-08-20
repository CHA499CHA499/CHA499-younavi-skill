# INTERFACE

## 2026-08-20 Pack / Driver Motion 合同

- `Persona.motion` 五人固定映射：Naval 与 Elon Musk 读取 `/personas-motion/*.mp4`；Steve Jobs、Donald Trump、Paul Graham 读取 `/personas-motion-v3-intense/*-action-masked-intense-v3.mp4`。Naval/Musk 禁止误接 intense 资产。
- deal-cards 任意卡按钮调用 `revealPackCard(personaId)`；`packEntrancePersonaId` 是唯一播放锁。视频 ended/error/Escape 调 `finishPackReveal(id)`；已翻卡允许重播且不会重复写 ID。
- `revealAllPackCards()` 是 finish-all 边界：暂停 `packEntranceVideoRef`、调用 `stopPackEntrancePreset()`、清空播放层、将五人 ID 同时写入 revealed/viewed。持久化继续使用 `persona-driver.pack-progress.v1`；complete 刷新停留 deal-cards。
- reduced-motion 不 mount pack 或 Driver motion；直接保留静态卡面/合体。媒体加载或 play 拒绝不得阻断卡牌 reveal、Driver activated 或 Navi 状态。
- Driver 的按钮启动与 pointer handle 阈值只调用同一个 `activateDriver`；该函数先 `setPhase("activated") + triggerActivationMotion(selectedPersona)`，再异步创建 Navi Run。

## 2026-08-20 Driver RodSprite 几何合同

- Driver 使用 `/driver-textures/*-tight-v1.png` charged sprite；每张 tight sprite 画布为 `256×1500`，alpha bbox 为 `(0,0)-(256,1500)`，不再把透明 canonical 画布作为 CSS 几何源。
- `SideChassisAssembly` 内部顺序：`chassisBackTexture → slotWindow → rodViewport → rodSprite → slotForegroundMask`。`sideAssembly` 是唯一移动/激活动画拥有者。
- `rodViewport` 使用槽 aperture，`rodSprite` 宽度填满 viewport、高度为 `--driver-rod-fill: 94%`；插入只执行 `translateY(-100%) → translateY(0)`，opacity 恒为 1，locked→activated 不卸载节点。
- 几何验收证据位于 `public/driver-textures/qa/browser-geometry/` 与 `public/driver-textures/qa/browser-timeline/`；metrics 由真实浏览器 DOM computed style、getBoundingClientRect 和截图采样生成。

## 2026-08-20 音频可靠性 P0 合同

- `chooseNextDecadeCandidate(event, random?, mode?)` 只能通过 `selectFromShuffleBag()` 选择。`remainingCandidatesByEvent.get(event)` 为 `undefined` 或 `[]` 时都必须以当前合法候选重填；禁止恢复 `stored ?? candidates` 的空数组漏洞。
- `selectFromShuffleBag(candidates, stored, lastId, random)` 返回 `{ candidate, remaining, lastId }`。空/坏池返回 `candidate:null`；`random<=0`、非有限数、抛错归一到 0，`random>=1` 归一到小于 1 的最大安全比例；任何路径都不得产生 `index=-1`。
- `public/audio/local-test/manifest.json` 可动态加入 candidate-17+。只接受 `/audio/local-test/` 下 `.m4a`、支持的 `pack-open/card-deal/skill-rod-select/assembly/final-snap` 事件和正整数 `sourceCandidate`；malformed 条目必须逐条过滤，不得清空 seed 池。
- `playCardInsertSound()` 是 `insertPersona` 的最终音频隔离边界：同步选择、Audio 构造、事件绑定、`play()`、Web Audio 和诊断订阅中的异常均须被吸收并记录，返回 `false` 或降级，不得 throw。
- 其他公开声音 API 同样经过 `safeAudioAction/playLocalCandidateEvent/playAudioClip/playWebAudioEvent` 防线；异步失败使用 `failed/fallback` 诊断，资源失败优先 Web Audio，Web Audio 也不可用时静默返回。
- 验收必须运行 `node --test tests/audio-reliability.test.mjs`、定向 TypeScript 检查与 `npm run build`。业务测试必须真实调用 `playCardInsertSound()`，不能只用源码正则代替异常隔离回归。

## 2026-08-20 Driver SideChassisAssembly 图层合同

- `app/driver-texture-scene.tsx` 继续只接收 `phase`、`handleProgress`、人物卡信息和 `energyRodEquipped/skillRodEquipped`；Driver 不接管 loose/empty 棒。
- `app/driver-closure-layer.tsx` 只渲染两个 `SideChassisAssembly`：每个容器内部固定顺序为 chassis back texture → `slotWindow` → equipped charged rod → slot foreground mask。每侧只有父容器拥有 chassis translate/rotate/snap 动画。
- `slotWindow` 是实际槽 aperture 的 `overflow:hidden` 局部坐标容器；rod 使用 canonical `1024×1536` 资产，插入只改变局部 `translateY`，不改变 x、scale 或 opacity。
- `locked` 未 equipped 时不产生 Driver rod DOM；equipped 后 rod 节点保持挂载，`locked → activated` 不卸载/重启插入动画。
- `public/driver-textures/qa/browser-timeline/metrics.json` 是真实 Codex In-app Browser 采样证据；`single-energy/` 与 `double-activated/` 保存逐时间点截图和 contact sheet。
- 读写依赖：只读 `/driver-textures/assembly/*`、canonical charged rod URL 与人物卡 URL；不读取 page/audio/Bridge 私有状态。

## 2026-08-20 Persona Driver 管理中心

### 组件接线

- `app/persona-management-page.tsx` 导出 `PersonaManagementPage`，最小合同为 `baselineCards`、`onBack`；`initialSection` 支持 `prompts | cards | diagnostics | materials` 深链。
- `PersonaManagementPage` 必须接收 `soulCardWizard`、`soulBridgeRequest`，可接收 `onSoulCardReady/onPersonaCardsChange`。页面默认以 `from-soul` 打开向导，状态合同为 `collecting | distilling | assembling | validating | ready | coverage-warning | index-warning | error`。
- 一键链路：`SoulCardWizard → POST /soul-runs → GET /soul-runs/:runId → projection → persist persona-driver.persona-cards.v1 → onCardReady/onPersonaCardsChange`。失败或产物不完整不得写卡。
- `installVerification.fileVerified` 只表示本地文件/frontmatter 正确；只有动态索引成功证据才能使 `verified=true`。索引 `LIST_FAILED/Not Found` 或未确认时显示 `index-warning` 并保持卡片 unmapped。
- 页面是独立全屏管理页，不修改 `app/page.tsx` 的 `phase`、卡片、双棒、任务或历史状态；`onBack()` 由调用方接回工作台，因此返回不会重置工作台。
- cards 分区复用 `PersonaCardEditor`，固定五卡只读，唯一通用空位卡与“新建角色卡”进入同一 creating 流程；旧 male/female 模板只作为迁移输入过滤。

### 存储依赖

- 固定 Prompt 真源：`rod-content-model.ts` 的 `SKILL_PROMPT_PRESETS`，当前合同为评审/解释/决策/行动四项；自定义 Prompt 使用 `persona-driver.prompt-presets.v1`，schema `persona-driver.prompt-presets/v1`。
- 旧 Prompt 存储中的 removed-normal 记录由管理模型迁移为 `warnings`，只读提示“该预设已移除，请重新选择”，不会进入当前固定或 custom 列表；页面不自行声明 normal。
- 自定义素材使用 `persona-driver.custom-materials.v1`，schema `persona-driver.custom-materials/v1`；只保存 `.md/.txt` 的名称、字节数、摘要、正文和最近使用时间。
- 卡片存储继续由 `PERSONA_CARD_STORAGE_KEY`/`PersonaCardEditor` 管理；管理页不复制卡片业务状态。
- Soul 状态只保存在管理页当前挂载内存，完成卡通过 `onSoulCardReady` 转交接线方；管理页不自行写卡片存储、不生成 Skill 映射。无 `SoulCardWizard` 时入口禁用并明确显示待接线状态。
- 卡片立绘合同由 `persona-card-model.ts` 的 `artSource/artAssetId` 维护：固定卡为 `fixed`，模板为 `template`，用户图片为 `uploaded`，custom/Soul 无图为 `random-pool`。编辑器读取 masked-bust-v2 manifest，复用 `drawPersonaRandomPoolAsset` / `assignRandomPoolArt` 的 shuffle-bag；「换一张」只对 custom/Soul 随机池卡可用。
- 诊断读取 `persona-driver.activation-history.v1` 的错误摘要，不删除或改写历史任务快照；素材删除只删除自定义素材记录。

### 只读诊断合同

- `/health` 只读取 Bridge 健康、Skill 安装和固定素材合同；页面禁止调用 `/runs`、`chat send` 或任何真实对话创建 API。
- 音频检查使用既有 `getDriverAudioStatus()` 和同源必需播报资源；视觉检查只读取批准的 Driver PNG；localStorage 通过临时 probe 检测可写性。

## 调用方

- 任何获得生产链接的浏览器访客。
- Sites 平台负责构建、托管和公开访问。

### WaitingVideoPanel（本地专项组件）

- `app/waiting-video-panel.tsx` 导出 `WaitingVideoPanel`，props 为 `open`、可选稳定 `runId`、可选 `receiptAccepted`/`runStatus`/`runtime`、`personaName`、`commandCode`、`onMinimize` 和 `onClose`。
- 调用方应在成功 receipt 后传入 `receiptAccepted={true}`，并在轮询中持续传入同一 `runId` 与 `pending`/`running`；`creating`、`completed`、`error`、`incomplete`、`cancelled` 不渲染等待播放器。
- 播放器以固定 16:9 `video` 节点承载本地 waiting loop；轮询只改变父组件 props，不改变视频节点或播放进度。关闭/最小化不取消 Run；同一 `runId` 被用户关闭后不会被强制重开。
- 播放器在有声 autoplay 被浏览器拒绝时切换 muted fallback，并提供“点击开启声音”和播放按钮；卸载时 pause、清理 `src` 并调用 `load()`。
- `runtime="public"` 或非 localhost/127.0.0.1 环境直接返回 `null`。公开构建不应将该本地素材作为公开业务入口使用。

## 输入

- 无服务端输入。
- 访客只能操作站内固定公开 Skill 摘要与浏览器内临时 UI 状态。
- 固定卡组只读取构建时写入的 5 个公开 GitHub Skill 摘要，不在运行时访问 GitHub。
- localhost 真实运行接受 `persona.navi-run/v1` 或 `persona.navi-run/v2`：固定素材使用 `runId/personaId/commandId/task/materials`，自定义输入使用单个 `document` 和 custom Prompt；Skill 名称和固定指令正文由 Bridge 白名单补全。

## 输出

- 根路由 `/`：封面「准备变身」进入唯一 `starter-pack`；「撕开卡包」进入 `deal-cards`，五张卡同时发牌并可任意翻开；「收下卡牌，进入工作台」进入 workbench。
- Persona Driver 工作台包含左侧变身组件、中央 Driver、固定五人卡盒和按选卡出现的右侧人物简介/角色实例面板；原始素材与指令经点击棒后的注入浮窗选择，不以常驻侧栏形式出现。
- `PersonaCardShelf` 是卡架布局唯一事实源；页面只传 `cards/selectedId/onDragStart/onDragEnd/onInspect/onManage`，不传固定列、卡数宽度或入口重排参数。Shelf 负责 5/7/12 张的并排、压缩重叠和 hover 展开。
- 人物卡进入 `locked` 后必须显示可见、可聚焦的「启动 Persona Driver」按钮；按钮是唯一必需的变身入口。
- 未选中人物卡时不渲染右侧角色面板；点击或拖入人物卡后，右侧先显示人物简介，启动完成后切换为角色实例输出。
- 静态资产 `/personas/*.jpg`：五张原创人物角色立绘。
- 静态资产 `/personas/*-action-masked-v3.jpg`：五张基线与模板的统一静态立绘；motion 仅使用本文件 Pack / Driver Motion 合同中的五条批准路径。`*-masked-v2.jpg` 仅属于随机池，不用于基线、模板或 Driver。
- 当前封面主入口为「准备变身」；不渲染 pack selection、唯一选项确认或逐张点击揭晓。
- starter pack sealed 状态只渲染 `/brand/persona-gate-logo-v1-256.png` 与 HTML 文案，不嵌套 `PersonaCardBack`；开包后五张 reveal back 各自复用极简 PNG `PersonaCardBack`，用户任意点击后播放该人物 motion 并切换正面。`prefers-reduced-motion: reduce` 点击后直接静态翻面；右下角 skip-all 可直接完成五张。
- 开包舞台桌面最大宽度为 1120px，五张卡等分全部宽度；工作台 shelf、详情半窗和 Driver 中央卡统一使用 action-masked-v3 图片源。
- 人物出场音与启动播报都读取同源 `/audio/persona-driver-announcer-v2-expressive.m4a`；不按 persona 分配外部候选，不依赖端口 8765。跳过、Escape、结束、返回选包和组件卸载都停止当前播报。
- 揭晓动作在普通动态偏好下先打开模态出场层，视频结束或用户跳过后缩回目标卡位并记为已揭晓；同一卡不会自动重播。
- `prefers-reduced-motion: reduce`、媒体播放失败或不支持视频时直接完成静态揭晓，不得阻塞后续卡牌或「收下卡牌」。
- 静态资产 `/hero-personas.png`：首页响应式人物卡背景。
- 静态资产 `/og.png`：链接分享封面。
- 本机 Bridge 成功返回 `persona.navi-receipt/v1`，包含稳定的 run/task/conversation ID；它只代表任务已入队，不代表完成。

## 二维逐帧运行合同

- 网页运行时不依赖 Three.js、WebGL、GLB、运行时材质或相机；`app/driver-texture-scene.tsx` 是同源二维 PNG 的唯一运行时渲染入口，`app/driver-scene.tsx` 只声明 `DriverPhase` 类型。
- 中央 Driver 读取 `public/driver-textures/` 中批准的二维腰带、能量棒、技能棒元素图和五人角色立绘。
- 左侧变身组件区承载能量棒和技能棒投放入口；两根棒的贴图层级高于腰带前景层，并保持垂直插槽轴线。
+ 能量棒注入浮窗复用四份白名单原始转写，且每次只能选择一篇；技能棒注入浮窗复用 review/explain/decision/action 四个固定预设，并支持 custom。空载棒不能发起拖拽，已注入但人物卡未锁定的棒只能继续编辑注入内容。
- 两根棒装配后从各自插槽上方垂直进入，最终停在 `30% / 70%` 两条插槽中心轴；不得带旋转角度或停在槽体外侧。
- `scripts/compose-persona-driver-texture-sprites.py` 只使用批准元素图做可选离线帧合成，输出路径为 `public/driver-textures/frames/`；网页默认直接显示元素图，不加载模型渲染帧。
- phase 只允许 `idle / ready / inserting / locked / activated`。inserting 在 900ms 内播放 8 帧，activated 在 760ms 内播放 12 帧；reduced motion 直接显示终帧。
- locked 且只装一根棒时显示对应单棒帧；双棒齐备时由 `handleProgress` 映射到 12 帧闭合序列。
- 贴图预载失败时显示静态错误状态，不影响人物卡、变身棒和 Navi Bridge 的 DOM 交互。
- `app/page.tsx` 的人物卡盒继续读取 `/personas/*.jpg`，卡片姓名作为可访问文本，图片使用空替代避免重复朗读。
- `scripts/compose-persona-driver-texture-sprites.py` 是当前唯一网页帧生成入口；它读取批准的元素图并输出帧和 `manifest.json`。网页不能直接访问 `/models/persona-driver/*.glb`，旧 Blender 脚本不得覆盖帧目录。
- `public/models/persona-driver/` 与拉丝材质只作为离线可回滚源资产保留，不属于浏览器运行依赖。
- 外部 `ryuki-rider` 包无授权说明，只用于本地结构评估，不复制到项目或成品帧。

## 变身把手输入合同

## 2026-08-20 页面交互状态机

- `pack-complete`：`pack-progress.v1` 持久化 `packOpened/revealedPackIds/viewedEntranceIds`；五张完成后刷新保持 `deal-cards` 完成页。只有「重新开始」清除 progress。
- 新用户路径固定为 `cover(准备变身) → starter-pack(撕开卡包) → deal-cards(任意翻卡/跳过全部) → pack-complete(收下卡牌) → workbench`；不渲染 pack selection。
- `workbench-empty`：`phase=idle/ready/inserting` 时不渲染 `.rod-tray`，不渲染注入器入口和详情窗；中央 Driver 空载，底部复用 `PersonaCardShelf` 展示五张卡。
- `card-browse/card-detail`：`PersonaCardShelf.onInspect` 只选卡并打开 `PersonaDetailSheet`；详情窗提供插入、复制/编辑和新建空卡，遮罩/Escape 关闭；拖拽仍只交给统一 DragLayer。
- `card-inserted/rods-revealed`：`PersonaDetailSheet.onInsert` 或上半 drag surface 命中人物槽调用 `insertPersona`；拖拽命中不打开详情；`phase=inserting` 播放插卡，`phase=locked/activated` 才渲染 `.rod-tray` 和注入入口。
- `rod-empty → rod-charged → rod-equipped`：棒体必须先由 `RodInjectorPanel` 充能，再在 locked 状态点击或拖入；空载/充能视觉由 Driver rod asset contract 区分，页面不在空工作台暴露其 DOM。

- `app/page.tsx` 持有归一化的 `handleProgress`，范围固定为 `0..1`；左右把手向中心拖动都会增加进度。
- `DriverTextureScene` 只把进度映射到元素贴图的位移、旋转和 glow，不改变既有 phase 状态机。
- 进度达到 `0.72` 后进入 `activated`；不足阈值时回到 `0`。单击或键盘激活任一把手时直接完成闭合并触发同一启动函数。
- Pointer Capture 保证拖出按钮后仍能完成手势；`touch-action: none` 避免触控拖动被页面滚动抢占。

## 元素图层合同

- `app/page.tsx` 在 loose 状态表达能量棒 empty/charged；`app/driver-texture-scene.tsx` 仅在 equipped 后加载 `/driver-textures/energy-rod-charged-v1.png`，不在 Driver 内渲染 empty。
- `/driver-textures/energy-rod-empty-v1.png` 与 `/driver-textures/energy-rod-charged-v1.png` 共享 1024×1536 RGBA 画布和 alpha 边界；槽内承载框放大并裁掉源图透明侧边，保证 charged 主体清晰。
- Energy Rod canonical：两态完整 alpha mask 逐像素一致，alpha 非零 bbox 固定为 `(359, 16, 626, 1500)`，主体顶底坐标为 `y=16..1499`，透明边固定为左/右/上/下 `359/398/16/36px`；禁止单独 crop、扩边或改变朝向。
- `app/driver-texture-scene.tsx` 将 `/driver-textures/belt-v1.png`、人物卡立绘、charged 能量棒和 `skill-rod-v1.png` 分为独立图层。
- 卡片图层只在插卡后出现；两根棒只在各自装配后出现；闭合进度只改变棒的 transform 与光效。
- 不允许把卡片或棒重新烘焙进腰带底图；拖拽时只允许显示固定视口内的页面级 `InteractionDragLayer` 控制预览，禁止浏览器原生图片拖拽。

## 统一抓取层合同

- `app/interaction-drag-layer.tsx` 是人物卡与变身棒唯一的页面级跟手视觉边界；该层固定在页面最上方，不能放入 Driver 场景内部。
- 来源组件只调用 `beginItemGrab` 并保留 Pointer Capture；抓取中的来源加 `is-lifted`，不再各自渲染浮动副本。
- 人物卡和两根棒使用同一个 `HeldWorkbenchItem`、`dragPointer` 与 `getDropTarget` 链路；槽位命中才调用 `insertPersona` 或 `equipRod`。

## 音效运行合同

- `app/driver-audio.ts` 是唯一声音边界；公开环境继续只使用 Web Audio API 与系统 TTS，不读取外部音频文件。
- 只在用户点击选卡、插卡或启动按钮后创建或恢复 AudioContext。
- 仅在页面 host 为 `localhost` 或 `127.0.0.1` 时，启动按钮按「英文角色卡名 → 英文指令 → 随机候选音效」串行播放；不会自动连播，也不会连续重复上一段候选。
- 角色名与指令是预生成本机片段，必须共用同一音色、语速、口音和处理链；Donald 的播报文本固定为 `Donald John Trump`，ACTION 的播报文本固定为 `Action`。
- 16 段候选保持原文件音调与速度，不做运行时变调、拉伸或拼接。
- 本机候选只用于开发试听，不复制进 `public/`、`dist/` 或 Sites；本地服务缺失或播放失败时回退原创合成启动音。
- 选卡与插卡只触发原有合成提示音，不会读取本机候选。
- `PERSONA RIDE` 使用浏览器系统 TTS，声音与可用语言随访客操作系统变化。
- 静音时停止本机候选与 TTS，后续交互不再产生声音事件。
- 禁止加入假面骑士原版音频、采样、台词节奏或其他受保护音效资产。

## Navi Bridge 运行合同

- 入口：`scripts/persona-navi-bridge.mjs`，固定监听 `127.0.0.1:8766`；`pnpm navi:bridge` 启动。页面和 Bridge 均使用 IPv4 loopback，避免 `localhost` 在不同环境解析到 `::1` 导致健康检查或启动请求失联。
- `GET /health`：返回当前进程随机 token、agent-cli 可用性和五个 Skill 的 installed/name/SHA-256 状态。
- `POST /runs`：校验 `persona.navi-run/v1`（固定素材）或 `persona.navi-run/v2`（单个 `.md/.txt` document 与 custom Prompt），按 runId 幂等创建 YouNavi task/conversation。
- `GET /runs/<runId>`：执行 `task show`；成功后执行 `convo show`，只接受同 task ID 的完整 assistant message，正文上限 2MB；v1 固定素材与 v2 已落盘 document 都必须找到预期 `skill_activate` 和每个绝对路径读到 EOF 的 `read_text_file_done` 证据，否则返回 `SKILL_NOT_ACTIVATED` 或 `SOURCE_NOT_FULLY_READ`，不得标记 completed。
- completed 结果额外返回 `metadata`：`title/task/persona/command/source/coverage` 均从冻结 request、Bridge manifest 与读取证据生成。固定素材的 `source.displayName` 面向用户，`technicalName/path/sha256` 仅供诊断；历史 request 缺 displayName 时按 material ID 回查当前 manifest。
- YouNavi 成功终态兼容 `success/completed/complete/finished`；其中实机 task show 使用 `finished`，必须映射为页面 completed。
- `POST /runs/<runId>/open`：由用户点击或 Driver 启动动作触发，只执行 `open -a YouNavi`；当前不承诺精确跳到 conversation。
- `RunResultSheet` 的正式动作文案固定为“打开 YouNavi”，提供 loading/success/error 状态；禁止命名为“发送”或暗示 conversation 深链，因为该接口既不发送内容也不改变 Run。
- `RunResultSheet` 根布局使用 `place-items:center`，桌面面板 `width:min(1180px, calc(100vw - 32px))`、`max-height:88dvh`；禁止恢复右侧 `justify-items:end/margin-right` 抽屉定位。窄屏继续全屏。
- Bridge 先打开 YouNavi，再用 `auth me --no-auto-start` 最多等待 30 秒；就绪后 `chat send` 使用 `--no-auto-start`。
- `POST /runs` 的实际 `chat send` 文本严格为三段：真实 `/<skill-name>`；“读取下列明确列出的绝对路径…”及逐行绝对路径；真实 `run.command.instruction`。custom 使用已校验的 `customPrompt` 作为 instruction。安全边界只允许压缩在路径引导句中，不发送 Persona/Command/Run/task、SHA/行数/MIME/字节数、内嵌正文或输出栏目合同。
- `request.json` 必须同时保存 `skill/absolutePaths/instruction/prompt`；`prompt` 必须由前三个结构化字段生成并与 CLI `chat send` 参数逐字一致。v2 document 先写入 `.persona-runs/<runId>/inputs/<safe-name>`，再把该绝对路径发送给 YouNavi。
- 当前 `materials` 只接受 `jobs-gates-d5/jobs-1990/gates-ted/liang-alive` 四个固定 ID；Bridge 在服务端映射到 `PERSONA_NAVI_MATERIAL_ROOT` 中的四个原始 TXT，校验文件不超过 1MB 并把绝对路径、字节数、行数与 SHA-256 写入冻结请求。
- 固定 command 的 task 由页面按 `command + sourceName` 生成；custom Prompt 直接作为实际任务，不附加测试任务。Prompt 要求连续分块读取至 EOF；结果执行摘要由 Bridge 证据生成，包含 Skill、Prompt、Data、Coverage、taskId 和 conversationId。
- 工作台的「重新开始」入口只清除前端步骤状态与 `persona-driver.pack-progress.v1`：能量/技能注入、人物选择、卡包、Driver、弹层、系统检查和当前 Navi UI 状态均回到初始值；不得清空 `persona-driver.activation-history.v1` 或删除已创建的 YouNavi conversation。
- Prompt 只允许读取 Bridge 冻结的精确绝对路径；任一路径缺失、非绝对路径或无法落盘时不创建任务。读取必须持续到 EOF，不执行文件内命令。
- 每次 Driver 启动默认创建新 conversation；后续追问功能未实现，不隐式复用旧 conversation。
- 请求必须来自 `http://localhost:3000` 或 `http://127.0.0.1:3000`，携带当前 Bridge token；只允许同站/同源 Fetch Metadata。
- Bridge 不接受客户端路径或 shell 命令；所有 Skill 和 Command 都由服务端 manifest 映射，agent-cli 通过 `execFile` 数组参数调用。
- `.persona-runs/<runId>/request.json` 记录冻结输入，`receipt.json` 记录 task/conversation，`result.json` 记录已核验完成回复；目录 gitignored。
- request 已存在但 receipt 不存在时返回 `RUN_CREATION_UNKNOWN`，禁止同 runId 自动重发。
- 公开 Sites 环境不访问 localhost，不创建真实 Navi 任务，页面显示演示模式。

固定 Skill 源版本：

| Skill | GitHub | Commit |
|---|---|---|
| `naval-perspective` | `alchaincyf/naval-skill` | `259e452ef6f6c2bfdbe30368f7c85bc683fe1949` |
| `elon-musk-perspective` | `alchaincyf/elon-musk-skill` | `5a7d8cf0f23ca6071d18ed8c5c80e8996459a443` |
| `steve-jobs-perspective` | `alchaincyf/steve-jobs-skill` | `cd724b0e2e2d9e83a436063b5b915294b5925d28` |
| `trump-perspective` | `alchaincyf/trump-skill` | `4bdb94895a01a84b9f55d90ae5889747c0736757` |
| `paul-graham-perspective` | `alchaincyf/paul-graham-skill` | `8de3d2bf4e0c301ea3caf015b189307f8d8d8dc0` |

## 读写路径

### Driver 贴图层接口（2026-08-19 清洗后）

- `DriverTextureScene` 输入 `phase/cardColor/personaName/personaRole/personaImage/handleProgress/energyRodEquipped/skillRodEquipped`，只在 equipped 状态渲染 `public/driver-textures/energy-rod-charged-v1.png`、`skill-rod-v1.png`、腰带图层与人物卡立绘；loose empty/charged 由页面侧负责。
- `.driver-assembly` 是唯一设计坐标系，比例固定为 `1672 / 941`；外层 `.texture-driver` 只负责响应式容器，拖拽预览由页面级 `InteractionDragLayer` 负责。
- 三层契约：base=`texture-driver-belt`，middle=`texture-persona-card`/`texture-driver-rod`，foreground=`texture-driver-foreground`。前景图必须最后绘制，不能把卡或棒烘焙回腰带底图。
- 页面投放命中使用同一个 `.driver-assembly` 的 `getBoundingClientRect()` 与归一化坐标，禁止复制另一套 viewport 比例常量。
- 所有 `<img>` 必须 `draggable={false}`；工作台根节点阻止 `dragstart`。拖拽预览由 `InteractionDragLayer` 绝对定位、`pointer-events:none`，不产生浏览器原生拖图。

#### 防漂移补充合同（2026-08-20）

- `driver-assembly` 的中心是所有 Driver 元素唯一允许的垂直/水平锚点；腰带、卡片、棒、前景和 glow 只能各自以 `translate(-50%, -50%)` 对齐该中心。
- 不允许共享百分比偏移变量到不同尺寸图层，例如 `--belt-nudge`。如需移动整体，只移动 `.driver-assembly` 与 `.driver-drop-guides` 这两个同尺寸容器。
- `.driver-assembly` 与 `.driver-drop-guides` 必须同时含 `calc(100vw - 32px)` 宽度约束；任何响应式改动都需在窄屏确认两者仍同宽同中心。

### 唤起历史接口

- 存储 key：`persona-driver.activation-history.v1`；值为 `ActivationHistoryRecord[]` JSON，最多 50 条。
- 单条记录只允许 `id/createdAt/personaId/personaName/commandId/commandCode/status/runId/taskId/conversationId/error/openError`，禁止写入 conversation 正文、token、文件绝对路径或原始素材内容。
- `startNaviConversation` 创建本机任务或公开演示时新增记录；Bridge 回执、检查结果与打开失败通过同一 `runId` 更新，不创建重复记录。
- 历史面板仅由右上角按钮打开，支持 Escape、关闭按钮和清空；`conversationId` 存在时可重新调用既有 `/runs/<runId>/open`。

### 启动音与状态检查接口

- `playActivationSequence()` 必须先同步触发 `playSynthesizedActivationEffect()`，再播放必需同源播报；TTS 只在同源资源 1.4 秒内未开始、触发 error 或 `play()` 被拒绝时恢复，且不能重复触发。
- `checkDriverAudioOutput()` 仅在用户点击「检查状态」的手势内调用，恢复 AudioContext 并播放短提示音；返回值只反映浏览器音频上下文是否进入 running。
- `runSystemCheck()` 不得调用 `/runs` 或打开 YouNavi。它只读 `GET /health`，并将前期资料/中间流程/最终接入三项写入页面临时状态。

### 卡包进度接口

- 存储 key：`persona-driver.pack-progress.v1`。值只包含 `version/selectedPackId/packOpened/revealedPackIds/viewedEntranceIds`，不保存视频、音频、人物正文、对话或认证信息。
- 用户完成或跳过角色过场时，`finishPackReveal()` 同时写入已揭晓与已观看 ID；刷新后恢复已开启卡包，已观看角色保持已揭晓并不会再次自动播放过场。
- 用户需要重新体验时只能显式清除该 key；普通“返回卡包”不得清空已有进度。

- 源码读取：当前工具目录。
- 构建输出：`dist/`。
- 浏览器临时状态：访客自己的 sessionStorage。
- Driver 二维元素：`public/driver-textures/`；模型源只保留在 `public/models/persona-driver/` 做历史归档。
- 站点必需播报资源：`public/audio/persona-driver-announcer-v2-expressive.m4a`，来源为仓内 `outputs/2026-08-18-device-announcer-voice/` 的原创系统音色研究成品，SHA-256 为 `176cef5e514ee488ff8db0de67a0c0bae44f1430153469d2f5ca2dc2dfdaeb44`。
- 本机 Skill 只读：`/Users/zqnw/navi-ai/CHA499/skills/{naval-perspective,elon-musk-perspective,steve-jobs-perspective,trump-perspective,paul-graham-perspective}/`。
- 本机原始素材只读：`PERSONA_NAVI_MATERIAL_ROOT`；默认 `/Users/zqnw/navi/CHA499/transcripts/classic-interviews-2026-08-19/`。兼容读取旧环境变量 `PERSONA_NAVI_PRESET_ROOT`，但当前 manifest 只允许用户指定的四个 TXT 文件名。
- Bridge 运行证据：当前工具目录 `.persona-runs/`；不提交 Git、不进入站点构建。
- 不读写 CHA499 的 `brain/`、`thalamus/` 或 `vault/`。

## 环境与依赖

- Node.js 22.13 或更高版本。
- 浏览器不依赖 `three`；离线重新出帧需要 Blender 5.x。
- Sites vinext starter 与 Cloudflare Worker 兼容构建。
- 不需要 API key、OAuth、飞书凭证、数据库或对象存储。
- 真实对话依赖本机 YouNavi 已登录；Bridge 不读取或返回认证 token 文件。

## 安全合同

- 站点公开，人物内容是公开 Skill 摘要，不代表本人观点。
- 外部内容不会进入 Cinder 四层记忆系统。
- 发布凭证只在 Sites 交付命令中短暂使用，不写入源码、Git 配置或 URL。
## 2026-08-20 新增入口与请求分流

### 页面 → 组件

- `app/page.tsx` → `PersonaCardEditor`：通用空位传 `initialTemplateId=custom-template-empty-v1`，组件以 creating 模式启动；`onCardSaved` 在明确持久化后关闭弹层、回到卡架选中新卡，不自动开详情。
- `PersonaDetailSheet(card, open, onClose)`：只展示人物名/封面，以及“播放人物动画 / 放大查看立绘”两个动作；不接收编辑、插卡、播报或新建回调。lightbox 的 Escape/遮罩/关闭按钮只关闭预览，第二次 Escape 才关闭详情。
- `PersonaCardShelf` 的卡片根节点不提供 inspect click；上半 `dragSurface` 只调用 `onDragStart/onDragEnd`，底部 `inspectButton`（`data-persona-card-inspect`）才调用 `onInspect`。图片主体点击不打开详情，拖拽命中直接插卡且 suppress 后续 click。
- `PersonaCardShelf.onCreateFromTemplate(template)` 仅用于 `templateId=empty` 通用空位；空位复用 `PersonaCardFace` 默认视觉，但不渲染 dragSurface 或 inspectButton，点击/Enter 直达 creating，不能成为 Driver 投放载荷。
- `cardDetailOpen` 只表示人物详情半窗；`resultSheetOpen` 只表示完整 Navi 输出半窗；两者都可关闭且不清空 `naviRun`、taskId 或 conversationId。
- 结果窗默认 DOM 只呈现真实任务标题、“人物名视角”、command label、与 CLI 一致的 instruction、source displayName、阅读覆盖与 Markdown；Skill slug、run/task/conversation ID、technicalName/path/SHA 在“运行详情”展开前不渲染。
- `app/page.tsx` → `RodInjectorPanel(kind="energy")`：接收/返回 `RodContentState`，只允许单个本地 `.md`/`.txt`，上限 1 MiB。
- `app/page.tsx` → `RodInjectorPanel(kind="skill")`：接收/返回 `RodContentState`，预设 Prompt 为只读展示，custom Prompt 上限 4,000 字符。

### 页面 → Bridge

- 固定素材 + 固定预设：`POST http://127.0.0.1:8766/runs`，`schema=persona.navi-run/v1`，发送一个服务端白名单 `materials` ID。
- 已上传文档或 custom Prompt：`POST /runs`，`schema=persona.navi-run/v2`，发送单个 `document` 正文和技能 Prompt；两者缺一不发。
- 两条路径都要求固定 Persona 的已安装 Skill。自建卡的 `skillBinding.status=unmapped` 在 UI 与 Bridge 请求前均阻断，不会把播报名或自由文本当作 Skill。
- Bridge body 上限：`4.125 MiB`（`MAX_DOCUMENT_BYTES * 4 + 128 KiB`），用于覆盖最大 v2 文档的有限 JSON 转义开销；超限返回 HTTP 413 / `REQUEST_TOO_LARGE`。
- `/runs/:runId` 返回状态、`taskId`、`conversationId`、错误与最终 Markdown；页面对 pending/running 自动轮询。`/health` 仍为只读检查，不创建任务。
- `RunStatusCard` 常驻 Driver 上方，仅展示人物、指令、未发送/创建中/生成中/已完成/失败状态，以及「查看结果」「重新创建」两个动作。`Failed to fetch` 只截断显示在状态卡；查看结果仅对 completed 打开结果半窗。
- Loopback alias：Bridge Host 只允许 `localhost:8766`、`127.0.0.1:8766`、`[::1]:8766`；Origin 只允许 `http://localhost:3000` / `http://127.0.0.1:3000`。两者组合即使 Fetch Metadata 为 `cross-site` 也允许，其他跨站请求仍返回 `CROSS_SITE_REQUEST`/Origin/Host code。白名单 alias 响应使用 `Cross-Origin-Resource-Policy: cross-origin`，不对白名单外来源开放；`/runs` 仍强制 token。
- 本地运行：`pnpm dev:persona` 启动/复用 web :3000 与 Bridge :8766，Bridge 异常最多 3 次指数退避重启并在退出时清理子进程；事件日志位于 `.persona-runs/bridge-events.ndjson`。
- `PersonaCardShelf.onManage` 调用页面 `openManagement("cards")`；右上齿轮调用 `openManagement("prompts")`。页面渲染现有 `PersonaManagementPage(initialSection, baselineCards, bridgeUrl, recentErrors, onBack)`，不生成第二套管理 UI 或浮动 Save。管理页卸载 workbench 但不调用 restart/reset，返回保留内存状态。
- Rod 生命周期由页面状态独立维护：`charged` 不等于 `equipped`；`equipRod` 只能从正确的 DragLayer drop 命中调用。空棒/充能棒都留在 loose 组件区，equipped 后从来源区移除，Driver 只接收 equipped 布尔值。

本轮不读取或修改 `driver-audio.ts`、`audio-library.ts` 和图片/动画资产；不部署，不自动创建真实 YouNavi 对话。
