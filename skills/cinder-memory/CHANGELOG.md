---
title: CHANGELOG
type: note
permalink: cinder/cortex/memory-system/code/cinder-memory/changelog
---

# Cinder Memory YouNavi Plugin · CHANGELOG

## 2026-08-05 v0.4.2

- `SKILL.md` 删除无效 `allowed-tools`，把触发描述收成 YouNavi frontmatter 解析器可完整保留的一行；
  仓内 `permalink` 由知识库索引器维护且不参与运行，公开日常入口仍只有“启动即自动捕获”。
- 晚报冻结前改为通过当前认证用户的本机 API 扫描全部 conversation，不按 `updated_at` 预筛；跨日会话
  按目标日已完成 assistant 及其最近 user 选取。列表不完整、详情 ID 不匹配、任一详情失败或约 200 秒
  超时时，模型零调用并记录 hook 失败健康状态。
- 快照覆盖按真实 `updated_at` 单调推进，同时间点优先真实任务快照；延迟 API 补扫不能把普通 hook
  已保存的新回答写旧。晚报输入在文件锁内冻结全部快照正文，避免并发覆盖产生混合版本。
- 历史采集先冻结会话、文件、录音和音频转写的全来源队列；逐项落盘后推进 cursor，约 180 秒主动暂停，
  后续完成事件从原队列继续。文本资料读取失败不再静默降级为 metadata-only，任一来源失败均停止提炼。
- 精确去重按真实时间点选择最新项；只排除生成的 conversation role 包装，普通文件和正文中的字面
  `[user]` 保持原样。Cinder 自己生成的提取会话不再回灌历史。
- 历史 `plan_id` 绑定批次 hash、完整 prompt/body token 估算、来源、日期和 primary 来源，启动及补试前
  重新校验。首次和每次继续最多授权 4 批；状态公开预计输入量和含一次补试的最坏预计输入量，不宣称
  无法由插件硬限制的输出或总 token 上限。
- 日常和历史长期记忆只接受原始 conversation 或完整文本作为 primary evidence；晚报、metadata-only、
  可疑指令、凭证和冲突只能形成 digest、待确认项或失败，不能静默写入长期记忆。
- `capture-health.json` 新增最近事件状态、连续失败数、累计失败数和脱敏后的最近失败记录；CLI 不再接受
  `--user-dir`，普通 `YOUNAVI_USER_*` 环境变量也不能改写安装路径推导出的用户数据根。
- 用户同意首次回填时必须明确告知“每次最多 4 批”和 `awaiting_continuation` 的继续方式；异步 hook
  stdout 不作为用户通知通道，不能把暂停状态静默藏在运行日志里。
- 启动的 hook 配置或回读失败时禁止调用历史 `prompt`；停止前若仍有日常或历史在途状态则保留 hook，
  避免一次性询问被提前消费或已付费模型结果无人应用。
- hook 在读取任何 YouNavi 资料前强绑定安装目录、payload、hook 环境、工作目录和认证 token 的 username；
  账号切换或环境错配直接失败关闭。对外发布包排除 `tests/`、`__pycache__` 和 `.pyc`。
- 回归测试增至 113 项，新增用户隔离、API 畸形响应、跨午夜补齐、扫描超时、全来源断点、批次篡改、
  授权边界、真实时间去重、非 primary 来源和可疑证据隔离覆盖。

## 2026-08-05 v0.4.1

- frontmatter 显式覆盖“上一条正在询问历史抓取时的可以/要/不要”上下文，让首次固定
  询问后的简短回答能重新触发 Skill，又不把其他会话中的普通“可以”视为授权。
- 普通任务最短时长门槛降为 0；UTC 消息按本地日期归档，有时间戳但目标日无消息时不再误收整段会话。
- 会话与晚报原始证据在 5,000,000 字符内完整保存，超限明确失败；模型输入仍限制约 8,000 tokens。
  `incoming/` 从普通 `search/read/expand` 完全隔离，提取来源白名单只认模型实际看到的文件。
- 晚报改为先按日期原子认领、再冻结证据；失败状态同日不自动重发。完成事件增加
  `triggered → applying → applied/failed` 原子认领，阻断并发、重复和迟到旧事件二次应用。
- 日常 `triggered` 超过 6 小时只读取原登记 conversation 对账，完整结果才补应用；不完整或读取失败就
  失败关闭，不另发模型任务。`applying` 超过 30 分钟因无法排除部分写入而失败关闭。
- 日常初次提炼和无效输出补试的 `launching` 模糊窗口改为超时即失败关闭；模型任务可能已创建但尚未
  登记 ID 时不再自动重发，避免重复 token 和重复结果。
- 历史回填补抓 `/file/audio-transcriptions`；采集、启动、运行与应用阶段均有租约。`running` 超时只
  对账原登记 conversation，不再盲目重发；失败、重复与旧完成事件均有界且可见。日常与历史租约
  都把超过 5 分钟的未来时间戳视为异常，防止时钟回拨后队列永久卡住。
- 历史逐会话读取只要有一项失败，仍先写含成功材料与 `failures` 的 manifest，但不建批、不调用模型；
  后续 hook 不自动重扫，只有用户再次明确 accept 才重新开始。历史 `launching` 超时也不再退回队列重发。
- 遗忘后同步重建 `MEMORY.md` 与 `memory_summary.md`。历史去重仍严格限定为规范化完整正文 SHA-256
  完全相同，材料内部重复字段和重复行不删除。
- 回归测试增至 86 项，覆盖 500 会话输入裁剪、5M 边界、并发完成、应用退出、租约过期/时钟异常、旧任务迟到、
  音频转写兼容、历史部分读取失败和 launching fail-closed。

## 2026-08-05 v0.4.0

- 收紧公开 Skill 契约：日常记忆只由任务完成自动捕获和晚报提炼产生；移除“记住/帮我记一下”触发词
  与手动新增记忆示例。底层 `remember` 仅保留给确定性提炼落盘和用户确认后的已有记忆纠错。
- 首次成功启动后新增一次性固定询问：“新的一启动，要不要把你以往的内容进行一次快速的抓取和提炼？”。
  询问状态持久化，重复启动不再重复询问；拒绝后可由“补抓历史记忆”重新授权。
- 新增 `scripts/history_bootstrap.py`：只通过 YouNavi 注入的本机 API 读取当前用户全部历史会话（含归档）、
  文件和录音，不修改 YouNavi 源码，不记录认证 token。
- 历史材料在任何模型调用前先完成全局精确去重：仅规范化 NUL/换行和移除会话 role 字段前缀，按正文
  SHA-256 判重，同正文保留更新时间最新项；没有评分、语义近似、优先级淘汰或正文截断。
- 唯一材料、重复映射和失败项写入 `incoming/history-bootstrap/manifest.json`；唯一正文无损切成约 6K-token
  材料批次，使用 `source=cinder_memory_history_extract` 串行提炼，同一时刻只运行一批。
- 历史批次按来源白名单和原材料日期应用到既有 digest/memory/inbox；无效输出补试一次，状态持久化在
  `.state/history-bootstrap.json`。重复 hook 事件用 `launching/running` 原子 claim 阻止重复启动。
- hook 超时由 60 秒提高至 300 秒，为首次本机历史扫描预留时间；日常晚报与捕获行为不变。
- 回归测试由 43 项增至 53 项，覆盖固定文案、一次性询问、接受/拒绝、三类来源、纯精确去重、无损
  分批、完整提示预算、并发启动 claim、串行应用和来源日期。

## 2026-08-05 v0.3.2

- 把公开 `SKILL.md` 从 190 行 / 414 词精简为 115 行 / 248 词；删除“仅初始化”、手动 candidate capture、
  inbox 整理和 `expand` 示例，启动后固定走自动捕获与晚报提取。
- 公开操作面收敛为启动、状态、回忆、明确记住/纠正、确认遗忘和停止；状态同时检查数据、最近提取
  结果和 hook 是否实际启用。
- `search` 不再返回随记忆量线性增长的完整 `MEMORY.md`，只返回最多 20 条的摘要导航和有界候选；
  正文仍按命中路径二次读取。
- 晚报提取从 report task ID 幂等改为日期幂等；同日不同晚报任务不会重复提取，失败状态可重新 claim。
- 无效 JSON 或计划校验失败自动补试一次，第二次失败停止并留下可见状态；提取任务创建失败也保留
  `failed` 状态。
- 证据归日优先使用已完成 assistant 消息时间，降低跨午夜完成时写入错误日期的概率。
- 新增本地凭证硬过滤：常见 token、私钥和密码/API key 赋值不进入长期记忆或 inbox，明确 remember
  同样拒绝。
- 回归测试由 37 项增至 43 项，新增按日幂等、失败重试上限、跨午夜日期、搜索上下文和凭证过滤覆盖。

## 2026-08-05 v0.3.1

- 主启动口令收敛为 `/cinder-memory 启动`。
- 兼容 `开始`、`开启`、`开始记忆`、`开启记忆`、`启动记忆` 与 `启动自动记忆`；所有入口共享同一
  幂等 hook 安装流程。
- 扩大 Skill 触发描述，覆盖自动记忆、长期记忆、个人知识库、保存偏好、历史回忆、人物/项目背景、
  整理、审查与遗忘等自然语言表达。
- 保留授权边界：询问功能、状态或用法不自动启用 hook；数据目录和 v0.3 schema 均不改变。

## 2026-08-04 v0.3.0

- 数据流升级为 `incoming → extraction JSON → digests/memory/inbox`：完整晚报、每日 conversation
  快照与 manifest 保留为原始证据，长期记忆改为带 frontmatter 的原子 Markdown。
- 晚报触发一个 `source=cinder_memory_extract` 无工具任务，最多输入约 8,000 tokens，其中晚报最多约
  2,000 tokens；模型只生成 schema v1 计划，文件写入与索引重建由本地脚本确定性完成。
- 新增来源白名单、提取任务登记、计划 hash 幂等、稳定 `canonical_key`、类型、标签、实体、来源日期、
  状态、置信度和内容 hash。
- 晚报单源只可生成 digest；自动长期记忆还必须是 high confidence、引用原始 conversation 证据且
  不含可疑指令。报告单源、低置信和冲突候选进入 inbox，不静默覆盖。
- 回忆改为 `search → read` 两阶段渐进展开；首步只返回 `memory_summary.md`、`MEMORY.md` 和候选元数据，
  第二步才读取命中的 1–3 个正文。`expand` 保留兼容。
- 新数据写入 `memory/<category>/`；v0.1/v0.2 根级分类、`sessions/` 和 `.consolidation/` 只读兼容，
  升级不删除旧数据。
- 回归测试增至 37 项，覆盖结构化计划应用、来源拒绝、token 预算、提取递归阻断和两阶段回忆。

## 2026-08-04 v0.2.0

- 自动捕获从“每个 task 追加一轮 inbox”改为“每个 conversation 每天覆盖一份 session 快照”。
- 普通回忆不搜索 `sessions/`，避免原始会话反复进入模型上下文。
- 绑定 YouNavi 晚报：`source=evening_report` 完成后生成有界提炼包，并 one-shot 发起
  `/cinder-memory 提炼今日记忆 YYYY-MM-DD`。
- 提炼任务使用 `source=cinder_memory`，其完成 hook 直接跳过；晚报 task 使用持久状态幂等，启动失败可重试。
- 晚报正文预算收紧为 4,000 字符，提炼包总预算收紧为 16,000 字符；剩余预算由当天 sessions
  公平共享，推断、冲突与低置信内容继续进入 inbox。
- hook 超时从 30 秒提高到 60 秒，为 conversation 读取、提炼包写入和 one-shot 创建预留时间。
- 补充 v0.1.2 升级路径：同名导入不会覆盖，需停旧 hook、卸载旧 Skill、导入新版后重新开始记忆；
  cognition 数据原样保留。

## 2026-08-04 v0.1.2

- 分发目录从 `younavi-memory-plugin/` 统一为 `cinder-memory/`，与 Skill 名和导入后的目录名一致。
- 同步 README、INTERFACE、ROLLBACK、迁移说明、架构引用和测试命令；运行时数据路径与 schema 不变。
- 记录 session 级捕获评估：该版本仍保留逐任务 inbox 捕获，后续由 v0.2.0 改变记忆语义。

## 2026-08-04 v0.1.1

- 首次使用收敛为 `/cinder-memory 开始记忆`：一次完成目录初始化、hook 合并和回读校验。
- “开始记忆”本身视为自动捕获授权，不再要求第二次确认；配置失败不得假报开启成功。
- 重复开始幂等，不重复添加 hook；新增“仅初始化”和“停止自动捕获”口令。
- hook 模板由启动流程用当前 `${SKILL_DIR}` 解析为绝对路径，外部用户不再填写 username 或路径。

## 2026-08-03 v0.1.0

- 首个外置 YouNavi Skill 版本，不修改 YouNavi 源码。
- 用户 Markdown 真源：profile/preferences/people/projects/references/inbox/archive。
- 自动生成轻量 `MEMORY.md`，按问题逐层展开匹配文件。
- 明确记忆直接分类沉淀；AI 推断与可选 hook 只进入 inbox。
- source + 内容哈希幂等，原子写和跨进程锁。
- forget 与 inbox 归档均要求 confirmed=true，且只做可恢复移动。
- 可选 task.completed hook 自动捕获最后一轮对话，不调用 LLM、无递归任务。
- JSON request-file 协议避免用户文本进入 shell 命令。
- 拒绝符号链接目录、文件和请求，防止记忆目录内的链接越过当前用户边界。
- 修复嵌套分类文件未进入 `MEMORY.md` 的问题，并补强中文连续词检索。
- 22 项标准库回归测试覆盖文件协议、中文展开、路径边界和自动捕获。
- 自动捕获默认关闭；新增通过 `hook-author` 确认后合并配置的一句式启用入口。
