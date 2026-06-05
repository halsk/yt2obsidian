# Android から YouTube 動画を yt2obsidian に共有する

## 前提条件

- WSL2（または yt2obsidian ホスト）と Android が同一 Tailscale tailnet に参加していること

## セットアップ手順

1. Android Chrome で `http://100.70.239.65:3456/` を開く
2. Chrome メニュー（右上の⋮）→「ホーム画面に追加」（または「アプリをインストール」）
3. ホーム画面に yt2obsidian アイコンが追加されたことを確認

## 使い方

1. YouTube アプリで動画を開く
2. 「共有」ボタンをタップ
3. 共有メニューから「yt2obsidian」アイコンをタップ
4. transcript 生成が完了すると Obsidian Vault に保存される

## トラブルシューティング

**アイコンが共有メニューに出ない場合**
- PWA のインストールが完了していない可能性あり → ホーム画面のアイコンを確認
- Chrome バージョンが古い場合は更新
- manifest.json の share_target が正しく設定されているか Chrome DevTools で確認

**接続できない場合**
- Tailscale が両端で接続されているか確認: `tailscale status`
- yt2obsidian サーバーが起動しているか確認: `ps aux | grep node`
