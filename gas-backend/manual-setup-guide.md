# GAS手動セットアップガイド

## clasp認証問題の回避策

claspの認証で問題が発生した場合の手動セットアップ手順です。

## ステップ1: Google Apps Scriptでプロジェクト作成

1. [Google Apps Script](https://script.google.com) を開く
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「PM001 Shipping System」に変更
4. URLからプロジェクトIDをコピー
   - URL例: `https://script.google.com/d/1Abc2Def3Ghi4Jkl5Mno6Pqr7Stu8Vwx9Yz0/edit`
   - プロジェクトID: `1Abc2Def3Ghi4Jkl5Mno6Pqr7Stu8Vwx9Yz0`

## ステップ2: .clasp.json作成

取得したプロジェクトIDを使用して .clasp.json を作成:

```json
{
  "scriptId": "YOUR_PROJECT_ID_HERE",
  "rootDir": "./dist"
}
```

## ステップ3: コードのプッシュ

```bash
# TypeScriptビルド
npm run build

# コードをGASにプッシュ
npx clasp push --force
```

## ステップ4: Webアプリとしてデプロイ

Google Apps Scriptエディタで:

1. 「デプロイ」→「新しいデプロイ」
2. タイプ: ウェブアプリ
3. 実行ユーザー: 自分
4. アクセスできるユーザー: 全員（匿名ユーザーを含む）
5. 「デプロイ」をクリック

## ステップ5: 設定の追加

1. GASエディタで「プロジェクトの設定」→「スクリプト プロパティ」
2. 以下のプロパティを追加:
   - キー: `SPREADSHEET_ID`
   - 値: スプレッドシートのID

## ステップ6: 動作テスト

1. デプロイ後に表示されるWebアプリURLをテスト
2. `src/html-files/gas-integration.js` の `GAS_API_URL` を更新

## 自動化スクリプト（手動作成後）

```bash
# .clasp.jsonが作成された後の自動化
npm run push    # ビルド＆プッシュ
npm run deploy  # デプロイ更新
```

## トラブルシューティング

### 「Authorization required」エラー
- GASエディタで初回実行時の認証を完了する

### 「Exceeded maximum execution time」
- 関数の実行時間を確認し、必要に応じて分割

### CORS エラー
- Webアプリの設定で「匿名ユーザーを含む全員」に設定されているか確認