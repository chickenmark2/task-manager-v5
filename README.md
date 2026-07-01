# 課題管理アプリ v5

千葉工業大学の manaba から課題を自動取り込みして管理するアプリです。

## アプリ

> Vercel へのデプロイ後に URL を記載します

## v4 からの変更点

### 1. タイマー終了時の音通知
- 集中タイムが終わると **高音→低音** の通知音が鳴ります。
- 休憩タイムが終わると **低音→高音** の通知音が鳴ります。
- Web Audio API を使用（外部ライブラリ不要）。

### 2. カスタムタイマーモード
- タイマー選択画面に **「カスタム」** が追加されました。
- 集中時間（1〜120 分）と休憩時間（1〜60 分）を自由に設定できます。
- 設定した時間はモード選択画面にプレビュー表示されます。

---

## 機能一覧

- manaba の課題を Chrome 拡張機能で手動取り込み
- 締め切り順・作成日順の並び替え
- 課題をステップに分割して進捗管理
- 集中モード（ポモドーロ / 52-17 / カスタムタイマー付き）
- タイマー終了時の音通知
- ご褒美タイムの設定
- ダークモード対応
- Firebase によるクロスデバイス同期

---

## Chrome 拡張機能のインストール

**v4 の拡張機能がそのまま使えます。**

[![Download](https://img.shields.io/badge/Download-manaba--extension--v4.zip-6366f1?style=for-the-badge&logo=googlechrome)](https://github.com/chickenmark2/task-manager-v4/releases/download/v4.0.0/manaba-extension-v4.zip)

**[→ Releases ページからダウンロード](https://github.com/chickenmark2/task-manager-v4/releases/tag/v4.0.0)**

1. 上のボタンから `manaba-extension-v4.zip` をダウンロードして解凍
2. Chrome で `chrome://extensions` を開く
3. 右上の「デベロッパーモード」をオン
4. 「パッケージ化されていない拡張機能を読み込む」→ 解凍した `manaba-extension` フォルダを選択

---

## 使い方

### 課題のスキャン・登録

1. manaba（`https://cit.manaba.jp`）を **どこかのタブで開く**（アクティブでなくてもOK）
2. 拡張機能アイコンをクリックしてログイン（初回のみ）
3. 「🔍 manabaをスキャン」をクリック
4. 取り込む課題にチェックを入れて「✅ 選択した課題を登録する」をクリック

> **ポイント**: 未提出課題一覧ページ (`cit.manaba.jp/ct/home_library_query`) を開いておくと全課題をまとめて取り込めます。

### 集中モードの使い方

1. 課題をタップして課題詳細ページへ
2. 「🎯 集中モードで始める」をクリック
3. タイマーモードを選択（ポモドーロ / 52-17 / カスタム）
4. カスタムを選んだ場合は集中・休憩時間を入力して「開始する」
5. タイマーに従って集中・休憩を繰り返し、ステップを完了していく

---

## 技術スタック

- **フロントエンド**: React + Vite
- **バックエンド / DB**: Firebase (Firestore + Authentication)
- **Chrome 拡張機能**: Manifest V3
