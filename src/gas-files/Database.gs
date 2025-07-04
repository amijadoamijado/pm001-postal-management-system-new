/**
 * PM001 データベース操作クラス
 * TaskMaster Task 1.2 - データベース基盤実装
 * 小規模運用（80名・同時5接続）最適化・新要件完全対応
 */

const Database = {
  
  spreadsheetId: null,
  
  /**
   * データベース初期化（拡張版）
   * TaskMaster Task 1.2 - 核心機能
   */
  initialize(spreadsheetId) {
    try {
      this.spreadsheetId = spreadsheetId;
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      
      Logger.info('データベース初期化開始', { spreadsheetId: spreadsheetId });
      
      // 各テーブル作成（新要件対応）
      const tableConfigs = [
        {
          name: 'Customers',
          headers: ['ID', '氏名', '会社名', 'メールアドレス', '電話番号', '作成日', '更新日'],
          headerStyle: { background: '#E3F2FD', fontWeight: 'bold' },
          description: '顧客マスタ（会社名フィールド追加）'
        },
        {
          name: 'Addresses',
          headers: ['ID', '顧客ID', '郵便番号', '住所', '建物名', '宛名', '作成日', '更新日'],
          headerStyle: { background: '#F3E5F5', fontWeight: 'bold' },
          description: '宛名マスタ'
        },
        {
          name: 'Shipping',
          headers: ['ID', '顧客ID', '宛名ID', '発送方法', '重量', '料金', '速達', '追跡番号', '発送日', '作成日'],
          headerStyle: { background: '#E8F5E8', fontWeight: 'bold' },
          description: '発送記録（追跡番号フィールド追加）'
        },
        {
          name: 'UserHistory',
          headers: ['ユーザーID', '宛名ID', '使用回数', '最終使用日', '作成日', '更新日'],
          headerStyle: { background: '#FFF3E0', fontWeight: 'bold' },
          description: 'ユーザー別宛名使用履歴'
        },
        {
          name: 'AddressUsage',
          headers: ['宛名ID', '総使用回数', '最終使用日', '作成者ユーザーID', '作成日', '更新日'],
          headerStyle: { background: '#FFEBEE', fontWeight: 'bold' },
          description: '宛名使用統計'
        },
        {
          name: 'SystemLog',
          headers: ['タイムスタンプ', 'ユーザーID', 'アクション', '実行者'],
          headerStyle: { background: '#F5F5F5', fontWeight: 'bold' },
          description: 'システムアクセスログ'
        }
      ];
      
      // テーブル作成実行
      tableConfigs.forEach(config => {
        this.createOptimizedTable(spreadsheet, config);
      });
      
      // デフォルトシート削除
      this.removeDefaultSheet(spreadsheet);
      
      // 初期化完了ログ
      Logger.info('データベース初期化完了', { 
        tables: tableConfigs.length, 
        spreadsheetId: spreadsheetId 
      });
      
      return { success: true, tables: tableConfigs.length };
      
    } catch (error) {
      Logger.error('データベース初期化エラー', error);
      throw error;
    }
  },
  
  /**
   * 最適化されたテーブル作成
   */
  createOptimizedTable(spreadsheet, config) {
    try {
      const sheet = spreadsheet.insertSheet(config.name);
      
      // ヘッダー設定
      const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
      headerRange.setValues([config.headers]);
      
      // ヘッダースタイル適用
      if (config.headerStyle) {
        headerRange.setBackground(config.headerStyle.background);
        headerRange.setFontWeight(config.headerStyle.fontWeight);
        headerRange.setHorizontalAlignment('center');
      }
      
      // 列幅自動調整
      sheet.autoResizeColumns(1, config.headers.length);
      
      // ヘッダー固定
      sheet.setFrozenRows(1);
      
      // シート保護（ヘッダー行のみ）
      const protection = sheet.getRange(1, 1, 1, config.headers.length).protect();
      protection.setDescription(`${config.name}ヘッダー保護`);
      
      Logger.info('テーブル作成完了', { 
        name: config.name, 
        headers: config.headers.length,
        description: config.description
      });
      
    } catch (error) {
      Logger.error('テーブル作成エラー', { name: config.name, error: error });
      throw error;
    }
  },
  
  /**
   * デフォルトシート削除
   */
  removeDefaultSheet(spreadsheet) {
    try {
      const defaultSheet = spreadsheet.getSheetByName('シート1') || 
                          spreadsheet.getSheetByName('Sheet1');
      if (defaultSheet) {
        spreadsheet.deleteSheet(defaultSheet);
        Logger.info('デフォルトシート削除完了');
      }
    } catch (error) {
      Logger.warn('デフォルトシート削除スキップ', error);
    }
  },
  
  /**
   * 顧客保存（会社名フィールド対応）
   * TaskMaster Task 2.1 の基盤
   */
  saveCustomer(customerData) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('Customers');
      
      const id = IdGenerator.generateCustomerId();
      const now = new Date();
      
      const row = [
        id,
        customerData.name,
        customerData.companyName || '', // 新規フィールド
        customerData.email,
        customerData.phone || '',
        now,
        now
      ];
      
      sheet.appendRow(row);
      
      // キャッシュクリア
      CacheManager.remove('customers_all');
      
      Logger.info('顧客保存完了', { 
        id: id, 
        name: customerData.name, 
        companyName: customerData.companyName 
      });
      
      return { 
        id: id, 
        ...customerData, 
        createdAt: now,
        updatedAt: now
      };
      
    } catch (error) {
      Logger.error('顧客保存エラー', error);
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
      
      const id = IdGenerator.generateAddressId();
      const now = new Date();
      
      const row = [
        id,
        addressData.customerId,
        addressData.zipCode,
        addressData.address,
        addressData.buildingName || '',
        addressData.recipientName,
        now,
        now
      ];
      
      sheet.appendRow(row);
      
      // キャッシュクリア
      CacheManager.remove('addresses_all');
      CacheManager.remove(`addresses_customer_${addressData.customerId}`);
      
      Logger.info('宛名保存完了', { 
        id: id, 
        customerId: addressData.customerId,
        recipientName: addressData.recipientName 
      });
      
      return { 
        id: id, 
        ...addressData, 
        createdAt: now,
        updatedAt: now
      };
      
    } catch (error) {
      Logger.error('宛名保存エラー', error);
      throw error;
    }
  },
  
  /**
   * 発送記録保存（追跡番号対応）
   * TaskMaster Task 3.1 の基盤
   */
  saveShipping(shippingData) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('Shipping');
      
      const id = IdGenerator.generateShippingId();
      const now = new Date();
      
      const row = [
        id,
        shippingData.customerId,
        shippingData.addressId,
        shippingData.shippingMethod,
        shippingData.weight || 0,
        shippingData.calculatedFee,
        shippingData.isExpress ? '速達' : '通常',
        shippingData.trackingNumber || '', // 新規フィールド
        shippingData.shippingDate || now,
        now
      ];
      
      sheet.appendRow(row);
      
      // 関連キャッシュクリア
      CacheManager.remove('shipping_all');
      CacheManager.remove(`shipping_customer_${shippingData.customerId}`);
      
      Logger.info('発送記録保存完了', { 
        id: id, 
        method: shippingData.shippingMethod,
        fee: shippingData.calculatedFee,
        trackingNumber: shippingData.trackingNumber
      });
      
      return { 
        id: id, 
        ...shippingData, 
        createdAt: now 
      };
      
    } catch (error) {
      Logger.error('発送記録保存エラー', error);
      throw error;
    }
  },
  
  /**
   * ユーザー履歴更新（新機能）
   */
  updateUserHistory(userId, addressId) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('UserHistory');
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) {
        // 初回登録
        const row = [userId, addressId, 1, new Date(), new Date(), new Date()];
        sheet.appendRow(row);
        Logger.info('ユーザー履歴初回登録', { userId: userId, addressId: addressId });
        return;
      }
      
      // 既存記録検索
      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === userId && data[i][1] === addressId) {
          foundRow = i + 1;
          break;
        }
      }
      
      if (foundRow > 0) {
        // 既存記録更新
        const currentCount = data[foundRow - 1][2] || 0;
        sheet.getRange(foundRow, 3).setValue(currentCount + 1); // 使用回数
        sheet.getRange(foundRow, 4).setValue(new Date()); // 最終使用日
        sheet.getRange(foundRow, 6).setValue(new Date()); // 更新日
        
        Logger.info('ユーザー履歴更新', { 
          userId: userId, 
          addressId: addressId, 
          newCount: currentCount + 1 
        });
      } else {
        // 新規記録追加
        const row = [userId, addressId, 1, new Date(), new Date(), new Date()];
        sheet.appendRow(row);
        
        Logger.info('ユーザー履歴新規追加', { userId: userId, addressId: addressId });
      }
      
      // キャッシュクリア
      CacheManager.remove(`user_history_${userId}`);
      
    } catch (error) {
      Logger.error('ユーザー履歴更新エラー', error);
      throw error;
    }
  },
  
  /**
   * 宛名使用統計更新（新機能）
   */
  updateAddressUsage(addressId) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('AddressUsage');
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) {
        // 初回登録
        const row = [addressId, 1, new Date(), 'system', new Date(), new Date()];
        sheet.appendRow(row);
        Logger.info('宛名使用統計初回登録', { addressId: addressId });
        return;
      }
      
      // 既存記録検索
      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === addressId) {
          foundRow = i + 1;
          break;
        }
      }
      
      if (foundRow > 0) {
        // 既存記録更新
        const currentCount = data[foundRow - 1][1] || 0;
        sheet.getRange(foundRow, 2).setValue(currentCount + 1); // 総使用回数
        sheet.getRange(foundRow, 3).setValue(new Date()); // 最終使用日
        sheet.getRange(foundRow, 6).setValue(new Date()); // 更新日
        
        Logger.info('宛名使用統計更新', { 
          addressId: addressId, 
          newCount: currentCount + 1 
        });
      } else {
        // 新規記録追加
        const row = [addressId, 1, new Date(), 'system', new Date(), new Date()];
        sheet.appendRow(row);
        
        Logger.info('宛名使用統計新規追加', { addressId: addressId });
      }
      
      // キャッシュクリア
      CacheManager.remove('address_usage_all');
      
    } catch (error) {
      Logger.error('宛名使用統計更新エラー', error);
      throw error;
    }
  },
  
  /**
   * 宛名使用履歴初期化
   */
  initializeAddressUsage(addressId, createdBy) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName('AddressUsage');
      
      const row = [addressId, 0, new Date(), createdBy, new Date(), new Date()];
      sheet.appendRow(row);
      
      Logger.info('宛名使用履歴初期化', { addressId: addressId, createdBy: createdBy });
      
    } catch (error) {
      Logger.warn('宛名使用履歴初期化エラー', error);
      // エラーでも処理継続
    }
  },
  
  /**
   * 顧客取得（キャッシュ対応）
   */
  getCustomers(id = null) {
    try {
      const cacheKey = id ? `customer_${id}` : 'customers_all';
      
      return CacheManager.getCachedData(cacheKey, () => {
        const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
        const sheet = spreadsheet.getSheetByName('Customers');
        const data = sheet.getDataRange().getValues();
        
        if (data.length <= 1) return [];
        
        const headers = data[0];
        const customers = data.slice(1).map(row => {
          return this.rowToObject(row, headers, 'customers');
        });
        
        const result = id ? customers.filter(c => c.id === id) : customers;
        
        Logger.info('顧客取得完了', { 
          total: customers.length, 
          filtered: result.length,
          cached: false
        });
        
        return result;
      });
      
    } catch (error) {
      Logger.error('顧客取得エラー', error);
      throw error;
    }
  },
  
  /**
   * 宛名取得（キャッシュ対応）
   */
  getAddresses(customerId = null) {
    try {
      const cacheKey = customerId ? `addresses_customer_${customerId}` : 'addresses_all';
      
      return CacheManager.getCachedData(cacheKey, () => {
        const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
        const sheet = spreadsheet.getSheetByName('Addresses');
        const data = sheet.getDataRange().getValues();
        
        if (data.length <= 1) return [];
        
        const headers = data[0];
        const addresses = data.slice(1).map(row => {
          return this.rowToObject(row, headers, 'addresses');
        });
        
        const result = customerId ? addresses.filter(a => a.customerId === customerId) : addresses;
        
        Logger.info('宛名取得完了', { 
          total: addresses.length, 
          filtered: result.length,
          cached: false
        });
        
        return result;
      });
      
    } catch (error) {
      Logger.error('宛名取得エラー', error);
      throw error;
    }
  },
  
  /**
   * 発送記録取得（キャッシュ対応）
   */
  getShipping(customerId = null) {
    try {
      const cacheKey = customerId ? `shipping_customer_${customerId}` : 'shipping_all';
      
      return CacheManager.getCachedData(cacheKey, () => {
        const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
        const sheet = spreadsheet.getSheetByName('Shipping');
        const data = sheet.getDataRange().getValues();
        
        if (data.length <= 1) return [];
        
        const headers = data[0];
        const shipping = data.slice(1).map(row => {
          return this.rowToObject(row, headers, 'shipping');
        });
        
        const result = customerId ? shipping.filter(s => s.customerId === customerId) : shipping;
        
        // 日付順ソート（新しい順）
        result.sort((a, b) => new Date(b.shippingDate) - new Date(a.shippingDate));
        
        Logger.info('発送記録取得完了', { 
          total: shipping.length, 
          filtered: result.length,
          cached: false
        });
        
        return result;
      });
      
    } catch (error) {
      Logger.error('発送記録取得エラー', error);
      throw error;
    }
  },
  
  /**
   * ユーザー履歴取得
   */
  getUserHistory(userId) {
    try {
      const cacheKey = `user_history_${userId}`;
      
      return CacheManager.getCachedData(cacheKey, () => {
        const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
        const sheet = spreadsheet.getSheetByName('UserHistory');
        const data = sheet.getDataRange().getValues();
        
        if (data.length <= 1) return [];
        
        const headers = data[0];
        const results = [];
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row[0] === userId) {
            const history = this.rowToObject(row, headers, 'userHistory');
            
            // 宛名情報も取得
            const addressInfo = this.getAddresses().find(addr => addr.id === history.addressId);
            if (addressInfo) {
              history.addressInfo = addressInfo;
              
              // 顧客情報も取得
              const customerInfo = this.getCustomers().find(cust => cust.id === addressInfo.customerId);
              if (customerInfo) {
                history.customerInfo = customerInfo;
              }
            }
            
            results.push(history);
          }
        }
        
        // 最終使用日順でソート
        results.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
        
        Logger.info('ユーザー履歴取得完了', { 
          userId: userId, 
          count: results.length,
          cached: false
        });
        
        return results;
      });
      
    } catch (error) {
      Logger.error('ユーザー履歴取得エラー', error);
      throw error;
    }
  },
  
  /**
   * 全使用履歴取得
   */
  getAllUsageHistory() {
    try {
      const cacheKey = 'address_usage_all';
      
      return CacheManager.getCachedData(cacheKey, () => {
        const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
        const sheet = spreadsheet.getSheetByName('AddressUsage');
        const data = sheet.getDataRange().getValues();
        
        if (data.length <= 1) return [];
        
        const headers = data[0];
        const results = [];
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const usage = this.rowToObject(row, headers, 'addressUsage');
          
          // 宛名情報も取得
          const addressInfo = this.getAddresses().find(addr => addr.id === usage.addressId);
          if (addressInfo) {
            usage.addressInfo = addressInfo;
            
            // 顧客情報も取得
            const customerInfo = this.getCustomers().find(cust => cust.id === addressInfo.customerId);
            if (customerInfo) {
              usage.customerInfo = customerInfo;
            }
          }
          
          results.push(usage);
        }
        
        // 総使用回数順でソート
        results.sort((a, b) => (b.totalUsage || 0) - (a.totalUsage || 0));
        
        Logger.info('全使用履歴取得完了', { 
          count: results.length,
          cached: false
        });
        
        return results;
      });
      
    } catch (error) {
      Logger.error('全使用履歴取得エラー', error);
      throw error;
    }
  },
  
  /**
   * 顧客・宛名検索（会社名対応）
   * TaskMaster Task 2.3 の基盤
   */
  searchCustomersAndAddresses(searchQuery) {
    try {
      const query = searchQuery.toLowerCase();
      const results = [];
      
      // 顧客検索（氏名・会社名）
      const customers = this.getCustomers();
      customers.forEach(customer => {
        if (customer.name.toLowerCase().includes(query) ||
            (customer.companyName && customer.companyName.toLowerCase().includes(query))) {
          results.push({
            type: 'customer',
            data: customer,
            matchField: customer.name.toLowerCase().includes(query) ? '氏名' : '会社名',
            score: this.calculateSearchScore(query, customer.name, customer.companyName)
          });
        }
      });
      
      // 宛名検索
      const addresses = this.getAddresses();
      addresses.forEach(address => {
        if (address.recipientName.toLowerCase().includes(query)) {
          const customer = customers.find(c => c.id === address.customerId);
          results.push({
            type: 'address',
            data: address,
            customerData: customer,
            matchField: '宛名',
            score: this.calculateSearchScore(query, address.recipientName)
          });
        }
      });
      
      // スコア順でソート（関連度順）
      results.sort((a, b) => b.score - a.score);
      
      Logger.info('検索完了', { 
        query: searchQuery, 
        results: results.length 
      });
      
      return results;
      
    } catch (error) {
      Logger.error('検索エラー', error);
      throw error;
    }
  },
  
  /**
   * 検索スコア計算（関連度評価）
   */
  calculateSearchScore(query, ...targets) {
    let maxScore = 0;
    
    targets.forEach(target => {
      if (!target) return;
      
      const targetLower = target.toLowerCase();
      const queryLower = query.toLowerCase();
      
      if (targetLower === queryLower) {
        maxScore = Math.max(maxScore, 100); // 完全一致
      } else if (targetLower.startsWith(queryLower)) {
        maxScore = Math.max(maxScore, 80); // 前方一致
      } else if (targetLower.includes(queryLower)) {
        maxScore = Math.max(maxScore, 60); // 部分一致
      }
    });
    
    return maxScore;
  },
  
  /**
   * 顧客と宛名の結合データ取得
   */
  getCustomersWithAddresses() {
    try {
      const cacheKey = 'customers_with_addresses';
      
      return CacheManager.getCachedData(cacheKey, () => {
        const customers = this.getCustomers();
        const addresses = this.getAddresses();
        
        const results = customers.map(customer => {
          const customerAddresses = addresses.filter(addr => addr.customerId === customer.id);
          return {
            ...customer,
            addresses: customerAddresses,
            addressCount: customerAddresses.length
          };
        });
        
        Logger.info('顧客・宛名結合データ取得完了', { 
          customers: customers.length,
          addresses: addresses.length,
          cached: false
        });
        
        return results;
      });
      
    } catch (error) {
      Logger.error('顧客・宛名結合データ取得エラー', error);
      throw error;
    }
  },
  
  /**
   * 行データをオブジェクトに変換
   */
  rowToObject(row, headers, type) {
    const obj = {};
    headers.forEach((header, index) => {
      const key = this.normalizeKey(header, type);
      obj[key] = row[index];
    });
    return obj;
  },
  
  /**
   * キー正規化（拡張版）
   */
  normalizeKey(key, type = 'general') {
    const keyMap = {
      'ID': 'id',
      '氏名': 'name',
      '会社名': 'companyName',
      'メールアドレス': 'email',
      '電話番号': 'phone',
      '顧客ID': 'customerId',
      '郵便番号': 'zipCode',
      '住所': 'address',
      '建物名': 'buildingName',
      '宛名': 'recipientName',
      '宛名ID': 'addressId',
      '発送方法': 'shippingMethod',
      '重量': 'weight',
      '料金': 'fee',
      '速達': 'express',
      '追跡番号': 'trackingNumber',
      '発送日': 'shippingDate',
      '作成日': 'createdAt',
      '更新日': 'updatedAt',
      'ユーザーID': 'userId',
      '使用回数': 'usageCount',
      '最終使用日': 'lastUsed',
      '総使用回数': 'totalUsage',
      '作成者ユーザーID': 'createdBy',
      'タイムスタンプ': 'timestamp',
      'アクション': 'action',
      '実行者': 'executor'
    };
    
    return keyMap[key] || key.toLowerCase();
  },
  
  /**
   * 統計情報取得
   */
  getStatistics() {
    try {
      const stats = {
        customers: this.getCustomers().length,
        addresses: this.getAddresses().length,
        shipping: this.getShipping().length,
        
        // 本日の統計
        todayShipping: this.getShipping().filter(s => 
          DateUtils.isToday(s.shippingDate)
        ).length,
        
        // 今月の統計
        thisMonthShipping: this.getShipping().filter(s => {
          const shipDate = new Date(s.shippingDate);
          const now = new Date();
          return shipDate.getMonth() === now.getMonth() && 
                 shipDate.getFullYear() === now.getFullYear();
        }).length
      };
      
      Logger.info('統計情報取得完了', stats);
      
      return stats;
      
    } catch (error) {
      Logger.error('統計情報取得エラー', error);
      throw error;
    }
  }
};