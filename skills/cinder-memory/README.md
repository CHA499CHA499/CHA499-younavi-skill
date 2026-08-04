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
/cinder-memory 开始记忆
```

这一步会同时初始化当前用户的 Markdown 目录，并通过 YouNavi 原生 `hook-author` 幂等开启
`task.completed` 自动捕获。重复执行不会重复添加 hook。

### 从 v0.1.2 升级

YouNavi 导入器会跳过同名 Skill，不能直接重复导入覆盖旧版：

1. 在旧版对话中执行 `/cinder-memory 停止自动捕获`。
2. 在技能管理中卸载旧 `cinder-memory`；这不会删除 `cognition/cinder-memory/`。
3. 导入当前 v0.2.0 文件夹。
4. 执行 `/cinder-memory 开始记忆`。它会安装 60 秒新 hook，已有长期 Markdown 和 inbox 原样保留。

插件会从安装位置识别当前用户，只创建：

```text
~/navi-ai/<username>/cognition/cinder-memory/
├── MEMORY.md
├── profile/
├── preferences/
├── people/
├── projects/
├── references/
├── inbox/
├── sessions/
│   ├── YYYY-MM-DD/
│   └── bundles/
├── archive/
├── .requests/
├── .consolidation/
└── .write.lock
```

不会扫描或写入其他 username，也不会改动现有的 `全局记忆文件.txt`、`常用人名表.txt`、
`专有名词表.txt`。

## 使用

- “记住我喜欢先看结论” → 明确记忆，写入分类 Markdown。
- “Amy 是谁？” → 先读 `MEMORY.md`，再只展开匹配文件。
- 每日晚报完成 → 自动提炼当天 session；明确内容分类沉淀，推断和冲突进入 inbox。
- “整理今天的记忆” → 人工审核 inbox，确认后沉淀并归档。
- “忘掉这个偏好” → 展示目标，确认后移动到 `archive/forgotten/`。

用户文本不会拼进 shell。Skill 先取得 `.requests/request-*.json` 路径，再用 YouNavi
`write_text_file` 写结构化请求，由脚本读取后立即删除。

## 自动捕获

插件附带 `hooks/auto_capture.py`，订阅 YouNavi 原生 `task.completed`：

- 普通任务完成：通过 `YOUNAVI_AGENT_CLI` 读取会话，把当天 user/assistant 正文覆盖写入一份
  `sessions/YYYY-MM-DD/session-*.md`。同一 session 当天无论完成多少任务都只有一个文件。
- `source=evening_report` 的晚报完成：生成最多 16,000 字符的当日提炼包，再 one-shot 创建
  `/cinder-memory 提炼今日记忆 YYYY-MM-DD` 任务。
- `source=cinder_memory` 的提炼任务完成：直接跳过，防止 hook 递归。

白天的快照写入不调用 LLM；模型只在晚报后集中提炼一次。`sessions/` 不参与普通 `expand`，因此
回忆时不会把原始会话反复塞进上下文。晚报正文最多取 4,000 字符，整个提炼包最多 16,000 字符，
剩余预算由当天 sessions 公平共享。
同一个晚报 task 的重复完成事件只会触发一次；创建提炼任务失败会释放幂等标记，允许下次重试。

`/cinder-memory 开始记忆` 会读取 `hooks/task-completed.example.json`，通过 YouNavi `hook-author`
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

停止只移除本插件 hook，不删除记忆数据。停止后不再更新 session 快照，也不会随晚报自动提炼；
手动“记住”和“回忆”仍可使用。

## 本地测试

```bash
python3 -m unittest discover \
  -s skills/cinder-memory/tests -v
```

## 边界

- Markdown 文件是唯一真源；`MEMORY.md` 是可重建索引。
- 首版为确定性关键词/CJK 检索，不内置 embedding。
- 冲突是否替换由用户确认，脚本不静默覆盖旧记忆。
- 晚报提炼只自动沉淀明确、无冲突的信息；推断、冲突和低置信内容进入 inbox。
- 遗忘使用可恢复移动，不物理删除。
- 插件卸载不删除 `cognition/cinder-memory/` 用户数据。

接口见 `INTERFACE.md`，升级记录见 `CHANGELOG.md`，回退见 `ROLLBACK.md`。
