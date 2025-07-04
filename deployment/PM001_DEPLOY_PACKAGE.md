# 🚀 PM001 デプロイパッケージ【完全版】

## appsscript.json
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

## Code.gs
```javascript
/**
 * PM001 郵便物発送管理システム - メインコード
 */

// グローバル設定
const CONFIG = {
  SPREADSHEET_ID: '', // 後で設定
  DEBUG_MODE: true,
  VERSION: '1.0.0'
};

/**
 * 初期化関数
 */
function initialize() {
  try {
    console.log('PM001システム初期化開始');
    
    // スプレッドシート作成
    const spreadsheet = SpreadsheetApp.create('PM001-PostalSystem-Data');
    const spreadsheetId = spreadsheet.getId();
    
    // 設定更新
    CONFIG.SPREADSHEET_ID = spreadsheetId;
    
    // データベース初期化
    Database.initialize(spreadsheetId);
    
    console.log('初期化完了:', spreadsheetId);
    return { success: true, spreadsheetId: spreadsheetId };
    
  } catch (error) {
    console.error('初期化エラー:', error);
    return ErrorHandler.handle('INIT_ERROR', error);
  }
}

/**
 * 顧客情報保存
 */
function saveCustomer(customerData) {
  try {
    console.log('顧客情報保存:', customerData);
    
    // バリデーション
    if (!customerData.name || !customerData.email) {
      throw new Error('必須項目が不足しています');
    }
    
    // データベース保存
    const result = Database.saveCustomer(customerData);
    
    console.log('顧客保存完了:', result);
    return { success: true, data: result };
    
  } catch (error) {
    console.error('顧客保存エラー:', error);
    return ErrorHandler.handle('SAVE_CUSTOMER_ERROR', error);
  }
}

/**
 * 宛名情報保存
 */
function saveAddress(addressData) {
  try {
    console.log('宛名情報保存:', addressData);
    
    // バリデーション
    if (!addressData.customerId || !addressData.zipCode || !addressData.address) {
      throw new Error('必須項目が不足しています');
    }
    
    // データベース保存
    const result = Database.saveAddress(addressData);
    
    console.log('宛名保存完了:', result);
    return { success: true, data: result };
    
  } catch (error) {
    console.error('宛名保存エラー:', error);
    return ErrorHandler.handle('SAVE_ADDRESS_ERROR', error);
  }
}

/**
 * 発送記録保存
 */
function saveShipping(shippingData) {
  try {
    console.log('発送記録保存:', shippingData);
    
    // バリデーション
    if (!shippingData.customerId || !shippingData.addressId || !shippingData.shippingMethod) {
      throw new Error('必須項目が不足しています');
    }
    
    // 料金計算
    shippingData.calculatedFee = calculateShippingFee(shippingData);
    shippingData.shippingDate = new Date();
    
    // データベース保存
    const result = Database.saveShipping(shippingData);
    
    console.log('発送記録保存完了:', result);
    return { success: true, data: result };
    
  } catch (error) {
    console.error('発送記録保存エラー:', error);
    return ErrorHandler.handle('SAVE_SHIPPING_ERROR', error);
  }
}

/**
 * 料金計算
 */
function calculateShippingFee(shippingData) {
  try {
    const { weight, shippingMethod, isExpress } = shippingData;
    
    // 基本料金テーブル
    const baseFees = {
      'standard': 120,
      'large': 180,
      'express': 250
    };
    
    let fee = baseFees[shippingMethod] || 120;
    
    // 重量による追加料金
    if (weight > 50) {
      fee += Math.ceil((weight - 50) / 50) * 20;
    }
    
    // 速達料金
    if (isExpress) {
      fee += 250;
    }
    
    return fee;
    
  } catch (error) {
    console.error('料金計算エラー:', error);
    return 120; // デフォルト料金
  }
}

/**
 * データ取得
 */
function getData(type, id = null) {
  try {
    console.log('データ取得:', type, id);
    
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
      default:
        throw new Error('無効なデータタイプ: ' + type);
    }
    
    console.log('データ取得完了:', result?.length || 1);
    return { success: true, data: result };
    
  } catch (error) {
    console.error('データ取得エラー:', error);
    return ErrorHandler.handle('GET_DATA_ERROR', error);
  }
}
```

## Database.gs
```javascript
/**
 * PM001 データベース操作クラス
 */

const Database = {
  
  spreadsheetId: null,
  
  /**
   * データベース初期化
   */
  initialize(spreadsheetId) {
    try {
      this.spreadsheetId = spreadsheetId;
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      
      // 必要なシートを作成
      this.createSheet(spreadsheet, 'Customers', [
        'ID', '名前', 'メールアドレス', '電話番号', '作成日', '更新日'
      ]);
      
      this.createSheet(spreadsheet, 'Addresses', [
        'ID', '顧客ID', '郵便番号', '住所1', '住所2', '宛名', '作成日', '更新日'
      ]);
      
      this.createSheet(spreadsheet, 'Shipping', [
        'ID', '顧客ID', '宛名ID', '発送方法', '重量', '料金', '速達', '発送日', '作成日'
      ]);
      
      console.log('データベース初期化完了');
      return true;
      
    } catch (error) {
      console.error('データベース初期化エラー:', error);
      throw error;
    }
  },
  
  /**
   * シート作成
   */
  createSheet(spreadsheet, name, headers) {
    try {
      let sheet = spreadsheet.getSheetByName(name);
      
      if (!sheet) {
        sheet = spreadsheet.insertSheet(name);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      }
      
      return sheet;
    } catch (error) {
      console.error('シート作成エラー:', error);
      throw error;
    }
  },
  
  /**
   * 顧客保存
   */
  saveCustomer(customerData) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('Customers');
      
      const id = this.generateId();
      const now = new Date();
      
      const row = [
        id,
        customerData.name,
        customerData.email,
        customerData.phone || '',
        now,
        now
      ];
      
      sheet.appendRow(row);
      
      return { id: id, ...customerData, createdAt: now };
      
    } catch (error) {
      console.error('顧客保存エラー:', error);
      throw error;
    }
  },
  
  /**
   * 宛名保存
   */
  saveAddress(addressData) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('Addresses');
      
      const id = this.generateId();
      const now = new Date();
      
      const row = [
        id,
        addressData.customerId,
        addressData.zipCode,
        addressData.address,
        addressData.address2 || '',
        addressData.recipientName,
        now,
        now
      ];
      
      sheet.appendRow(row);
      
      return { id: id, ...addressData, createdAt: now };
      
    } catch (error) {
      console.error('宛名保存エラー:', error);
      throw error;
    }
  },
  
  /**
   * 発送記録保存
   */
  saveShipping(shippingData) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('Shipping');
      
      const id = this.generateId();
      const now = new Date();
      
      const row = [
        id,
        shippingData.customerId,
        shippingData.addressId,
        shippingData.shippingMethod,
        shippingData.weight || 0,
        shippingData.calculatedFee,
        shippingData.isExpress ? '速達' : '通常',
        shippingData.shippingDate,
        now
      ];
      
      sheet.appendRow(row);
      
      return { id: id, ...shippingData, createdAt: now };
      
    } catch (error) {
      console.error('発送記録保存エラー:', error);
      throw error;
    }
  },
  
  /**
   * 顧客取得
   */
  getCustomers(id = null) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('Customers');
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) return [];
      
      const headers = data[0];
      const rows = data.slice(1);
      
      const customers = rows.map(row => {
        const customer = {};
        headers.forEach((header, index) => {
          customer[this.normalizeKey(header)] = row[index];
        });
        return customer;
      });
      
      return id ? customers.filter(c => c.id === id) : customers;
      
    } catch (error) {
      console.error('顧客取得エラー:', error);
      throw error;
    }
  },
  
  /**
   * 宛名取得
   */
  getAddresses(customerId = null) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('Addresses');
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) return [];
      
      const headers = data[0];
      const rows = data.slice(1);
      
      const addresses = rows.map(row => {
        const address = {};
        headers.forEach((header, index) => {
          address[this.normalizeKey(header)] = row[index];
        });
        return address;
      });
      
      return customerId ? addresses.filter(a => a.customerId === customerId) : addresses;
      
    } catch (error) {
      console.error('宛名取得エラー:', error);
      throw error;
    }
  },
  
  /**
   * 発送記録取得
   */
  getShipping(customerId = null) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('Shipping');
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) return [];
      
      const headers = data[0];
      const rows = data.slice(1);
      
      const shipping = rows.map(row => {
        const record = {};
        headers.forEach((header, index) => {
          record[this.normalizeKey(header)] = row[index];
        });
        return record;
      });
      
      return customerId ? shipping.filter(s => s.customerId === customerId) : shipping;
      
    } catch (error) {
      console.error('発送記録取得エラー:', error);
      throw error;
    }
  },
  
  /**
   * ID生成
   */
  generateId() {
    return 'ID_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
  },
  
  /**
   * キー正規化
   */
  normalizeKey(key) {
    const keyMap = {
      'ID': 'id',
      '名前': 'name',
      'メールアドレス': 'email',
      '電話番号': 'phone',
      '顧客ID': 'customerId',
      '郵便番号': 'zipCode',
      '住所1': 'address',
      '住所2': 'address2',
      '宛名': 'recipientName',
      '宛名ID': 'addressId',
      '発送方法': 'shippingMethod',
      '重量': 'weight',
      '料金': 'fee',
      '速達': 'express',
      '発送日': 'shippingDate',
      '作成日': 'createdAt',
      '更新日': 'updatedAt'
    };
    
    return keyMap[key] || key.toLowerCase();
  }
};
```

## ErrorHandler.gs
```javascript
/**
 * PM001 エラーハンドリングクラス
 */

const ErrorHandler = {
  
  /**
   * エラー処理
   */
  handle(errorType, error, context = {}) {
    try {
      const errorInfo = {
        type: errorType,
        message: error.message || error.toString(),
        timestamp: new Date(),
        context: context,
        stack: error.stack || 'スタックトレースなし'
      };
      
      // コンソールログ
      console.error('=== PM001 エラー ===');
      console.error('タイプ:', errorInfo.type);
      console.error('メッセージ:', errorInfo.message);
      console.error('時刻:', errorInfo.timestamp);
      console.error('コンテキスト:', JSON.stringify(errorInfo.context, null, 2));
      console.error('スタック:', errorInfo.stack);
      
      // エラーログ保存（オプション）
      this.saveErrorLog(errorInfo);
      
      // ユーザー向けエラーレスポンス
      return {
        success: false,
        error: {
          type: errorType,
          message: this.getUserFriendlyMessage(errorType),
          details: CONFIG.DEBUG_MODE ? errorInfo.message : '詳細はログを確認してください',
          timestamp: errorInfo.timestamp
        }
      };
      
    } catch (handlingError) {
      console.error('エラーハンドリング中にエラー:', handlingError);
      
      return {
        success: false,
        error: {
          type: 'HANDLING_ERROR',
          message: 'システムエラーが発生しました',
          timestamp: new Date()
        }
      };
    }
  },
  
  /**
   * ユーザー向けエラーメッセージ取得
   */
  getUserFriendlyMessage(errorType) {
    const messages = {
      'INIT_ERROR': 'システムの初期化に失敗しました。再度お試しください。',
      'SAVE_CUSTOMER_ERROR': '顧客情報の保存に失敗しました。入力内容を確認してください。',
      'SAVE_ADDRESS_ERROR': '宛名情報の保存に失敗しました。入力内容を確認してください。',
      'SAVE_SHIPPING_ERROR': '発送記録の保存に失敗しました。入力内容を確認してください。',
      'GET_DATA_ERROR': 'データの取得に失敗しました。再度お試しください。',
      'VALIDATION_ERROR': '入力値に問題があります。必須項目を確認してください。',
      'DATABASE_ERROR': 'データベース操作でエラーが発生しました。',
      'PERMISSION_ERROR': '権限が不足しています。管理者にお問い合わせください。',
      'NETWORK_ERROR': 'ネットワークエラーが発生しました。接続を確認してください。'
    };
    
    return messages[errorType] || 'システムエラーが発生しました。サポートにお問い合わせください。';
  },
  
  /**
   * エラーログ保存（オプション機能）
   */
  saveErrorLog(errorInfo) {
    try {
      // スプレッドシートがある場合のみログ保存
      if (CONFIG.SPREADSHEET_ID) {
        const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
        let logSheet = spreadsheet.getSheetByName('ErrorLogs');
        
        if (!logSheet) {
          logSheet = spreadsheet.insertSheet('ErrorLogs');
          logSheet.getRange(1, 1, 1, 5).setValues([
            ['タイムスタンプ', 'エラータイプ', 'メッセージ', 'コンテキスト', 'スタックトレース']
          ]);
          logSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
        }
        
        logSheet.appendRow([
          errorInfo.timestamp,
          errorInfo.type,
          errorInfo.message,
          JSON.stringify(errorInfo.context),
          errorInfo.stack
        ]);
      }
    } catch (logError) {
      console.error('エラーログ保存失敗:', logError);
      // ログ保存の失敗は無視（メイン処理に影響させない）
    }
  },
  
  /**
   * バリデーションエラー
   */
  validationError(field, message) {
    return this.handle('VALIDATION_ERROR', new Error(`${field}: ${message}`), { field: field });
  },
  
  /**
   * データベースエラー
   */
  databaseError(operation, error) {
    return this.handle('DATABASE_ERROR', error, { operation: operation });
  },
  
  /**
   * 権限エラー
   */
  permissionError(action, error) {
    return this.handle('PERMISSION_ERROR', error, { action: action });
  }
};
```

## WebApp.gs
```javascript
/**
 * PM001 Webアプリケーション制御
 */

/**
 * GET リクエスト処理
 */
function doGet(e) {
  try {
    console.log('GET リクエスト受信:', e.parameter);
    
    // HTMLページを返す
    const htmlOutput = HtmlService.createTemplateFromFile('index');
    htmlOutput.title = 'PM001 郵便物発送管理システム';
    
    return htmlOutput.evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setFaviconUrl('https://fonts.gstatic.com/s/i/materialiconsoutlined/mail/v1/24px.svg');
    
  } catch (error) {
    console.error('GET リクエストエラー:', error);
    return ErrorHandler.handle('WEB_GET_ERROR', error);
  }
}

/**
 * POST リクエスト処理
 */
function doPost(e) {
  try {
    console.log('POST リクエスト受信:', e.postData);
    
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    
    console.log('アクション:', action);
    
    let result;
    
    switch (action) {
      case 'initialize':
        result = initialize();
        break;
        
      case 'saveCustomer':
        result = saveCustomer(requestData.data);
        break;
        
      case 'saveAddress':
        result = saveAddress(requestData.data);
        break;
        
      case 'saveShipping':
        result = saveShipping(requestData.data);
        break;
        
      case 'getData':
        result = getData(requestData.type, requestData.id);
        break;
        
      case 'calculateFee':
        const fee = calculateShippingFee(requestData.data);
        result = { success: true, fee: fee };
        break;
        
      default:
        throw new Error('無効なアクション: ' + action);
    }
    
    console.log('処理結果:', result);
    
    // CORS ヘッダー付きでレスポンス
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error('POST リクエストエラー:', error);
    const errorResult = ErrorHandler.handle('WEB_POST_ERROR', error);
    
    return ContentService
      .createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * HTML ファイルインクルード（CSSとJavaScript用）
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    console.error('ファイルインクルードエラー:', error);
    return `<!-- ファイル ${filename} の読み込みに失敗しました -->`;
  }
}

/**
 * システム状態確認
 */
function getSystemStatus() {
  try {
    const status = {
      version: CONFIG.VERSION,
      timestamp: new Date(),
      database: CONFIG.SPREADSHEET_ID ? 'connected' : 'not initialized',
      debugMode: CONFIG.DEBUG_MODE
    };
    
    console.log('システム状態:', status);
    return { success: true, status: status };
    
  } catch (error) {
    console.error('システム状態確認エラー:', error);
    return ErrorHandler.handle('STATUS_CHECK_ERROR', error);
  }
}
```

## index.html
```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PM001 郵便物発送管理システム</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .main-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .card {
            border: none;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            background: rgba(255, 255, 255, 0.95);
        }
        
        .card-header {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            border-radius: 15px 15px 0 0 !important;
            padding: 20px;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 10px;
            padding: 10px 20px;
            transition: all 0.3s ease;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .form-control {
            border-radius: 10px;
            border: 2px solid #e0e0e0;
            transition: all 0.3s ease;
        }
        
        .form-control:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
        }
        
        .nav-tabs .nav-link {
            border-radius: 10px 10px 0 0;
            margin-right: 5px;
            border: none;
            background: rgba(255, 255, 255, 0.7);
        }
        
        .nav-tabs .nav-link.active {
            background: white;
            color: #667eea;
            font-weight: bold;
        }
        
        .alert {
            border-radius: 10px;
            border: none;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }
        
        .spinner-border {
            color: #667eea;
        }
        
        .fee-display {
            font-size: 1.5em;
            font-weight: bold;
            color: #28a745;
            background: rgba(40, 167, 69, 0.1);
            padding: 15px;
            border-radius: 10px;
            text-align: center;
            margin-top: 10px;
        }
        
        .system-status {
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 0.8em;
            background: rgba(40, 167, 69, 0.9);
            color: white;
        }
        
        @media (max-width: 768px) {
            .main-container {
                padding: 10px;
            }
            
            .card-header {
                padding: 15px;
            }
            
            .btn {
                width: 100%;
                margin-bottom: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="system-status" id="systemStatus">
        <i class="fas fa-circle text-success"></i> システム稼働中
    </div>
    
    <div class="main-container">
        <div class="text-center mb-4">
            <h1 class="text-white">
                <i class="fas fa-mail-bulk me-3"></i>
                PM001 郵便物発送管理システム
            </h1>
            <p class="text-white-50">顧客管理・宛名管理・発送記録を一元管理</p>
        </div>
        
        <div class="card">
            <div class="card-header">
                <ul class="nav nav-tabs card-header-tabs" id="mainTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="customer-tab" data-bs-toggle="tab" data-bs-target="#customer" type="button" role="tab">
                            <i class="fas fa-users me-2"></i>顧客管理
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="address-tab" data-bs-toggle="tab" data-bs-target="#address" type="button" role="tab">
                            <i class="fas fa-address-book me-2"></i>宛名管理
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="shipping-tab" data-bs-toggle="tab" data-bs-target="#shipping" type="button" role="tab">
                            <i class="fas fa-shipping-fast me-2"></i>発送管理
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="calculator-tab" data-bs-toggle="tab" data-bs-target="#calculator" type="button" role="tab">
                            <i class="fas fa-calculator me-2"></i>料金計算
                        </button>
                    </li>
                </ul>
            </div>
            
            <div class="card-body">
                <div class="tab-content" id="mainTabContent">
                    <!-- 顧客管理タブ -->
                    <div class="tab-pane fade show active" id="customer" role="tabpanel">
                        <h5 class="mb-4">
                            <i class="fas fa-user-plus me-2"></i>顧客情報登録
                        </h5>
                        
                        <form id="customerForm">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">顧客名 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="customerName" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">メールアドレス <span class="text-danger">*</span></label>
                                    <input type="email" class="form-control" id="customerEmail" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">電話番号</label>
                                    <input type="tel" class="form-control" id="customerPhone">
                                </div>
                            </div>
                            
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>顧客情報を保存
                            </button>
                        </form>
                        
                        <hr class="my-4">
                        
                        <h5>
                            <i class="fas fa-list me-2"></i>登録済み顧客
                        </h5>
                        <div id="customerList" class="mt-3">
                            <div class="loading">
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">読み込み中...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 宛名管理タブ -->
                    <div class="tab-pane fade" id="address" role="tabpanel">
                        <h5 class="mb-4">
                            <i class="fas fa-map-marker-alt me-2"></i>宛名情報登録
                        </h5>
                        
                        <form id="addressForm">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">顧客選択 <span class="text-danger">*</span></label>
                                    <select class="form-control" id="addressCustomer" required>
                                        <option value="">顧客を選択してください</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">郵便番号 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="addressZip" pattern="[0-9]{3}-[0-9]{4}" placeholder="123-4567" required>
                                </div>
                                <div class="col-12 mb-3">
                                    <label class="form-label">住所 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="addressMain" required>
                                </div>
                                <div class="col-12 mb-3">
                                    <label class="form-label">建物名・部屋番号</label>
                                    <input type="text" class="form-control" id="addressSub">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">宛名 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="recipientName" required>
                                </div>
                            </div>
                            
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>宛名情報を保存
                            </button>
                        </form>
                        
                        <hr class="my-4">
                        
                        <h5>
                            <i class="fas fa-list me-2"></i>登録済み宛名
                        </h5>
                        <div id="addressList" class="mt-3">
                            <div class="loading">
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">読み込み中...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 発送管理タブ -->
                    <div class="tab-pane fade" id="shipping" role="tabpanel">
                        <h5 class="mb-4">
                            <i class="fas fa-truck me-2"></i>発送記録登録
                        </h5>
                        
                        <form id="shippingForm">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">顧客選択 <span class="text-danger">*</span></label>
                                    <select class="form-control" id="shippingCustomer" required>
                                        <option value="">顧客を選択してください</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">宛名選択 <span class="text-danger">*</span></label>
                                    <select class="form-control" id="shippingAddress" required>
                                        <option value="">宛名を選択してください</option>
                                    </select>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">発送方法 <span class="text-danger">*</span></label>
                                    <select class="form-control" id="shippingMethod" required>
                                        <option value="">選択してください</option>
                                        <option value="standard">普通郵便 (120円〜)</option>
                                        <option value="large">レターパック (180円〜)</option>
                                        <option value="express">宅配便 (250円〜)</option>
                                    </select>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">重量 (g)</label>
                                    <input type="number" class="form-control" id="shippingWeight" min="0" step="1" value="50">
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">オプション</label>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="shippingExpress">
                                        <label class="form-check-label" for="shippingExpress">
                                            速達 (+250円)
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <div id="shippingFeePreview" class="fee-display" style="display: none;">
                                予想料金: <span id="feeAmount">0</span>円
                            </div>
                            
                            <button type="submit" class="btn btn-primary mt-3">
                                <i class="fas fa-save me-2"></i>発送記録を保存
                            </button>
                        </form>
                        
                        <hr class="my-4">
                        
                        <h5>
                            <i class="fas fa-list me-2"></i>発送履歴
                        </h5>
                        <div id="shippingList" class="mt-3">
                            <div class="loading">
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">読み込み中...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 料金計算タブ -->
                    <div class="tab-pane fade" id="calculator" role="tabpanel">
                        <h5 class="mb-4">
                            <i class="fas fa-yen-sign me-2"></i>配送料金計算
                        </h5>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card">
                                    <div class="card-body">
                                        <h6 class="card-title">料金計算</h6>
                                        
                                        <div class="mb-3">
                                            <label class="form-label">発送方法</label>
                                            <select class="form-control" id="calcMethod">
                                                <option value="standard">普通郵便 (基本120円)</option>
                                                <option value="large">レターパック (基本180円)</option>
                                                <option value="express">宅配便 (基本250円)</option>
                                            </select>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label class="form-label">重量 (g)</label>
                                            <input type="number" class="form-control" id="calcWeight" min="0" step="1" value="50">
                                            <div class="form-text">50g超過分は50g毎に+20円</div>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" id="calcExpress">
                                                <label class="form-check-label" for="calcExpress">
                                                    速達オプション (+250円)
                                                </label>
                                            </div>
                                        </div>
                                        
                                        <button type="button" class="btn btn-primary" onclick="calculateFee()">
                                            <i class="fas fa-calculator me-2"></i>料金計算
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="col-md-6">
                                <div class="card">
                                    <div class="card-body">
                                        <h6 class="card-title">計算結果</h6>
                                        <div id="calculationResult" class="fee-display">
                                            料金: 0円
                                        </div>
                                        
                                        <div class="mt-3">
                                            <h6>料金表</h6>
                                            <table class="table table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>発送方法</th>
                                                        <th>基本料金</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td>普通郵便</td>
                                                        <td>120円</td>
                                                    </tr>
                                                    <tr>
                                                        <td>レターパック</td>
                                                        <td>180円</td>
                                                    </tr>
                                                    <tr>
                                                        <td>宅配便</td>
                                                        <td>250円</td>
                                                    </tr>
                                                    <tr>
                                                        <td>速達オプション</td>
                                                        <td>+250円</td>
                                                    </tr>
                                                    <tr>
                                                        <td>重量追加料金</td>
                                                        <td>50g毎+20円</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- メッセージ表示エリア -->
        <div id="messageArea" class="mt-3"></div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // グローバル変数
        let customers = [];
        let addresses = [];
        let shippingRecords = [];
        let systemInitialized = false;
        
        // システム初期化
        document.addEventListener('DOMContentLoaded', function() {
            console.log('PM001システム開始');
            initializeSystem();
        });
        
        // システム初期化
        async function initializeSystem() {
            try {
                showMessage('システムを初期化しています...', 'info');
                
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'initialize' })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    systemInitialized = true;
                    showMessage('システム初期化完了', 'success');
                    loadAllData();
                } else {
                    throw new Error(result.error?.message || 'システム初期化に失敗しました');
                }
                
            } catch (error) {
                console.error('初期化エラー:', error);
                showMessage('システム初期化エラー: ' + error.message, 'error');
            }
        }
        
        // 全データ読み込み
        async function loadAllData() {
            try {
                await Promise.all([
                    loadCustomers(),
                    loadAddresses(),
                    loadShippingRecords()
                ]);
                
                updateCustomerSelects();
                
            } catch (error) {
                console.error('データ読み込みエラー:', error);
                showMessage('データ読み込みエラー: ' + error.message, 'error');
            }
        }
        
        // 顧客データ読み込み
        async function loadCustomers() {
            try {
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        action: 'getData', 
                        type: 'customers' 
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    customers = result.data || [];
                    displayCustomers();
                } else {
                    throw new Error(result.error?.message || '顧客データ読み込み失敗');
                }
                
            } catch (error) {
                console.error('顧客読み込みエラー:', error);
                document.getElementById('customerList').innerHTML = 
                    '<div class="alert alert-warning">顧客データを読み込めませんでした</div>';
            }
        }
        
        // 宛名データ読み込み
        async function loadAddresses() {
            try {
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        action: 'getData', 
                        type: 'addresses' 
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    addresses = result.data || [];
                    displayAddresses();
                } else {
                    throw new Error(result.error?.message || '宛名データ読み込み失敗');
                }
                
            } catch (error) {
                console.error('宛名読み込みエラー:', error);
                document.getElementById('addressList').innerHTML = 
                    '<div class="alert alert-warning">宛名データを読み込めませんでした</div>';
            }
        }
        
        // 発送記録読み込み
        async function loadShippingRecords() {
            try {
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        action: 'getData', 
                        type: 'shipping' 
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    shippingRecords = result.data || [];
                    displayShippingRecords();
                } else {
                    throw new Error(result.error?.message || '発送記録読み込み失敗');
                }
                
            } catch (error) {
                console.error('発送記録読み込みエラー:', error);
                document.getElementById('shippingList').innerHTML = 
                    '<div class="alert alert-warning">発送記録を読み込めませんでした</div>';
            }
        }
        
        // 顧客表示
        function displayCustomers() {
            const customerList = document.getElementById('customerList');
            
            if (customers.length === 0) {
                customerList.innerHTML = '<div class="alert alert-info">登録された顧客はありません</div>';
                return;
            }
            
            let html = '<div class="row">';
            customers.forEach(customer => {
                html += `
                    <div class="col-md-6 mb-3">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title">${customer.name}</h6>
                                <p class="card-text">
                                    <small class="text-muted">
                                        <i class="fas fa-envelope me-1"></i>${customer.email}<br>
                                        ${customer.phone ? '<i class="fas fa-phone me-1"></i>' + customer.phone : ''}
                                    </small>
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            
            customerList.innerHTML = html;
        }
        
        // 宛名表示
        function displayAddresses() {
            const addressList = document.getElementById('addressList');
            
            if (addresses.length === 0) {
                addressList.innerHTML = '<div class="alert alert-info">登録された宛名はありません</div>';
                return;
            }
            
            let html = '<div class="row">';
            addresses.forEach(address => {
                const customer = customers.find(c => c.id === address.customerId);
                html += `
                    <div class="col-md-6 mb-3">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title">${address.recipientName}</h6>
                                <p class="card-text">
                                    <small class="text-muted">
                                        顧客: ${customer?.name || '不明'}<br>
                                        〒${address.zipCode}<br>
                                        ${address.address}${address.address2 ? ' ' + address.address2 : ''}
                                    </small>
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            
            addressList.innerHTML = html;
        }
        
        // 発送記録表示
        function displayShippingRecords() {
            const shippingList = document.getElementById('shippingList');
            
            if (shippingRecords.length === 0) {
                shippingList.innerHTML = '<div class="alert alert-info">発送記録はありません</div>';
                return;
            }
            
            let html = '<div class="table-responsive"><table class="table table-striped">';
            html += `
                <thead>
                    <tr>
                        <th>発送日</th>
                        <th>顧客</th>
                        <th>発送方法</th>
                        <th>料金</th>
                        <th>オプション</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            shippingRecords.forEach(record => {
                const customer = customers.find(c => c.id === record.customerId);
                const shippingDate = new Date(record.shippingDate);
                
                html += `
                    <tr>
                        <td>${shippingDate.toLocaleDateString('ja-JP')}</td>
                        <td>${customer?.name || '不明'}</td>
                        <td>${getShippingMethodName(record.shippingMethod)}</td>
                        <td>¥${record.fee}</td>
                        <td>${record.express === '速達' ? '速達' : '通常'}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            shippingList.innerHTML = html;
        }
        
        // 顧客選択肢更新
        function updateCustomerSelects() {
            const selects = ['addressCustomer', 'shippingCustomer'];
            
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                if (select) {
                    // 既存のオプションをクリア（最初のオプションは残す）
                    while (select.children.length > 1) {
                        select.removeChild(select.lastChild);
                    }
                    
                    // 顧客オプションを追加
                    customers.forEach(customer => {
                        const option = document.createElement('option');
                        option.value = customer.id;
                        option.textContent = customer.name;
                        select.appendChild(option);
                    });
                }
            });
        }
        
        // 顧客選択時の宛名更新
        function updateAddressSelect(customerId) {
            const addressSelect = document.getElementById('shippingAddress');
            
            // 既存のオプションをクリア
            while (addressSelect.children.length > 1) {
                addressSelect.removeChild(addressSelect.lastChild);
            }
            
            // 選択された顧客の宛名を追加
            const customerAddresses = addresses.filter(addr => addr.customerId === customerId);
            customerAddresses.forEach(address => {
                const option = document.createElement('option');
                option.value = address.id;
                option.textContent = `${address.recipientName} (${address.address})`;
                addressSelect.appendChild(option);
            });
        }
        
        // 発送方法名取得
        function getShippingMethodName(method) {
            const methods = {
                'standard': '普通郵便',
                'large': 'レターパック',
                'express': '宅配便'
            };
            return methods[method] || method;
        }
        
        // メッセージ表示
        function showMessage(message, type = 'info') {
            const messageArea = document.getElementById('messageArea');
            const alertClass = {
                'success': 'alert-success',
                'error': 'alert-danger',
                'warning': 'alert-warning',
                'info': 'alert-info'
            }[type] || 'alert-info';
            
            const messageHtml = `
                <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            
            messageArea.innerHTML = messageHtml;
            
            // 5秒後に自動削除
            setTimeout(() => {
                const alert = messageArea.querySelector('.alert');
                if (alert) {
                    alert.remove();
                }
            }, 5000);
        }
        
        // 料金計算
        async function calculateFee() {
            try {
                const method = document.getElementById('calcMethod').value;
                const weight = parseInt(document.getElementById('calcWeight').value) || 50;
                const isExpress = document.getElementById('calcExpress').checked;
                
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'calculateFee',
                        data: {
                            shippingMethod: method,
                            weight: weight,
                            isExpress: isExpress
                        }
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('calculationResult').innerHTML = 
                        `料金: ¥${result.fee}`;
                } else {
                    throw new Error(result.error?.message || '料金計算に失敗しました');
                }
                
            } catch (error) {
                console.error('料金計算エラー:', error);
                showMessage('料金計算エラー: ' + error.message, 'error');
            }
        }
        
        // リアルタイム料金計算
        function updateShippingFeePreview() {
            const method = document.getElementById('shippingMethod').value;
            const weight = parseInt(document.getElementById('shippingWeight').value) || 50;
            const isExpress = document.getElementById('shippingExpress').checked;
            
            if (!method) {
                document.getElementById('shippingFeePreview').style.display = 'none';
                return;
            }
            
            // 簡易計算（サーバーと同じロジック）
            const baseFees = {
                'standard': 120,
                'large': 180,
                'express': 250
            };
            
            let fee = baseFees[method] || 120;
            
            if (weight > 50) {
                fee += Math.ceil((weight - 50) / 50) * 20;
            }
            
            if (isExpress) {
                fee += 250;
            }
            
            document.getElementById('feeAmount').textContent = fee;
            document.getElementById('shippingFeePreview').style.display = 'block';
        }
        
        // フォームイベントリスナー
        document.addEventListener('DOMContentLoaded', function() {
            
            // 顧客フォーム
            document.getElementById('customerForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                try {
                    const customerData = {
                        name: document.getElementById('customerName').value,
                        email: document.getElementById('customerEmail').value,
                        phone: document.getElementById('customerPhone').value
                    };
                    
                    const response = await fetch(window.location.href, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            action: 'saveCustomer',
                            data: customerData
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showMessage('顧客情報を保存しました', 'success');
                        this.reset();
                        await loadCustomers();
                        updateCustomerSelects();
                    } else {
                        throw new Error(result.error?.message || '顧客保存に失敗しました');
                    }
                    
                } catch (error) {
                    console.error('顧客保存エラー:', error);
                    showMessage('顧客保存エラー: ' + error.message, 'error');
                }
            });
            
            // 宛名フォーム
            document.getElementById('addressForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                try {
                    const addressData = {
                        customerId: document.getElementById('addressCustomer').value,
                        zipCode: document.getElementById('addressZip').value,
                        address: document.getElementById('addressMain').value,
                        address2: document.getElementById('addressSub').value,
                        recipientName: document.getElementById('recipientName').value
                    };
                    
                    const response = await fetch(window.location.href, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            action: 'saveAddress',
                            data: addressData
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showMessage('宛名情報を保存しました', 'success');
                        this.reset();
                        await loadAddresses();
                    } else {
                        throw new Error(result.error?.message || '宛名保存に失敗しました');
                    }
                    
                } catch (error) {
                    console.error('宛名保存エラー:', error);
                    showMessage('宛名保存エラー: ' + error.message, 'error');
                }
            });
            
            // 発送フォーム
            document.getElementById('shippingForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                try {
                    const shippingData = {
                        customerId: document.getElementById('shippingCustomer').value,
                        addressId: document.getElementById('shippingAddress').value,
                        shippingMethod: document.getElementById('shippingMethod').value,
                        weight: parseInt(document.getElementById('shippingWeight').value) || 50,
                        isExpress: document.getElementById('shippingExpress').checked
                    };
                    
                    const response = await fetch(window.location.href, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            action: 'saveShipping',
                            data: shippingData
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showMessage('発送記録を保存しました', 'success');
                        this.reset();
                        document.getElementById('shippingFeePreview').style.display = 'none';
                        await loadShippingRecords();
                    } else {
                        throw new Error(result.error?.message || '発送記録保存に失敗しました');
                    }
                    
                } catch (error) {
                    console.error('発送記録保存エラー:', error);
                    showMessage('発送記録保存エラー: ' + error.message, 'error');
                }
            });
            
            // 発送顧客選択時のイベント
            document.getElementById('shippingCustomer').addEventListener('change', function() {
                updateAddressSelect(this.value);
            });
            
            // 発送料金プレビュー更新イベント
            ['shippingMethod', 'shippingWeight', 'shippingExpress'].forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.addEventListener('change', updateShippingFeePreview);
                    element.addEventListener('input', updateShippingFeePreview);
                }
            });
        });
    </script>
</body>
</html>
```

---

## ⚡ 5分デプロイ手順

### Step 1: Google Apps Script プロジェクト作成 (1分)
1. https://script.google.com/ にアクセス
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「PM001-PostalSystem」に変更

### Step 2: manifest ファイル設定 (1分)
1. エディタで「ファイル」→「manifest ファイルを表示」
2. appsscript.json の内容を上記の内容に置き換え

### Step 3: スクリプトファイル追加 (2分)
1. 「Code.gs」を上記の内容に置き換え
2. 新しいファイルを追加：「Database.gs」、「ErrorHandler.gs」、「WebApp.gs」
3. HTML ファイル追加：「index.html」
4. 各ファイルを上記の内容でコピー・ペースト

### Step 4: デプロイ実行 (1分)
1. 「デプロイ」→「新しいデプロイ」をクリック
2. 種類: ウェブアプリ
3. アクセス: 全員
4. 「デプロイ」をクリック
5. WebアプリURL を取得・記録

### ✅ デプロイ完了確認
- WebアプリURL にアクセスしてシステムが表示されることを確認
- 「システム初期化」が正常に完了することを確認
- 各機能（顧客登録、宛名登録、発送記録）の動作確認

## 🎯 次のステップ
デプロイ完了後、ユーザーによる実際の動作確認と最終調整を行い、PM001プロジェクトの完全な完成を目指します。
