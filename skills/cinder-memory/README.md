---
title: README
type: note
permalink: cinder/cortex/memory-system/code/cinder-memory/readme
---

# Cinder Memory · YouNavi 外置插件

面向外部 YouNavi 用户的文件式知识库与记忆插件。它通过 YouNavi 原生“导入技能文件夹”安装，
不修改 YouNavi 源码，不需要数据库、MCP、API key 或第三方 Python 包。

## 安装

在 YouNavi 的技能面板选择“导入文件夹”，选中本目录：

```text
cinder-memory/
```

YouNavi 会把 `SKILL.md` 和附属脚本复制到：

```text
~/navi-ai/<username>/skills/cinder-memory/
```

随后只需在对话中发送一次：

```text
/cinder-memory 启动
```

这一步会同时初始化当前用户的 Markdown 目录，并通过 YouNavi 原生 `hook-author` 幂等开启
`task.completed` 自动捕获。`开始`、`开启`、`开始记忆`、`开启记忆`、`启动记忆` 和
`启动自动记忆` 都是兼容说法；重复执行不会重复添加 hook。单纯询问用法或状态不会自动开启。
只有 hook 保存并回读成功后才会创建首次历史询问状态；配置失败不会消耗这次询问。

隐私边界：启动后，当前 YouNavi 用户的普通对话正文会保存在本机 `incoming/` 作为可审计证据，可能
包含敏感内容；不会上传到 Cinder 仓库或其他用户目录。停止自动捕获不会删除已有数据，卸载 Skill
也不会删除 `cognition/cinder-memory/`，用户应按本机敏感数据管理和备份该目录。

### 从旧版升级

YouNavi 导入器会跳过同名 Skill，不能直接重复导入覆盖旧版：

1. 在旧版对话中执行 `/cinder-memory 停止自动捕获`。
2. 在技能管理中卸载旧 `cinder-memory`；这不会删除 `cognition/cinder-memory/`。
3. 导入当前 v0.4.2 文件夹。
4. 执行 `/cinder-memory 启动`。它会安装 300 秒新 hook，已有长期 Markdown 和 inbox 原样保留。

插件会从安装位置识别当前用户，只创建：

```text
~/navi-ai/<username>/cognition/cinder-memory/
├── MEMORY.md
├── memory_summary.md
├── memory/
│   ├── profile/
│   ├── preferences/
│   ├── people/
│   ├── projects/
│   └── references/
├── incoming/YYYY-MM-DD/
│   ├── manifest.json
│   ├── conversation-*.md
│   ├── evening-report.md
│   └── extraction-input.md
├── incoming/history-bootstrap/
│   ├── manifest.json
│   └── material-*.md
├── digests/
├── inbox/
├── archive/
├── .requests/
├── .state/
│   ├── consolidation/
│   ├── applied/
│   ├── history-bootstrap.json
│   └── history-bootstrap/
│       ├── batches/
│       └── collection/
└── .write.lock
```

不会扫描或写入其他 username，也不会改动现有的 `全局记忆文件.txt`、`常用人名表.txt`、
`专有名词表.txt`。

### 首次历史回填

首次成功启动后，插件只询问一次：

> 新的一启动，要不要把你以往的内容进行一次快速的抓取和提炼？

用户同意后，该任务完成时 hook 才开始回填。顺序固定为：

1. 通过 YouNavi 注入的本机 API 读取当前用户全部历史会话（含归档）、文件、录音和音频转写。
2. 文本只规范化 NUL 与换行；按规范化正文 SHA-256 做全局精确去重，同正文只保留更新时间最新项。
3. 把全部唯一材料、重复映射和任一来源读取失败项写入 `incoming/history-bootstrap/manifest.json`，便于逐项审查。
4. 只有所有资料读取零失败且去重完全结束，才把唯一正文无损切成有界批次并串行提炼；同一时刻只运行一个历史批次。

这一步不评分、不按重要性或来源淘汰、不做语义近似去重，也不截断唯一正文。普通文本和录音转写会
保存完整正文；音频和其他二进制文件不做额外 ASR/解析，只保存 API 元数据。拒绝会持久记录且不重复
询问；任何应读资料失败都会在 manifest 留账并停止，不会提炼成功子集。以后明确说“补抓历史记忆”
会重新授权一次完整扫描。

扫描、规范化、精确去重、落盘和分批均不调用模型。只有第 4 步开始消耗 token，每批约 6,000 tokens
材料、完整输入不超过约 8,000 tokens。首次同意和每次“继续历史提炼”最多授权 4 批；状态会显示
`plan_id`、扫描数、唯一数、删除重复数、批次进度、预计输入量，以及计入一次补试的最坏预计输入量。
这些数字只估算输入，不是包含模型输出的总 token 上限。会话、文件、录音和音频转写列表先冻结；单次
采集约 180 秒后从 cursor 暂停，下一次 YouNavi 任务完成时继续。插件没有独立后台调度器，因此用户
长期不再产生任务时，暂停的历史采集不会自行唤醒。

## 使用

- 日常会话完成 → 自动保存证据；晚报完成 → 自动提炼长期记忆，不需要逐条说“记住”。
- “Amy 是谁？” → 先返回有界摘要和候选元数据，再只读取命中的 1–3 个文件。
- 每日晚报完成 → 自动生成 digest 和结构化提取计划；只有原始会话支持的高置信内容进入 memory。
- 首次历史回填 → 先精确去重并写 manifest，再串行提炼全部唯一正文。
- “查看记忆状态” → 同时核验数据统计、最近提取结果和自动 hook 是否启用。
- “把刚才那条记忆改成……” → 展示差异并确认后，可恢复地归档旧版本再写入新版本。
- “忘掉这个偏好” → 展示目标，确认后移动到 `archive/forgotten/`。

用户文本不会拼进 shell。Skill 先取得 `.requests/request-*.json` 路径，再用 YouNavi
`write_text_file` 写结构化请求，由脚本读取后立即删除。

## 自动捕获

插件附带 `hooks/auto_capture.py`，订阅 YouNavi 原生 `task.completed`：

- 普通任务完成：通过 `YOUNAVI_AGENT_CLI` 读取会话，把当天 user/assistant 正文覆盖写入
  `incoming/YYYY-MM-DD/conversation-*.md`。同一 conversation 当天只有一个文件；单份原始证据超过
  5,000,000 字符时明确失败，不静默截断。
- `source=evening_report` 完成：保留完整晚报，按保守 token 估算构造最多约 8,000 tokens 的
  `extraction-input.md`，其中晚报最多约 2,000 tokens；冻结前通过当前认证用户的本机 API 补齐当日
  conversation 快照，任一详情失败或约 200 秒内无法完整扫描时不调用模型；随后创建一个
  `source=cinder_memory_extract` 的普通提取任务。
- 提取任务被要求不调用工具、只返回 JSON。完成后 hook 校验来源白名单、日期、稳定键、类型、大小、
  置信度和冲突，并由本地脚本写入 `digests/`、`memory/` 或 `inbox/`，再重建两级索引。

白天快照、计划校验、去重、冲突判断和索引生成都不调用模型；每天晚报后只创建一个有效提取任务。
快照覆盖按真实 `updated_at` 单调推进；延迟返回的晚报 API 补扫不能覆盖普通 hook 已保存的更新内容，
同时间点则优先保留真实任务快照。晚报输入在文件锁内一次冻结全部快照正文，避免并发覆盖时读到混合版本。
`incoming/` 与 `digests/` 不参与普通检索，因此回忆不会重复带入原始会话。一个 YouNavi 任务不等于
底层实现严格只有一次推理调用，但该任务没有 Skill 工具往返，目标是一次结构化回复完成提取。
同一天即使出现不同晚报 task 也只会触发一次；无效提取输出会自动补试一次，仍失败就保留可见的
`failed` 状态。创建提取任务失败同样记录为失败；同日失败不会被重复晚报事件重新拉起。
`launching` 超过 15 分钟或时间戳异常时无法排除任务已经创建，因此直接失败关闭，不重新发起。
`triggered` 超过 6 小时后只读取登记的 conversation：已有完整回复就补应用，否则失败关闭；不会因
超时另发模型任务。`applying` 超过 30 分钟时因无法排除部分写入而失败关闭。
日常和历史租约均容忍 5 分钟时钟偏差；更远的未来时间戳视为异常租约，不会永久卡住队列。

`/cinder-memory 启动` 会读取 `hooks/task-completed.example.json`，通过 YouNavi `hook-author`
先读后合并现有 hooks；不会直接覆盖 `option.json`。斜杠激活 Skill 时，YouNavi 会把当前
`${SKILL_DIR}` 解析为插件目录的绝对路径，再用它替换模板中的 `<skill-dir>`；外部用户不需要填写
username 或绝对路径。

历史回填使用同一 hook 的 `source=cinder_memory_history_extract` 分支：每批完成后本地应用计划，再启动
下一批；无效输出只补试一次。`.state/history-bootstrap.json` 保存全流程进度，重复完成事件不会重复
启动同一批。`running` 超过 6 小时只读取原登记 conversation 对账，不盲目重发；抓取失败、批次启动
失败、对账无完整回复或第二次输出仍无效时状态变为 `failed`，不会跳过失败继续假报完成。`launching`
超过 5 分钟或时间戳异常时同样失败关闭，不把批次退回队列重发。

停止自动捕获时使用：

```text
/cinder-memory 停止自动捕获
```

停止前会先检查日常和历史状态；存在采集、启动、运行或应用中的任务时不会移除 hook，以免已付费结果
无人接收。待状态进入终态后再次停止，只移除本插件 hook，不删除记忆数据。停止后不再更新 incoming，
也不会随晚报自动提取；已有记忆仍可回忆、纠正或遗忘，但不再提供手动新增日常记忆的入口。

## 本地测试

```bash
python3 -m unittest discover \
  -s brain/cortex/memory-system/code/cinder-memory/tests -v
```

## 边界

- `incoming` 是证据层，`digests` 是每日机器摘要，`memory` 是长期结果层；不能互相替代。
- 历史 manifest 是抓取和精确去重的审计账本；提炼结果不能反向改写它。
- Markdown 文件是唯一真源；`memory_summary.md` 和 `MEMORY.md` 都是可重建索引。
- 普通 `search` 不返回随记忆量增长的完整 `MEMORY.md`，只返回固定上限摘要和候选元数据。
- 首版为确定性关键词/CJK 检索，不内置 embedding。
- 冲突是否替换由用户确认，脚本不静默覆盖旧记忆。
- 晚报不能单独成为长期记忆；日常自动沉淀必须引用原始 conversation，历史回填必须引用已登记 material。
- 推断、报告单源、疑似指令、冲突和低置信内容进入 inbox 或跳过。
- 常见 token、私钥或密码赋值只保留在本机原始证据，不进入长期记忆或 inbox 副本。
- v0.2 根级分类、`sessions/` 和 `.consolidation/` 保持只读兼容，不自动删除。
- 遗忘使用可恢复移动，不物理删除。
- 插件卸载不删除 `cognition/cinder-memory/` 用户数据。
- 当前是关键词/CJK 扫描，适合个人规模；记忆达到数千文件后应实测检索延迟，再决定是否引入本地倒排或向量索引。

接口见 `INTERFACE.md`，升级记录见 `CHANGELOG.md`，回退见 `ROLLBACK.md`。
