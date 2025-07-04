/**
 * PM001 顧客管理モジュール
 * TaskMaster Task 2.1 - 顧客管理機能実装
 * 登録、検索、編集、削除、会社名フィールド対応
 */

const CustomerManager = {
  
  /**
   * 顧客一覧取得（ページング対応）
   * 小規模運用でも将来の拡張性を考慮
   */
  getCustomerList(options = {}) {
    try {
      const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc', filter = null } = options;
      
      Logger.info('顧客一覧取得開始', { page, limit, sortBy, sortOrder });
      
      // キャッシュキーを詳細に設定
      const cacheKey = `customer_list_${page}_${limit}_${sortBy}_${sortOrder}_${filter || 'all'}`;
      
      return CacheManager.getCachedData(cacheKey, () => {
        let customers = Database.getCustomers();
        
        // フィルタリング
        if (filter) {
          customers = customers.filter(customer => 
            customer.name.toLowerCase().includes(filter.toLowerCase()) ||
            (customer.companyName && customer.companyName.toLowerCase().includes(filter.toLowerCase())) ||
            customer.email.toLowerCase().includes(filter.toLowerCase())
          );
        }
        
        // ソート
        customers.sort((a, b) => {
          let aValue = a[sortBy] || '';
          let bValue = b[sortBy] || '';
          
          if (typeof aValue === 'string') aValue = aValue.toLowerCase();
          if (typeof bValue === 'string') bValue = bValue.toLowerCase();
          
          if (sortOrder === 'desc') {
            return bValue > aValue ? 1 : -1;
          }
          return aValue > bValue ? 1 : -1;
        });
        
        // ページング
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedCustomers = customers.slice(startIndex, endIndex);
        
        // 各顧客の宛名数も取得
        const customersWithCounts = paginatedCustomers.map(customer => {
          const addresses = Database.getAddresses(customer.id);
          return {
            ...customer,
            addressCount: addresses.length,
            lastOrderDate: this.getLastOrderDate(customer.id)
          };
        });
        
        const result = {
          customers: customersWithCounts,
          pagination: {
            current: page,
            total: Math.ceil(customers.length / limit),
            count: customers.length,
            limit: limit
          }
        };
        
        Logger.info('顧客一覧取得完了', { 
          total: customers.length, 
          page: page, 
          returned: paginatedCustomers.length 
        });
        
        return result;
      });
      
    } catch (error) {
      Logger.error('顧客一覧取得エラー', error);
      throw error;
    }
  },
  
  /**
   * 顧客詳細取得（宛名・発送履歴含む）
   */
  getCustomerDetail(customerId) {
    try {
      Logger.info('顧客詳細取得開始', { customerId });
      
      const cacheKey = `customer_detail_${customerId}`;
      
      return CacheManager.getCachedData(cacheKey, () => {
        const customers = Database.getCustomers(customerId);
        if (!customers || customers.length === 0) {
          throw new Error(`顧客が見つかりません: ${customerId}`);
        }
        
        const customer = customers[0];
        
        // 関連データ取得
        const addresses = Database.getAddresses(customerId);
        const shipping = Database.getShipping(customerId);
        
        // 統計情報計算
        const stats = this.calculateCustomerStats(customer, addresses, shipping);
        
        const result = {
          customer: customer,
          addresses: addresses,
          recentShipping: shipping.slice(0, 10), // 最新10件
          statistics: stats
        };
        
        Logger.info('顧客詳細取得完了', { 
          customerId, 
          addressCount: addresses.length, 
          shippingCount: shipping.length 
        });
        
        return result;
      });
      
    } catch (error) {
      Logger.error('顧客詳細取得エラー', error);
      throw error;
    }
  },
  
  /**
   * 顧客情報更新
   */
  updateCustomer(customerId, updateData) {
    try {
      Logger.info('顧客更新開始', { customerId, updateData });
      
      // バリデーション
      const validation = Validator.validateCustomer(updateData);
      if (!validation.isValid) {
        throw new Error(`入力エラー: ${validation.errors.join(', ')}`);
      }
      
      // 既存顧客確認
      const existingCustomers = Database.getCustomers(customerId);
      if (!existingCustomers || existingCustomers.length === 0) {
        throw new Error(`顧客が見つかりません: ${customerId}`);
      }
      
      const existingCustomer = existingCustomers[0];
      
      // 更新データ準備
      const updatedCustomer = {
        ...existingCustomer,
        ...updateData,
        updatedAt: new Date()
      };
      
      // データベース更新（排他制御）
      const result = LockManager.execute(() => {
        const spreadsheet = SpreadsheetApp.openById(Database.spreadsheetId);
        const sheet = spreadsheet.getSheetByName('Customers');
        const data = sheet.getDataRange().getValues();
        
        // 該当行を検索
        let targetRow = -1;
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === customerId) {
            targetRow = i + 1;
            break;
          }
        }
        
        if (targetRow === -1) {
          throw new Error(`顧客データが見つかりません: ${customerId}`);
        }
        
        // 行更新
        const updateRow = [
          customerId,
          updatedCustomer.name,
          updatedCustomer.companyName || '',
          updatedCustomer.email,
          updatedCustomer.phone || '',
          existingCustomer.createdAt,
          updatedCustomer.updatedAt
        ];
        
        sheet.getRange(targetRow, 1, 1, updateRow.length).setValues([updateRow]);
        
        Logger.info('顧客更新完了', { customerId, name: updatedCustomer.name });
        
        return updatedCustomer;
      });
      
      // キャッシュクリア
      this.clearCustomerCaches(customerId);
      
      return result;
      
    } catch (error) {
      Logger.error('顧客更新エラー', error);
      throw error;
    }
  },
  
  /**
   * 顧客削除（論理削除）
   */
  deleteCustomer(customerId, reason = '') {
    try {
      Logger.info('顧客削除開始', { customerId, reason });
      
      // 関連データ確認
      const addresses = Database.getAddresses(customerId);
      const shipping = Database.getShipping(customerId);
      
      if (shipping.length > 0) {
        throw new Error('発送履歴のある顧客は削除できません');
      }
      
      // 論理削除実行（排他制御）
      const result = LockManager.execute(() => {
        const spreadsheet = SpreadsheetApp.openById(Database.spreadsheetId);
        
        // 顧客を削除済みマーク
        const customerSheet = spreadsheet.getSheetByName('Customers');
        const customerData = customerSheet.getDataRange().getValues();
        
        let targetRow = -1;
        for (let i = 1; i < customerData.length; i++) {
          if (customerData[i][0] === customerId) {
            targetRow = i + 1;
            break;
          }
        }
        
        if (targetRow === -1) {
          throw new Error(`顧客が見つかりません: ${customerId}`);
        }
        
        // 名前に[削除済み]マーク追加
        const currentName = customerData[targetRow - 1][1];
        const deletedName = `[削除済み] ${currentName}`;
        customerSheet.getRange(targetRow, 2).setValue(deletedName);
        customerSheet.getRange(targetRow, 7).setValue(new Date()); // 更新日
        
        // 関連宛名も削除済みマーク
        if (addresses.length > 0) {
          const addressSheet = spreadsheet.getSheetByName('Addresses');
          const addressData = addressSheet.getDataRange().getValues();
          
          for (let i = 1; i < addressData.length; i++) {
            if (addressData[i][1] === customerId) {
              const currentRecipient = addressData[i][5];
              const deletedRecipient = `[削除済み] ${currentRecipient}`;
              addressSheet.getRange(i + 1, 6).setValue(deletedRecipient);
              addressSheet.getRange(i + 1, 8).setValue(new Date()); // 更新日
            }
          }
        }
        
        // 削除ログ記録
        MonitoringSimple.logAccess(`customer_delete:${customerId}:${reason}`, Session.getActiveUser().getEmail());
        
        Logger.info('顧客削除完了', { customerId, addressCount: addresses.length });
        
        return { success: true, deletedAddresses: addresses.length };
      });
      
      // キャッシュクリア
      this.clearCustomerCaches(customerId);
      CacheManager.remove('addresses_all');
      
      return result;
      
    } catch (error) {
      Logger.error('顧客削除エラー', error);
      throw error;
    }
  },
  
  /**
   * 高度な顧客検索
   */
  advancedCustomerSearch(searchOptions) {
    try {
      const { 
        query = '', 
        companyOnly = false, 
        hasOrders = null, 
        createdAfter = null, 
        createdBefore = null,
        sortBy = 'relevance',
        limit = 100
      } = searchOptions;
      
      Logger.info('高度顧客検索開始', searchOptions);
      
      const cacheKey = `advanced_search_${JSON.stringify(searchOptions)}`;
      
      return CacheManager.getCachedData(cacheKey, () => {
        let customers = Database.getCustomers();
        
        // 削除済み顧客を除外
        customers = customers.filter(customer => 
          !customer.name.startsWith('[削除済み]')
        );
        
        // テキスト検索
        if (query) {
          const searchTerm = query.toLowerCase();
          customers = customers.filter(customer => {
            const nameMatch = customer.name.toLowerCase().includes(searchTerm);
            const companyMatch = customer.companyName && 
              customer.companyName.toLowerCase().includes(searchTerm);
            const emailMatch = customer.email.toLowerCase().includes(searchTerm);
            const phoneMatch = customer.phone && 
              customer.phone.includes(searchTerm);
            
            return nameMatch || companyMatch || emailMatch || phoneMatch;
          });
        }
        
        // 会社顧客のみ
        if (companyOnly) {
          customers = customers.filter(customer => 
            customer.companyName && customer.companyName.trim().length > 0
          );
        }
        
        // 注文履歴フィルタ
        if (hasOrders !== null) {
          customers = customers.filter(customer => {
            const shipping = Database.getShipping(customer.id);
            return hasOrders ? shipping.length > 0 : shipping.length === 0;
          });
        }
        
        // 作成日フィルタ
        if (createdAfter) {
          const afterDate = new Date(createdAfter);
          customers = customers.filter(customer => 
            new Date(customer.createdAt) >= afterDate
          );
        }
        
        if (createdBefore) {
          const beforeDate = new Date(createdBefore);
          customers = customers.filter(customer => 
            new Date(customer.createdAt) <= beforeDate
          );
        }
        
        // ソート
        if (sortBy === 'relevance' && query) {
          customers = customers.map(customer => ({
            ...customer,
            relevanceScore: this.calculateRelevanceScore(customer, query)
          })).sort((a, b) => b.relevanceScore - a.relevanceScore);
        } else {
          customers.sort((a, b) => {
            let aValue = a[sortBy] || '';
            let bValue = b[sortBy] || '';
            
            if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
              return new Date(b[sortBy]) - new Date(a[sortBy]);
            }
            
            if (typeof aValue === 'string') aValue = aValue.toLowerCase();
            if (typeof bValue === 'string') bValue = bValue.toLowerCase();
            
            return aValue > bValue ? 1 : -1;
          });
        }
        
        // 制限適用
        const limitedCustomers = customers.slice(0, limit);
        
        // 追加情報付与
        const enhancedCustomers = limitedCustomers.map(customer => {
          const addresses = Database.getAddresses(customer.id);
          const shipping = Database.getShipping(customer.id);
          
          return {
            ...customer,
            addressCount: addresses.length,
            orderCount: shipping.length,
            lastOrderDate: shipping.length > 0 ? shipping[0].shippingDate : null,
            totalSpent: shipping.reduce((sum, order) => sum + (order.fee || 0), 0)
          };
        });
        
        Logger.info('高度顧客検索完了', { 
          query, 
          totalFound: customers.length, 
          returned: limitedCustomers.length 
        });
        
        return {
          customers: enhancedCustomers,
          totalCount: customers.length,
          searchOptions: searchOptions
        };
      });
      
    } catch (error) {
      Logger.error('高度顧客検索エラー', error);
      throw error;
    }
  },
  
  /**
   * 顧客インポート（CSV対応）
   */
  importCustomers(csvData, options = {}) {
    try {
      const { skipDuplicates = true, validateOnly = false } = options;
      
      Logger.info('顧客インポート開始', { skipDuplicates, validateOnly });
      
      const lines = csvData.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      // ヘッダー検証
      const requiredHeaders = ['name', 'email'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new Error(`必須ヘッダーが不足: ${missingHeaders.join(', ')}`);
      }
      
      const results = {
        processed: 0,
        imported: 0,
        skipped: 0,
        errors: [],
        preview: []
      };
      
      // 既存顧客のメールアドレス一覧（重複チェック用）
      const existingEmails = new Set();
      if (skipDuplicates) {
        const existingCustomers = Database.getCustomers();
        existingCustomers.forEach(customer => {
          existingEmails.add(customer.email.toLowerCase());
        });
      }
      
      // データ処理
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) continue;
        
        const customerData = {};
        headers.forEach((header, index) => {
          customerData[header] = values[index];
        });
        
        results.processed++;
        
        try {
          // バリデーション
          const validation = Validator.validateCustomer(customerData);
          if (!validation.isValid) {
            results.errors.push(`行 ${i + 1}: ${validation.errors.join(', ')}`);
            continue;
          }
          
          // 重複チェック
          if (skipDuplicates && existingEmails.has(customerData.email.toLowerCase())) {
            results.skipped++;
            continue;
          }
          
          // プレビューに追加
          results.preview.push({
            line: i + 1,
            data: customerData
          });
          
          // 実際のインポート実行
          if (!validateOnly) {
            Database.saveCustomer(customerData);
            results.imported++;
          }
          
        } catch (error) {
          results.errors.push(`行 ${i + 1}: ${error.message}`);
        }
      }
      
      // キャッシュクリア
      if (!validateOnly && results.imported > 0) {
        CacheManager.remove('customers_all');
      }
      
      Logger.info('顧客インポート完了', results);
      
      return results;
      
    } catch (error) {
      Logger.error('顧客インポートエラー', error);
      throw error;
    }
  },
  
  /**
   * 顧客エクスポート（CSV）
   */
  exportCustomers(options = {}) {
    try {
      const { includeAddresses = false, includeStats = false } = options;
      
      Logger.info('顧客エクスポート開始', options);
      
      const customers = Database.getCustomers();
      
      // ヘッダー構築
      let headers = ['ID', '氏名', '会社名', 'メールアドレス', '電話番号', '作成日', '更新日'];
      
      if (includeStats) {
        headers.push('宛名数', '注文数', '最終注文日', '累計金額');
      }
      
      if (includeAddresses) {
        headers.push('宛名一覧');
      }
      
      const csvLines = [headers.join(',')];
      
      // データ行構築
      customers.forEach(customer => {
        let row = [
          customer.id,
          `"${customer.name}"`,
          `"${customer.companyName || ''}"`,
          customer.email,
          customer.phone || '',
          DateUtils.formatDateTime(customer.createdAt),
          DateUtils.formatDateTime(customer.updatedAt)
        ];
        
        if (includeStats) {
          const addresses = Database.getAddresses(customer.id);
          const shipping = Database.getShipping(customer.id);
          const totalSpent = shipping.reduce((sum, order) => sum + (order.fee || 0), 0);
          const lastOrder = shipping.length > 0 ? DateUtils.formatDate(shipping[0].shippingDate) : '';
          
          row.push(addresses.length, shipping.length, lastOrder, totalSpent);
        }
        
        if (includeAddresses) {
          const addresses = Database.getAddresses(customer.id);
          const addressList = addresses.map(addr => 
            `${addr.recipientName}(${addr.zipCode} ${addr.address})`
          ).join('; ');
          row.push(`"${addressList}"`);
        }
        
        csvLines.push(row.join(','));
      });
      
      const csvContent = csvLines.join('\n');
      
      Logger.info('顧客エクスポート完了', { count: customers.length });
      
      return {
        content: csvContent,
        filename: `customers_export_${DateUtils.formatDate(new Date()).replace(/-/g, '')}.csv`,
        count: customers.length
      };
      
    } catch (error) {
      Logger.error('顧客エクスポートエラー', error);
      throw error;
    }
  },
  
  /**
   * 顧客統計情報計算
   */
  calculateCustomerStats(customer, addresses, shipping) {
    const totalSpent = shipping.reduce((sum, order) => sum + (order.fee || 0), 0);
    const orderCount = shipping.length;
    const addressCount = addresses.length;
    
    // 月別注文統計
    const monthlyOrders = {};
    shipping.forEach(order => {
      const monthKey = DateUtils.formatDate(order.shippingDate, 'yyyy-MM');
      monthlyOrders[monthKey] = (monthlyOrders[monthKey] || 0) + 1;
    });
    
    // 発送方法統計
    const methodStats = {};
    shipping.forEach(order => {
      methodStats[order.shippingMethod] = (methodStats[order.shippingMethod] || 0) + 1;
    });
    
    return {
      totalSpent: totalSpent,
      orderCount: orderCount,
      addressCount: addressCount,
      averageOrderValue: orderCount > 0 ? Math.round(totalSpent / orderCount) : 0,
      firstOrderDate: shipping.length > 0 ? shipping[shipping.length - 1].shippingDate : null,
      lastOrderDate: shipping.length > 0 ? shipping[0].shippingDate : null,
      monthlyOrders: monthlyOrders,
      methodStats: methodStats,
      customerSince: DateUtils.formatDate(customer.createdAt),
      daysSinceFirstOrder: shipping.length > 0 ? 
        Math.floor((new Date() - new Date(shipping[shipping.length - 1].shippingDate)) / (1000 * 60 * 60 * 24)) : null
    };
  },
  
  /**
   * 関連性スコア計算（検索用）
   */
  calculateRelevanceScore(customer, query) {
    const queryLower = query.toLowerCase();
    let score = 0;
    
    // 名前マッチ
    if (customer.name.toLowerCase().includes(queryLower)) {
      score += customer.name.toLowerCase().startsWith(queryLower) ? 100 : 80;
    }
    
    // 会社名マッチ
    if (customer.companyName && customer.companyName.toLowerCase().includes(queryLower)) {
      score += customer.companyName.toLowerCase().startsWith(queryLower) ? 90 : 70;
    }
    
    // メールマッチ
    if (customer.email.toLowerCase().includes(queryLower)) {
      score += customer.email.toLowerCase().startsWith(queryLower) ? 60 : 40;
    }
    
    // 電話番号マッチ
    if (customer.phone && customer.phone.includes(query)) {
      score += 50;
    }
    
    return score;
  },
  
  /**
   * 最終注文日取得
   */
  getLastOrderDate(customerId) {
    try {
      const shipping = Database.getShipping(customerId);
      return shipping.length > 0 ? shipping[0].shippingDate : null;
    } catch (error) {
      return null;
    }
  },
  
  /**
   * 顧客関連キャッシュクリア
   */
  clearCustomerCaches(customerId = null) {
    if (customerId) {
      CacheManager.remove(`customer_${customerId}`);
      CacheManager.remove(`customer_detail_${customerId}`);
    }
    
    CacheManager.remove('customers_all');
    CacheManager.remove('customers_with_addresses');
    
    // リスト系キャッシュも全クリア（簡易実装）
    const listCachePattern = /^customer_list_/;
    const searchCachePattern = /^advanced_search_/;
    
    // 小規模運用なのでキャッシュ全クリアで対応
    CacheManager.removeAll();
  }
};