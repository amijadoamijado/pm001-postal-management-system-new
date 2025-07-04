# Google Apps Script 自動デプロイツール完全ガイド

## 🚀 clasp (Command Line Apps Script Projects)

### 概要
- **提供**: Google公式
- **機能**: コマンドラインからGASプロジェクトを完全管理
- **利点**: ローカル開発 → 自動デプロイ → バージョン管理

---

## 📦 clasp インストール・設定

### インストール
```bash
# Node.js必須（事前インストール）
npm install -g @google/clasp

# インストール確認
clasp --version
```

### 初期設定
```bash
# Googleアカウント認証
clasp login

# Apps Script API有効化
# https://script.google.com/home/usersettings でAPI有効化が必要
```

---

## 🔧 clasp 基本コマンド

### プロジェクト管理
```bash
# 新規プロジェクト作成
clasp create "PM001-PostalSystem"
clasp create --type webapp "PM001-PostalSystem"

# 既存プロジェクトクローン
clasp clone [スクリプトID]

# プロジェクト情報表示
clasp status
```

### ファイル同期・デプロイ
```bash
# ローカル → GAS アップロード
clasp push

# GAS → ローカル ダウンロード  
clasp pull

# Webアプリデプロイ
clasp deploy

# デプロイ履歴確認
clasp deployments

# 特定バージョンデプロイ
clasp deploy --versionNumber 2
```

### 開発・テスト
```bash
# ブラウザでGASエディタ開く
clasp open

# 関数実行
clasp run 関数名

# ログ確認
clasp logs
```

---

## 🎯 PM001 での clasp 活用例

### Step 1: プロジェクト初期化
```bash
# PM001用ディレクトリ作成
mkdir PM001-clasp
cd PM001-clasp

# GASプロジェクト作成
clasp create --type webapp "PM001-PostalSystem"
```

### Step 2: ローカルファイル配置
```bash
# プロジェクト構造
PM001-clasp/
├── appsscript.json
├── Code.js
├── Database.js
├── ErrorHandler.js
├── WebApp.js
└── index.html
```

### Step 3: 自動デプロイ
```bash
# ファイル更新 → GAS反映
clasp push

# Webアプリとしてデプロイ
clasp deploy --description "PM001 v1.0"

# デプロイURL取得
clasp deployments
```

---

## 🔄 GitHub Actions 統合

### 自動デプロイワークフロー
```yaml
# .github/workflows/gas-deploy.yml
name: Deploy to Google Apps Script

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
        
    - name: Install clasp
      run: npm install -g @google/clasp
      
    - name: Create clasprc.json
      run: echo '${{ secrets.CLASPRC_JSON }}' > ~/.clasprc.json
      
    - name: Deploy to GAS
      run: |
        clasp push
        clasp deploy
```

### GitHub Secrets設定
```bash
# ~/.clasprc.json の内容を GitHub Secrets に CLASPRC_JSON として登録
```

---

## 📋 PM001専用 clasp 設定

### appsscript.json
```json
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {
    "enabledAdvancedServices": []
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
  ]
}
```

### .clasp.json
```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "projectId": "YOUR_PROJECT_ID"
}
```

---

## 🛠️ 他のデプロイツール

### gas-client
```bash
npm install -g gas-client

# 使用例
gas upload
gas deploy
```

### apps-script-cli
```bash
npm install -g apps-script-cli

# 使用例
appsscript create PM001
appsscript deploy
```

---

## ⚡ PM001 緊急デプロイ手順【clasp版】

### 即座実行可能
```bash
# 1. clasp セットアップ（5分）
npm install -g @google/clasp
clasp login

# 2. PM001プロジェクト作成（3分）
mkdir PM001-clasp
cd PM001-clasp
clasp create --type webapp "PM001-PostalSystem"

# 3. ファイル配置（2分）
# PM001_DEPLOY_PACKAGE.md からファイルをコピー

# 4. デプロイ実行（1分）
clasp push
clasp deploy

# 5. URL確認
clasp deployments
```

---

## 🎯 TS001 テスト自動化との統合

### テスト → デプロイ自動化
```bash
# テスト実行
npm test

# テスト通過時のみデプロイ
if [ $? -eq 0 ]; then
  clasp push
  clasp deploy
  echo "✅ デプロイ完了"
else
  echo "❌ テスト失敗 - デプロイ中止"
fi
```

### CI/CD パイプライン
```yaml
# テスト → デプロイ → 動作確認の自動化
test:
  - npm run test-gas
deploy:  
  - clasp push
  - clasp deploy
verify:
  - curl ${WEBAPP_URL}/test
  - npm run integration-test
```

---

## 📊 clasp の利点・効果

### 開発効率向上
```
✅ ローカル開発環境での作業
✅ Git バージョン管理統合
✅ 自動デプロイ・継続的統合
✅ チーム開発の協働支援
✅ テスト → デプロイの自動化
```

### 品質向上効果
```
✅ デプロイの標準化・自動化
✅ 人的ミスの削減
✅ バージョン管理の徹底
✅ ロールバック機能
✅ 環境差異の排除
```

---

## 🚨 注意事項・制限

### 制限事項
```
⚠️ Apps Script API の有効化必須
⚠️ 認証トークンの管理重要
⚠️ GAS エディタとの同期注意
⚠️ デプロイ権限の確認必要
```

### セキュリティ考慮
```
🔒 認証情報の安全管理
🔒 GitHub Secrets の適切使用
🔒 アクセス権限の最小化
🔒 API キーの定期更新
```

---

## 🎊 期待される効果

### PM001 での効果
```
✅ 手動デプロイ作業の撲滅
✅ デプロイミスの回避
✅ 修正 → テスト → デプロイの自動化
✅ バージョン管理の徹底
✅ チーム開発の支援
```

### 今後のプロジェクトでの効果
```
✅ 開発速度の大幅向上
✅ 品質の安定化・向上
✅ 継続的インテグレーション
✅ 自動化レベルの向上
✅ 開発体制の効率化
```

**clasp により、GAS開発の自動化・効率化・品質向上を実現！**