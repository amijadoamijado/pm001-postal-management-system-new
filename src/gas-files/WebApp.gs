/**
 * PM001 Webアプリケーション制御
 * TaskMaster Task 1.1 - Web制御基盤
 * 小規模運用（80名・同時5接続）対応
 */

/**
 * GET リクエスト処理
 * メインのWebアプリケーション画面を返す
 */
function doGet(e) {
  try {
    console.log('GET リクエスト受信:', e.parameter);
    
    // ユーザー識別
    const userEmail = Session.getActiveUser().getEmail();
    
    // アクセスログ記録
    MonitoringSimple.logAccess('GET', userEmail);
    
    // HTMLテンプレート作成
    const template = HtmlService.createTemplateFromFile('index');
    
    // テンプレート変数設定
    template.systemVersion = CONFIG.VERSION;
    template.systemName = CONFIG.SYSTEM_NAME;
    template.debugMode = CONFIG.DEBUG_MODE;
    template.maxUsers = CONFIG.MAX_USERS;
    template.userEmail = userEmail;
    template.baseUrl = ScriptApp.getService().getUrl();
    
    // HTML出力作成
    const htmlOutput = template.evaluate()
      .setTitle('PM001 郵便物発送管理システム')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setFaviconUrl('https://fonts.gstatic.com/s/i/materialiconsoutlined/mail/v1/24px.svg');
    
    console.log('HTML出力完了:', userEmail);
    return htmlOutput;
    
  } catch (error) {
    console.error('GET リクエストエラー:', error);
    return createErrorPage(error);
  }
}

/**
 * POST リクエスト処理
 * API呼び出しの振り分け・実行
 */
function doPost(e) {
  try {
    console.log('POST リクエスト受信');
    
    // ユーザー識別・認証
    const userEmail = Session.getActiveUser().getEmail();
    SecurityManager.checkAccess(userEmail);
    
    // リクエストデータ解析
    if (!e.postData || !e.postData.contents) {
      throw new Error('リクエストデータが不正です');
    }
    
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    
    if (!action) {
      throw new Error('アクションが指定されていません');
    }
    
    console.log('アクション実行:', action, userEmail);
    
    // レート制限チェック（小規模運用対応）
    SecurityManager.checkRateLimit(userEmail);
    
    // アクション実行
    let result = processAction(action, requestData, userEmail);
    
    // アクセスログ記録
    MonitoringSimple.logAccess(action, userEmail);
    
    // CORS対応レスポンス
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
    
  } catch (error) {
    console.error('POST リクエストエラー:', error);
    
    const errorResult = ErrorHandler.handle('WEB_POST_ERROR', error);
    
    return ContentService
      .createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * アクション処理の振り分け
 */
function processAction(action, requestData, userEmail) {
  const data = requestData.data || {};
  const options = requestData.options || {};
  
  // ユーザー情報をデータに追加
  data.userId = userEmail;
  data.userEmail = userEmail;
  
  switch (action) {
    case 'initialize':
      return initialize();
      
    case 'getSystemStatus':
      return { success: true, data: getSystemStatus() };
      
    case 'saveCustomer':
      return saveCustomer(data);
      
    case 'saveAddress':
      return saveAddress(data);
      
    case 'saveShipping':
      return saveShipping(data);
      
    case 'getData':
      return getData(data.type, data.id, options);
      
    case 'searchCustomers':
      return searchCustomers(data.query);
      
    case 'calculateFee':
      return calculateFee(data);
      
    case 'getAddressSelection':
      return getAddressSelectionData(userEmail, data.selectionType, data.options);
      
    // Task 2.1: 顧客管理機能API
    case 'getCustomerList':
      return { success: true, data: CustomerManager.getCustomerList(data.options) };
      
    case 'getCustomerDetail':
      return { success: true, data: CustomerManager.getCustomerDetail(data.customerId) };
      
    case 'updateCustomer':
      return { success: true, data: CustomerManager.updateCustomer(data.customerId, data.updateData) };
      
    case 'deleteCustomer':
      return { success: true, data: CustomerManager.deleteCustomer(data.customerId, data.reason) };
      
    case 'advancedCustomerSearch':
      return { success: true, data: CustomerManager.advancedCustomerSearch(data.searchOptions) };
      
    case 'importCustomers':
      return { success: true, data: CustomerManager.importCustomers(data.csvData, data.options) };
      
    case 'exportCustomers':
      return { success: true, data: CustomerManager.exportCustomers(data.options) };
      
    // Task 2.2: 宛名管理機能API
    case 'getAddressList':
      return { success: true, data: AddressManager.getAddressList(data.options) };
      
    case 'getAddressDetail':
      return { success: true, data: AddressManager.getAddressDetail(data.addressId) };
      
    case 'updateAddress':
      return { success: true, data: AddressManager.updateAddress(data.addressId, data.updateData) };
      
    case 'deleteAddress':
      return { success: true, data: AddressManager.deleteAddress(data.addressId, data.reason) };
      
    case 'duplicateAddress':
      return { success: true, data: AddressManager.duplicateAddress(data.addressId, data.modifications) };
      
    case 'advancedAddressSearch':
      return { success: true, data: AddressManager.advancedAddressSearch(data.searchOptions) };
      
    case 'getAddressSuggestions':
      return { success: true, data: AddressManager.getAddressSuggestions(data.zipCode) };
      
    case 'importAddresses':
      return { success: true, data: AddressManager.importAddresses(data.csvData, data.options) };
      
    case 'exportAddresses':
      return { success: true, data: AddressManager.exportAddresses(data.options) };
      
    // Task 2.3: 4パターン宛名選択機能API
    case 'searchAcrossAllPatterns':
      return { success: true, data: AddressSelector.searchAcrossAllPatterns(userEmail, data.searchQuery, data.options) };
      
    case 'clearSelectionCaches':
      AddressSelector.clearSelectionCaches(userEmail);
      return { success: true, message: 'キャッシュをクリアしました' };
      
    case 'runTest':
      // 開発時のみ許可
      if (CONFIG.DEBUG_MODE) {
        return runBasicTest();
      } else {
        throw new Error('テスト機能は本番環境では無効です');
      }
      
    default:
      throw new Error(`無効なアクション: ${action}`);
  }
}

/**
 * 宛名選択データ取得（4パターン対応）
 * TaskMaster Task 2.3 - AddressSelector統合版
 */
function getAddressSelectionData(userId, selectionType, options = {}) {
  try {
    console.log('宛名選択データ取得:', userId, selectionType, options);
    
    const result = AddressSelector.getSelectionData(userId, selectionType, options);
    
    console.log('宛名選択データ取得完了:', selectionType, result.metadata?.totalCount);
    
    return { 
      success: true, 
      data: result, 
      type: selectionType,
      userId: userId 
    };
    
  } catch (error) {
    console.error('宛名選択データ取得エラー:', error);
    return ErrorHandler.handle('GET_ADDRESS_SELECTION_ERROR', error);
  }
}

/**
 * HTMLファイルインクルード（CSS・JavaScript用）
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    console.error(`ファイルインクルードエラー: ${filename}`, error);
    return `<!-- ファイル ${filename} の読み込みに失敗しました: ${error.message} -->`;
  }
}

/**
 * エラーページ作成
 */
function createErrorPage(error) {
  try {
    const errorHtml = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PM001 - システムエラー</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
          <style>
              body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
              .error-container { max-width: 600px; margin: 100px auto; padding: 20px; }
              .error-card { background: white; border-radius: 15px; padding: 40px; text-align: center; }
          </style>
      </head>
      <body>
          <div class="error-container">
              <div class="error-card">
                  <h1 class="text-danger mb-4">
                      <i class="fas fa-exclamation-triangle"></i> システムエラー
                  </h1>
                  <p class="lead">申し訳ございません。システムでエラーが発生しました。</p>
                  <div class="alert alert-warning">
                      <strong>エラー詳細:</strong><br>
                      ${CONFIG.DEBUG_MODE ? error.message : 'システム管理者にお問い合わせください'}
                  </div>
                  <button class="btn btn-primary" onclick="location.reload()">
                      <i class="fas fa-redo"></i> ページを再読み込み
                  </button>
                  <hr>
                  <small class="text-muted">
                      PM001 郵便物発送管理システム v${CONFIG.VERSION}<br>
                      エラー時刻: ${new Date().toLocaleString('ja-JP')}
                  </small>
              </div>
          </div>
      </body>
      </html>
    `;
    
    return HtmlService.createHtmlOutput(errorHtml)
      .setTitle('PM001 - システムエラー');
    
  } catch (createError) {
    console.error('エラーページ作成エラー:', createError);
    
    // 最低限のエラーページ
    return HtmlService.createHtmlOutput(`
      <h1>システムエラー</h1>
      <p>申し訳ございません。システムでエラーが発生しました。</p>
      <p>ページを再読み込みしてお試しください。</p>
    `);
  }
}

/**
 * プリフライトリクエスト対応
 */
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600'
    });
}

/**
 * システム管理関数群
 */

/**
 * デバッグ情報取得（開発時のみ）
 */
function getDebugInfo() {
  if (!CONFIG.DEBUG_MODE) {
    throw new Error('デバッグモードが無効です');
  }
  
  try {
    const debugInfo = {
      config: CONFIG,
      systemStatus: getSystemStatus(),
      spreadsheetId: getSpreadsheetId(),
      user: Session.getActiveUser().getEmail(),
      timestamp: new Date(),
      gasLimits: {
        executionTime: '6分',
        triggerCount: '20個',
        dailyRuntime: '6時間',
        emailsSent: '100通/日'
      }
    };
    
    return { success: true, debugInfo: debugInfo };
    
  } catch (error) {
    console.error('デバッグ情報取得エラー:', error);
    return ErrorHandler.handle('DEBUG_INFO_ERROR', error);
  }
}

/**
 * パフォーマンス統計取得
 */
function getPerformanceStats() {
  try {
    const stats = MonitoringSimple.getPerformanceStats();
    return { success: true, stats: stats };
  } catch (error) {
    console.error('パフォーマンス統計取得エラー:', error);
    return ErrorHandler.handle('PERFORMANCE_STATS_ERROR', error);
  }
}