/**
 * PM001 エラーハンドリングモジュール
 * TaskMaster Task 1.1 - エラー処理統合
 * Task 2.1 - 顧客管理エラー対応
 */

const ErrorHandler = {
  
  /**
   * 統合エラーハンドリング
   */
  handle(errorType, error, context = {}) {
    try {
      const errorInfo = {
        type: errorType,
        message: error.message || error,
        timestamp: new Date(),
        context: context,
        user: this.getCurrentUser(),
        stack: error.stack || 'No stack trace'
      };
      
      // エラーログ記録
      Logger.error(`[${errorType}] ${error.message || error}`, errorInfo);
      
      // 重要エラーの場合は追加ログ
      if (this.isCriticalError(errorType)) {
        this.logCriticalError(errorInfo);
      }
      
      // ユーザー向けエラーレスポンス生成
      const userMessage = this.generateUserMessage(errorType, error);
      
      return {
        success: false,
        error: {
          type: errorType,
          message: userMessage,
          code: this.getErrorCode(errorType),
          timestamp: errorInfo.timestamp,
          requestId: this.generateRequestId()
        },
        debug: CONFIG.DEBUG_MODE ? errorInfo : undefined
      };
      
    } catch (handlingError) {
      // エラーハンドリング自体でエラーが発生した場合
      console.error('Error handling failed:', handlingError);
      
      return {
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: 'システム内部エラーが発生しました',
          code: 'E_INTERNAL_001',
          timestamp: new Date()
        }
      };
    }
  },
  
  /**
   * エラーコード取得
   */
  getErrorCode(errorType) {
    const errorCodes = {
      // システム基盤エラー
      'INIT_ERROR': 'E_INIT_001',
      'DATABASE_ERROR': 'E_DB_001',
      'CACHE_ERROR': 'E_CACHE_001',
      'LOCK_ERROR': 'E_LOCK_001',
      'VALIDATION_ERROR': 'E_VALID_001',
      
      // Web API エラー
      'WEB_POST_ERROR': 'E_WEB_001',
      'WEB_GET_ERROR': 'E_WEB_002',
      'AUTH_ERROR': 'E_AUTH_001',
      'RATE_LIMIT_ERROR': 'E_RATE_001',
      
      // データ操作エラー
      'SAVE_CUSTOMER_ERROR': 'E_CUST_001',
      'SAVE_ADDRESS_ERROR': 'E_ADDR_001',
      'SAVE_SHIPPING_ERROR': 'E_SHIP_001',
      'GET_DATA_ERROR': 'E_GET_001',
      'SEARCH_ERROR': 'E_SEARCH_001',
      'CALCULATE_FEE_ERROR': 'E_FEE_001',
      
      // 顧客管理エラー（Task 2.1）
      'CUSTOMER_NOT_FOUND': 'E_CUST_002',
      'CUSTOMER_UPDATE_ERROR': 'E_CUST_003',
      'CUSTOMER_DELETE_ERROR': 'E_CUST_004',
      'CUSTOMER_SEARCH_ERROR': 'E_CUST_005',
      'CUSTOMER_IMPORT_ERROR': 'E_CUST_006',
      'CUSTOMER_EXPORT_ERROR': 'E_CUST_007',
      'CUSTOMER_HAS_ORDERS': 'E_CUST_008',
      
      // 宛名管理エラー（Task 2.2）
      'ADDRESS_NOT_FOUND': 'E_ADDR_002',
      'ADDRESS_UPDATE_ERROR': 'E_ADDR_003',
      'ADDRESS_DELETE_ERROR': 'E_ADDR_004',
      'ADDRESS_SEARCH_ERROR': 'E_ADDR_005',
      'ADDRESS_IMPORT_ERROR': 'E_ADDR_006',
      'ADDRESS_EXPORT_ERROR': 'E_ADDR_007',
      'ADDRESS_HAS_SHIPPING': 'E_ADDR_008',
      'ADDRESS_DUPLICATE_ERROR': 'E_ADDR_009',
      
      // 宛名選択エラー
      'GET_ADDRESS_SELECTION_ERROR': 'E_ADDR_SEL_001',
      
      // その他
      'STATUS_ERROR': 'E_STATUS_001',
      'DEBUG_INFO_ERROR': 'E_DEBUG_001',
      'PERFORMANCE_STATS_ERROR': 'E_PERF_001'
    };
    
    return errorCodes[errorType] || 'E_UNKNOWN_001';
  },
  
  /**
   * ユーザー向けエラーメッセージ生成
   */
  generateUserMessage(errorType, error) {
    const userMessages = {
      // システム基盤エラー
      'INIT_ERROR': 'システムの初期化に失敗しました。管理者にお問い合わせください。',
      'DATABASE_ERROR': 'データベースへのアクセスに失敗しました。しばらく待ってから再試行してください。',
      'CACHE_ERROR': 'キャッシュ処理でエラーが発生しました。処理は継続されます。',
      'LOCK_ERROR': '他のユーザーが同じデータを更新中です。しばらく待ってから再試行してください。',
      'VALIDATION_ERROR': '入力データに不備があります。内容を確認してください。',
      
      // Web API エラー
      'WEB_POST_ERROR': 'リクエストの処理に失敗しました。',
      'WEB_GET_ERROR': 'ページの読み込みに失敗しました。',
      'AUTH_ERROR': '認証に失敗しました。ログインし直してください。',
      'RATE_LIMIT_ERROR': 'アクセス過多です。しばらく待ってからお試しください。',
      
      // データ操作エラー
      'SAVE_CUSTOMER_ERROR': '顧客情報の保存に失敗しました。',
      'SAVE_ADDRESS_ERROR': '宛名情報の保存に失敗しました。',
      'SAVE_SHIPPING_ERROR': '発送記録の保存に失敗しました。',
      'GET_DATA_ERROR': 'データの取得に失敗しました。',
      'SEARCH_ERROR': '検索処理に失敗しました。',
      'CALCULATE_FEE_ERROR': '料金計算に失敗しました。',
      
      // 顧客管理エラー（Task 2.1）
      'CUSTOMER_NOT_FOUND': '指定された顧客が見つかりません。',
      'CUSTOMER_UPDATE_ERROR': '顧客情報の更新に失敗しました。',
      'CUSTOMER_DELETE_ERROR': '顧客の削除に失敗しました。',
      'CUSTOMER_SEARCH_ERROR': '顧客検索に失敗しました。',
      'CUSTOMER_IMPORT_ERROR': '顧客データのインポートに失敗しました。',
      'CUSTOMER_EXPORT_ERROR': '顧客データのエクスポートに失敗しました。',
      'CUSTOMER_HAS_ORDERS': '発送履歴のある顧客は削除できません。',
      
      // 宛名管理エラー（Task 2.2）
      'ADDRESS_NOT_FOUND': '指定された宛名が見つかりません。',
      'ADDRESS_UPDATE_ERROR': '宛名情報の更新に失敗しました。',
      'ADDRESS_DELETE_ERROR': '宛名の削除に失敗しました。',
      'ADDRESS_SEARCH_ERROR': '宛名検索に失敗しました。',
      'ADDRESS_IMPORT_ERROR': '宛名データのインポートに失敗しました。',
      'ADDRESS_EXPORT_ERROR': '宛名データのエクスポートに失敗しました。',
      'ADDRESS_HAS_SHIPPING': '発送履歴のある宛名は削除できません。',
      'ADDRESS_DUPLICATE_ERROR': '宛名の複製に失敗しました。',
      
      // 宛名選択エラー
      'GET_ADDRESS_SELECTION_ERROR': '宛名選択データの取得に失敗しました。',
      
      // その他
      'STATUS_ERROR': 'システム状態の取得に失敗しました。',
      'DEBUG_INFO_ERROR': 'デバッグ情報の取得に失敗しました。',
      'PERFORMANCE_STATS_ERROR': 'パフォーマンス統計の取得に失敗しました。'
    };
    
    // 基本メッセージ
    let baseMessage = userMessages[errorType] || 'システムエラーが発生しました。';
    
    // 詳細エラーメッセージがある場合は追加
    if (error.message && this.isUserFriendlyMessage(error.message)) {
      baseMessage += ` (${error.message})`;
    }
    
    return baseMessage;
  },
  
  /**
   * 重要エラー判定
   */
  isCriticalError(errorType) {
    const criticalErrors = [
      'INIT_ERROR',
      'DATABASE_ERROR',
      'SAVE_CUSTOMER_ERROR',
      'SAVE_ADDRESS_ERROR',
      'SAVE_SHIPPING_ERROR',
      'CUSTOMER_DELETE_ERROR'
    ];
    
    return criticalErrors.includes(errorType);
  },
  
  /**
   * 重要エラーログ記録
   */
  logCriticalError(errorInfo) {
    try {
      // システムログへの記録
      MonitoringSimple.logAccess(`CRITICAL_ERROR:${errorInfo.type}`, errorInfo.user);
      
      // 必要に応じてメール通知等を実装
      // this.sendCriticalErrorNotification(errorInfo);
      
    } catch (error) {
      console.error('Critical error logging failed:', error);
    }
  },
  
  /**
   * ユーザーフレンドリーメッセージ判定
   */
  isUserFriendlyMessage(message) {
    // SQL エラーやスタックトレースなど、技術的すぎるメッセージを除外
    const technicalPatterns = [
      /Exception in thread/i,
      /at com\.google/i,
      /at java\./i,
      /SQLException/i,
      /NullPointerException/i,
      /stack trace/i
    ];
    
    return !technicalPatterns.some(pattern => pattern.test(message));
  },
  
  /**
   * 現在のユーザー取得（安全版）
   */
  getCurrentUser() {
    try {
      return Session.getActiveUser().getEmail();
    } catch (error) {
      return 'unknown_user';
    }
  },
  
  /**
   * リクエストID生成
   */
  generateRequestId() {
    return `req_${new Date().getTime()}_${Math.random().toString(36).substr(2, 6)}`;
  },
  
  /**
   * バリデーションエラー専用ハンドラー
   */
  handleValidationError(validationResult) {
    return this.handle('VALIDATION_ERROR', {
      message: validationResult.errors.join(', ')
    }, {
      validationDetails: validationResult
    });
  },
  
  /**
   * 顧客関連エラー専用ハンドラー
   */
  handleCustomerError(errorType, error, customerId = null) {
    return this.handle(errorType, error, {
      customerId: customerId,
      module: 'CustomerManager'
    });
  },
  
  /**
   * データベースエラー専用ハンドラー
   */
  handleDatabaseError(operation, error, data = {}) {
    return this.handle('DATABASE_ERROR', error, {
      operation: operation,
      data: data,
      module: 'Database'
    });
  },
  
  /**
   * レート制限エラー専用ハンドラー
   */
  handleRateLimitError(userEmail, limit = 100) {
    return this.handle('RATE_LIMIT_ERROR', {
      message: `1分間に${limit}回を超えるアクセスが検出されました`
    }, {
      userEmail: userEmail,
      limit: limit
    });
  },
  
  /**
   * エラー統計取得
   */
  getErrorStats(timeframe = 'today') {
    try {
      // 簡易実装：実際のログから統計を取得
      const stats = {
        timeframe: timeframe,
        totalErrors: 0,
        errorTypes: {},
        criticalErrors: 0,
        timestamp: new Date()
      };
      
      // 実装は必要に応じて拡張
      return stats;
      
    } catch (error) {
      Logger.error('エラー統計取得エラー', error);
      return null;
    }
  }
};