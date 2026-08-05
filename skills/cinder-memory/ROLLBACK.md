---
title: ROLLBACK
type: note
permalink: cinder/cortex/memory-system/code/cinder-memory/rollback
---

# Cinder Memory YouNavi Plugin · ROLLBACK

v0.4.2 不改变长期 Markdown schema，但新增历史冻结队列/cursor、`collection_paused`、
`awaiting_continuation`、批次 `plan_id` 完整性字段和 capture health 字段。回退到 v0.4.1 前先停止自动
捕获，并等待历史状态进入 `completed`、`declined` 或已留账的 `failed`；v0.4.1 不理解暂停和继续授权，
不能接管未完成的 v0.4.2 队列。保留整个 `incoming/history-bootstrap/`、`.state/history-bootstrap/` 和
`.state/history-bootstrap.json`，不要为兼容旧版手工删改 cursor 或批次。若必须恢复旧版运行态，使用
升级前的完整 cognition 备份；v0.4.2 已写入的长期记忆、digest 和证据 Markdown 本身仍可审查。

回退还会失去晚报当前用户 API 补齐、全来源失败关闭、4 批授权边界、完整批次契约校验、primary evidence
分级与 capture health 连续失败信息。只有在接受这些保护退化后才使用旧版；回退不会减少已发生的模型
token 消耗，也不能恢复被旧版漏抓的资料。

v0.4.1 不改变 v0.4.0 Markdown schema，但新增日常 `applying` 状态、完成任务尝试历史和更严格的失败
闭合。回退到 v0.4.0 前必须等待 `memory_fs.py status` 中最近提取离开 `launching/triggered/applying`，并
等待 `history_bootstrap.py status` 不再有运行批次；旧版不理解 `applying` 超时对账，直接回退可能留下
永不结束的状态。v0.4.1 将单份原始证据上限从旧文档的 100,000 字符提升到 5,000,000 字符，回退不会
删除大文件，但旧版 hook 可能拒绝继续覆盖它们。新版还会把超过 5 分钟的未来租约时间戳视为异常；回退后若
机器时钟回拨，旧版可能会把该状态一直当作活跃租约。本候选版还把日常和历史 `launching` 超时改为
失败关闭，并在历史会话部分读取失败时禁止提炼成功子集；回退会恢复自动重发或子集提炼风险。

v0.4.0 新增一次性历史回填状态与 `incoming/history-bootstrap/` 证据，但不改变 v0.3 长期记忆 schema。
回退到 v0.3.2 后，新版已经生成的 `memory/`、digest 和 inbox 仍可读；旧版会忽略历史 manifest、批次与
`.state/history-bootstrap.json`，不会继续未完成的历史队列。回退前应等待当前历史批次终止或先停止
自动捕获，避免卸载后留下正在完成但无人应用的提取任务。

v0.3.2 不改变用户 Markdown schema，但把晚报幂等键从 report task ID 收敛为日期，并为无效提取增加
一次自动补试；`search` 不再返回完整 `MEMORY.md`。回退到 v0.3.1 后既有数据可读，但同一天多个晚报
task 可能重复触发，失败不会自动补试，长期使用时搜索响应会重新随完整索引增长。

v0.3.1 只调整启动口令与 Skill 触发描述，不改变数据布局、hook schema 或自动提取流程。回退到
v0.3.0 后数据完全兼容，但主启动口令恢复为 `/cinder-memory 开始记忆`。

v0.3.0 新增 `incoming/`、`digests/`、`memory/`、`memory_summary.md` 与 `.state/`。v0.1/v0.2 的根级
分类、`sessions/`、`.consolidation/`、inbox 和 archive 不删除；v0.3 会继续读取旧分类和 session 证据。
回退时旧版本会忽略 v0.3 新目录，但不会自动理解 `memory/` 中新增的原子记忆。

## 停用

在 YouNavi 技能管理中卸载 `cinder-memory`。这只移除：

```text
~/navi-ai/<username>/skills/cinder-memory/
```

不会删除 `cognition/cinder-memory/` 用户数据。

如果启用了自动 hook，先在 YouNavi 中执行 `/cinder-memory 停止自动捕获`。它会按 `hook-author`
流程通过 `GET /ai/option` 读取现有配置，再用 `PUT /ai/option` 仅移除指向 `auto_capture.py` 的那一项；
不要覆盖其他 hooks。若状态显示仍有日常或历史在途工作，停止会保留 hook；等进入终态后重试。回读
确认移除后再卸载 Skill，避免已付费结果无人应用或留下指向不存在脚本的配置。

## 恢复误忘记的记忆

forget 不删除文件。到：

```text
cognition/cinder-memory/archive/forgotten/
```

把目标文件移回原分类目录，再执行：

```bash
python3 "<skill-dir>/scripts/memory_fs.py" reindex
```

## 恢复已归档 inbox

从 `archive/inbox/` 把对应日期文件移回 `inbox/YYYY-MM-DD.md`。如果目标已存在，先人工合并，
不要覆盖。

## 版本回退

1. 先执行 `/cinder-memory 停止自动捕获`，确认旧 hook 已移除。
2. 卸载当前 Skill，保留整个 cognition 数据。
3. 备份整个 `cognition/cinder-memory/`，尤其是 `incoming/`、`memory/`、inbox 和 `.state/`。
4. 导入 v0.2.0 或其他已知可用的插件目录。
5. 如需让旧版回忆 v0.3 新增记忆，人工审查 `memory/<category>/*.md` 后复制正文到对应旧版根级分类；
   不要覆盖同名文件，也不要迁移派生索引代替正文。
6. 运行目标版本文档指定的启动口令，让旧版本重新安装自己的 hook 配置；v0.3.1 及 v0.3.2 使用
   `/cinder-memory 启动`，v0.3.0 及更早版本使用 `/cinder-memory 开始记忆`。
7. 运行 `status` 和 `reindex`，再用一条 `expand` 请求确认旧 Markdown 可读。

回退 v0.4.0 时不要删除 `incoming/history-bootstrap/`：它是“抓了什么、精确删了哪些重复项”的审计
证据。若必须重新执行历史回填，先备份该目录和 `.state/history-bootstrap.json`，再由用户明确授权；
插件没有公开 reset 命令，避免误触造成重复 token 消耗。

回退到 v0.1.2 后不会再按 session 覆盖或随晚报自动提炼，而会恢复逐任务 inbox 捕获。
回退到 v0.2.0 时会恢复旧 session + 人工提炼任务流程。`incoming/`、`digests/`、`memory/` 和 `.state/`
可留作审查证据；物理清理不属于回退动作。

## 调整提取预算

如果约 8,000 tokens 的输入经真实验收确认遗漏关键信息，可在备份当前插件后调整
`scripts/memory_fs.py` 的 `MAX_REPORT_ESTIMATED_TOKENS` 和 `MAX_EXTRACTION_ESTIMATED_TOKENS`，再运行
完整测试。该估算是确定性近似值，不等于模型账单中的精确 token 数；调整只影响下一次
`extraction-input.md`，不会迁移或删除完整 incoming 证据。

插件没有数据库迁移。回退前不要手工删除 v0.3 目录；新版本如果改变文件格式，必须先备份整个
`cognition/cinder-memory/`。

## 完全删除

物理删除用户记忆不可恢复，不属于卸载动作。本插件没有“清空整个目录”命令；必须由用户单独明确
授权并自行备份后处理。
