# GAS AI完全自動デプロイ - 知見記録

## 作業日時
2025年7月4日

## 目標
GASのデプロイプロセスを可能な限りAIで自動化し、Geminiを活用して最適化する

## 1. clasp認証プロセス

### 認証方法の選択肢
1. **--no-localhost オプション**
   - ローカルサーバーを起動せずに認証
   - WSL環境で有効
   - URLを手動でコピー＆ペーストする必要あり

2. **通常のclasp login**
   - ローカルサーバー（ポート8080）を起動
   - WSL環境では追加設定が必要

### 認証フロー
```bash
npx clasp login --no-localhost
```
1. 認証URLが表示される
2. ブラウザでURLを開く
3. Googleアカウントでログイン
4. 認証後のリダイレクトURLをコピー
5. ターミナルに貼り付け

### 必要な権限スコープ
- script.deployments - デプロイ管理
- script.projects - プロジェクト管理
- script.webapp.deploy - Webアプリデプロイ
- drive.file - ドライブファイルアクセス
- service.management - サービス管理
- userinfo.email/profile - ユーザー情報

## 2. プロジェクト作成の課題

### .clasp.jsonの構造
```json
{
  "scriptId": "XXXXXXXXXXXXXXXXXXXXX",
  "rootDir": "./dist"
}
```

### 自動化の制限
- scriptIdはGoogle側で生成される
- 初回作成時は対話的な操作が必要
- APIでの完全自動化は制限あり

## 3. TypeScriptビルドプロセス

### ビルド前の準備
1. TypeScriptのインストール確認
2. tsconfig.jsonの設定確認
3. 型定義ファイルの確認

### ビルド手順
```bash
npm run build
```
- src/からdist/へトランスパイル
- appsscript.jsonをdistにコピー必須

### .claspignoreの重要性
```
**/**
!dist/**/*.js
!dist/appsscript.json
```
- distディレクトリのみアップロード
- ソースファイルは除外

## 4. デプロイ自動化の検討

### 方法1: clasp CLIのみ
```bash
# プロジェクト作成
npx clasp create --type webapp --title "Project Name" --rootDir ./dist

# コードプッシュ
npx clasp push

# デプロイ
npx clasp deploy --description "Initial deployment"
```

### 方法2: GAS APIを使用
- Apps Script APIを有効化
- サービスアカウントの作成
- APIキーによる認証

### 方法3: GitHub Actionsとの統合
```yaml
- name: Deploy to GAS
  env:
    CLASPRC_JSON: ${{ secrets.CLASPRC_JSON }}
  run: |
    echo "$CLASPRC_JSON" > ~/.clasprc.json
    npx clasp push
    npx clasp deploy
```

## 5. 未解決の課題と質問

### Geminiに聞くべき質問
1. GAS APIを使用した完全自動デプロイは可能か？
2. clasp認証トークンの有効期限と更新方法
3. CI/CD環境でのベストプラクティス
4. 複数環境（dev/staging/prod）の管理方法

### 技術的制限
1. OAuth認証の初回は手動必須
2. プロジェクトIDの事前取得不可
3. Webアプリデプロイ時のURL取得タイミング

## 6. エラーと対処法

### よくあるエラー
1. **"User not logged in"**
   - 解決: `npx clasp login`を再実行

2. **"Push failed"**
   - 原因: .clasp.jsonが存在しない
   - 解決: `npx clasp create`を実行

3. **"Permission denied"**
   - 原因: スコープ不足
   - 解決: 再ログインして権限を追加

## 7. 次のステップ

1. 認証完了後の自動化スクリプト作成
2. デプロイパイプラインの構築
3. エラーハンドリングの実装
4. Geminiでの最適化提案の取得

## 8. 発生したエラーと対処法

### エラー1: "Invalid container file type"
**状況:** clasp createコマンド実行時
**原因:** appsscript.jsonファイルの内容が空または破損
**対処法:** 
1. appsscript.jsonを手動で再作成
2. 正しいJSON形式で保存
```json
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

### エラー2: "No credentials found"
**状況:** clasp create実行時
**原因:** 認証情報の問題
**現在の状況:** ~/.clasprc.jsonは存在するが、claspが認証を認識していない

### 認証問題の詳細調査
- 認証ファイルは存在: ~/.clasprc.json
- ファイル内容: tokens オブジェクトが存在
- しかし clasp create で "No credentials found" エラー

### 次のアプローチ
1. clasp logout && clasp login で再認証
2. 手動でGoogle Apps Script エディタからプロジェクト作成
3. 既存プロジェクトIDを使用した .clasp.json 手動作成

## 9. Playwright MCP統合の検討

### Playwright自動テストの組み込み
- GASデプロイ後の自動テスト実行
- WebアプリのURL取得と動作確認
- フォーム送信テストの自動化

### MCP活用でのワークフロー
1. GASデプロイ完了
2. PlaywrightでWebアプリアクセステスト
3. フォーム機能の自動テスト
4. 結果レポートの自動生成

## 10. 継続調査項目

- [ ] clasp認証問題の根本解決
- [ ] GAS Management APIの詳細調査
- [ ] Playwright MCPとの統合方法
- [ ] 完全自動化CI/CDパイプライン構築
- [ ] Google Cloud SDKとの連携可能性