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

### 从旧版升级

YouNavi 导入器会跳过同名 Skill，不能直接重复导入覆盖旧版：

1. 在旧版对话中执行 `/cinder-memory 停止自动捕获`。
2. 在技能管理中卸载旧 `cinder-memory`；这不会删除 `cognition/cinder-memory/`。
3. 导入当前 v0.3.1 文件夹。
4. 执行 `/cinder-memory 启动`。它会安装 60 秒新 hook，已有长期 Markdown 和 inbox 原样保留。

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
├── digests/
├── inbox/
├── archive/
├── .requests/
├── .state/
└── .write.lock
```

不会扫描或写入其他 username，也不会改动现有的 `全局记忆文件.txt`、`常用人名表.txt`、
`专有名词表.txt`。

## 使用

- “记住我喜欢先看结论” → 明确记忆，写入 `memory/preferences/` 原子 Markdown。
- “Amy 是谁？” → 先搜索 `memory_summary.md` / `MEMORY.md`，再只读取命中的 1–3 个文件。
- 每日晚报完成 → 自动生成 digest 和结构化提取计划；只有原始会话支持的高置信内容进入 memory。
- “整理今天的记忆” → 人工审核 inbox，确认后沉淀并归档。
- “忘掉这个偏好” → 展示目标，确认后移动到 `archive/forgotten/`。

用户文本不会拼进 shell。Skill 先取得 `.requests/request-*.json` 路径，再用 YouNavi
`write_text_file` 写结构化请求，由脚本读取后立即删除。

## 自动捕获

插件附带 `hooks/auto_capture.py`，订阅 YouNavi 原生 `task.completed`：

- 普通任务完成：通过 `YOUNAVI_AGENT_CLI` 读取会话，把当天 user/assistant 正文覆盖写入
  `incoming/YYYY-MM-DD/conversation-*.md`。同一 conversation 当天只有一个文件。
- `source=evening_report` 完成：保留完整晚报，按保守 token 估算构造最多约 8,000 tokens 的
  `extraction-input.md`，其中晚报最多约 2,000 tokens；随后创建一个
  `source=cinder_memory_extract` 的普通提取任务。
- 提取任务被要求不调用工具、只返回 JSON。完成后 hook 校验来源白名单、日期、稳定键、类型、大小、
  置信度和冲突，并由本地脚本写入 `digests/`、`memory/` 或 `inbox/`，再重建两级索引。

白天快照、计划校验、去重、冲突判断和索引生成都不调用模型；晚报后只创建一个提取任务。
`incoming/` 与 `digests/` 不参与普通检索，因此回忆不会重复带入原始会话。一个 YouNavi 任务不等于
底层实现严格只有一次推理调用，但该任务没有 Skill 工具往返，目标是一次结构化回复完成提取。
同一个晚报 task 的重复完成事件只会触发一次；创建提炼任务失败会释放幂等标记，允许下次重试。

`/cinder-memory 启动` 会读取 `hooks/task-completed.example.json`，通过 YouNavi `hook-author`
先读后合并现有 hooks；不会直接覆盖 `option.json`。斜杠激活 Skill 时，YouNavi 会把当前
`${SKILL_DIR}` 解析为插件目录的绝对路径，再用它替换模板中的 `<skill-dir>`；外部用户不需要填写
username 或绝对路径。

只想创建目录、不自动捕获时使用：

```text
/cinder-memory 仅初始化
```

停止自动捕获时使用：

```text
/cinder-memory 停止自动捕获
```

停止只移除本插件 hook，不删除记忆数据。停止后不再更新 incoming，也不会随晚报自动提取；
手动“记住”和“回忆”仍可使用。

## 本地测试

```bash
python3 -m unittest discover \
  -s brain/cortex/memory-system/code/cinder-memory/tests -v
```

## 边界

- `incoming` 是证据层，`digests` 是每日机器摘要，`memory` 是长期结果层；不能互相替代。
- Markdown 文件是唯一真源；`memory_summary.md` 和 `MEMORY.md` 都是可重建索引。
- 首版为确定性关键词/CJK 检索，不内置 embedding。
- 冲突是否替换由用户确认，脚本不静默覆盖旧记忆。
- 晚报不能单独成为长期记忆；自动沉淀必须同时引用原始 conversation 证据。
- 推断、报告单源、疑似指令、冲突和低置信内容进入 inbox 或跳过。
- v0.2 根级分类、`sessions/` 和 `.consolidation/` 保持只读兼容，不自动删除。
- 遗忘使用可恢复移动，不物理删除。
- 插件卸载不删除 `cognition/cinder-memory/` 用户数据。

接口见 `INTERFACE.md`，升级记录见 `CHANGELOG.md`，回退见 `ROLLBACK.md`。
