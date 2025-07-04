# GAS clasp実装 - 知見・エラー・問題点の記録

## 作業日時
2025年7月4日

## 環境情報
- Node.js: v18.19.1
- npm: 9.2.0
- @google/clasp: 3.0.6-alpha
- TypeScript: 5.8.3

## 遭遇したエラーと解決方法

### 1. Node.jsバージョン警告
**エラー内容:**
```
npm WARN EBADENGINE Unsupported engine {
  package: '@google/clasp@3.0.6-alpha',
  required: { node: ' >=20.0.0' },
  current: { node: 'v18.19.1', npm: '9.2.0' }
}
```

**影響:**
- 警告は出るが、基本的な機能は動作する
- 最新のclasp機能を使う場合はNode.js 20以上が推奨

**解決策:**
- 本番環境ではNode.js 20以上を使用することを推奨
- 開発環境では警告を無視して続行可能

### 2. グローバルインストール権限エラー
**エラー内容:**
```
npm ERR! Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules/@google'
```

**解決策:**
- ローカルインストール（--save-dev）を使用
- npxコマンドでclaspを実行

### 3. CORS問題への対処
**問題:**
- GAS WebアプリはCORS制限があり、通常のfetchでは詳細なレスポンスが取得できない

**解決策:**
```javascript
// mode: 'no-cors'を使用
fetch(GAS_API_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
        'Content-Type': 'text/plain'
    },
    body: JSON.stringify(data)
});
```

**制限事項:**
- no-corsモードではレスポンスボディを読めない
- エラーハンドリングが制限される

## TypeScriptでのGAS開発のポイント

### 1. 型定義の活用
```typescript
interface ShippingData {
  method: string;
  weight: number;
  express: boolean;
  // ...
}
```
- @types/google-apps-scriptで型安全性を確保
- インターフェースでデータ構造を明確化

### 2. GAS固有のAPIの扱い
```typescript
// PropertiesServiceを使った環境変数管理
const scriptProperties = PropertiesService.getScriptProperties();
const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');
```

### 3. doPost/doGetの実装
```typescript
function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  // e.postData.contentsでPOSTデータを取得
  const requestData = JSON.parse(e.postData.contents);
}
```

## claspワークフローのベストプラクティス

### 1. ディレクトリ構造
```
gas-backend/
├── src/           # TypeScriptソース
├── dist/          # トランスパイル後のJS
├── .claspignore   # アップロード除外設定
├── appsscript.json # GASマニフェスト
└── tsconfig.json   # TypeScript設定
```

### 2. npmスクリプトの活用
```json
{
  "scripts": {
    "build": "tsc",
    "push": "npm run build && npx clasp push",
    "deploy": "npm run push && npx clasp deploy"
  }
}
```

### 3. .claspignoreの重要性
```
# TypeScriptファイルは除外
src/**/*.ts
# distのJSファイルのみアップロード
!dist/**/*.js
```

## セキュリティ考慮事項

### 1. 認証設定
```json
"webapp": {
  "executeAs": "USER_DEPLOYING",  // 実行者の権限
  "access": "ANYONE_ANONYMOUS"     // 匿名アクセス許可
}
```

### 2. データ検証
- クライアントからのデータは必ず検証
- スプレッドシートIDは環境変数で管理

### 3. エラーハンドリング
- try-catchでエラーをキャッチ
- ユーザーに詳細なエラー情報を返さない

## パフォーマンス最適化

### 1. バッチ処理
```typescript
// 複数のセルを一度に更新
sheet.getRange(row, 1, 1, data.length).setValues([data]);
```

### 2. キャッシュの活用
- PropertiesServiceでの設定値キャッシュ
- 頻繁にアクセスするシートの参照を保持

## デプロイ手順

1. **初回セットアップ**
   ```bash
   npm run login     # Googleアカウントでログイン
   npm run create    # 新規プロジェクト作成
   ```

2. **開発サイクル**
   ```bash
   npm run build     # TypeScriptをトランスパイル
   npm run push      # GASにアップロード
   npm run deploy    # 新バージョンをデプロイ
   ```

3. **環境変数設定**
   - GASエディタでプロジェクトのプロパティを設定
   - SPREADSHEET_IDなどを設定

## トラブルシューティング

### 1. clasp pushが失敗する場合
- .clasp.jsonが存在するか確認
- プロジェクトIDが正しいか確認
- ログイン状態を確認（clasp logout → clasp login）

### 2. TypeScriptエラー
- tsconfig.jsonの設定を確認
- @types/google-apps-scriptが最新か確認

### 3. 実行時エラー
- GASのログ（View → Logs）で確認
- console.logの出力を確認

## 今後の改善提案

1. **エラーレスポンスの改善**
   - カスタムエラーコードの実装
   - クライアント側でのリトライ機能

2. **パフォーマンス向上**
   - 履歴データのページネーション
   - キャッシュサービスの活用

3. **セキュリティ強化**
   - APIキーによる認証
   - レート制限の実装

4. **開発効率化**
   - ローカルテスト環境の構築
   - CI/CDパイプラインの整備

## まとめ
claspを使用したGAS開発は、TypeScriptによる型安全性とモダンな開発環境を提供する。初期設定には若干の手間がかかるが、長期的なメンテナンス性と開発効率を大幅に向上させる。Node.jsバージョンとCORS制限に注意が必要。