# yt2obsidian

YouTube動画のトランスクリプト（字幕）を取得し、AI要約付きのMarkdownファイルとしてObsidianに保存するCLI & HTTPサーバー。

## Features

- YouTube動画のトランスクリプトを自動取得（APIキー不要）
- Claude Haiku による日本語要約を自動生成
- Obsidian Clippings互換のYAML frontmatter付きMarkdown出力
- 言語フォールバック（ja → en → auto）
- Obsidian安全なファイル名サニタイズ
- HTTPサーバー（モバイル対応Webフォーム + JSON API）
- 保存後にObsidian Vault自動同期（git commit & push）

## Setup

```bash
git clone https://github.com/halsk/yt2obsidian.git
cd yt2obsidian
npm install
```

### API Key

AI要約を使う場合、`.env` ファイルを作成:

```bash
cp .env.example .env
# .env を編集して ANTHROPIC_API_KEY を設定
```

APIキーなしでも動作します（要約のみスキップ）。

## CLI Usage

```bash
# 基本（日本語字幕優先 + AI要約）
npm run transcript -- https://www.youtube.com/watch?v=xxxxx

# 短縮URL
npm run transcript -- https://youtu.be/xxxxx

# 言語指定
npm run transcript -- https://youtu.be/xxxxx --lang en

# 要約なし（トランスクリプトのみ）
npm run transcript -- https://youtu.be/xxxxx --no-summary

# Obsidian同期をスキップ
npm run transcript -- https://youtu.be/xxxxx --no-sync

# 出力先を指定
npm run transcript -- https://youtu.be/xxxxx --out ./output
```

## HTTP Server

### 起動

```bash
# 開発
npm run serve

# 本番（要 npm run build）
npm run build
npm start
```

デフォルトで `0.0.0.0:3456` でリッスン（`PORT` 環境変数で変更可）。

### 常時起動（systemd）

```bash
# サービスファイル作成
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/yt2obsidian.service << 'EOF'
[Unit]
Description=YT2Obsidian - YouTube transcript to Obsidian
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/yt2obsidian
ExecStart=/usr/bin/npx tsx src/server.ts
Restart=always
RestartSec=5
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF

# 有効化・起動
systemctl --user daemon-reload
systemctl --user enable yt2obsidian
systemctl --user start yt2obsidian
```

管理コマンド:

```bash
systemctl --user status yt2obsidian   # 状態確認
systemctl --user restart yt2obsidian  # 再起動
systemctl --user stop yt2obsidian     # 停止
journalctl --user -u yt2obsidian -f   # ログ確認
```

### エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/` | モバイル対応Webフォーム |
| GET/POST | `/api/transcript` | トランスクリプト API |
| GET | `/health` | ヘルスチェック |
| GET | `/debug` | リクエストエコー（デバッグ用） |

### API

```bash
# GET（iOS ショートカット向け）
curl "http://localhost:3456/api/transcript?url=https://youtu.be/xxxxx&skipSummary=true"

# POST（JSON）
curl -X POST http://localhost:3456/api/transcript \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://youtu.be/xxxxx","skipSummary":true}'
```

レスポンス:
```json
{
  "title": "動画タイトル",
  "channelName": "チャンネル名",
  "filename": "動画タイトル.md",
  "outputPath": "/home/hal/workspace/obsidian/Clippings/動画タイトル.md",
  "language": "ja",
  "hasSummary": true
}
```

### iOS ショートカット設定

Tailscale経由でスマホから使用:

1. ショートカットアプリで「YT2Obsidian」を作成
2. 共有シートに表示を有効化（詳細 → 「Receive What's On Screen」をON）
3. アクション追加:
   - **テキスト**: `http://<tailscale-hostname>:3456/api/transcript?url=` + ショートカットの入力
   - **URLの内容を取得**: 上のテキスト（GET）
   - **辞書の値を取得**: `title`
   - **通知を表示**: `保存完了: (title)`

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
  - "youtube"
  - "clippings"
  - "economics"        # AI生成（要約あり時のみ）
  - "interest-rates"   # AI生成
  - "financial-policy" # AI生成
  - "japan-economy"    # AI生成
  - "investment"       # AI生成
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
| `PORT` | HTTP server port (default: 3456) | No |

## License

MIT
