# PM001 郵便物発送管理システム - GAS Backend

## セットアップ手順

### 1. 依存関係のインストール
```bash
npm install
```

### 2. Googleアカウントでログイン
```bash
npm run login
```

### 3. GASプロジェクトの作成
```bash
npm run create
```
これにより、`.clasp.json`ファイルが生成されます。

### 4. TypeScriptのビルドとデプロイ
```bash
npm run deploy
```

### 5. スプレッドシートの準備
1. Google Sheetsで新規スプレッドシートを作成
2. スプレッドシートのIDをコピー（URLの`/d/`と`/edit`の間の文字列）

### 6. GASプロジェクトの設定
1. [https://script.google.com](https://script.google.com)でプロジェクトを開く
2. プロジェクトの設定 → スクリプト プロパティ
3. 以下のプロパティを追加：
   - キー: `SPREADSHEET_ID`
   - 値: コピーしたスプレッドシートID

### 7. Webアプリとしてデプロイ
1. デプロイ → 新しいデプロイ
2. 種類: ウェブアプリ
3. 実行ユーザー: 自分
4. アクセスできるユーザー: 全員（匿名ユーザーを含む）
5. デプロイ

### 8. フロントエンドの設定
1. デプロイ後に表示されるWebアプリのURLをコピー
2. `src/html-files/gas-integration.js`の`GAS_API_URL`を更新

## 開発コマンド

- `npm run build` - TypeScriptをコンパイル
- `npm run push` - GASにコードをアップロード
- `npm run deploy` - ビルド＆プッシュ＆デプロイ

## ディレクトリ構造

```
gas-backend/
├── src/
│   └── main.ts         # メインのTypeScriptコード
├── dist/               # コンパイル後のJavaScript
├── appsscript.json     # GASマニフェスト
├── tsconfig.json       # TypeScript設定
├── .claspignore        # clasp除外設定
└── package.json        # npm設定
```

## API仕様

### POST /exec
発送データを記録

**リクエストボディ:**
```json
{
  "address": {
    "name": "山田太郎",
    "company": "株式会社サンプル",
    "postalCode": "100-0001",
    "address": "東京都千代田区..."
  },
  "shippingData": {
    "method": "standard_regular",
    "weight": 50,
    "express": false,
    "trackingNumber": "",
    "contentType": "書類",
    "contentDetail": "契約書",
    "postingMethod": "metered-mail"
  },
  "timestamp": "2025-07-04T12:00:00Z"
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "recordId": "PM001-123",
    "fee": 140,
    "timestamp": "2025-07-04T12:00:00Z"
  }
}
```

### GET /exec
APIの動作確認

**レスポンス:**
```json
{
  "success": true,
  "message": "PM001 Shipping System API is running",
  "version": "1.0.0"
}
```

## トラブルシューティング

### clasp pushでエラーが出る場合
1. `.clasp.json`が存在することを確認
2. `npm run login`で再ログイン
3. `dist/`ディレクトリが存在することを確認

### TypeScriptのコンパイルエラー
1. `npm install`を再実行
2. `tsconfig.json`の設定を確認

### GASでの実行時エラー
1. GASエディタでログを確認（表示 → ログ）
2. スプレッドシートIDが正しく設定されているか確認