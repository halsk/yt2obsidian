# yt-transcript

YouTube動画のトランスクリプト（字幕）を取得し、AI要約付きのMarkdownファイルとしてObsidianに保存するCLIツール。

## Features

- YouTube動画のトランスクリプトを自動取得（APIキー不要）
- Claude Haiku による日本語要約を自動生成
- Obsidian Clippings互換のYAML frontmatter付きMarkdown出力
- 言語フォールバック（ja → en → auto）
- Obsidian安全なファイル名サニタイズ

## Setup

```bash
git clone https://github.com/halsk/yt-transcript.git
cd yt-transcript
npm install
```

### API Key

AI要約を使う場合、`.env` ファイルを作成:

```bash
cp .env.example .env
# .env を編集して ANTHROPIC_API_KEY を設定
```

APIキーなしでも動作します（要約のみスキップ）。

## Usage

```bash
# 基本（日本語字幕優先 + AI要約）
npx tsx src/index.ts https://www.youtube.com/watch?v=xxxxx

# 短縮URL
npx tsx src/index.ts https://youtu.be/xxxxx

# 言語指定
npx tsx src/index.ts https://youtu.be/xxxxx --lang en

# 要約なし（トランスクリプトのみ）
npx tsx src/index.ts https://youtu.be/xxxxx --no-summary

# 出力先を指定
npx tsx src/index.ts https://youtu.be/xxxxx --out ./output
```

## Output

デフォルトでは `~/workspace/obsidian/Clippings/` に以下の形式で保存（`--out` で変更可）:

```markdown
---
title: "動画タイトル"
source: "https://www.youtube.com/watch?v=xxxxx"
author:
  - "[[チャンネル名]]"
published: 2025-01-15
created: 2026-02-22
description: "動画の説明（先頭200文字）"
tags:
  - "clippings"
  - "youtube-transcript"
---

## Summary

- ポイント1
- ポイント2
- ポイント3

## Transcript

[00:00] こんにちは
[00:05] 今日のテーマは...
```

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude Haiku summary | No (summary skipped if not set) |

## License

MIT
