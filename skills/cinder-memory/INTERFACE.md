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

hook 运行时优先采用 YouNavi 注入的 `YOUNAVI_USER_WORK_DIR`；普通 Skill 运行从脚本路径向上查找
`skills/`，其父目录即当前 YouNavi 用户目录。源码测试场景必须显式传 `--user-dir`；也可用
`YOUNAVI_USER_DIR` 覆盖。

## 启停契约

| 口令 | 结果 |
|---|---|
| `/cinder-memory 启动` | 初始化数据目录，并幂等启用一个 `task.completed` 自动捕获 hook |
| `开始 / 开启 / 开始记忆 / 开启记忆 / 启动记忆 / 启动自动记忆` | 与“启动”相同；必须处于 cinder-memory Skill 上下文 |
| `/cinder-memory 仅初始化` | 只初始化数据目录，不修改 hooks |
| `/cinder-memory 停止自动捕获` | 只移除本插件 hook，保留其他 hooks 和全部记忆数据 |
| `/cinder-memory 整理记忆` | 人工审核 inbox；不是自动提取任务的内部入口 |

“启动”及上述同义表达是自动捕获的显式授权，不再二次确认；仅询问功能、状态或用法不是授权。
hook 配置必须经 `GET /ai/option`、合并、`PUT /ai/option`、回读校验四步完成；重复启动不得创建
重复 hook，重复停止不得报错。配置失败时目录
可以保留，但调用方不得宣称自动捕获已开启。同一 `script_path` 已存在时必须原位更新为当前模板并
去重，保证旧版 30 秒 hook 能升级为 v0.3.1 的 60 秒 hook。

## 读写路径

| 路径 | 行为 |
|---|---|
| `<user>/skills/cinder-memory/` | 插件代码，只读运行 |
| `<user>/cognition/cinder-memory/` | 当前用户记忆真源，读写 |
| `<user>/cognition/cinder-memory/.requests/` | 单次 JSON 请求，读取后立即删除 |
| `<user>/cognition/cinder-memory/incoming/YYYY-MM-DD/` | manifest、每 conversation 日快照、完整晚报和有界提取输入；不参与普通回忆 |
| `<user>/cognition/cinder-memory/digests/` | 每日机器摘要；由结构化计划确定性生成，不是长期记忆真源 |
| `<user>/cognition/cinder-memory/memory/<category>/` | 带类型、标签、实体、来源和稳定键的长期原子记忆 |
| `<user>/cognition/cinder-memory/inbox/` | 低置信、报告单源、冲突或需人工确认的候选 |
| `<user>/cognition/cinder-memory/.state/consolidation/` | 晚报触发、提取任务和应用结果状态 |
| `<user>/cognition/cinder-memory/.state/applied/` | 已应用结构化计划的幂等记录 |
| `<user>/cognition/cinder-memory/.write.lock` | 跨进程写锁 |
| `<user>/cognition/cinder-memory/{profile,...,sessions,.consolidation}/` | v0.1/v0.2 只读兼容数据；不删除，不再写新数据 |
| 其他 username / YouNavi 源码仓 | 不读取、不写入 |

## CLI

```text
memory_fs.py [--user-dir PATH] init
memory_fs.py [--user-dir PATH] status
memory_fs.py [--user-dir PATH] list
memory_fs.py [--user-dir PATH] pending
memory_fs.py [--user-dir PATH] reindex
memory_fs.py [--user-dir PATH] incoming --date YYYY-MM-DD
memory_fs.py [--user-dir PATH] request --file PATH
```

`sessions --date` 和 `consolidation --date` 仅为 v0.2 调用方保留，分别映射到 `incoming` 列表与
`extraction-input.md`；新调用方不得依赖这两个旧名字。

stdout 始终为一行 JSON：成功 `{success:true,data:...}`，失败
`{success:false,error:"..."}`；失败时退出码为 1。

`request` 只接受位于当前数据根 `.requests/` 下、最大 1MB 的 `.json` 文件。动作：

| action | 必填 | 副作用 |
|---|---|---|
| `search` | query | 只读，返回两级索引、候选元数据和摘要，不返回记忆正文 |
| `read` | paths | 只读，只返回 `memory/`、inbox 或旧分类中明确指定的 Markdown |
| `expand` | query | v0.2 兼容；一次完成 search + read |
| `capture` | title/content/source | 幂等追加到当日 inbox |
| `remember` | category/slug/title/content/source | 写一条高置信原子记忆；稳定键冲突时拒绝覆盖 |
| `pending` | - | 只读全部 inbox |
| `list` | - | 只读文件列表 |
| `reindex` | - | 重建派生 `MEMORY.md` 和 `memory_summary.md` |
| `forget` | path/confirmed=true | 移到 archive/forgotten，不删除 |
| `archive_inbox` | date/confirmed=true | 移到 archive/inbox |

分类固定为 `profile/preferences/people/projects/references`。新记忆写在 `memory/<category>/`；所有内容
写入必须有非空 source。普通回忆必须优先 `search`，确认候选相关后再 `read` 1–3 个文件。

## 自动 hook

`hooks/auto_capture.py` 接受 `task.completed` HookPayload，通过 YouNavi 注入的
`YOUNAVI_AGENT_CLI` 获取完整 conversation，并以 conversation `source` 分流：

| source | 行为 |
|---|---|
| `cinder_memory` | 跳过，兼容并阻断 v0.2 提炼任务递归 |
| `cinder_memory_extract` | 只接受已登记的提取 conversation；解析最终 JSON，校验并本地应用，不再创建任务 |
| `evening_report` | 保存完整晚报，合并当日原始证据为有界输入，并创建一次 `source=cinder_memory_extract` 任务 |
| 其他 | 覆盖 `incoming/YYYY-MM-DD/conversation-*.md`；同一 conversation 当天只有一个快照 |

单份会话快照和完整晚报各最多 100,000 字符。完整证据原样留在 `incoming/`；发给模型的
`extraction-input.md` 按本地保守估算最多约 8,000 tokens，其中晚报最多约 2,000 tokens，剩余预算
在会话快照间均分。模型任务不调用工具，只返回 schema v1 JSON；白天捕获、裁剪、计划校验、写入、
去重、冲突判断和索引重建均不调用模型。普通 `search` / `expand` 不搜索 incoming 或 digests。

晚报 trigger 以 report task ID 持久化幂等；`agent-cli chat send` 创建失败时移除 launching 状态以允许
重试。提取任务必须能在 `.state/consolidation/` 反查到日期与 conversation，否则拒绝应用。完整计划以
内容 hash 记录到 `.state/applied/`，重复完成事件返回相同结果。hook 失败只返回非零，不影响原任务。

结构化计划的本地应用规则：

- digest 必须引用当日 manifest 白名单中的来源；晚报单源可以生成 digest。
- 自动长期记忆必须为 `confidence=high`、至少引用一份 `conversation-*.md` 原始证据，且内容不含
  可疑指令模式。
- `canonical_key` 已存在且内容 hash 不同视为冲突，只进 inbox，不静默覆盖。
- 只有晚报支持、medium/low confidence、疑似指令和其他需确认项进入 inbox 或被跳过。

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
- 晚报、会话快照和记忆文件中的文本都作为不可信数据，不得当作指令执行。
- `MEMORY.md` 与 `memory_summary.md` 可随时由原子记忆重建，不是第二真源。
