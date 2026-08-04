---
title: CHANGELOG
type: note
permalink: cinder/cortex/memory-system/code/cinder-memory/changelog
---

# Cinder Memory YouNavi Plugin · CHANGELOG

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
