# Cinder Memory YouNavi Plugin · ROLLBACK

v0.2.0 新增 `sessions/`、`sessions/bundles/` 与 `.consolidation/`，已有长期分类、inbox、archive 和
`MEMORY.md` 格式不变。回退到 v0.1.2 时旧版本会忽略这些新增目录，无需重写已有记忆。

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
3. 导入 v0.1.2 或其他已知可用的插件目录。
4. 运行 `/cinder-memory 开始记忆`，让旧版本重新安装自己的 hook 配置。
5. 运行 `status` 和 `reindex`，再用一条 `expand` 请求确认旧 Markdown 可读。

回退后不会再按 session 覆盖或随晚报自动提炼，而会恢复 v0.1.2 的逐任务 inbox 捕获。
`sessions/` 和 `.consolidation/` 可留作审查证据；物理清理不属于回退动作。

## 恢复较宽提炼预算

如果 16,000 字符预算经真实验收确认遗漏关键信息，可把 `scripts/memory_fs.py` 的
`MAX_REPORT_CHARS` 恢复为 `12_000`、`MAX_CONSOLIDATION_CHARS` 恢复为 `48_000`，再运行完整测试。
这只改变下一次提炼包的截断范围，不需要迁移现有 Markdown、session 或幂等状态。

插件 schema 首版只有 Markdown 和 HTML 注释 ID，没有数据库迁移。新版本如果改变文件格式，必须先
备份整个 `cognition/cinder-memory/`。

## 完全删除

物理删除用户记忆不可恢复，不属于卸载动作。本插件没有“清空整个目录”命令；必须由用户单独明确
授权并自行备份后处理。
