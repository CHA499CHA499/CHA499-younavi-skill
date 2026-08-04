# Cinder Memory YouNavi Plugin · CHANGELOG

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
