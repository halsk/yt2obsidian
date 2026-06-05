# macOS セットアップ手順

yt2obsidian を macOS（Mac mini 等）で **launchd** によるバックグラウンド常駐サービスとしてセットアップする手順。

## 前提

- macOS（Apple Silicon 推奨、Intel でも可）
- **Node.js 20+** （`brew install node` または [Volta](https://volta.sh/) 推奨）
- `npx` が `/usr/local/bin/npx`（Intel Mac）または `/opt/homebrew/bin/npx`（Apple Silicon）に存在
- ポート `3456` 空き

```bash
# Node.js 確認
node --version  # v20+ 必要
which npx       # パス確認（後で plist にも反映が必要な場合あり）
```

## 1. クローン + 依存インストール

```bash
git clone https://github.com/halsk/yt2obsidian.git ~/workspace/yt2obsidian
cd ~/workspace/yt2obsidian
npm install
# または pnpm install （リポに pnpm-lock.yaml もあり）
```

## 2. 環境変数設定

```bash
cp .env.example .env
# .env を編集して ANTHROPIC_API_KEY 等を設定（要約機能を使う場合）
```

詳細は [README.md の API Key セクション](../README.md#api-key) を参照。

## 3. launchd plist の配置

このリポの [`launchd/com.geolonia.yt2obsidian.plist`](../launchd/com.geolonia.yt2obsidian.plist) を
`~/Library/LaunchAgents/` にコピー：

```bash
cp launchd/com.geolonia.yt2obsidian.plist ~/Library/LaunchAgents/
```

⚠️ plist 内のパスはユーザー名 `hal` を前提に書かれているため、Mac mini の実ユーザー名と
異なる場合は置換が必要：

```bash
sed -i '' "s|/Users/hal|$HOME|g" ~/Library/LaunchAgents/com.geolonia.yt2obsidian.plist
```

⚠️ `npx` のパスが `/usr/local/bin/npx` ではない場合（Apple Silicon の Homebrew 等）も置換：

```bash
NPX_PATH=$(which npx)
sed -i '' "s|/usr/local/bin/npx|$NPX_PATH|g" ~/Library/LaunchAgents/com.geolonia.yt2obsidian.plist
```

## 4. ログディレクトリ準備

```bash
mkdir -p ~/Library/Logs
```

## 5. 起動 + 自動起動有効化

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.geolonia.yt2obsidian.plist
launchctl kickstart -k gui/$(id -u)/com.geolonia.yt2obsidian
```

## 6. 動作確認

```bash
# 状態確認
launchctl list | grep yt2obsidian
# 出力例: <PID> <ExitCode> com.geolonia.yt2obsidian

# ログ確認
tail -f ~/Library/Logs/yt2obsidian.log

# HTTP エンドポイント疎通
curl http://localhost:3456/health
curl http://localhost:3456/

# Tailscale 経由（他端末アクセス想定）
curl "http://$(tailscale ip -4):3456/health"
```

## 停止 / 再起動 / アップデート

```bash
# 停止
launchctl bootout gui/$(id -u)/com.geolonia.yt2obsidian

# 再起動
launchctl bootout gui/$(id -u)/com.geolonia.yt2obsidian
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.geolonia.yt2obsidian.plist

# アップデート
cd ~/workspace/yt2obsidian
git pull
npm install  # or pnpm install
launchctl kickstart -k gui/$(id -u)/com.geolonia.yt2obsidian
```

## ファイアウォール許可

初回起動時、macOS が `node` の incoming network 受信について確認ダイアログを
出す場合あり。Tailscale 経由疎通させたい場合は **「許可」** を選択。

## Tailscale 経由 / Android Share Target

WSL2 版と同じく PWA + Web Share Target API が有効ゆえ、Android 端末から
`http://<Mac mini Tailscale IP>:3456/` を Chrome で開く → 「ホーム画面に追加」
で共有メニューに yt2obsidian が現れる。詳細は [share-from-android.md](share-from-android.md) を参照。

## トラブルシュート

| 症状 | 対処 |
|------|------|
| `npx: command not found` (ログ) | plist の `ProgramArguments` 内 `npx` パスを `which npx` の結果で置換 |
| `EADDRINUSE: address already in use 0.0.0.0:3456` | `lsof -i :3456` で競合プロセスを確認、別ポートに変更 (`PORT` 環境変数) |
| `tsx not found` | `npm install` を再実行（devDependencies に `tsx` 含まれる） |
| `Application crashed` 連続 | `~/Library/Logs/yt2obsidian.error.log` を確認、API Key 不備や Node.js バージョン不一致をチェック |
