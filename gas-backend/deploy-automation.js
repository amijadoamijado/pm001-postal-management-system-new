// GAS自動デプロイスクリプト
// このスクリプトは認証後に実行することで、完全自動デプロイを実現

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 設定
const config = {
  projectTitle: 'PM001 Shipping System',
  description: 'Postal Management System Backend',
  timezone: 'Asia/Tokyo',
  spreadsheetId: process.env.SPREADSHEET_ID || ''
};

// カラー出力用
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

// ログ出力
function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

// コマンド実行
function exec(command, silent = false) {
  try {
    const result = execSync(command, { encoding: 'utf8' });
    if (!silent) {
      log(`✓ ${command}`, colors.green);
    }
    return result;
  } catch (error) {
    log(`✗ ${command}`, colors.red);
    log(error.message, colors.red);
    throw error;
  }
}

// ステップ1: 認証状態確認
function checkAuth() {
  log('\n=== Step 1: 認証状態確認 ===', colors.bright);
  // サービスアカウントキーのパスを環境変数から取得
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialsPath && fs.existsSync(credentialsPath)) {
    log('サービスアカウントの認証情報が見つかりました ✓', colors.green);
    log(`パス: ${credentialsPath}`, colors.blue);
    return true;
  }

  log('サービスアカウントの認証情報が見つかりません', colors.yellow);
  log('環境変数 GOOGLE_APPLICATION_CREDENTIALS を設定してください', colors.yellow);
  log('設定例: export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/credentials.json"', colors.bright);
  return false;
}

// ステップ2: ビルド
function build() {
  log('\n=== Step 2: TypeScriptビルド ===', colors.bright);
  exec('npm run build');
  
  // appsscript.jsonをコピー
  const source = path.join(__dirname, 'appsscript.json');
  const dest = path.join(__dirname, 'dist', 'appsscript.json');
  fs.copyFileSync(source, dest);
  log('✓ appsscript.jsonをdistにコピー', colors.green);
}

// ステップ3: プロジェクト作成または既存プロジェクト使用
function createOrUseProject() {
  log('\n=== Step 3: GASプロジェクト設定 ===', colors.bright);
  
  const claspJsonPath = path.join(__dirname, '.clasp.json');
  
  if (fs.existsSync(claspJsonPath)) {
    log('既存のプロジェクトを使用します', colors.green);
    const claspJson = JSON.parse(fs.readFileSync(claspJsonPath, 'utf8'));
    log(`Project ID: ${claspJson.scriptId}`, colors.blue);
    return claspJson.scriptId;
  } else {
    log('新規プロジェクトを作成します', colors.yellow);
    const result = exec(`npx clasp create --type webapp --title "${config.projectTitle}" --rootDir ./dist`);
    
    // .clasp.jsonを読み込んでプロジェクトIDを取得
    const claspJson = JSON.parse(fs.readFileSync(claspJsonPath, 'utf8'));
    log(`✓ プロジェクト作成完了: ${claspJson.scriptId}`, colors.green);
    return claspJson.scriptId;
  }
}

// ステップ4: コードをプッシュ
function pushCode() {
  log('\n=== Step 4: コードをGASにプッシュ ===', colors.bright);
  exec('npx clasp push --force');
}

// ステップ5: プロジェクト設定
function configureProject(scriptId) {
  log('\n=== Step 5: プロジェクト設定 ===', colors.bright);
  
  // 設定ファイルを作成
  const configScript = `
// このスクリプトをGASエディタで実行してください
function setupProjectProperties() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('SPREADSHEET_ID', '${config.spreadsheetId}');
  
  console.log('プロパティを設定しました:');
  console.log('SPREADSHEET_ID:', scriptProperties.getProperty('SPREADSHEET_ID'));
}

// テスト用関数
function testSetup() {
  const response = doGet({});
  console.log(response.getContent());
}
`;

  const setupPath = path.join(__dirname, 'dist', 'setup.js');
  fs.writeFileSync(setupPath, configScript);
  log('✓ セットアップスクリプトを作成しました', colors.green);
  
  // プッシュ
  exec('npx clasp push --force');
}

// ステップ6: デプロイ
function deploy() {
  log('\n=== Step 6: Webアプリとしてデプロイ ===', colors.bright);
  
  try {
    const result = exec('npx clasp deploy --description "Automated deployment"');
    
    // デプロイIDを抽出
    const deployIdMatch = result.match(/- ([a-zA-Z0-9_-]+) @/);
    if (deployIdMatch) {
      const deployId = deployIdMatch[1];
      log(`✓ デプロイID: ${deployId}`, colors.green);
      
      // デプロイ情報を取得
      const deployments = exec('npx clasp deployments', true);
      log('\nデプロイ一覧:', colors.bright);
      console.log(deployments);
      
      return deployId;
    }
  } catch (error) {
    log('デプロイに失敗しました', colors.red);
    throw error;
  }
}

// ステップ7: 設定手順を表示
function showNextSteps(scriptId) {
  log('\n=== 次の手順 ===', colors.bright);
  log('1. 以下のURLでGASエディタを開いてください:', colors.yellow);
  log(`   https://script.google.com/d/${scriptId}/edit`, colors.blue);
  
  log('\n2. setupProjectProperties()関数を実行してください', colors.yellow);
  
  log('\n3. デプロイ設定を確認してください:', colors.yellow);
  log('   - デプロイ → デプロイを管理', colors.white);
  log('   - 実行ユーザー: 自分', colors.white);
  log('   - アクセスできるユーザー: 全員（匿名を含む）', colors.white);
  
  log('\n4. WebアプリのURLを取得してフロントエンドに設定してください', colors.yellow);
}

// メイン処理
async function main() {
  try {
    log('GAS自動デプロイを開始します', colors.bright);
    
    // 認証確認
    const isAuthenticated = checkAuth();
    if (!isAuthenticated) {
      log('\n認証後、再度このスクリプトを実行してください', colors.yellow);
      process.exit(0);
    }
    
    // ビルド
    build();
    
    // プロジェクト作成/使用
    const scriptId = createOrUseProject();
    
    // コードプッシュ
    pushCode();
    
    // プロジェクト設定
    configureProject(scriptId);
    
    // デプロイ
    const deployId = deploy();
    
    // 次の手順を表示
    showNextSteps(scriptId);
    
    log('\n✓ 自動デプロイが完了しました！', colors.green);
    
  } catch (error) {
    log('\nエラーが発生しました', colors.red);
    console.error(error);
    process.exit(1);
  }
}

// 実行
main();