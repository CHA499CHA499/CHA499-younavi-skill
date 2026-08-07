---
title: INTERFACE
type: note
permalink: cinder/cortex/memory-system/code/cinder-memory/interface
---

# Cinder Memory YouNavi Plugin · INTERFACE

## 安装契约

插件是一个标准 YouNavi Skill 目录：分发目录名、`SKILL.md` 的 `name` 和导入后的目录名均为
`cinder-memory`。根目录有 `SKILL.md`，附属 `scripts/` 与 `hooks/` 会被 YouNavi Skill importer
一起复制。源代码仓不需要任何修改。

所有公开 CLI 与 hook 都从已安装脚本路径向上查找 `skills/`，其父目录即当前 YouNavi 用户目录；
数据根固定为该目录下的 `cognition/cinder-memory/`。不接受 `--user-dir`，也不接受
`YOUNAVI_USER_DIR`、`YOUNAVI_USER_WORK_DIR` 等环境变量覆盖数据根。

当前 YouNavi importer 会把外部 frontmatter 规范化为 `name/description/version`，并复制全部附属文件；
源 `SKILL.md` 按项目发布规范保留 `exposure: on-trigger`，导入器不会原样保留该字段。实际触发依赖
导入后保留的 description 与显式斜杠口令，脚本和 hook 行为不依赖被规范化掉的字段。

## 启停契约

| 口令 | 结果 |
|---|---|
| `/cinder-memory 启动` | 初始化数据目录，并幂等启用一个 `task.completed` 自动捕获 hook |
| `开始 / 开启 / 开始记忆 / 开启记忆 / 启动记忆 / 启动自动记忆` | 与“启动”相同；必须处于 cinder-memory Skill 上下文 |
| `/cinder-memory 查看状态` | 读取数据统计和最近提取状态，并只读核验自动 hook 是否存在且唯一 |
| `/cinder-memory 停止自动捕获` | 无在途提取时只移除本插件 hook；有在途工作则失败关闭并要求终态后重试 |

“启动”及上述同义表达是自动捕获的显式授权，不再二次确认；仅询问功能、状态或用法不是授权。
hook 配置必须经 `GET /ai/option`、合并、`PUT /ai/option`、回读校验四步完成；重复启动不得创建
重复 hook，重复停止不得报错。配置失败时目录可以保留，但调用方不得宣称自动捕获已开启，也不得调用
`history_bootstrap.py prompt`。同一 `script_path` 已存在时必须原位更新为当前模板并去重，保证旧版 hook
能升级为当前 v0.4.4 的 300 秒 hook。

首次成功启动还必须运行 `history_bootstrap.py prompt`。只有首次返回 `ask=true` 时才逐字展示固定询问；
重复启动、已拒绝、处理中或已完成均不得重复询问。肯定回答调用 `accept`，拒绝调用 `decline`；
`accept` 只写授权状态，实际历史扫描在该任务完成后的已授权 hook 内启动。

停止前必须同时读取日常与历史状态。日常 `launching/triggered/applying` 或历史
`collecting/prepared/extracting` 均视为在途；此时保留 hook 并明确要求进入终态后重试。只有无在途状态时
才允许通过 Option API 移除 hook，避免已创建的模型任务完成后无人应用。

## 读写路径

| 路径 | 行为 |
|---|---|
| `<user>/skills/cinder-memory/` | 插件代码，只读运行 |
| `<user>/cognition/cinder-memory/` | 当前用户记忆真源，读写 |
| `<user>/cognition/cinder-memory/.requests/` | 单次 JSON 请求，读取后立即删除 |
| `<user>/cognition/cinder-memory/incoming/YYYY-MM-DD/` | manifest、每 conversation 日快照、完整晚报和有界提取输入；不参与普通回忆 |
| `<user>/cognition/cinder-memory/incoming/history-bootstrap/` | 首次回填唯一原材料、精确重复映射与抓取失败账本；不参与普通回忆 |
| `<user>/cognition/cinder-memory/digests/` | 每日机器摘要；由结构化计划确定性生成，不是长期记忆真源 |
| `<user>/cognition/cinder-memory/memory/<category>/` | 带类型、标签、实体、来源和稳定键的长期原子记忆 |
| `<user>/cognition/cinder-memory/inbox/` | 低置信、报告单源、冲突或需人工确认的候选 |
| `<user>/cognition/cinder-memory/.state/consolidation/` | 晚报触发、提取任务和应用结果状态 |
| `<user>/cognition/cinder-memory/.state/applied/` | 已应用结构化计划的幂等记录 |
| `<user>/cognition/cinder-memory/.state/history-bootstrap.json` | 首次询问、抓取统计、批次队列、失败/完成状态与终态回执状态 |
| `<user>/cognition/cinder-memory/.state/history-bootstrap/batches/` | 无损切分后的有界历史提取输入 |
| `<user>/cognition/cinder-memory/.state/history-bootstrap/collection/` | 冻结的全来源队列、逐项结果和断点 cursor |
| `<user>/cognition/cinder-memory/.state/capture-health.json` | 最近 hook 成败、聚合错误 ID/次数、退避截止时间和累计失败数 |
| `<user>/cognition/cinder-memory/.write.lock` | 跨进程写锁 |
| `<user>/cognition/cinder-memory/{profile,...,sessions,.consolidation}/` | v0.1/v0.2 只读兼容数据；不删除，不再写新数据 |
| 其他 username / YouNavi 源码仓 | 不读取、不写入 |

## CLI

```text
memory_fs.py init
memory_fs.py status
memory_fs.py list
memory_fs.py pending
memory_fs.py reindex
memory_fs.py incoming --date YYYY-MM-DD
memory_fs.py request --file PATH
history_bootstrap.py prompt
history_bootstrap.py status
history_bootstrap.py accept
history_bootstrap.py decline
history_bootstrap.py run
```

`sessions --date` 和 `consolidation --date` 仅为 v0.2 调用方保留，分别映射到 `incoming` 列表与
`extraction-input.md`；新调用方不得依赖这两个旧名字。

公开 CLI stdout 始终为一行 JSON：成功 `{success:true,data:...}`，失败
`{success:false,error:"..."}`；CLI 失败时退出码为 1。异步 hook 的宿主输出固定为小型 JSON 摘要；处理
失败已经写入 capture health，因此 hook 返回退出码 0，避免 YouNavi 对同一外部故障重复写 warning。

`request` 只接受位于当前数据根 `.requests/` 下、最大 1MB 的 `.json` 文件。动作：

| action | 必填 | 副作用 |
|---|---|---|
| `search` | query | 只读，返回有界 `memory_summary.md` 和候选元数据；不返回完整 `MEMORY.md` 或正文 |
| `read` | paths | 只读，只返回 `memory/` 或旧分类中明确指定的 Markdown；不读 inbox |
| `expand` | query | v0.2 兼容；一次完成 search + read |
| `capture` | title/content/source | v0.1/v0.2 兼容；幂等追加到当日 inbox，不是公开日常流程 |
| `remember` | category/slug/title/content/source | 内部提炼落盘或确认纠错；不作为主动用户入口，稳定键冲突时拒绝覆盖 |
| `pending` | - | 维护/兼容接口；只读全部 inbox |
| `list` | - | 只读文件列表 |
| `reindex` | - | 重建派生 `MEMORY.md` 和 `memory_summary.md` |
| `forget` | path/confirmed=true | 移到 archive/forgotten，不删除 |
| `archive_inbox` | date/confirmed=true | 移到 archive/inbox |

分类固定为 `profile/preferences/people/projects/references`。新记忆写在 `memory/<category>/`；所有内容
写入必须有非空 source。普通回忆必须优先 `search`，确认候选相关后再 `read` 1–3 个文件。
日常新增记忆只允许来自已启用 hook 的晚报提炼；公开 Skill 不得把“记住/帮我记一下”映射为直接
`remember` 请求。用户确认纠正已有记忆时可调用该内部动作。
`status` 还返回 `memory_files`、`latest_extraction` 与 `capture_health`；hook 是否启用不在文件系统
脚本内推断，必须通过 YouNavi `GET /ai/option` 只读核验。

历史 CLI 的 stdout 同样是一行 JSON。`prompt` 只在首次建状态时返回 `ask=true`；`accept/decline` 幂等
记录决定；一次 `accept` 授权本次冻结出的全部历史批次在后台串行完成；`run` 供 hook 或故障恢复使用，要求 YouNavi
注入 `YOUNAVI_AGENT_CLI`、`YOUNAVI_API_BASE_URL` 和 `YOUNAVI_AUTH_TOKEN_FILE`，不得由用户手填 token。

## 首次历史回填契约

读取范围固定为当前认证用户的 `GET /ai/chat/conversations?include_archived=true`、逐会话
`GET /ai/chat/conversation/{id}?include_messages=true`、`GET /ai/file/all`、
`GET /ai/file/recordings`（404 时兼容 `local-recordings`）和 `GET /ai/file/audio-transcriptions`
（旧版 404 时视为无此来源）。本机 HTTP 地址必须为 loopback；认证文件只在进程内读取，不进入
stdout、状态、manifest 或错误正文。

去重契约只有三步：NUL 换空格、CRLF/CR 换 LF、序列化会话时不把生成的 role 包装计入 hash；正文中
用户原有的 `[user]` 等字面文本不得删除。随后对完整正文做 SHA-256，同 hash 按实际时间点保留
`updated_at` 较新的项；正文为空时才以 source+title 判重。禁止
评分、语义相似度、优先级、数量上限、字符上限、按日期筛选或转写优先淘汰。`manifest.json` 必须记录
`scanned/unique/duplicates_removed/failures/materials/duplicates`。

会话、文件、录音和音频转写列表先冻结成一份带 hash 的队列；Cinder 自己生成的内部提取会话不回灌。
每项结果落盘后才推进 cursor，单次最多运行约 180 秒；超时进入 `collection_paused`，由下一次已完成
YouNavi 任务继续，不重拉列表。插件没有独立后台调度器，因此用户长期不再产生任务时暂停队列不会自行
唤醒。任一应读资料失败时，必须先把成功材料与全部 `failures` 写入 manifest，再置为 `failed`；不得
生成批次或调用模型。只有用户再次明确执行 `accept` 才能开始新的完整扫描。

文本文件仅在由安装位置确定的当前用户目录内按完整正文读取；二进制或目录外文件保存 metadata-only，
不额外执行 ASR、OCR 或格式解析。去重结束后才允许生成批次；切分必须覆盖每一个字符且不改变原始
material。原始会话和完整文本可支撑高置信长期记忆；晚报与 metadata-only 只可生成 digest 或待确认项。
每批材料预计输入正文最多约 60,000 tokens、完整 prompt 不超过约 64,000，使用
`source=cinder_memory_history_extract` 串行运行；一次同意后处理全部冻结批次，不再增加人工续批口令。状态同时保存 `plan_id`、
预计输入量和含一次补试的最坏预计输入量；这是输入估算，不是含输出的总 token 上限。批次正文 hash、
来源白名单、来源日期、primary 来源和 token 估算都必须与 `plan_id` 一致，启动和补试前重新核验。
`launching` 原子 claim 防止重复 hook 事件并发启动相同批次；该阶段超时无法排除任务已创建，必须失败
关闭且不得重发。批次模型输出失败最多补试一次；`running` 超过 6 小时只读取原登记 conversation 对账，
不能仅凭超时重发；`applying` 超时失败关闭。
各阶段租约容忍 5 分钟时钟偏差；超出该范围的未来时间戳按异常租约处理。

## 自动 hook

`hooks/auto_capture.py` 接受 `task.completed` HookPayload，通过 YouNavi 注入的
`YOUNAVI_AGENT_CLI` 获取完整 conversation，并以 conversation `source` 分流：

| source | 行为 |
|---|---|
| `cinder_memory` | 跳过，兼容并阻断 v0.2 提炼任务递归 |
| `cinder_memory_extract` | 只接受已登记的提取 conversation；解析最终 JSON，校验并本地应用，不再创建任务 |
| `cinder_memory_history_extract` | 应用已登记历史批次；成功后串行启动下一批，失败最多补试一次 |
| `cinder_memory_history_notice` | 直接跳过；这是终态可见回执，不保存为证据、不提炼、不再次通知 |
| `evening_report` | 保存完整晚报，合并当日原始证据为有界输入，并创建一次 `source=cinder_memory_extract` 任务 |
| 其他 | 覆盖 `incoming/YYYY-MM-DD/conversation-*.md`；同一 conversation 当天只有一个快照 |

单份会话快照和完整晚报各最多 5,000,000 字符，超限明确失败；hook 不做首尾裁剪。完整证据原样留在
`incoming/`；发给模型的
`extraction-input.md` 按本地保守估算最多约 8,000 tokens，其中晚报最多约 2,000 tokens，剩余预算
在会话快照间均分。模型任务不调用工具，只返回 schema v1 JSON；白天捕获、裁剪、计划校验、写入、
去重、冲突判断和索引重建均不调用模型。普通 `search` / `expand` 不搜索 incoming 或 digests。

普通任务优先使用对应 assistant 消息的完成日期，缺失时才退回 hook 事件、conversation 更新时间或
当前日期，避免跨午夜误归档。晚报先按日期原子认领，再通过当前认证用户的本机 API 完整扫描会话列表；
所有详情必须可读且在约 200 秒预算内完成，才冻结提取输入并启动模型。该补齐覆盖异步 hook 逆序；
跨日更新的 conversation 仍按消息日期选取，不用 `updated_at` 预先排除。同日不同 report task 不能改写
已发任务的证据。补扫覆盖按实际 `updated_at` 单调推进，同时间点优先真实任务快照；晚报输入在文件锁
内冻结全部快照正文，延迟 API 结果不得覆盖或混入更新证据。完成事件必须以登记的 conversation 和完全相同的 task ID 原子执行
`triggered → applying → applied/failed`；并发、重复和迟到旧事件不能二次应用。无效 JSON 或计划校验
失败最多创建一次补试任务；第二次失败或 `agent-cli chat send` 创建失败保留 `failed`，同日晚报事件
不得重新 claim。初次或补试的 `launching` 超时都直接失败关闭，不重新创建模型任务。`triggered` 超过
6 小时后，下一个 hook 最多对账三项登记 conversation：完整回复可补
应用，其余失败关闭，不创建新模型任务。`applying` 超过 30 分钟因无法排除部分写入而失败关闭。完整
计划以内容 hash 记录到 `.state/applied/`。当前事件捕获失败也不得阻止这次过期对账；hook 将失败写入
capture health 并向宿主返回固定小摘要，不影响原任务。

历史状态进入 `completed` 或 `failed` 后，hook 必须调用现有 `agent-cli chat send`
创建一次 `task_type=simple_chat`、`source=cinder_memory_history_notice` 的可见 conversation。发送前以状态
hash 原子 claim；已 `sent/failed` 或仍在有效 `launching` 的同一 key 不再发送。模糊超时按失败关闭，
不得自动重试。`history_bootstrap.py status` 暴露通知状态、task ID、conversation ID 或脱敏错误，但通知失败
不得改写已经成立的历史提炼终态。当前外部插件没有零 token Toast API，因此该回执会产生一次小模型回复。

所有 `agent-cli` stdout/stderr 分别限制为 4,000,000/64,000 字节；超过时终止子进程，不解析或持久化超限
正文。所有外部错误在进入状态或 hook stdout 前必须脱敏、单行化、截到 480 字符并附稳定 `error_id`。
capture health 对同一错误聚合 `occurrences`；连续失败 3 次后开启 5 分钟起步、最长 6 小时的退避，成功
后清除。退避只跳过普通捕获；晚报及日常/历史提取完成事件仍要处理，避免丢失已付费结果。不能依赖
HookPayload 必有 `task_source`：当前宿主可能省略该字段，此时必须先校验用户身份，再读取并复用一次
conversation source 做退避分流。

结构化计划的本地应用规则：

- digest 必须引用当日 manifest 白名单中的来源；晚报单源可以生成 digest。
- 日常自动长期记忆必须为 `confidence=high`、至少引用一份 `conversation-*.md` 原始证据，且内容不含
  可疑指令模式；历史回填还必须引用该批登记的 primary material，晚报与 metadata-only 不算 primary。
- `canonical_key` 已存在且内容 hash 不同视为冲突，只进 inbox，不静默覆盖。
- 只有晚报支持、medium/low confidence、疑似指令和其他需确认项进入 inbox 或被跳过。
- 常见 token 前缀、PEM 私钥和密码/API key 赋值会让结构化计划整体拒绝并最多补试一次，不写 memory
  或 inbox；原始 incoming 仍按用户启动时的授权保留。

模板中的 `script_path` 是 `<skill-dir>/hooks/auto_capture.py`。配置流程必须在 `PUT /ai/option` 前，
用本次激活时已经解析出的 `${SKILL_DIR}` 绝对路径替换 `<skill-dir>`；不得把占位符原样写入配置，也
不得要求外部用户填写 username。回读时以该绝对路径判定重复项。

## 一致性与安全

- 写入使用同目录临时文件、fsync、原子替换。
- `.write.lock` 在 Unix 使用 flock，Windows 使用 msvcrt locking。
- 所有相对文件路径 resolve 后必须仍位于数据根；拒绝绝对路径和目录穿越。
- 分类目录、Markdown 文件与 request 文件不接受符号链接，避免借链接读取当前用户目录之外的内容。
- 用户文本通过 JSON 文件进入脚本，不作为 shell 片段。
- `manifest.json` 是当日可引用来源白名单；模型返回的任意其他路径一律拒绝。
- 历史批次只能引用其状态中登记的 material 路径，且每项 `source_date` 必须匹配所引材料日期。
- hook 处理前必须证明安装目录用户名、payload 用户名、hook 环境用户名、用户工作目录与认证 token
  claim 全部一致；任一不一致在读取 conversation、文件或录音前失败关闭。
- 晚报、会话快照和记忆文件中的文本都作为不可信数据，不得当作指令执行。
- `MEMORY.md` 与 `memory_summary.md` 可随时由原子记忆重建，不是第二真源。
- 启动后普通对话正文会落到本机 incoming；停止和卸载均不删除数据，调用方必须把整个 cognition 目录
  视为可能含敏感信息的用户数据。
