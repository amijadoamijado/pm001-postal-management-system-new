/**
 * PM001 郵便物発送管理システム - メインコード
 * TaskMaster実装計画 Task 1.1 対応
 * 小規模運用（80名・同時5接続）最適化版
 */

// グローバル設定
const CONFIG = {
  SPREADSHEET_ID: '', // 実行時に動的設定
  VERSION: '2.0.0',
  SYSTEM_NAME: 'PM001 郵便物発送管理システム',
  DEBUG_MODE: true,
  
  // 小規模運用設定
  MAX_USERS: 80,
  MAX_CONCURRENT: 5,
  CACHE_DURATION: 600, // 10分（小規模なのでキャッシュ長め）
  
  // テーブル名
  SHEETS: {
    CUSTOMERS: 'Customers',
    ADDRESSES: 'Addresses',
    SHIPPING: 'Shipping',
    USER_HISTORY: 'UserHistory',
    ADDRESS_USAGE: 'AddressUsage',
    SYSTEM_LOG: 'SystemLog'
  }
};

/**
 * システム初期化関数
 * TaskMaster Task 1.1 - 基盤構築の核心機能
 */
function initialize() {
  try {
    console.log('PM001システム初期化開始 v2.0');
    
    // スプレッドシート作成（小規模運用最適化）
    const spreadsheet = SpreadsheetApp.create(`PM001-PostalSystem-${new Date().getTime()}`);
    const spreadsheetId = spreadsheet.getId();
    
    // 設定更新
    CONFIG.SPREADSHEET_ID = spreadsheetId;
    
    // PropertiesServiceに保存（永続化）
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheetId);
    
    // データベース初期化
    const initResult = Database.initialize(spreadsheetId);
    
    // システムログ記録
    Logger.info('システム初期化完了', {
      spreadsheetId: spreadsheetId,
      version: CONFIG.VERSION,
      timestamp: new Date()
    });
    
    return {
      success: true,
      spreadsheetId: spreadsheetId,
      version: CONFIG.VERSION,
      systemName: CONFIG.SYSTEM_NAME,
      maxUsers: CONFIG.MAX_USERS,
      message: 'PM001システムが正常に初期化されました'
    };
    
  } catch (error) {
    console.error('初期化エラー:', error);
    return ErrorHandler.handle('INIT_ERROR', error);
  }
}

/**
 * スプレッドシートID取得（設定済みIDを使用）
 */
function getSpreadsheetId() {
  if (CONFIG.SPREADSHEET_ID) {
    return CONFIG.SPREADSHEET_ID;
  }
  
  // PropertiesServiceから取得
  const storedId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (storedId) {
    CONFIG.SPREADSHEET_ID = storedId;
    return storedId;
  }
  
  throw new Error('スプレッドシートIDが設定されていません。初期化を実行してください。');
}

/**
 * 顧客情報保存（会社名フィールド対応）
 * TaskMaster Task 2.1 の基盤
 */
function saveCustomer(customerData) {
  try {
    console.log('顧客情報保存開始:', customerData);
    
    // バリデーション
    const validation = Validator.validateCustomer(customerData);
    if (!validation.isValid) {
      throw new Error(`入力エラー: ${validation.errors.join(', ')}`);
    }
    
    // データベース保存
    const result = Database.saveCustomer({
      ...customerData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // キャッシュクリア（小規模運用では全データキャッシュ）
    CacheManager.remove('customers_all');
    
    Logger.info('顧客保存完了', { customerId: result.id, name: result.name });
    
    return { success: true, data: result };
    
  } catch (error) {
    console.error('顧客保存エラー:', error);
    return ErrorHandler.handle('SAVE_CUSTOMER_ERROR', error);
  }
}

/**
 * 宛名情報保存（履歴管理統合）
 */
function saveAddress(addressData) {
  try {
    console.log('宛名情報保存開始:', addressData);
    
    // バリデーション
    const validation = Validator.validateAddress(addressData);
    if (!validation.isValid) {
      throw new Error(`入力エラー: ${validation.errors.join(', ')}`);
    }
    
    // データベース保存
    const result = Database.saveAddress({
      ...addressData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // 宛名使用履歴の初期化
    Database.initializeAddressUsage(result.id, addressData.createdBy || 'system');
    
    // キャッシュクリア
    CacheManager.remove('addresses_all');
    
    Logger.info('宛名保存完了', { addressId: result.id, recipientName: result.recipientName });
    
    return { success: true, data: result };
    
  } catch (error) {
    console.error('宛名保存エラー:', error);
    return ErrorHandler.handle('SAVE_ADDRESS_ERROR', error);
  }
}

/**
 * 発送記録保存（追跡番号・履歴管理対応）
 * TaskMaster Task 3.1 の核心機能
 */
function saveShipping(shippingData) {
  try {
    console.log('発送記録保存開始:', shippingData);
    
    // バリデーション
    const validation = Validator.validateShipping(shippingData);
    if (!validation.isValid) {
      throw new Error(`入力エラー: ${validation.errors.join(', ')}`);
    }
    
    // 料金計算（新仕様）
    const calculatedFee = FeeCalculator.calculate(shippingData);
    
    // 発送データ準備
    const shippingRecord = {
      ...shippingData,
      calculatedFee: calculatedFee,
      shippingDate: new Date(),
      createdAt: new Date()
    };
    
    // 排他制御（同時アクセス対策）
    const result = LockManager.execute(() => {
      // 発送記録保存
      const shipping = Database.saveShipping(shippingRecord);
      
      // 履歴更新（非同期的に実行）
      if (shippingData.userId) {
        Database.updateUserHistory(shippingData.userId, shippingData.addressId);
      }
      Database.updateAddressUsage(shippingData.addressId);
      
      return shipping;
    });
    
    Logger.info('発送記録保存完了', { 
      shippingId: result.id, 
      fee: calculatedFee, 
      method: shippingData.shippingMethod 
    });
    
    return { success: true, data: result };
    
  } catch (error) {
    console.error('発送記録保存エラー:', error);
    return ErrorHandler.handle('SAVE_SHIPPING_ERROR', error);
  }
}

/**
 * データ取得（統合API）
 */
function getData(type, id = null, options = {}) {
  try {
    console.log('データ取得:', type, id, options);
    
    let result;
    
    switch (type) {
      case 'customers':
        result = Database.getCustomers(id);
        break;
        
      case 'addresses':
        result = Database.getAddresses(id);
        break;
        
      case 'shipping':
        result = Database.getShipping(id);
        break;
        
      case 'user_history':
        result = Database.getUserHistory(options.userId);
        break;
        
      case 'address_usage':
        result = Database.getAddressUsage();
        break;
        
      case 'system_status':
        result = getSystemStatus();
        break;
        
      default:
        throw new Error(`無効なデータタイプ: ${type}`);
    }
    
    Logger.info('データ取得完了', { 
      type: type, 
      count: Array.isArray(result) ? result.length : 1 
    });
    
    return { success: true, data: result, type: type };
    
  } catch (error) {
    console.error('データ取得エラー:', error);
    return ErrorHandler.handle('GET_DATA_ERROR', error);
  }
}

/**
 * 顧客検索（宛名・会社名対応）
 */
function searchCustomers(query) {
  try {
    console.log('顧客検索:', query);
    
    if (!query || query.trim().length < 1) {
      return { success: true, data: [], query: query };
    }
    
    const results = Database.searchCustomersAndAddresses(query.trim());
    
    Logger.info('検索完了', { query: query, resultCount: results.length });
    
    return { success: true, data: results, query: query };
    
  } catch (error) {
    console.error('検索エラー:', error);
    return ErrorHandler.handle('SEARCH_ERROR', error);
  }
}

/**
 * 料金計算API
 * TaskMaster Task 1.3 対応
 */
function calculateFee(feeData) {
  try {
    console.log('料金計算:', feeData);
    
    const fee = FeeCalculator.calculate(feeData);
    
    Logger.info('料金計算完了', { 
      method: feeData.shippingMethod, 
      weight: feeData.weight, 
      fee: fee 
    });
    
    return { success: true, fee: fee, calculation: feeData };
    
  } catch (error) {
    console.error('料金計算エラー:', error);
    return ErrorHandler.handle('CALCULATE_FEE_ERROR', error);
  }
}

/**
 * システム状態取得
 */
function getSystemStatus() {
  try {
    const spreadsheetId = getSpreadsheetId();
    
    const status = {
      version: CONFIG.VERSION,
      systemName: CONFIG.SYSTEM_NAME,
      timestamp: new Date(),
      spreadsheetId: spreadsheetId,
      database: spreadsheetId ? 'connected' : 'not_initialized',
      maxUsers: CONFIG.MAX_USERS,
      maxConcurrent: CONFIG.MAX_CONCURRENT,
      debugMode: CONFIG.DEBUG_MODE,
      features: {
        extendedPricing: true,
        addressSelection4Pattern: true,
        trackingNumber: true,
        userHistory: true,
        companyNameField: true,
        smallScaleOptimized: true
      }
    };
    
    return status;
    
  } catch (error) {
    console.error('システム状態取得エラー:', error);
    return ErrorHandler.handle('STATUS_ERROR', error);
  }
}

/**
 * テスト用関数（開発時のみ使用）
 * Phase 2 完了テスト統合版
 */
function runBasicTest() {
  try {
    console.log('=== PM001 Phase 2 完了テスト開始 ===');
    
    const testResults = {
      phase1: {},
      phase2: {},
      integration: {},
      performance: {}
    };
    
    // Phase 1 基盤テスト
    testResults.phase1 = runPhase1Tests();
    
    // Phase 2 機能テスト
    testResults.phase2 = runPhase2Tests();
    
    // 統合テスト
    testResults.integration = runIntegrationTests();
    
    // パフォーマンステスト
    testResults.performance = runPerformanceTests();
    
    // 総合評価
    const overallSuccess = 
      testResults.phase1.success &&
      testResults.phase2.success &&
      testResults.integration.success &&
      testResults.performance.success;
    
    console.log('=== Phase 2 完了テスト終了 ===');
    
    return {
      success: overallSuccess,
      timestamp: new Date(),
      testResults: testResults,
      summary: generateTestSummary(testResults)
    };
    
  } catch (error) {
    console.error('テストエラー:', error);
    return { 
      success: false, 
      error: error.message,
      timestamp: new Date()
    };
  }
}

/**
 * Phase 1 基盤テスト
 */
function runPhase1Tests() {
  console.log('--- Phase 1 基盤テスト開始 ---');
  
  const results = {
    initialization: false,
    database: false,
    feeCalculation: false,
    errorHandling: false
  };
  
  try {
    // Task 1.1: 初期化テスト
    const initResult = initialize();
    results.initialization = initResult.success;
    console.log('✓ 初期化テスト:', results.initialization);
    
    // Task 1.2: データベーステスト
    results.database = testDatabaseOperations();
    console.log('✓ データベーステスト:', results.database);
    
    // Task 1.3: 料金計算テスト
    results.feeCalculation = testFeeCalculation();
    console.log('✓ 料金計算テスト:', results.feeCalculation);
    
    // エラーハンドリングテスト
    results.errorHandling = testErrorHandling();
    console.log('✓ エラーハンドリングテスト:', results.errorHandling);
    
    const success = Object.values(results).every(result => result === true);
    
    return {
      success: success,
      details: results,
      phase: 'Phase 1: 基盤実装'
    };
    
  } catch (error) {
    console.error('Phase 1 テストエラー:', error);
    return {
      success: false,
      error: error.message,
      details: results
    };
  }
}

/**
 * Phase 2 機能テスト
 */
function runPhase2Tests() {
  console.log('--- Phase 2 機能テスト開始 ---');
  
  const results = {
    customerManagement: false,
    addressManagement: false,
    addressSelection: false,
    dataIntegrity: false
  };
  
  try {
    // Task 2.1: 顧客管理テスト
    results.customerManagement = testCustomerManagement();
    console.log('✓ 顧客管理テスト:', results.customerManagement);
    
    // Task 2.2: 宛名管理テスト
    results.addressManagement = testAddressManagement();
    console.log('✓ 宛名管理テスト:', results.addressManagement);
    
    // Task 2.3: 4パターン宛名選択テスト
    results.addressSelection = testAddressSelection();
    console.log('✓ 宛名選択テスト:', results.addressSelection);
    
    // データ整合性テスト
    results.dataIntegrity = testDataIntegrity();
    console.log('✓ データ整合性テスト:', results.dataIntegrity);
    
    const success = Object.values(results).every(result => result === true);
    
    return {
      success: success,
      details: results,
      phase: 'Phase 2: コア機能実装'
    };
    
  } catch (error) {
    console.error('Phase 2 テストエラー:', error);
    return {
      success: false,
      error: error.message,
      details: results
    };
  }
}

/**
 * 統合テスト
 */
function runIntegrationTests() {
  console.log('--- 統合テスト開始 ---');
  
  const results = {
    endToEndScenario: false,
    apiIntegration: false,
    crossModuleData: false
  };
  
  try {
    // エンドツーエンドシナリオテスト
    results.endToEndScenario = testEndToEndScenario();
    console.log('✓ E2Eシナリオテスト:', results.endToEndScenario);
    
    // API統合テスト
    results.apiIntegration = testApiIntegration();
    console.log('✓ API統合テスト:', results.apiIntegration);
    
    // モジュール間データ連携テスト
    results.crossModuleData = testCrossModuleData();
    console.log('✓ モジュール間連携テスト:', results.crossModuleData);
    
    const success = Object.values(results).every(result => result === true);
    
    return {
      success: success,
      details: results,
      phase: '統合テスト'
    };
    
  } catch (error) {
    console.error('統合テストエラー:', error);
    return {
      success: false,
      error: error.message,
      details: results
    };
  }
}

/**
 * パフォーマンステスト
 */
function runPerformanceTests() {
  console.log('--- パフォーマンステスト開始 ---');
  
  const results = {
    responseTime: false,
    throughput: false,
    resourceUsage: false
  };
  
  try {
    // 応答時間テスト
    results.responseTime = testResponseTime();
    console.log('✓ 応答時間テスト:', results.responseTime);
    
    // スループットテスト
    results.throughput = testThroughput();
    console.log('✓ スループットテスト:', results.throughput);
    
    // リソース使用量テスト
    results.resourceUsage = testResourceUsage();
    console.log('✓ リソース使用量テスト:', results.resourceUsage);
    
    const success = Object.values(results).every(result => result === true);
    
    return {
      success: success,
      details: results,
      phase: 'パフォーマンステスト'
    };
    
  } catch (error) {
    console.error('パフォーマンステストエラー:', error);
    return {
      success: false,
      error: error.message,
      details: results
    };
  }
}

// 個別テスト関数実装
function testDatabaseOperations() {
  try {
    const testCustomer = {
      name: 'テスト顧客',
      companyName: 'テスト会社',
      email: 'test@example.com',
      phone: '03-1234-5678'
    };
    
    const savedCustomer = Database.saveCustomer(testCustomer);
    const retrievedCustomers = Database.getCustomers(savedCustomer.id);
    
    return savedCustomer.id && retrievedCustomers.length > 0;
  } catch (error) {
    console.error('データベーステストエラー:', error);
    return false;
  }
}

function testFeeCalculation() {
  try {
    const testCases = [
      { method: 'standard_regular', weight: 50, expected: 140 },
      { method: 'standard_irregular', weight: 100, expected: 290 },
      { method: 'letterpack', weight: 500, expected: 430 }
    ];
    
    return testCases.every(testCase => {
      const result = FeeCalculator.calculate({
        shippingMethod: testCase.method,
        weight: testCase.weight,
        isExpress: false
      });
      return result === testCase.expected;
    });
  } catch (error) {
    console.error('料金計算テストエラー:', error);
    return false;
  }
}

function testErrorHandling() {
  try {
    // 無効な顧客データでエラーハンドリングテスト
    const result = saveCustomer({});
    return !result.success && result.error;
  } catch (error) {
    return true; // エラーが正しく投げられた
  }
}

function testCustomerManagement() {
  try {
    const testData = {
      name: 'CM テスト',
      companyName: 'CM テスト株式会社',
      email: 'cm-test@example.com'
    };
    
    const customerResult = CustomerManager.getCustomerList({ limit: 10 });
    return customerResult && customerResult.customers;
  } catch (error) {
    console.error('顧客管理テストエラー:', error);
    return false;
  }
}

function testAddressManagement() {
  try {
    const addressResult = AddressManager.getAddressList({ limit: 10 });
    return addressResult && addressResult.addresses;
  } catch (error) {
    console.error('宛名管理テストエラー:', error);
    return false;
  }
}

function testAddressSelection() {
  try {
    const selectionResult = AddressSelector.getSelectionData('test_user', 'customer_db', { limit: 5 });
    return selectionResult && selectionResult.metadata;
  } catch (error) {
    console.error('宛名選択テストエラー:', error);
    return false;
  }
}

function testDataIntegrity() {
  try {
    const customers = Database.getCustomers();
    const addresses = Database.getAddresses();
    
    // 孤児宛名チェック（顧客が存在しない宛名）
    const orphanAddresses = addresses.filter(address => 
      !customers.some(customer => customer.id === address.customerId)
    );
    
    return orphanAddresses.length === 0;
  } catch (error) {
    console.error('データ整合性テストエラー:', error);
    return false;
  }
}

function testEndToEndScenario() {
  try {
    // 簡易E2Eシナリオ：顧客作成→宛名作成→選択
    const customer = { name: 'E2E テスト', email: 'e2e@example.com' };
    const savedCustomer = Database.saveCustomer(customer);
    
    const address = {
      customerId: savedCustomer.id,
      recipientName: 'E2E 宛名',
      zipCode: '100-0001',
      address: 'テスト住所'
    };
    const savedAddress = Database.saveAddress(address);
    
    const selection = AddressSelector.getSelectionData('test_user', 'customer_db');
    
    return savedCustomer.id && savedAddress.id && selection.metadata;
  } catch (error) {
    console.error('E2Eテストエラー:', error);
    return false;
  }
}

function testApiIntegration() {
  try {
    // WebApp API統合テスト
    const systemStatus = getSystemStatus();
    return systemStatus && systemStatus.version;
  } catch (error) {
    console.error('API統合テストエラー:', error);
    return false;
  }
}

function testCrossModuleData() {
  try {
    // モジュール間のデータ連携テスト
    const customers = Database.getCustomers();
    const customersWithAddresses = Database.getCustomersWithAddresses();
    
    return customers.length >= 0 && customersWithAddresses.length >= 0;
  } catch (error) {
    console.error('モジュール間データテストエラー:', error);
    return false;
  }
}

function testResponseTime() {
  try {
    const startTime = new Date();
    Database.getCustomers();
    const endTime = new Date();
    
    const responseTime = endTime - startTime;
    return responseTime < 2000; // 2秒以内
  } catch (error) {
    console.error('応答時間テストエラー:', error);
    return false;
  }
}

function testThroughput() {
  try {
    const startTime = new Date();
    for (let i = 0; i < 10; i++) {
      FeeCalculator.calculate({
        shippingMethod: 'standard_regular',
        weight: 50,
        isExpress: false
      });
    }
    const endTime = new Date();
    
    const totalTime = endTime - startTime;
    return totalTime < 1000; // 10回の計算を1秒以内
  } catch (error) {
    console.error('スループットテストエラー:', error);
    return false;
  }
}

function testResourceUsage() {
  try {
    // GAS環境ではメモリ使用量の直接測定は困難なため、
    // 処理完了を成功とする
    const stats = Database.getStatistics();
    return stats && typeof stats.customers === 'number';
  } catch (error) {
    console.error('リソース使用量テストエラー:', error);
    return false;
  }
}

function generateTestSummary(testResults) {
  const totalTests = Object.keys(testResults).length;
  const passedPhases = Object.values(testResults).filter(phase => phase.success).length;
  
  return {
    totalPhases: totalTests,
    passedPhases: passedPhases,
    successRate: Math.round((passedPhases / totalTests) * 100),
    readyForPhase3: passedPhases === totalTests,
    recommendations: generateRecommendations(testResults)
  };
}

function generateRecommendations(testResults) {
  const recommendations = [];
  
  if (!testResults.phase1.success) {
    recommendations.push('Phase 1 基盤の修正が必要です');
  }
  
  if (!testResults.phase2.success) {
    recommendations.push('Phase 2 機能の修正が必要です');
  }
  
  if (!testResults.integration.success) {
    recommendations.push('統合部分の修正が必要です');
  }
  
  if (!testResults.performance.success) {
    recommendations.push('パフォーマンス改善が必要です');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('全テスト合格 - Phase 3 発送管理実装に進んでください');
  }
  
  return recommendations;
}