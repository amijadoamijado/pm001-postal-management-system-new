/**
 * PM001 ユーティリティ関数群
 * TaskMaster Task 1.1 - 支援機能・共通処理
 * 小規模運用最適化
 */

/**
 * ログ管理（構造化ログ）
 */
const Logger = {
  
  info(message, data = {}) {
    console.log(`[INFO] ${message}`, JSON.stringify(data, null, 2));
  },
  
  warn(message, data = {}) {
    console.warn(`[WARN] ${message}`, JSON.stringify(data, null, 2));
  },
  
  error(message, error = {}) {
    console.error(`[ERROR] ${message}`, {
      message: error.message || error,
      stack: error.stack || 'No stack trace',
      timestamp: new Date().toISOString()
    });
  },
  
  performance(operation, duration) {
    console.log(`[PERF] ${operation}: ${duration}ms`);
  }
};

/**
 * キャッシュ管理（小規模運用特化）
 */
const CacheManager = {
  
  cache: CacheService.getScriptCache(),
  
  get(key) {
    try {
      const cached = this.cache.get(key);
      if (cached) {
        Logger.info('キャッシュヒット', { key: key });
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      Logger.error('キャッシュ取得エラー', error);
      return null;
    }
  },
  
  set(key, value, expirationInSeconds = CONFIG.CACHE_DURATION) {
    try {
      this.cache.put(key, JSON.stringify(value), expirationInSeconds);
      Logger.info('キャッシュ設定', { key: key, expires: expirationInSeconds });
    } catch (error) {
      Logger.error('キャッシュ設定エラー', error);
    }
  },
  
  remove(key) {
    try {
      this.cache.remove(key);
      Logger.info('キャッシュ削除', { key: key });
    } catch (error) {
      Logger.error('キャッシュ削除エラー', error);
    }
  },
  
  removeAll() {
    try {
      this.cache.removeAll();
      Logger.info('全キャッシュ削除');
    } catch (error) {
      Logger.error('全キャッシュ削除エラー', error);
    }
  },
  
  // 小規模運用用：全データキャッシュ
  getCachedData(key, fetchFunction, expiration = CONFIG.CACHE_DURATION) {
    let data = this.get(key);
    
    if (!data) {
      data = fetchFunction();
      this.set(key, data, expiration);
    }
    
    return data;
  }
};

/**
 * バリデーター（入力検証）
 */
const Validator = {
  
  // 顧客データバリデーション
  validateCustomer(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
      errors.push('氏名は必須です');
    }
    
    if (data.name && data.name.length > 50) {
      errors.push('氏名は50文字以内で入力してください');
    }
    
    if (!data.email) {
      errors.push('メールアドレスは必須です');
    } else if (!this.isValidEmail(data.email)) {
      errors.push('有効なメールアドレスを入力してください');
    }
    
    if (data.phone && !this.isValidPhoneNumber(data.phone)) {
      errors.push('有効な電話番号を入力してください');
    }
    
    if (data.companyName && data.companyName.length > 100) {
      errors.push('会社名は100文字以内で入力してください');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },
  
  // 宛名データバリデーション
  validateAddress(data) {
    const errors = [];
    
    if (!data.customerId) {
      errors.push('顧客IDは必須です');
    }
    
    if (!data.zipCode) {
      errors.push('郵便番号は必須です');
    } else if (!this.isValidZipCode(data.zipCode)) {
      errors.push('郵便番号の形式が正しくありません（例：123-4567）');
    }
    
    if (!data.address || data.address.trim().length === 0) {
      errors.push('住所は必須です');
    }
    
    if (data.address && data.address.length > 200) {
      errors.push('住所は200文字以内で入力してください');
    }
    
    if (!data.recipientName || data.recipientName.trim().length === 0) {
      errors.push('宛名は必須です');
    }
    
    if (data.recipientName && data.recipientName.length > 50) {
      errors.push('宛名は50文字以内で入力してください');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },
  
  // 発送データバリデーション
  validateShipping(data) {
    const errors = [];
    
    if (!data.customerId) {
      errors.push('顧客IDは必須です');
    }
    
    if (!data.addressId) {
      errors.push('宛名IDは必須です');
    }
    
    if (!data.shippingMethod) {
      errors.push('発送方法は必須です');
    } else if (!this.isValidShippingMethod(data.shippingMethod)) {
      errors.push('無効な発送方法です');
    }
    
    if (data.weight && (data.weight < 1 || data.weight > 30000)) {
      errors.push('重量は1g以上30000g以下で入力してください');
    }
    
    // レターパックライトの場合、追跡番号の形式チェック
    if (data.shippingMethod === 'letterpack' && data.trackingNumber) {
      if (!this.isValidTrackingNumber(data.trackingNumber)) {
        errors.push('追跡番号の形式が正しくありません');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },
  
  // メールアドレス検証
  isValidEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
  },
  
  // 電話番号検証（日本の形式）
  isValidPhoneNumber(phone) {
    const pattern = /^[\d\-\(\)\+\s]{10,15}$/;
    return pattern.test(phone);
  },
  
  // 郵便番号検証（日本の形式）
  isValidZipCode(zipCode) {
    const pattern = /^\d{3}-\d{4}$/;
    return pattern.test(zipCode);
  },
  
  // 発送方法検証
  isValidShippingMethod(method) {
    const validMethods = ['standard_regular', 'standard_irregular', 'letterpack'];
    return validMethods.includes(method);
  },
  
  // 追跡番号検証
  isValidTrackingNumber(trackingNumber) {
    // レターパックライトの追跡番号形式（例：12345678901234）
    const pattern = /^\d{10,20}$/;
    return pattern.test(trackingNumber);
  },
  
  // 文字列サニタイズ
  sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>&"']/g, '').trim();
  }
};

/**
 * 料金計算エンジン（新仕様対応）
 * TaskMaster Task 1.3 対応
 */
const FeeCalculator = {
  
  // メイン計算関数
  calculate(data) {
    const { shippingMethod, weight = 50, isExpress = false } = data;
    
    let baseFee = this.getBaseFee(shippingMethod, weight);
    let totalFee = baseFee;
    
    // 速達オプション
    if (isExpress) {
      totalFee += 250;
    }
    
    Logger.info('料金計算実行', {
      method: shippingMethod,
      weight: weight,
      baseFee: baseFee,
      isExpress: isExpress,
      totalFee: totalFee
    });
    
    return totalFee;
  },
  
  // 基本料金取得
  getBaseFee(method, weight) {
    switch (method) {
      case 'standard_regular':
        return this.getStandardRegularFee(weight);
        
      case 'standard_irregular':
        return this.getStandardIrregularFee(weight);
        
      case 'letterpack':
        return 430; // レターパックライト固定料金
        
      default:
        throw new Error(`無効な発送方法: ${method}`);
    }
  },
  
  // 普通郵便（規格内）料金
  getStandardRegularFee(weight) {
    if (weight <= 50) return 140;
    if (weight <= 100) return 180;
    if (weight <= 150) return 270;
    if (weight <= 250) return 320;
    return 320; // 250g超過は320円
  },
  
  // 普通郵便（規格外）料金
  getStandardIrregularFee(weight) {
    if (weight <= 50) return 260;
    if (weight <= 100) return 290;
    if (weight <= 150) return 390;
    if (weight <= 250) return 450;
    return 450; // 250g超過は450円
  },
  
  // 料金表取得（UI表示用）
  getFeeTable() {
    return {
      standard_regular: [
        { weight: '50g以内', fee: 140 },
        { weight: '100g以内', fee: 180 },
        { weight: '150g以内', fee: 270 },
        { weight: '250g以内', fee: 320 }
      ],
      standard_irregular: [
        { weight: '50g以内', fee: 260 },
        { weight: '100g以内', fee: 290 },
        { weight: '150g以内', fee: 390 },
        { weight: '250g以内', fee: 450 }
      ],
      letterpack: [
        { weight: '4kg以内', fee: 430 }
      ],
      options: [
        { name: '速達', fee: 250 }
      ]
    };
  }
};

/**
 * 排他制御管理（同時アクセス対策）
 */
const LockManager = {
  
  execute(operation, timeout = 30000) {
    const lock = LockService.getScriptLock();
    
    try {
      lock.waitLock(timeout);
      Logger.info('ロック取得成功');
      
      const result = operation();
      
      return result;
      
    } catch (error) {
      Logger.error('ロック処理エラー', error);
      throw error;
    } finally {
      lock.releaseLock();
      Logger.info('ロック解放');
    }
  }
};

/**
 * セキュリティ管理（小規模運用対応）
 */
const SecurityManager = {
  
  // アクセス許可チェック
  checkAccess(userEmail) {
    if (!userEmail) {
      throw new Error('ユーザー認証が必要です');
    }
    
    // 小規模運用では基本的に全員許可
    // 必要に応じて特定ドメインのみ許可等に変更可能
    Logger.info('アクセス許可', { user: userEmail });
    return true;
  },
  
  // レート制限チェック
  checkRateLimit(userEmail) {
    const key = `rate_${userEmail}`;
    const cache = CacheService.getScriptCache();
    
    const current = parseInt(cache.get(key) || '0');
    
    if (current >= 100) { // 1分間に100回まで
      throw new Error('アクセス過多です。しばらく待ってからお試しください。');
    }
    
    cache.put(key, (current + 1).toString(), 60); // 1分間保持
  }
};

/**
 * 監視・統計（シンプル版）
 */
const MonitoringSimple = {
  
  // アクセスログ記録
  logAccess(action, userEmail) {
    try {
      const spreadsheetId = CONFIG.SPREADSHEET_ID || 
        PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      
      if (!spreadsheetId) return; // 初期化前はスキップ
      
      const sheet = SpreadsheetApp.openById(spreadsheetId)
                                  .getSheetByName('SystemLog');
      
      if (sheet) {
        sheet.appendRow([
          new Date(),
          userEmail,
          action,
          Session.getActiveUser().getEmail()
        ]);
      }
      
    } catch (error) {
      Logger.error('アクセスログ記録エラー', error);
      // ログ記録失敗でも処理は継続
    }
  },
  
  // パフォーマンス統計取得
  getPerformanceStats() {
    try {
      const spreadsheetId = getSpreadsheetId();
      const sheet = SpreadsheetApp.openById(spreadsheetId)
                                  .getSheetByName('SystemLog');
      
      if (!sheet) return { error: 'ログデータなし' };
      
      const data = sheet.getDataRange().getValues();
      const today = new Date();
      const todayStr = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy-MM-dd');
      
      const todayLogs = data.filter(row => {
        if (row[0] instanceof Date) {
          const logDate = Utilities.formatDate(row[0], 'Asia/Tokyo', 'yyyy-MM-dd');
          return logDate === todayStr;
        }
        return false;
      });
      
      const uniqueUsers = new Set(todayLogs.map(row => row[1])).size;
      const totalRequests = todayLogs.length;
      
      return {
        today: todayStr,
        uniqueUsers: uniqueUsers,
        totalRequests: totalRequests,
        averageRequestsPerUser: uniqueUsers > 0 ? Math.round(totalRequests / uniqueUsers) : 0
      };
      
    } catch (error) {
      Logger.error('パフォーマンス統計取得エラー', error);
      return { error: error.message };
    }
  }
};

/**
 * ID生成ユーティリティ
 */
const IdGenerator = {
  
  generate(prefix = 'ID') {
    const timestamp = new Date().getTime();
    const random = Math.random().toString(36).substr(2, 6);
    return `${prefix}_${timestamp}_${random}`;
  },
  
  generateCustomerId() {
    return this.generate('CUST');
  },
  
  generateAddressId() {
    return this.generate('ADDR');
  },
  
  generateShippingId() {
    return this.generate('SHIP');
  }
};

/**
 * 日付・時間ユーティリティ
 */
const DateUtils = {
  
  formatDate(date, format = 'yyyy-MM-dd') {
    return Utilities.formatDate(date, 'Asia/Tokyo', format);
  },
  
  formatDateTime(date) {
    return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  },
  
  getToday() {
    return new Date();
  },
  
  getTodayString() {
    return this.formatDate(new Date());
  },
  
  isToday(date) {
    const today = this.getTodayString();
    const checkDate = this.formatDate(date);
    return today === checkDate;
  }
};

/**
 * パフォーマンス測定ユーティリティ
 */
const Performance = {
  
  measure(name, fn) {
    const startTime = new Date();
    
    try {
      const result = fn();
      const duration = new Date() - startTime;
      
      Logger.performance(name, duration);
      
      return result;
      
    } catch (error) {
      const duration = new Date() - startTime;
      Logger.error(`パフォーマンス測定エラー: ${name} (${duration}ms)`, error);
      throw error;
    }
  },
  
  async measureAsync(name, fn) {
    const startTime = new Date();
    
    try {
      const result = await fn();
      const duration = new Date() - startTime;
      
      Logger.performance(name, duration);
      
      return result;
      
    } catch (error) {
      const duration = new Date() - startTime;
      Logger.error(`非同期パフォーマンス測定エラー: ${name} (${duration}ms)`, error);
      throw error;
    }
  }
};