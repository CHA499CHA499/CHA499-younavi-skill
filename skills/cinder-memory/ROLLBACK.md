---
title: ROLLBACK
type: note
permalink: cinder/cortex/memory-system/code/cinder-memory/rollback
---

# Cinder Memory YouNavi Plugin · ROLLBACK

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
不要覆盖其他 hooks。回读确认移除后再卸载 Skill，避免留下指向不存在脚本的配置。

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
6. 运行目标版本文档指定的启动口令，让旧版本重新安装自己的 hook 配置；v0.3.1 使用
   `/cinder-memory 启动`，v0.3.0 及更早版本使用 `/cinder-memory 开始记忆`。
7. 运行 `status` 和 `reindex`，再用一条 `expand` 请求确认旧 Markdown 可读。

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
