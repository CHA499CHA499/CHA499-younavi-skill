---
name: jmqs-driver
description: 启动、调试和维护仓库中的 JMQS Driver Persona 工作台；适用于卡包、人物卡、能量棒/技能棒、腰带合体、YouNavi Bridge 和结果阅读器相关任务。
metadata:
  short-description: Run and maintain JMQS Driver
---

# JMQS Driver

JMQS Driver 的项目源码位于仓库根目录的 `projects/JMQS-Driver/`。这是一个本地优先的 YouNavi Persona 工作台，包含卡包流程、人物卡管理、能量棒/技能棒注入、腰带合体动画、本地 Navi Bridge 和 Markdown 结果阅读器。

## 启动

先确认 Node.js `>=22.13.0`，然后在项目目录执行：

```bash
cd projects/JMQS-Driver
npm install
npm run dev:persona
```

打开 `http://localhost:3000`。

`dev:persona` 会同时启动网页开发服务和本地 Persona Bridge。只需要网页时使用 `npm run dev`；只调试 Bridge 时使用 `npm run navi:bridge`。

## 本地 Navi 前置条件

真实 YouNavi 唤起只在本机 localhost 流程中生效，公开部署模式不会创建真实任务。运行前确认：

- YouNavi 的 `agent-cli` 可用；
- 五个 Persona Skill 已安装并通过 Bridge 健康检查：`naval-perspective`、`elon-musk-perspective`、`steve-jobs-perspective`、`trump-perspective`、`paul-graham-perspective`；
- Bridge 健康地址为 `http://127.0.0.1:8766/health`；
- 固定素材路径由 Bridge 配置解析，不要从浏览器直接传入任意路径或 shell 命令。

如果页面显示 `BRIDGE_OFFLINE`，先检查 `npm run dev:persona` 或 `npm run navi:bridge` 是否仍在运行，再查看 Bridge 健康检查。不要通过刷新页面重复创建未知状态的 Run。

## 使用边界

- 人物卡上半区用于拖入 Driver，下半区用于查看/播放/放大；空位卡只能进入新建角色卡流程，不能插入腰带。
- 能量棒和技能棒必须先注入内容，再分别放入左槽和右槽；两棒就绪后才允许合体启动。
- 合体触发同时负责静态合体反馈、人物 motion（若视频素材存在）、音效和本地 Navi Run；媒体失败不能阻断主流程。
- 结果完成后使用 Markdown 结果阅读器查看内容；运行详情仅用于诊断。

## 视频素材

视频文件暂不随本仓库提交。代码保留完整路径映射和静态降级逻辑；需要恢复视频时，把对应 `.mp4` 文件放回：

- `public/personas-motion/`
- `public/personas-motion-v3-intense/`
- `public/waiting-media/`

缺少视频时，卡包和合体仍应显示静态立绘/腰带状态；不要把缺失视频当作 Bridge 或卡片状态机故障。

## 验证

```bash
cd projects/JMQS-Driver
npm test
npm run lint
```

`npm test` 会先构建，再运行 `tests/*.test.mjs`。视频资产测试在视频未打包时允许跳过；Bridge HTTP 测试若当前环境禁止本地端口绑定，也会跳过对应用例。

## 修改规则

修改 JMQS Driver 时，先读项目内的 `README.md`、`INTERFACE.md`、`CHANGELOG.md` 和 `ROLLBACK.md`，确认数据流和回退边界。新增或修改 Bridge、音频、媒体路径或资产合同时，同步更新对应文档和测试；不要把 `.persona-runs/`、凭证、构建产物或视频素材提交到仓库。
