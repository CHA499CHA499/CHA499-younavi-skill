# JMQS Driver

JMQS Driver 是 YouNavi 项目的 Persona Driver 本地工作台：开包、人物卡、能量棒/技能棒注入、腰带合体、YouNavi Bridge 和结果阅读器均包含在本目录。

## 资产说明

视频素材暂不进入本仓库。代码仍保留完整的视频路径映射、播放失败降级和静态卡面回退；后续将对应 `.mp4` 文件补入 `public/personas-motion/`、`public/personas-motion-v3-intense/` 或 `public/waiting-media/` 后即可恢复视频播放。

## 开包翻牌与合体动画（2026-08-20）

新手包撕开后五张卡同时发到桌面，任意未翻卡都可直接点击；每次只播放一段角色 motion，结束、媒体错误或 Escape 后翻开对应卡。已翻卡可点击重播。内容区和视频层右下角「跳过动画」使用同一 finish-all 动作：暂停当前视频、停止卡包音频、一次写满 `revealedPackIds/viewedEntranceIds` 并进入五卡完成态；刷新继续停留在完成页，用户确认后才进入工作台。

五人 motion 固定为：Naval `/personas-motion/naval.mp4`、Elon Musk `/personas-motion/elon-musk.mp4`、Steve Jobs / Donald Trump / Paul Graham 使用各自 `/personas-motion-v3-intense/*-action-masked-intense-v3.mp4`。不得把 Naval/Musk 换成 intense 版本。

Driver 双棒启动时，按钮和把手阈值共用 `activateDriver`；用户手势当下先进入静态 activated 并挂载同一人物 motion，不等待 Navi receipt。视频嵌在 Driver 视觉区，Run 状态保持可见；播放拒绝、404、ended、跳过和 reduced-motion 都回到现有静态合体态。

## 音频可靠性 P0（2026-08-20）

`app/audio-library.ts` 的 Decade 候选选择使用可循环 shuffle bag：某事件没有已存袋、或一轮播放后袋为空时，必须从当前 manifest 候选重新装填；同一事件有多个候选时仍避免连续重复。`random()` 的 `1`、`NaN`、负数和抛错均会安全归一，空事件返回 `null`，不会产生负索引或读取 `undefined.id`。

`app/driver-audio.ts` 是业务流程的故障隔离边界。`playCardInsertSound()`、`playAssemblySound()`、开包/发牌、双棒和最终合拢音频即使遇到坏 manifest、`Audio` 构造失败、autoplay 拒绝、404、卡顿或 Web Audio 异常，也只记录 `DriverAudioDiagnostic` 并回退 Web Audio/静默失败，禁止把异常抛回 `insertPersona`、装配或激活主流程。

本地资源由 `public/audio/local-test/manifest.json` 动态扩展；malformed 条目会被过滤，合法 candidate-17+ 按 `id` 合并并在刷新后重建轮换袋。回归命令：`node --test tests/audio-reliability.test.mjs`；该测试包含单候选连续两次、N 候选 N+1、随机边界、空池、坏 manifest 和真实模块路径下插卡不抛错。

当前开发状态以本地源码为唯一真源，不再更新公开测试链接；旧线上版本只作历史留档，不代表本文描述的最新交互。

把已验证的「人物图鉴」交互 Demo 发布为所有人可访问的公开测试站。站内使用固定的公开人物 Skill 摘要和模拟交互，
不连接飞书、不读取本机资料、不保存访客输入，也不代表人物本人观点。

固定卡组为纳瓦尔、埃隆·马斯克、史蒂夫·乔布斯、唐纳德·特朗普和 Paul Graham，卡片内容来自对应公开 GitHub Skill。
首步为封面「准备变身」：用户已获得唯一新手卡包，点击「撕开卡包」后五张 `*-action-masked-v3.jpg` Persona Card 同时发牌；任意点击翻卡并观看对应 motion，全部翻开后点击「收下卡牌，进入工作台」。卡背与品牌 Logo 复用 PNG 卡背组件，不使用临时菱形或 SVG 品牌标记。
五位人物均使用项目自有生成立绘：动态漫画姿势、原创特摄假面和角色专属配色，不复用参考图像素或第三方角色设计。
五张卡按固定位置发牌，但翻牌不限制顺序；sealed pack 只显示独立 PNG Logo，五张 reveal back 才复用极简 `PersonaCardBack`。翻牌与 Driver 合体均播放真实 motion video，失败与低动态模式降级为 action-masked-v3 静态卡面。
工作台卡架复用 `PersonaCardShelf` hand-layout；页面只传卡片、选中、拖拽、inspect 和管理回调，卡架自行处理 5/7/12 张的压缩与 hover 展开。

## 本地运行

```bash
npm install
npm run dev
```

本地完整运行（web dev server + Bridge）使用一条命令：

```bash
pnpm dev:persona
```

也可单独运行 `pnpm navi:bridge` 做 Bridge 调试；公开 Sites 不会调用 Bridge。

页面仍从 `http://localhost:3000` 打开。Bridge offline 时页面禁止进入 activated 成功态，状态卡显示 `BRIDGE_OFFLINE` 等具体 code。

## Persona Driver 管理中心

`app/persona-management-page.tsx` 是独立的整页管理组件，接线时传入 `baselineCards` 与 `onBack`，可选传入 `initialSection`、固定素材、存储和最近错误。页面不接管 `app/page.tsx` 的工作台状态，返回时由调用方恢复原工作台。

四个分区按被管理对象划分：Prompt 预设、人物卡、状态检测、素材。固定 Prompt/文档校验分别复用 `rod-content-model.ts`，人物卡 CRUD 复用 `PersonaCardEditor` 与 `persona-card-model.ts`。管理页当前固定 Prompt 由 rod 合同提供四项：评审、解释、决策、行动；custom 独立管理。自定义 Prompt 写入 `persona-driver.prompt-presets.v1`，自定义素材写入 `persona-driver.custom-materials.v1`；诊断只读 `/health`、资源和本机历史，不创建真实对话。

旧 Prompt 存储中若发现已移除的 normal 记录，管理页只显示迁移提醒并从当前列表排除；具体迁移语义由 `rod-content-model.ts` 提供，管理页不硬编码固定预设。

人物卡管理区的「从 Soul 提炼」已接入真实 `SoulCardWizard`，与编辑器内「＋ 新建空卡」并列。流程为按钮 → 向导 → token-aware `/soul-runs` → collecting/distilling/assembling/validating/ready 轮询 → 完整产物投影 → `source=soul` 卡写入 `persona-driver.persona-cards.v1`。Bridge 失败会明确显示且不写卡；本地文件/frontmatter 验证与动态 Skill 索引验证分离，索引未确认时显示警告并保持 unmapped。

`RunResultSheet` 是遮罩内居中大窗口：桌面最大宽度 1180px、最大高度 88dvh，窄屏全屏。Markdown、关闭、“打开 YouNavi”和折叠运行详情保持原合同。

custom / Soul 卡没有用户上传图片时，卡片编辑器从 `/personas/random-pool/masked-bust-v2/manifest.json` 的 shuffle-bag 分配系统立绘，并在卡片底部提供「换一张」。用户上传图片后不会被覆盖；固定五卡和通用空位模板不进入随机池。

## 验证

```bash
npm test
```

测试会重新构建 Sites 产物，并确认根页面、公开 Demo 资产和正式标题都存在。

## 目录

- `app/`：Sites 外壳、页面元数据与公开 Demo iframe。
- `public/hero-personas.png`：首页三人物卡主视觉，左侧标题由 HTML 实时渲染。
- `public/personas/`：五张人物角色立绘的网页压缩资产。
- `public/personas-motion/`：五段 4 秒 H.264 出场视频与首帧海报，保留作素材归档。
- `public/driver-textures/`：已批准的二维腰带、能量棒、技能棒元素图和离线合成脚本。
- `public/models/persona-driver/`：历史原创 GLB 源资产，当前网页不加载。
- `public/og.png`：链接分享封面。
- `.openai/hosting.json`：Sites 项目绑定，只保存公开项目 ID，不含凭证。
- `INTERFACE.md`：调用与数据边界。
- `ROLLBACK.md`：发布失败时的回退步骤。

## 隐私边界

- 所有人拿到链接都能打开。
- 只展示固定公开 Skill 的摘要与模拟交互。
- 没有登录、数据库、文件上传、第三方连接器或模型调用。
- Demo 的本地状态仅存在于访客浏览器会话。

## 页面尺寸

首页与各交互状态使用动态视口高度 `100dvh`，不再依赖 720/760/780px 固定高度。根页面只保留一层 iframe，
内部页面负责铺满视口，避免高屏幕下露出外层白底。

## Persona Driver v1

本地 Persona Runtime 在 Navi Run 收到成功 receipt 且状态为 `pending`/`running` 时，可由 `app/waiting-video-panel.tsx` 显示等待视频；组件只使用 `public/waiting-media/` 的本地循环素材，公开运行时返回空，不接线到 Bridge 的取消路径。

根路由先显示封面和卡包选择；工作台是卡包流程的出口：左侧变身组件、中央二维贴图 Persona Driver、底部固定五人卡盒。用户从开包选中的人物会以 ready 状态带入工作台；只有选中人物卡后，右侧才出现人物简介，启动后切换为角色实例面板。
原始素材与指令不再常驻占用首屏：点击能量棒打开上下文注入浮窗，从四篇原文中选择一篇；点击技能棒打开提问预设浮窗，选择解释、评审、决策或行动，也可编辑自定义 Prompt。两根棒完成注入后才可拖入 Driver。
第一版支持待机呼吸、人物卡插入、锁定、核心旋转点亮、原创 Web Audio 提示音和系统 TTS 播报。
底部人物卡盒直接展示 `public/personas/` 的五张角色立绘，不再使用字母与几何人形占位。
网页不加载 Three.js、GLB、WebGL 或运行时材质。`driver-texture-scene.tsx` 只读取批准的二维贴图和人物立绘，贴图失败时显示静态错误状态。
人物卡锁定后始终显示明确的「启动 Persona Driver」主按钮；实验性交互不能替代主操作。
卡片锁定后，用户可把左右机械把手向中心拖动；拖动进度会同步驱动 3D 外壳、导轨、光环与核心闭合，超过阈值后进入 `PERSONA RIDE`。单击任一把手是键盘和触控场景的等价启动入口，未达到阈值则自动弹回。
中央 Driver 由腰带、人物卡、能量棒和技能棒二维贴图组成，插入、吸附、闭合和激活都用 CSS/DOM 位移与发光反馈完成。

中央 Driver 使用现有二维元素图；人物卡和棒的抓取预览位于页面最上层，进入正确槽位才完成吸附，点击、键盘和触控继续作为回退入口。

人物卡与两根变身棒使用同一页面级 `InteractionDragLayer`：按下来源即出现顶层真实贴图，指针移动只更新该层的位置，来源本身只进入轻量 lifted 状态；松开后由中央槽位决定插卡、装棒或取消，避免每个卡片各自维护一套拖拽动画。
两根棒完成后，腰带两侧会随 `handleProgress` 进行二维位移和闭合反馈。点击按钮继续作为键盘、触控与低动态模式的等价入口。
能量棒与技能棒默认空载。能量棒必须注入一篇原文上下文，技能棒必须注入一种提问预设；两项完成后，人物卡锁定时才可分别拖到中央 Driver（或点击作为键盘/触控回退）。两根全部装配后才开放闭合与启动。
`scripts/compose-persona-driver-texture-sprites.py` 直接使用批准的元素图合成 1024×1024 RGBA 帧与 manifest。网页只读取成品 PNG，不执行材质、灯光或相机计算；旧的 Blender 出帧脚本仅供源资产评估，不能覆盖当前帧。

当前首页唯一 Driver 视觉入口为 `app/driver-texture-scene.tsx` 和独立元素贴图层；腰带、人物卡、能量棒、技能棒和发光效果分别渲染，网页没有第二套运行时 3D 场景或重复烘焙卡片。

### 2026-08-19 全量清洗后的前端真源

- 运行时唯一入口是 `app/driver-texture-scene.tsx`；`app/driver-scene.tsx` 只保留 `DriverPhase` 类型，不再承担第二套视觉渲染。
- 所有腰带视觉元素挂在同一个 `.driver-assembly` 组合框内，固定使用批准元素图的 `1672 / 941` 比例；外层只负责响应式缩放，不再分别对腰带、卡片和能量棒使用 viewport `clamp()` 尺寸。
- 图层顺序固定为：`data-layer="base"` 腰带底图 → `data-layer="middle"` 人物卡/能量棒/技能棒 → `data-layer="foreground"` 腰带前景遮罩。插入卡因此真实位于中央盒子内部，而不是浮在盒子外。
- 拖拽预览使用 `position:absolute`，坐标由 `.texture-driver` 的 `getBoundingClientRect()` 转换并限制在组合框内；`page.tsx` 的吸附命中也读取同一个 `.driver-assembly` 边界，避免分辨率变化错位。
- 所有图片显式 `draggable={false}`，工作台统一阻止 `dragstart`，拖拽结束、取消和离开均回收预览；点击仍是键盘/触控回退入口。
- 已删除未挂载的旧 `.driver-sprite-*`、`.driver-layer-*`、`.interaction-hands`、`.held-object` 和旧 fallback CSS，避免旧规则覆盖贴图层。

### Driver 坐标与响应式合同（2026-08-20）

- `.driver-assembly` 是唯一的视觉坐标真源。腰带底图、人物卡、两根棒、前景遮罩与发光层都以其 `50% / 50%` 为中心；不得给这些不同尺寸的元素分别添加百分比 `translateY()`。
- 禁止恢复 `--belt-nudge`。CSS transform 的百分比按元素自身尺寸计算，腰带、卡片和棒的高度不同，会导致同一个变量产生不同的真实像素位移与错层。
- 组合框与投放引导使用 `min(760px, calc(100% - 32px), calc(100vw - 32px))`，避免父级网格最小宽度在窄屏下把腰带裁出视口。
- 当前拖拽只使用 `InteractionDragLayer`；旧 `.texture-driver-held` 与隐藏人体底片都不是运行时入口，不能重新引入。

### 本机唤起记录

右上角「唤起记录」按钮打开本机浏览器历史面板。每次 Driver 启动会记录人物、指令、时间、状态、runId 与 conversationId；状态更新会回写同一条记录。数据只写入当前浏览器的 `localStorage`（key：`persona-driver.activation-history.v1`），最多保留 50 条，不保存对话正文、认证信息或原始素材。面板支持 Escape 关闭、重新打开 YouNavi 和清空全部记录；公开站点只会记录演示模式，不创建真实本机任务。

### 启动音与状态检查

- Driver 启动与人物过场都会播放随站点打包的原创播报 `public/audio/persona-driver-announcer-v2-expressive.m4a`；扫描/冲击仍由浏览器 Web Audio 立即播放。音频是产品必需资源，不依赖临时端口或本机静态服务器。
- 工作台顶部「检查状态」不会创建任务或对话。它只检查三件事：固定五人卡/四份原始转写是否齐备、人物卡/腰带/双棒与浏览器音频是否可用、以及本机 `127.0.0.1:8766/health` 是否确认 Bridge/Skill/素材都已就绪。
- 最后一项在公开站点会明确显示演示模式；在本机 Bridge 未启动、Skill 缺失或原始转写不可读时显示失败，而非发起真实对话。

音效层由 `app/driver-audio.ts` 运行时合成：选卡金属音、插卡滑轨与锁扣、启动扫描脉冲、
能量升频和低频冲击。最后使用系统 TTS 播报原创 `PERSONA RIDE` 文案；不包含影视原版采样。

播报资源来自仓内原创 `Device Announcer Voice Study`，使用系统音色与原创处理链生成；它作为同源静态资源发布，不使用影视原声、外部 CDN 或运行中的本机音频服务。若资源加载失败，系统播报与原创合成冲击仍会保留为恢复路径。

人物卡出场动画同样只在本机读取预设，并且五张角色卡各自绑定不同候选：纳瓦尔 `01`、马斯克 `04`、乔布斯 `05`、特朗普 `13`、Paul Graham `02`。出场视频结束、跳过、Escape 或返回卡包都会停止当前预设。此出场音不使用浏览器合成音，也不进入公开站。

工作台左上角的「重新开始」只重置当前体验步骤：封面/选包/开包进度、已揭晓卡、人物卡、原文与指令注入、双棒、Driver 状态、本轮 Navi 状态和弹层。它会移除 `persona-driver.pack-progress.v1`，但不会清除右上角「唤起记录」及其 `persona-driver.activation-history.v1` 历史。

## Persona Navi Bridge

本机版提交 `persona.navi-run/v1|v2` 到 `http://127.0.0.1:8766`。Bridge 解析并冻结真实输入后，`agent-cli chat send` 的首条用户消息只包含三段：`/skill-name`、需要读取的真实绝对路径、当前预设的真实 instruction。Persona/Command/Run/task、SHA/行数/MIME/字节数、文档正文与输出栏目等内部元数据只留在本地审计记录或结果诊断，不进入发送文本。

| 卡片 | YouNavi Skill |
|---|---|
| Naval | `naval-perspective` |
| Elon Musk | `elon-musk-perspective` |
| Steve Jobs | `steve-jobs-perspective` |
| Donald John Trump | `trump-perspective` |
| Paul Graham | `paul-graham-perspective` |

运行前必须把五个完整 Skill 目录安装到 `/Users/zqnw/navi-ai/CHA499/skills/`。Bridge 只接受服务端白名单中的
persona/command，不接受网页传入 Skill 路径、命令或落盘目录；CLI 使用数组参数调用，不经过 shell。
运行证据写在 gitignored `.persona-runs/<runId>/`，不进入 Sites、brain 或人物卡。
四项素材已替换为 `transcripts/classic-interviews-2026-08-19/` 中的真实 TXT：乔布斯盖茨 D5 对话、乔布斯 1990 访谈、比尔·盖茨 TED Interview、梁文道《活着（二）》。
网页只提交素材 ID，Bridge 从 `PERSONA_NAVI_MATERIAL_ROOT` 解析固定原始文件；v2 自定义文档冻结到 `.persona-runs/<runId>/inputs/`。两者都把真实绝对路径写入 `request.json.absolutePaths`，并与 `skill/instruction/prompt` 一起审计；缺失或非绝对路径时停止创建任务。

### 2026-08-20 新入口与 v2

工作台最后一个位置是通用空位卡，不代表已完成 Persona。它复用标准 Persona Card 卡面结构，但没有拖拽、详情或插卡能力；点击/Enter 与管理页“新建角色卡”进入同一 `PersonaCardEditor` creating 流程。自建卡保存后回卡架显示并保持 Skill 未映射。

页面用 `RodState` 统一保存两根棒的内容，同时保留固定素材/固定预设兼容字段。固定素材 + 固定预设继续提交 `persona.navi-run/v1`；上传文档或 custom Prompt 进入 `persona.navi-run/v2`，且必须同时有文档、Prompt 和已映射 Persona Skill。Bridge HTTP JSON body 上限为有限的 `4.125 MiB`，覆盖 1 MiB 文档的 JSON 开销，不是无限放大。

启动状态会显示请求已发送、Bridge 错误、taskId、conversationId、正在生成和已完成；pending/running 会自动轮询 Bridge 的 task/conversation 结果。自动测试只使用 Bridge fixture，不创建真实 YouNavi 对话。

结果阅读窗以本次冻结 request/result metadata 为准：标题由真实 command 与 task 生成，副标题显示“人物名视角”，默认展示人类可读的素材 `displayName`、与 CLI 一致的真实 instruction、阅读覆盖和 Markdown 正文。`technicalName`、本地路径、SHA、Skill slug、runId、taskId、conversationId 收进默认折叠的“运行详情”，展开后可复制诊断信息。右上“打开 YouNavi”只调用已有 `/runs/:runId/open` 启动 YouNavi 应用，不发送内容、不伪装成 conversation 深链。

本地完整运行入口为 `pnpm dev:persona`：它统一管理 web dev server 与 Persona Bridge，避免重复实例；Bridge 异常退出最多有限退避重启，退出时清理子进程。Bridge 事件写入 gitignored `.persona-runs/bridge-events.ndjson`，不记录 token、正文或 Prompt。公开 Sites 构建不会启动该 supervisor。

### 工作台状态门控

`pack-complete` 刷新保持五卡完成页，用户点击「收下卡牌，进入工作台」后进入 `workbench-empty`；空工作台只显示空载 Driver 和 `PersonaCardShelf`。已有卡底部 inspect 打开 `PersonaDetailSheet`，详情仅提供“播放人物动画 / 放大查看立绘”；人物卡插入只来自上半 dragSurface 命中人物槽。进入 `locked` 后才把两根棒和注入入口加入 DOM。

卡片 Shelf 的卡片根节点只负责拖拽，不绑定 inspect click；图片主体点击保持当前状态。只有卡片底部半透明文字/图标 `inspectButton` hit-zone 触发详情；上半 dragSurface 命中人物槽会直接插卡，不打开详情。Run 失败或生成中时，状态摘要固定显示在 Driver 上方绿框；完整结果只在点击「查看结果」后打开右侧半窗，关闭不会清除 task/conversation 状态。

右上角齿轮打开统一管理中心，Shelf 的「管理卡片」深链到 `management/cards`；工作台和管理页都只展示 5 张基线卡 + 1 张通用空位卡。旧 male/female 模板缓存会被过滤，不作为两个可见角色。

棒体严格按 `loose-empty → loose-charged → equipped`：锁定后才散落显示；空棒点击只打开注入面板，充能后仍留在组件区，只有拖入正确槽位并命中才进入 Driver。拖错或未命中保持 loose-charged。
