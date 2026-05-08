# Changelog

このファイルは、`歯科行政管理システム / 施設基準管理アプリ` の主な変更履歴を記録するためのものです。

## [Unreleased]

### Added

- GitHub運用のための `README.md` を追加
- GitHub運用のための `CHANGELOG.md` を追加
- GitHub運用のための `.gitignore` を追加
- 管理者モードの入口を追加
- 公式Excel/ZIP取込に備えた画面枠を追加

### Changed

- `index.html` 内の CSS を `./assets/css/style.css` に分離
- JavaScript を `./assets/js/data.js` `./assets/js/admin.js` `./assets/js/app.js` に分割し、静的読み込み順を整理
- `./assets/js/import-excel.js` を Excel 取込機能用のプレースホルダーとして追加
- 管理者モードを通常ナビゲーションから外し、右上の `設定` メニュー配下へ移動
- 管理者用画面にパスフレーズ入力モーダル、セッション管理、終了導線、注意書きを追加
- 管理者パスフレーズを `localStorage` の SHA-256 ハッシュ、管理者ログイン状態を `sessionStorage` で扱うよう整理

### Planned

- Excel取込本体は未実装

## 既存履歴整理

### Changed

- 配布用エントリHTMLを `index.html` にリネーム

### Fixed

- PDF取込時の医療機関番号誤認識を修正
- PDF取込時の医院名誤抽出を修正
- PDF選択UIを修正し、ファイル選択ダイアログからのPDF読込に対応
