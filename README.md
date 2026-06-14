# 課題管理アプリ v4

千葉工業大学の manaba から課題を自動取り込みして管理するアプリです。

## Chrome 拡張機能のダウンロード

[![Download](https://img.shields.io/badge/Download-manaba--extension--v4.zip-6366f1?style=for-the-badge&logo=googlechrome)](https://github.com/chickenmark2/task-manager-v4/releases/download/v4.0.0/manaba-extension-v4.zip)

**[→ Releases ページからダウンロード](https://github.com/chickenmark2/task-manager-v4/releases/tag/v4.0.0)**

### インストール手順

1. 上のボタンから `manaba-extension-v4.zip` をダウンロードして解凍
2. Chrome で `chrome://extensions` を開く
3. 右上の「デベロッパーモード」をオン
4. 「パッケージ化されていない拡張機能を読み込む」→ 解凍した `manaba-extension` フォルダを選択

> v3 の拡張機能を使用中の場合は、一度削除してから再インストールしてください。

---

## v3 からの変更点

### 1. manaba タブを問わずスキャン可能に
アクティブなタブが manaba でなくてもスキャンできるようになりました。Chrome 内に manaba のタブが開いていれば自動的に検索します。

### 2. 集中モード：ポモドーロ / 52-17 タイマー
- **ポモドーロ**: 25 分集中 → 5 分休憩
- **52/17 ルール**: 52 分集中 → 17 分休憩
- カウントダウンのリングタイマー表示、タイマー切れで自動移行

### 3. ステップ 0 件での課題登録
ステップなしで課題を作成・登録できるようになりました。

### 4. ダークモード
ヘッダー右上の ☀️ / 🌙 スイッチでライト・ダークを切り替えられます。設定は次回アクセス時も保持されます。

---

## ファイル構成

```
├── manaba-extension/   # Chrome 拡張機能
└── task-manager/       # Web アプリ (React + Vite + Firebase)
```

## 技術スタック

- **フロントエンド**: React + Vite
- **バックエンド / DB**: Firebase (Firestore + Authentication)
- **Chrome 拡張機能**: Manifest V3
