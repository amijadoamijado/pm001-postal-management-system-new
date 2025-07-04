# PM001 TaskMaster設定ファイル

## プロジェクト初期化コマンド
```bash
# プロジェクトフォルダで実行
cd C:\Users\a-odajima\Desktop\claudecode\pm001-shipping-system
npx task-master init --project-name "PM001郵便物発送管理システム"
```

## tasks.json構造例
```json
{
  "project": "PM001-shipping-system",
  "version": "1.0.0",
  "tasks": [
    {
      "id": 1,
      "taskId": "PM001-T1.1",
      "title": "GASプロジェクト基盤構築",
      "description": "Google Apps Scriptプロジェクト作成と基本設定",
      "priority": "critical",
      "status": "pending",
      "dependencies": [],
      "estimatedHours": 8,
      "subtasks": [
        {
          "id": "1.1",
          "title": "GASプロジェクト作成",
          "status": "pending"
        },
        {
          "id": "1.2",
          "title": "appsscript.json設定",
          "status": "pending"
        },
        {
          "id": "1.3",
          "title": "基本ファイル構造作成",
          "status": "pending"
        }
      ]
    }
  ]
}
```

## TaskMaster活用フロー
```bash
# 1. PRDからタスク生成
npx task-master parse-prd --input PM001_TaskMaster_実装・テスト計画.md

# 2. タスク複雑度分析
npx task-master analyze

# 3. 日次進捗更新
npx task-master done --id 1.1  # サブタスク完了
npx task-master update-task --id 1 --prompt "appsscript.json設定完了、次はファイル構造作成"

# 4. 次のタスク確認
npx task-master next

# 5. 週次レポート生成
npx task-master report --format markdown > reports/week1-report.md
```
