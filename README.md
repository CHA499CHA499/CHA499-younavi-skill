# CHA499-younavi-skill

Personal Codex/Claude skills for YouNavi-flavored workflows.

## Skills

- `skills/navi-video-explain` - Explain a video from a URL or local file by transcribing it, selecting key frames, and producing a personalized Markdown image-and-text walkthrough. Current imported version: `0.5`.
- `skills/cinder-memory` - Provide file-based personal knowledge, automatic memory, and structured evening extraction for YouNavi without modifying YouNavi source code. Current imported version: `0.4.4`.

## Project

- `projects/JMQS-Driver` - JMQS Driver Persona 工作台项目源码，包含卡包、人物卡、双棒注入、腰带合体、YouNavi Bridge、管理中心和测试。视频素材暂不随仓库提交，补入项目 README 指定路径后即可恢复视频播放。

## Install

Copy or symlink an individual skill directory into the target agent's skills directory.

For Cinder Memory, use YouNavi's skill panel to import the `skills/cinder-memory` folder directly.

For Navi Video Explain, install it manually as follows.

For Claude:

```bash
cp -R skills/navi-video-explain ~/.claude/skills/
```

For Codex:

```bash
cp -R skills/navi-video-explain ~/.codex/skills/
```

## Publish

Create the GitHub repository as public:

```bash
gh auth login
gh repo create CHA499-younavi-skill --public --source=. --remote=origin --push
```

If `origin` already exists, use:

```bash
git push -u origin main
```

## License

MIT.
