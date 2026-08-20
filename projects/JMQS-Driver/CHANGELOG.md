# CHANGELOG

## 2026-08-20 · 开包任意翻卡、跳过全部与 Driver 合体视频

- 删除 deal-cards eyebrow，主标题/说明改为桌面与窄屏单行；右下角新增 finish-all「跳过动画」，播放中视频层使用同一动作。
- 移除 `nextPackPersona/isNext/等待前一张/非当前 disabled`：任意未翻卡可播放自己的 motion，已翻卡可重播；单段播放锁防并发。
- skip-all 暂停当前 video、停止卡包音频、一次写满 revealed/viewed 五人 ID；刷新保留 deal-cards 完成态，用户确认后进入工作台。
- 五人资源映射固定为 Naval/Musk 旧版 motion，Jobs/Trump/Paul Graham intense v3；媒体失败、Escape、reduced-motion 静态降级。
- `activateDriver` 用户手势当下进入 activated 并挂载对应 motion，不等待 Bridge receipt；视频嵌入 Driver 视觉区且不遮 Run 状态。
- 新增 `tests/pack-motion-state.test.mjs`；真实 localhost 验证任意点击 Paul Graham、播放中 skip-all、刷新完成态及 390px 单行布局。

## 2026-08-20 · 中央结果窗与 Soul 一键导入集成验收

- `RunResultSheet` 改为居中 1180px / 88dvh 大窗，窄屏全屏；真实浏览器验证中心偏差 X=0px、Y=5px，Markdown、关闭与 YouNavi 动作均可用。
- 管理页真实注入 `SoulCardWizard`、token-aware `naviRequest`、`onSoulCardReady` 与卡库 merge；`/soul-runs` 创建、轮询、打开路由进入 Bridge。
- fixture 验证成功卡写入并刷新保留，Bridge offline 明确失败且不写入；未验证 Skill 保持 unmapped。
- 修正跨组索引语义：本地 SKILL.md/frontmatter 只记为 `fileVerified`，未获得动态索引成功证据时 `verified=false`，管理页显示“索引未确认”警告。当前动态列表 `LIST_FAILED/Not Found` 不再被误报为索引成功。

## 2026-08-20 · YouNavi 三段式 Persona Prompt

- `renderPersonaPrompt()` 收敛为 slash Skill、真实绝对路径、真实 `command.instruction` 三段；唯一安全边界压缩进路径引导句，不再发送 Persona Driver 标题、人物/Command/Run/task、SHA/行数/MIME/字节数、内嵌正文或输出栏目合同。
- v2 `.md/.txt` 在创建 Run 时冻结到 `.persona-runs/<runId>/inputs/<name>`，CLI 只接收该真实绝对路径；固定素材继续使用 `PERSONA_NAVI_MATERIAL_ROOT` 解析后的绝对路径。
- `request.json` 新增并冻结 `skill/absolutePaths/instruction`，实际 `chat send` 文本由同一结构生成；结果阅读器继续独立呈现 Markdown 与折叠诊断。
- 定向 fixture 精确覆盖字段顺序、固定素材路径、custom Prompt、文档落盘和禁用旧长合同；未创建真实 YouNavi 对话。

## 2026-08-20 · 结果窗口信息架构与动作收敛

- 结果标题改由冻结 request 的 `commandId + task + source displayName` 生成：评审/解释/决策/行动分别使用“评审… / 解释… / 决策… / 制定…行动方案”，人物改为“人物名视角”副标题。
- 固定素材新增 `displayName` 与 `technicalName` 分离；默认结果页只显示规范中文来源名与阅读覆盖，原始文件名、绝对路径、SHA、Skill slug、run/task/conversation ID 仅在用户展开“运行详情”后渲染，并支持复制诊断信息。
- 右上模糊箭头改为带图标和状态的“打开 YouNavi”。真实动作仍是 `POST /runs/:runId/open → open -a YouNavi`，只启动应用，不发送内容，也不承诺精确深链 conversation。
- 新增标题模板、缺失 task/source 回退、默认 DOM 隐藏工程字段与动作语义回归测试。
- 新增 1440×1000 只读 fixture 浏览器截图 `persona-card-qa/run-result-ia-1440.png`；未创建真实 Run，临时 QA 路由已删除。

## 2026-08-20 · Driver P0 RodSprite tight-crop 尺寸修复

- 将 Driver charged rod 从透明 canonical 画布改为同一 `256×1500` tight-crop sprite，避免透明横边参与 slot shrink-to-fit 导致棒体缩成小图标。
- `rodViewport` 统一使用槽宽与 `94%` 槽高，插入动画只做局部 `translateY`，不改变 scale/width/opacity；SideChassisAssembly 结构不变。
- 增加 1440/1792/2560 宽度的真实浏览器验收截图与 browser timeline 证据；更新 alpha bbox/尺寸回归合同。

## 2026-08-20 · 音频 shuffle bag P0 崩溃修复

- 修复 `chooseNextDecadeCandidate()` 在事件候选恰好播完一轮后把已存空数组继续当作可选池，最终形成 `pool=[] / index=-1 / candidate=undefined / candidate.id` 崩溃的问题。
- 新增通用 `selectFromShuffleBag()`：stored 缺失或为空时重新装填；守卫空池与缺失 candidate；对 `random=1/NaN/负数/抛错` 安全归一；多候选跨轮次继续避免相邻重复。
- manifest 解析只接受 local-test 下合法 M4A、受支持事件和正整数 `sourceCandidate`；坏数组、空条目、外部 URL、未知事件和非法编号均被过滤且不替换 seed 池。
- 加固 `driver-audio.ts`：诊断监听器、AudioContext、Web Audio render、HTMLAudio 构造/绑定/播放、fallback 回调和最终 `playCardInsertSound()` 都不能向插卡/装配/激活业务层抛错。
- `tests/audio-reliability.test.mjs` 增加 5 组可执行回归；音频专项 10/10 通过，定向 TypeScript 检查通过。

## 2026-08-20 · Driver SideChassisAssembly 时间线重构

- 将左右 chassis、slotWindow、equipped rod、slot foreground mask 合并到两个 `SideChassisAssembly` 移动容器；删除 `leftPayloadMotion/rightPayloadMotion/leftFrontMask/rightFrontMask` 重复 transform 路径。
- 棒体插入只在局部 `slotWindow` 内执行 `translateY`，始终 `opacity: 1`，phase 从 `locked` 到 `activated` 不卸载或重启动棒体节点。
- 新增真实浏览器时间线 QA：单棒 0/50/100/160/240/400/620/900ms，双棒 handle 中间帧与 activated 0/80/160/300/500/800ms；保留截图与 metrics 供集成验收。
- RCA：之前只验收离线 open/final 端点，三个绝对定位 wrapper 各自复制 transform/animation，导致真实中间帧可能出现棒与槽沿不同步并被遮罩吞掉。

## 2026-08-20 · Persona Driver 本地等待视频组件

- 新增 `WaitingVideoPanel` 与局部 CSS：只接受成功 receipt 的 `pending`/`running` Run，公开运行时不渲染。
- 轮询保持同一 `runId` 的 `<video>` 节点与播放进度；completed/error/incomplete/cancelled 关闭并清理媒体，用户关闭不会取消 Run 或被同一 Run 强制重开。
- 增加有声 autoplay → muted fallback、点击开启声音/手动播放入口、`pause + remove src + load` 卸载清理和本地 waiting media provenance README；未修改页面接线、Bridge、Driver、卡片或音频模块。
- 新增 `tests/waiting-video-panel.test.mjs`，覆盖状态门控、poll 稳定性、媒体合同、autoplay fallback、关闭/清理和公开模式。

## 2026-08-20 · 新手包极简卡面

- sealed pack 改为直接显示 `/brand/persona-gate-logo-v1-256.png` 与 HTML 文案，不再嵌套 `PersonaCardBack` 或加载卡背底图。
- 五张 `pack-reveal-back` 继续复用极简 `PersonaCardBack`；结构测试覆盖 sealed nested card-back 为 0 与品牌 PNG 资产存在。

## 2026-08-20 · PersonaCardShelf hand-layout 接线

- 页面不再向 `PersonaCardShelf` 传入 `entranceKey`、卡架 class 或任何卡数/固定列布局；卡架只接收 cards、selected、drag、inspect、manage，5/7/12 张的并排、压缩重叠与 hover 展开由 Shelf 自己负责。

## 2026-08-20 · Prompt 预设收口

- 当前新建技能棒固定预设收口为 review/explain/decision/action 四项，另保留 custom；不再预选固定 Prompt。
- 新建 Bridge Run 遇到已移除的普通提问 ID 返回 INVALID_COMMAND；历史 request/result 与回执展示保持只读兼容。
- 旧技能棒状态迁移为空态并显示“该预设已移除，请重新选择”，不会静默改写为其他预设。

## 2026-08-20 · Persona Driver 管理中心

- 人物卡管理区新增与「＋ 新建空卡」并列的「从 Soul 提炼」入口；通过可选 `SoulCardWizardComponent` 注入，未接入时不伪造可用状态。
- 管理页新增 Soul 状态回显 `collecting / distilling / ready / coverage-warning`，只转发 `onCardReady`，不复制 Soul 蒸馏逻辑或 Skill 映射。
- 卡片管理区接入随机立绘池：custom/Soul 无上传图时按 manifest shuffle-bag 分配并显示「换一张」，上传图优先；固定卡和通用空位不进入随机池。
- Prompt 管理固定列表收敛为 rod 合同中的评审、解释、决策、行动四项；custom 独立保留。旧 normal 存储记录只转为迁移警告，不再显示为当前预设。
- 新增独立全屏 `PersonaManagementPage`，以 Prompt 预设、人物卡、状态检测、素材四区承载管理需求，支持 `initialSection` 深链和 `onBack` 返回合同。
- Prompt 固定预设只读并展示真实 Prompt；自定义 Prompt 支持复制、编辑、重命名、删除，复用 rod content 校验。
- 人物卡分区复用 `PersonaCardEditor`；固定五卡只读，通用空位与新建按钮进入同一 creating 流程，自建卡继续显示 Skill mapped/unmapped 安全状态。
- 状态检测只读 Bridge `/health`、Skill/素材合同、音频/AudioContext、视觉资产、localStorage 和最近错误，不创建真实 YouNavi 对话。
- 素材分区固定四份只读，自定义 `.md/.txt` 支持新增、重命名、删除，复用 1 MiB、路径穿越、MIME 与字节数校验；不删除历史任务快照。
- 新增 `tests/persona-management-page.test.mjs`；未接线、未修改工作台、Bridge、audio/animation 或全局 CSS。
- 新增 `pnpm dev:persona` 本地完整运行入口与 Bridge 生命周期事件日志；公开构建不启动 supervisor。

## 2026-08-20 · 新手卡包路径

- 首页 CTA 收短为「准备变身」，唯一 starter pack 直接进入「已获得新手卡包」；移除 pack selection、经典五人卡组选择和单选确认。
- 「撕开卡包」后五张基线卡自动按固定顺序 stagger 落位并发出短促节拍，完成后以「收下卡牌，进入工作台」确认；reduced-motion 直接终态。
- 老 progress 完整状态刷新直达 workbench；旧 selectedPackId 继续兼容读取；首版不启用旧全身动态过场。

## 2026-08-20 · Bridge loopback alias

- 允许白名单 `localhost:3000 ↔ 127.0.0.1:8766` 与反向 alias 在 `Sec-Fetch-Site: cross-site` 下通过；非白名单 Origin/Host 仍拒绝。
- 白名单 alias 响应使用受限 `Cross-Origin-Resource-Policy: cross-origin`；`/runs` 不放宽 token 校验；页面错误保留 Bridge code。
- 新增真实 Bridge 进程 HTTP header 测试，未创建 YouNavi Run。

## 2026-08-20

- 追加 Persona Driver 交互状态机：pack-complete 刷新直达工作台；空工作台不渲染棒体/注入入口/详情；底部 inspect 点击打开 PersonaDetailSheet，拖拽命中直接插卡；locked 后才 reveal 双棒。
- 工作台卡牌改接现有 `PersonaCardShelf` 与 `PersonaDetailSheet`，保留 stagger、hover 抽牌、reduced-motion、遮罩/Escape 关闭和编辑/新建入口。
- 卡片 Shelf 根节点改为仅承载拖拽的 article；inspect 只由底部半透明文字/图标 hit-zone 触发，图片主体点击不改变状态；拖拽命中直接插卡且不会误开详情。
- 移除页面侧旧卡片 CSS/序号/重复布局；新增 Driver 上方紧凑 RunStatusCard。右侧结果半窗与 `cardDetailOpen` 分离，失败只显示短错误与重试，不自动占据右侧。
- 接入统一 `PersonaManagementPage`：右上齿轮进入 prompts，Shelf「管理卡片」进入 cards；管理中心返回不调用 restart/reset，工作台内存状态保留。
- 修正棒体状态机：锁定前/刚插卡时槽内为 0；空棒只能打开注入面板，充能棒仍在组件区，只有命中正确槽位的拖拽才装备；装备后来源棒消失。
- 旧版封面/选择页路径已由本文件上方的「新手卡包路径」条目取代；当前不渲染 pack selection、唯一选项确认或逐张点击揭晓。
- 当前卡片合同为双路径：上半 drag surface 命中人物槽直接插卡；下半 inspect 区打开详情半窗，详情内仍可确认插卡。
- 开包背面统一复用 `PersonaCardBack` 与 PNG Logo；五张卡自动按固定顺序落位，旧 motion 视频/海报和逐张点击揭晓路径禁用。
+ 前端与 Bridge 合同对齐：决策指令 ID 从 `decide` 改为 `decision`，能量棒只注入一篇白名单原始转写，并收紧为当前四个固定 Prompt。
- 工作台左上角从「返回卡包」改为「重新开始」：统一清除本轮步骤状态和持久化的 pack-progress，回到封面；唤起记录、浏览器历史和已创建的 YouNavi 对话保持不变。
- 审计补齐重置清理：`resetDriver` 现同时清空抓取引用、held item、拖拽坐标、投放目标、点击抑制与把手手势瞬态，避免重新开始后出现残留拖拽状态；文档同步删除已废弃的场景内拖拽副本和旧手部组件合同。

## 2026-08-19

- 修复 Driver 启动无音：原创合成启动音改为用户点击后立即播放；原创播报 `persona-driver-announcer-v2-expressive.m4a` 作为同源必需资源进入 `public/audio/`，不再依赖临时 8765 服务；加载失败才回退 TTS。
- 卡包状态持久化：记录已开启卡包、已揭晓卡片和已观看过场，刷新后恢复到卡包进度，已看过的角色过场不再重播。
- 顶部新增「检查状态」：一次只读短检查覆盖前期资料、卡片/腰带/双棒/浏览器音频的中间流程，以及 Navi Bridge/Skill/原始转写最终接入；不会创建真实对话。
- Bridge 与页面请求统一固定到 `127.0.0.1:8766`，避免 `localhost` 在本机解析到 IPv6 `::1` 而页面走 IPv4 时产生“已启动但不可连接”的假失败。

- 修复 Persona Driver 图层漂移：移除未提交的 `--belt-nudge` 百分比位移，腰带、人物卡、双棒、前景遮罩和发光层统一回到 `.driver-assembly` 的中心坐标。
- 清理已被替换的隐藏人体底片与 `.texture-driver-held` 旧样式；当前拖拽预览只由 `InteractionDragLayer` 负责。
- 组合框和投放引导增加视口宽度上限，修复窄屏父级最小宽度导致的横向裁切；封面英文说明增加安全换行。
- 回归测试新增防漂移约束：禁止 `belt-nudge`/人体底片复现，并锁定组合框的固定比例、前景覆盖和视口安全宽度。

- 新增右上角「唤起记录」：使用 `localStorage` 持久化本机 Persona Driver 启动摘要，支持状态回写、打开 YouNavi、Escape 关闭、空态与清空全部记录；最多保留 50 条，不保存正文或认证信息。

- 完成 Persona Driver 前端全量清洗：统一 `1672 / 941` 组合框与响应式外壳，腰带底图、卡片/双棒中层、腰带前景遮罩固定为三层叠加，卡片始终落在中央盒子内部。
- 拖拽坐标统一转换到 `.texture-driver` 本地空间并限制边界；投放命中读取同一 `.driver-assembly` 实际边界，修复不同分辨率下腰带与卡槽错位。
- 禁止所有图片原生拖拽，移除旧 sprite/layer/interaction-hands/held-object CSS 路径；拖拽预览结束或取消后立即回收。
- 增加渲染合同断言：固定组合框比例、三层 data-layer、绝对定位拖拽预览、无旧视觉选择器。

- Driver 元素图层拆分：腰带、人物卡、能量棒、技能棒和发光效果独立渲染，后续只替换单个元素贴图，不再重烘整条腰带。
- 以用户批准的腰带、青色能量棒和琥珀色技能棒元素图重新合成 23 张 Driver 帧；覆盖空载、插卡、单棒、双棒闭合和启动状态，统一 1024×1024 RGBA 画布。
- 四项本机 Markdown 预设已被用户指定的经典访谈原始 TXT 完整替换；页面默认全选四份，Bridge 改读 `PERSONA_NAVI_MATERIAL_ROOT` 并保持服务端 ID 白名单、绝对路径与 SHA-256 冻结。
- 首页切换为高保真贴图 Driver：腰带、能量棒和技能棒使用独立同源 PNG，人物卡沿用角色立绘；移除跟随指针的手持复制卡，修复拖动时卡片漂出工作台。
- 拖拽反馈调整为受控 `texture-driver-held` 贴图预览：跟随鼠标但限制在视口范围，松手/取消立即销毁，不触发浏览器原生图片拖拽。
- Persona Driver 网页运行时完全移除 Three.js、WebGL 与 GLB 加载，改为透明 PNG 逐帧系统；`three` 依赖已从 package 和 lockfile 删除。
- 新增 Blender 离线出帧脚本，生成空载腰带、8 帧插卡、两张单棒状态和 12 帧闭合/启动，共 23 张 1024×1024 RGBA 帧及 manifest。
- 原创 GLB 与拉丝材质降级为离线源资产；外部 `ryuki-rider` 包只完成结构评估，因缺少授权说明未复制进项目。
- Persona Driver 中央场景从悬浮腰带升级为完整人物载体：删除球体和圆柱拼接的人形，改用包含真实五官、头颈、肩胸、手臂与腰胯的透明写实人物底片，Three.js 腰带叠在真实腰部位置。
- 新增桌面双手交互：原创装甲手套跟随鼠标左右切换，按住人物卡、指令卡、资料和两根棒时切换抓握态并携带真实物件，正确槽位松手才装载。
- 两根棒装载后双手自动对齐腰带把手，并与把手进度同步合拢；触控、键盘、低动态和窄屏继续使用原按钮路径。
- Persona Driver 材质升级：新增自有拉丝枪灰贴图，运行时叠加碳纤维、微法线、粗糙度和工作室反射；移除外部环境几何依赖，材质资产全部同源加载。
- 能量棒与技能棒改为两件独立拖拽耗材：人物卡锁定后从底部收纳架分别装入左右插座，单棒状态显示 1/2，双棒齐备后才开放闭合、启动与 Navi Run；点击保留为无拖拽回退。
- 修复假文件名导致 Navi 扩大目录搜索：新增四份真实 Markdown 预设，Bridge 服务端按素材 ID 解析绝对路径与 SHA-256，并在 Prompt 中禁止 `find`、目录遍历和扫描 `/Users`。
- YouNavi 的终态实际返回 `finished`；Bridge 已将其映射为 completed。Steve Jobs + REVIEW 实测读取三份预设并把完整回复收回页面。
- Persona Driver 接入四件原创模块化 GLB：精细腰带本体、独立人物卡、青色能量棒与琥珀色技能棒；保留程序化几何作为加载失败回退，并把插卡与双棒闭合映射到既有 phase/handleProgress。
- 本机 Bridge 的四项演示素材升级为服务端固定预设文件：只接受素材 ID，读取精确 Markdown 路径并冻结 SHA-256；同步补齐临时预设测试。
- 五张卡牌的首次揭晓接入 4 秒动态出场立绘；出场层播放人物大动作、激烈运镜和粒子冲击，结束后缩回目标卡位并翻卡。
- 动态出场支持跳过、Escape、视频失败降级和 reduced-motion 静态直出；五张视频与匹配首帧海报作为本地静态资产随站点发布。
- 新增本机 `Persona Navi Bridge`：启动 Driver 后先唤起 YouNavi，再显式激活人物 Skill，创建独立 task/conversation 并保存幂等回执。
- 五张人物卡对齐真实 Skill 名称与固定源提交；完整 Skill 已迁入 YouNavi 用户目录，Bridge 逐次校验 SKILL.md name 与 SHA-256。
- 角色实例面板新增 Navi 创建、入队、执行、完成、失败状态，支持检查结果、重新打开 YouNavi 和失败后重新创建。
- Bridge 只监听 localhost，使用 Origin/Fetch Metadata/进程随机 token、persona/command 白名单、请求限额和 `execFile` 数组参数；公开 Sites 保持演示模式。
- `chat send` 前先打开 YouNavi 并等待后端认证就绪；请求已落盘但无回执时失败关闭，避免重试重复创建 conversation。
- Three.js resize 改为 animation-frame 合并并跳过相同尺寸，避免角色面板变化触发 ResizeObserver 开发错误浮层。
- 在左右机械把手之外恢复卡片锁定态的「启动 Persona Driver」主按钮；拖拽体验不再替代唯一主操作。
- 增加仅限本机开发的 Driver 启动音覆盖：点击启动按钮时从本地 16 段候选随机播放一段，避免连续重复；候选不打包、不发布，服务不可用时回退原创合成音。
- 本机启动音改为三段串行播报：固定同音色角色卡名、固定同音色英文指令、未经变调变速的随机候选；Donald 卡使用完整播报名 `Donald John Trump`。
- 根页面新增 Three.js Persona Driver 工作台，3D 只负责中央变身器，素材、卡片和角色结果继续使用 DOM。
- Driver v1 支持待机呼吸、卡片插入锁定、核心旋转与红色能量灯、原创合成音和 `PERSONA RIDE` 系统语音。
- 增加解释、评审、决策、行动四类指令卡和五张公开人物 Skill 卡；旧图鉴入口已归档删除。
- 增加 WebGL 2 能力检测、静态回退、动态加载、页面隐藏暂停和渲染资源清理。
- Driver 音效升级为原创多层 Web Audio 序列：选卡、指令确认、插卡、扫描、升频、冲击和系统 TTS 播报；新增静音开关。
- 人物卡固定为纳瓦尔、埃隆·马斯克、史蒂夫·乔布斯、唐纳德·特朗普和 Paul Graham 五个公开 Skill。
- 首页主按钮后新增二选一分流：「打开卡包」直接进入固定卡组，「构建卡片」进入原模拟构建流程。
- 「打开卡包」新增密封卡包震动开启、五张卡牌依次发出、逐张点击翻面和全部收下的完整交互。
- 为固定五人生成并接入原创漫画特摄角色立绘，覆盖开包揭晓、首卡解锁和图鉴卡面。
- Persona Driver 首页人物卡盒同步换为五张角色立绘，移除字母与几何人形占位。
- 新建公开 Sites 项目，发布既有人物图鉴交互 Demo。
- 产品名统一为「假面骑事」。
- 访问策略确定为所有人可见，仅供测试。
- 增加公开测试版页面元数据与分享封面。
- 明确站点不接真实飞书、不上传文件、不持久化访客数据。
- 首页替换为用户指定的黑银红三人物卡主视觉，移除图片内旧标题，保留 HTML 实时文案。
- 删除可视化导出器生成的内层 iframe，页面状态改用 `100dvh` 动态高度，修复高屏幕底部漏白。
- 完成 1440×900 桌面与 390×844 移动端真实浏览器验收。
# 2026-08-19

- 收敛首页首屏：删除原始素材选择、指令卡选择和任务输入等非主路径 UI，只保留固定五人卡盒、中央贴图 Driver、两根变身棒和角色实例结果。
- 移除模型人物背景层及其错误素材 `public/persona-body/carrier-human.png`；Driver 继续只使用批准的二维贴图。
- 拖拽投放槽位收敛为人物卡、能量棒、技能棒三类，并同步删除无用的资料/指令投放提示与音效入口。
# 2026-08-20

- 人物详情半窗删除资料、状态、Skill、编辑、插卡、播报与新建入口，只保留人物动画播放和立绘放大；两者使用可关闭 lightbox，Escape/遮罩关闭且焦点恢复。
- male/female 模板收敛为一个通用空位卡：工作台与管理页都复用标准 `PersonaCardFace`；点击/Enter 进入同一 creating 流程，旧模板缓存过滤后只显示一个空位。

- 首页布局改为“左侧变身组件 + 中央 Driver + 选卡后右侧人物简介”；未选卡时不渲染角色属性面板。
- 能量棒/技能棒从底部卡盒移到左侧组件区，能量棒贴图改为独立可见、垂直对齐左右插槽，避免被前景层遮挡或只露出细条。
- 模型人物背景层强制隐藏，中央继续只显示二维腰带与角色卡贴图。
# 2026-08-20

- 修复启动后 `startedAt is not defined` 导致的 Unhandled Promise Rejection：恢复 `startNaviConversation` 的启动时间戳，并完成实际启动回归。
# 2026-08-20

- 统一人物卡与变身棒的抓取模型：来源按钮只发起 Pointer Capture，`InteractionDragLayer` 作为页面级最上层渲染层跟随指针，中央槽位只负责命中与落位。
- 抓取中的来源卡会降透明并下沉，浮层使用原卡立绘或原棒贴图；同一套状态覆盖点击、桌面拖拽和正确槽位投放。
# 2026-08-20

- 两根变身棒改为与人物卡一致的垂直插入语法：装配时从左右槽位上方直落，不再斜向漂浮。
- 根据能量棒/技能棒 PNG 的大面积横向透明留白，将贴图承载框从 `6.2%` 扩至 `16%`，使实际可见实体与插槽宽度匹配；最终约占插槽可用高度的三分之二。
# 2026-08-20

- 左侧两根棒升级为“先注入、后装配”：点击能量棒选择一篇原始转写并充能，点击技能棒选择提问预设并写入；只有已注入的棒能在人物卡锁定后被抓起和拖入腰带。
- 将旧侧栏的四篇原始素材和指令卡信息迁入两个浮窗，避免常驻占据工作台。
+ Bridge 命令白名单继续由服务端 manifest 补全解释、评审、决策、行动四个固定 Prompt。
## 2026-08-20

- 接入 `PersonaCardEditor`：卡盒提供「建立卡片 / 空卡」入口，自建卡维持 unmapped Skill 安全边界。
+ 接入 RodInjectorPanel：能量棒支持本地 MD/TXT，技能棒展示真实四项固定 Prompt 和 custom 编辑。
- 页面状态迁移为双 `RodState`，固定素材/预设兼容走 v1；文档或 custom Prompt 走 v2，并在 v2 前检查文档、Prompt 与 Skill 映射。
- Bridge body 上限调整为 `4.125 MiB` 有界 JSON envelope，新增最大 v2 文档 envelope 测试；页面增加 task/conversation 可观测状态与自动轮询。
