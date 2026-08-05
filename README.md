# CHA499-younavi-skill

Personal Codex/Claude skills for YouNavi-flavored workflows.

## Skills

- `skills/navi-video-explain` - Explain a video from a URL or local file by transcribing it, selecting key frames, and producing a personalized Markdown image-and-text walkthrough. Current imported version: `0.5`.
- `skills/cinder-memory` - Provide file-based personal knowledge, automatic memory, and structured evening extraction for YouNavi without modifying YouNavi source code. Current imported version: `0.4.2`.

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
