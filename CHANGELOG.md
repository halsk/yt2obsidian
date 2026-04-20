# Changelog

## [Unreleased]

### Added
- YouTube Live URL 対応: `youtube.com/live/{id}` 形式のURLからVideo IDを抽出可能に
- vitest によるユニットテスト基盤を追加

### Changed
- エラーメッセージを日本語化
  - 無効なURL: `無効なYouTube URLです: {input}`
  - 字幕なし: `この動画には字幕（トランスクリプト）がありません。ライブ配信アーカイブの場合、自動字幕が生成されるまで数時間〜数日かかることがあります。`
