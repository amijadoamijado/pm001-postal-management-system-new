/**
 * PM001 宛名選択モジュール
 * TaskMaster Task 2.3 - 4パターン宛名選択機能実装
 * パターン1: 顧客データベースから選択
 * パターン2: ログインユーザーの過去履歴から選択
 * パターン3: 全員の過去履歴から選択（使用頻度順）
 * パターン4: 新規宛名登録
 */

const AddressSelector = {
  
  /**
   * 統合宛名選択データ取得
   * @param {string} userId - ログインユーザーID
   * @param {string} selectionType - 選択タイプ
   * @param {Object} options - 追加オプション
   */
  getSelectionData(userId, selectionType, options = {}) {
    try {
      Logger.info('宛名選択データ取得開始', { userId, selectionType, options });
      
      const cacheKey = `address_selection_${selectionType}_${userId}_${JSON.stringify(options)}`;
      
      return CacheManager.getCachedData(cacheKey, () => {
        let result = {};
        
        switch (selectionType) {
          case 'customer_db':
            result = this.getCustomerDatabaseSelection(options);
            break;
            
          case 'user_history':
            result = this.getUserHistorySelection(userId, options);
            break;
            
          case 'all_history':
            result = this.getAllHistorySelection(options);
            break;
            
          case 'new_address':
            result = this.getNewAddressFormData(options);
            break;
            
          default:
            throw new Error(`無効な選択タイプ: ${selectionType}`);
        }
        
        // 共通メタデータ追加
        result.metadata = {
          selectionType: selectionType,
          userId: userId,
          timestamp: new Date(),
          totalCount: this.getTotalCount(result),
          cacheKey: cacheKey
        };
        
        Logger.info('宛名選択データ取得完了', { 
          selectionType, 
          count: result.metadata.totalCount 
        });
        
        return result;
      });
      
    } catch (error) {
      Logger.error('宛名選択データ取得エラー', error);
      throw error;
    }
  },
  
  /**
   * パターン1: 顧客データベースから選択
   */
  getCustomerDatabaseSelection(options = {}) {
    try {
      const { 
        searchQuery = '', 
        sortBy = 'name', 
        limit = 50,
        includeAddressCount = true,
        companyFilter = null 
      } = options;
      
      Logger.info('顧客DB選択データ取得', { searchQuery, sortBy, limit });
      
      // 顧客・宛名データ取得
      let customersWithAddresses = Database.getCustomersWithAddresses();
      
      // 削除済み除外
      customersWithAddresses = customersWithAddresses.filter(customer => 
        !customer.name.startsWith('[削除済み]')
      );
      
      // 検索フィルタ
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        customersWithAddresses = customersWithAddresses.filter(customer => 
          customer.name.toLowerCase().includes(query) ||
          (customer.companyName && customer.companyName.toLowerCase().includes(query)) ||
          customer.email.toLowerCase().includes(query)
        );
      }
      
      // 会社フィルタ
      if (companyFilter === 'company_only') {
        customersWithAddresses = customersWithAddresses.filter(customer => 
          customer.companyName && customer.companyName.trim().length > 0
        );
      } else if (companyFilter === 'individual_only') {
        customersWithAddresses = customersWithAddresses.filter(customer => 
          !customer.companyName || customer.companyName.trim().length === 0
        );
      }
      
      // 宛名ありのみ
      customersWithAddresses = customersWithAddresses.filter(customer => 
        customer.addresses && customer.addresses.length > 0
      );
      
      // 削除済み宛名除外
      customersWithAddresses.forEach(customer => {
        customer.addresses = customer.addresses.filter(address => 
          !address.recipientName.startsWith('[削除済み]')
        );
      });
      
      // 宛名数でソート（デフォルト）
      if (sortBy === 'addressCount') {
        customersWithAddresses.sort((a, b) => b.addresses.length - a.addresses.length);
      } else if (sortBy === 'name') {
        customersWithAddresses.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      } else if (sortBy === 'companyName') {
        customersWithAddresses.sort((a, b) => {
          const aCompany = a.companyName || 'zzz';
          const bCompany = b.companyName || 'zzz';
          return aCompany.localeCompare(bCompany, 'ja');
        });
      }
      
      // 制限適用
      const limitedCustomers = customersWithAddresses.slice(0, limit);
      
      // 統計情報計算
      if (includeAddressCount) {
        limitedCustomers.forEach(customer => {
          customer.totalAddresses = customer.addresses.length;
          customer.displayText = `${customer.name} ${customer.companyName ? '(' + customer.companyName + ')' : ''} - ${customer.totalAddresses}件の宛名`;
        });
      }
      
      return {
        type: 'customer_database',
        customers: limitedCustomers,
        searchQuery: searchQuery,
        totalFound: customersWithAddresses.length,
        displayCount: limitedCustomers.length,
        suggestedFilters: this.generateCustomerFilters(customersWithAddresses)
      };
      
    } catch (error) {
      Logger.error('顧客DB選択データ取得エラー', error);
      throw error;
    }
  },
  
  /**
   * パターン2: ログインユーザーの過去履歴から選択
   */
  getUserHistorySelection(userId, options = {}) {
    try {
      const { 
        limit = 30, 
        sortBy = 'lastUsed', 
        includeUsageStats = true,
        minUsageCount = 1 
      } = options;
      
      Logger.info('ユーザー履歴選択データ取得', { userId, limit, sortBy });
      
      // ユーザー履歴取得
      let userHistory = Database.getUserHistory(userId);
      
      // 使用回数フィルタ
      if (minUsageCount > 1) {
        userHistory = userHistory.filter(history => 
          (history.usageCount || 0) >= minUsageCount
        );
      }
      
      // ソート
      if (sortBy === 'usageCount') {
        userHistory.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      } else if (sortBy === 'lastUsed') {
        userHistory.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
      }
      
      // 制限適用
      const limitedHistory = userHistory.slice(0, limit);
      
      // 表示用データ拡張
      const enhancedHistory = limitedHistory.map(history => {
        const displayText = this.buildAddressDisplayText(
          history.addressInfo, 
          history.customerInfo, 
          history.usageCount
        );
        
        return {
          ...history,
          displayText: displayText,
          category: 'user_history',
          priority: this.calculateUserPriority(history),
          lastUsedDisplay: DateUtils.formatDate(history.lastUsed),
          frequencyLevel: this.getFrequencyLevel(history.usageCount)
        };
      });
      
      // カテゴリ別グループ化
      const categories = this.categorizeByFrequency(enhancedHistory);
      
      return {
        type: 'user_history',
        userHistory: enhancedHistory,
        categories: categories,
        userId: userId,
        totalFound: userHistory.length,
        displayCount: limitedHistory.length,
        stats: this.calculateUserHistoryStats(userHistory)
      };
      
    } catch (error) {
      Logger.error('ユーザー履歴選択データ取得エラー', error);
      throw error;
    }
  },
  
  /**
   * パターン3: 全員の過去履歴から選択（使用頻度順）
   */
  getAllHistorySelection(options = {}) {
    try {
      const { 
        limit = 50, 
        sortBy = 'totalUsage', 
        minTotalUsage = 2,
        includeUserBreakdown = false,
        excludeCurrentUser = false,
        currentUserId = null 
      } = options;
      
      Logger.info('全履歴選択データ取得', { limit, sortBy, minTotalUsage });
      
      // 全使用履歴取得
      let allUsageHistory = Database.getAllUsageHistory();
      
      // 最小使用回数フィルタ
      allUsageHistory = allUsageHistory.filter(usage => 
        (usage.totalUsage || 0) >= minTotalUsage
      );
      
      // 現在ユーザー除外オプション
      if (excludeCurrentUser && currentUserId) {
        allUsageHistory = allUsageHistory.filter(usage => 
          usage.createdBy !== currentUserId
        );
      }
      
      // ソート
      if (sortBy === 'totalUsage') {
        allUsageHistory.sort((a, b) => (b.totalUsage || 0) - (a.totalUsage || 0));
      } else if (sortBy === 'lastUsed') {
        allUsageHistory.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
      }
      
      // 制限適用
      const limitedHistory = allUsageHistory.slice(0, limit);
      
      // 表示用データ拡張
      const enhancedHistory = limitedHistory.map(usage => {
        const displayText = this.buildAddressDisplayText(
          usage.addressInfo, 
          usage.customerInfo, 
          usage.totalUsage,
          true // 全履歴モード
        );
        
        // ユーザー別内訳取得
        let userBreakdown = null;
        if (includeUserBreakdown) {
          userBreakdown = this.getUserBreakdownForAddress(usage.addressId);
        }
        
        return {
          ...usage,
          displayText: displayText,
          category: 'popular_address',
          popularityScore: this.calculatePopularityScore(usage),
          lastUsedDisplay: DateUtils.formatDate(usage.lastUsed),
          popularityLevel: this.getPopularityLevel(usage.totalUsage),
          userBreakdown: userBreakdown
        };
      });
      
      // 人気度別グループ化
      const categories = this.categorizeByPopularity(enhancedHistory);
      
      return {
        type: 'all_history',
        popularAddresses: enhancedHistory,
        categories: categories,
        totalFound: allUsageHistory.length,
        displayCount: limitedHistory.length,
        stats: this.calculateAllHistoryStats(allUsageHistory)
      };
      
    } catch (error) {
      Logger.error('全履歴選択データ取得エラー', error);
      throw error;
    }
  },
  
  /**
   * パターン4: 新規宛名登録フォームデータ
   */
  getNewAddressFormData(options = {}) {
    try {
      const { 
        includeCustomerList = true, 
        includeAddressTemplates = true,
        includeZipCodeHelp = true 
      } = options;
      
      Logger.info('新規宛名フォームデータ取得', options);
      
      const result = {
        type: 'new_address',
        formReady: true
      };
      
      // 顧客一覧（選択用）
      if (includeCustomerList) {
        const customers = Database.getCustomers()
          .filter(customer => !customer.name.startsWith('[削除済み]'))
          .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
          .map(customer => ({
            id: customer.id,
            name: customer.name,
            companyName: customer.companyName,
            displayText: `${customer.name} ${customer.companyName ? '(' + customer.companyName + ')' : ''}`
          }));
        
        result.availableCustomers = customers;
      }
      
      // 住所テンプレート（よく使われる住所パターン）
      if (includeAddressTemplates) {
        result.addressTemplates = this.getAddressTemplates();
      }
      
      // 郵便番号ヘルプ
      if (includeZipCodeHelp) {
        result.zipCodeHelp = {
          format: '123-4567',
          example: '100-0001',
          helpText: '郵便番号を入力すると住所候補が表示されます'
        };
      }
      
      // フォームバリデーション設定
      result.validation = {
        required: ['customerId', 'recipientName', 'zipCode', 'address'],
        patterns: {
          zipCode: '^\\d{3}-\\d{4}$'
        },
        maxLength: {
          recipientName: 50,
          address: 200,
          buildingName: 100
        }
      };
      
      // 新規作成統計
      result.stats = {
        totalCustomers: result.availableCustomers ? result.availableCustomers.length : 0,
        recentAddresses: this.getRecentNewAddresses(),
        suggestedNextSteps: [
          '顧客を選択してください',
          '宛名（受取人名）を入力してください', 
          '郵便番号を入力して住所候補を確認してください'
        ]
      };
      
      return result;
      
    } catch (error) {
      Logger.error('新規宛名フォームデータ取得エラー', error);
      throw error;
    }
  },
  
  /**
   * 宛名表示テキスト構築
   */
  buildAddressDisplayText(addressInfo, customerInfo, usageCount = 0, showPopularity = false) {
    if (!addressInfo) return '不明な宛名';
    
    let displayText = `${addressInfo.recipientName}`;
    
    // 顧客情報追加
    if (customerInfo) {
      if (customerInfo.companyName) {
        displayText += ` (${customerInfo.companyName})`;
      } else {
        displayText += ` (${customerInfo.name})`;
      }
    }
    
    // 住所情報追加
    displayText += ` - ${addressInfo.zipCode} ${addressInfo.address}`;
    if (addressInfo.buildingName) {
      displayText += ` ${addressInfo.buildingName}`;
    }
    
    // 使用頻度情報追加
    if (usageCount > 0) {
      if (showPopularity) {
        displayText += ` [人気度: ${usageCount}回]`;
      } else {
        displayText += ` [使用: ${usageCount}回]`;
      }
    }
    
    return displayText;
  },
  
  /**
   * ユーザー優先度計算
   */
  calculateUserPriority(history) {
    const usageCount = history.usageCount || 0;
    const daysSinceLastUsed = Math.floor(
      (new Date() - new Date(history.lastUsed)) / (1000 * 60 * 60 * 24)
    );
    
    // 使用回数と最近度のスコア
    let score = usageCount * 10;
    if (daysSinceLastUsed <= 7) score += 50;
    else if (daysSinceLastUsed <= 30) score += 30;
    else if (daysSinceLastUsed <= 90) score += 10;
    
    return score;
  },
  
  /**
   * 人気度スコア計算
   */
  calculatePopularityScore(usage) {
    const totalUsage = usage.totalUsage || 0;
    const daysSinceLastUsed = Math.floor(
      (new Date() - new Date(usage.lastUsed)) / (1000 * 60 * 60 * 24)
    );
    
    // 総使用回数と最近度のスコア
    let score = totalUsage * 5;
    if (daysSinceLastUsed <= 30) score += 20;
    else if (daysSinceLastUsed <= 90) score += 10;
    
    return score;
  },
  
  /**
   * 頻度レベル取得
   */
  getFrequencyLevel(usageCount) {
    if (usageCount >= 10) return 'very_high';
    if (usageCount >= 5) return 'high';
    if (usageCount >= 2) return 'medium';
    return 'low';
  },
  
  /**
   * 人気度レベル取得
   */
  getPopularityLevel(totalUsage) {
    if (totalUsage >= 20) return 'very_popular';
    if (totalUsage >= 10) return 'popular';
    if (totalUsage >= 5) return 'somewhat_popular';
    return 'rarely_used';
  },
  
  /**
   * 頻度別カテゴリ化
   */
  categorizeByFrequency(historyItems) {
    return {
      veryHigh: historyItems.filter(item => item.frequencyLevel === 'very_high'),
      high: historyItems.filter(item => item.frequencyLevel === 'high'),
      medium: historyItems.filter(item => item.frequencyLevel === 'medium'),
      low: historyItems.filter(item => item.frequencyLevel === 'low')
    };
  },
  
  /**
   * 人気度別カテゴリ化
   */
  categorizeByPopularity(historyItems) {
    return {
      veryPopular: historyItems.filter(item => item.popularityLevel === 'very_popular'),
      popular: historyItems.filter(item => item.popularityLevel === 'popular'),
      somewhatPopular: historyItems.filter(item => item.popularityLevel === 'somewhat_popular'),
      rarelyUsed: historyItems.filter(item => item.popularityLevel === 'rarely_used')
    };
  },
  
  /**
   * 顧客フィルタ生成
   */
  generateCustomerFilters(customers) {
    const companyCount = customers.filter(c => c.companyName && c.companyName.trim().length > 0).length;
    const individualCount = customers.length - companyCount;
    
    return {
      all: { label: '全て', count: customers.length },
      company: { label: '法人顧客', count: companyCount },
      individual: { label: '個人顧客', count: individualCount }
    };
  },
  
  /**
   * ユーザー履歴統計計算
   */
  calculateUserHistoryStats(userHistory) {
    if (userHistory.length === 0) {
      return {
        totalAddresses: 0,
        totalUsage: 0,
        averageUsage: 0,
        mostUsedAddress: null,
        lastActivity: null
      };
    }
    
    const totalUsage = userHistory.reduce((sum, history) => sum + (history.usageCount || 0), 0);
    const mostUsed = userHistory.reduce((max, history) => 
      (history.usageCount || 0) > (max.usageCount || 0) ? history : max
    );
    
    return {
      totalAddresses: userHistory.length,
      totalUsage: totalUsage,
      averageUsage: Math.round(totalUsage / userHistory.length),
      mostUsedAddress: mostUsed.addressInfo ? mostUsed.addressInfo.recipientName : null,
      lastActivity: userHistory[0] ? userHistory[0].lastUsed : null
    };
  },
  
  /**
   * 全履歴統計計算
   */
  calculateAllHistoryStats(allHistory) {
    if (allHistory.length === 0) {
      return {
        totalAddresses: 0,
        totalUsage: 0,
        averageUsage: 0,
        mostPopularAddress: null,
        uniqueUsers: 0
      };
    }
    
    const totalUsage = allHistory.reduce((sum, usage) => sum + (usage.totalUsage || 0), 0);
    const mostPopular = allHistory.reduce((max, usage) => 
      (usage.totalUsage || 0) > (max.totalUsage || 0) ? usage : max
    );
    
    return {
      totalAddresses: allHistory.length,
      totalUsage: totalUsage,
      averageUsage: Math.round(totalUsage / allHistory.length),
      mostPopularAddress: mostPopular.addressInfo ? mostPopular.addressInfo.recipientName : null,
      uniqueUsers: new Set(allHistory.map(usage => usage.createdBy)).size
    };
  },
  
  /**
   * 宛名別ユーザー内訳取得
   */
  getUserBreakdownForAddress(addressId) {
    try {
      const allShipping = Database.getShipping();
      const addressShipping = allShipping.filter(shipping => shipping.addressId === addressId);
      
      const userStats = {};
      addressShipping.forEach(shipping => {
        const userId = shipping.userId || 'unknown';
        if (!userStats[userId]) {
          userStats[userId] = { count: 0, lastUsed: null };
        }
        userStats[userId].count++;
        
        if (!userStats[userId].lastUsed || 
            new Date(shipping.shippingDate) > new Date(userStats[userId].lastUsed)) {
          userStats[userId].lastUsed = shipping.shippingDate;
        }
      });
      
      return Object.entries(userStats)
        .map(([userId, stats]) => ({ userId, ...stats }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // 上位5ユーザー
      
    } catch (error) {
      Logger.error('ユーザー内訳取得エラー', error);
      return [];
    }
  },
  
  /**
   * 住所テンプレート取得
   */
  getAddressTemplates() {
    return [
      {
        name: '東京都内オフィス',
        zipCode: '100-0001',
        address: '東京都千代田区千代田',
        buildingName: ''
      },
      {
        name: '大阪府内オフィス', 
        zipCode: '530-0001',
        address: '大阪府大阪市北区梅田',
        buildingName: ''
      },
      {
        name: '住宅地（例）',
        zipCode: '150-0001',
        address: '東京都渋谷区神宮前',
        buildingName: ''
      }
    ];
  },
  
  /**
   * 最近の新規宛名取得
   */
  getRecentNewAddresses() {
    try {
      const allAddresses = Database.getAddresses();
      return allAddresses
        .filter(address => !address.recipientName.startsWith('[削除済み]'))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(address => ({
          recipientName: address.recipientName,
          createdAt: DateUtils.formatDate(address.createdAt)
        }));
    } catch (error) {
      Logger.error('最近の新規宛名取得エラー', error);
      return [];
    }
  },
  
  /**
   * 総件数取得
   */
  getTotalCount(result) {
    if (result.customers) return result.customers.length;
    if (result.userHistory) return result.userHistory.length;
    if (result.popularAddresses) return result.popularAddresses.length;
    if (result.formReady) return result.availableCustomers ? result.availableCustomers.length : 0;
    return 0;
  },
  
  /**
   * 選択候補統合検索
   */
  searchAcrossAllPatterns(userId, searchQuery, options = {}) {
    try {
      const { limit = 20 } = options;
      
      Logger.info('統合選択検索', { userId, searchQuery, limit });
      
      const results = [];
      
      // パターン1: 顧客DB検索
      const customerResults = this.getCustomerDatabaseSelection({ 
        searchQuery, 
        limit: Math.ceil(limit / 4) 
      });
      customerResults.customers.forEach(customer => {
        customer.addresses.forEach(address => {
          results.push({
            source: 'customer_db',
            priority: 1,
            data: address,
            customer: customer,
            displayText: this.buildAddressDisplayText(address, customer)
          });
        });
      });
      
      // パターン2: ユーザー履歴検索
      const userHistoryResults = this.getUserHistorySelection(userId, { 
        limit: Math.ceil(limit / 4) 
      });
      userHistoryResults.userHistory.forEach(history => {
        if (history.addressInfo && 
            history.addressInfo.recipientName.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push({
            source: 'user_history',
            priority: 3,
            data: history.addressInfo,
            customer: history.customerInfo,
            usageCount: history.usageCount,
            displayText: history.displayText
          });
        }
      });
      
      // パターン3: 全履歴検索
      const allHistoryResults = this.getAllHistorySelection({ 
        limit: Math.ceil(limit / 4) 
      });
      allHistoryResults.popularAddresses.forEach(popular => {
        if (popular.addressInfo && 
            popular.addressInfo.recipientName.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push({
            source: 'all_history',
            priority: 2,
            data: popular.addressInfo,
            customer: popular.customerInfo,
            totalUsage: popular.totalUsage,
            displayText: popular.displayText
          });
        }
      });
      
      // 重複除去とソート
      const uniqueResults = this.deduplicateResults(results);
      uniqueResults.sort((a, b) => {
        // 優先度順、その後使用回数順
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (b.usageCount || b.totalUsage || 0) - (a.usageCount || a.totalUsage || 0);
      });
      
      return {
        type: 'integrated_search',
        searchQuery: searchQuery,
        results: uniqueResults.slice(0, limit),
        totalFound: uniqueResults.length,
        sources: {
          customer_db: results.filter(r => r.source === 'customer_db').length,
          user_history: results.filter(r => r.source === 'user_history').length,
          all_history: results.filter(r => r.source === 'all_history').length
        }
      };
      
    } catch (error) {
      Logger.error('統合選択検索エラー', error);
      throw error;
    }
  },
  
  /**
   * 結果重複除去
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = `${result.data.id || result.data.recipientName}_${result.data.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
  
  /**
   * 選択キャッシュクリア
   */
  clearSelectionCaches(userId = null) {
    if (userId) {
      // ユーザー固有キャッシュ
      const userCachePattern = new RegExp(`address_selection_.*_${userId}_`);
      // 簡易実装：全キャッシュクリア
      CacheManager.removeAll();
    } else {
      // 全選択キャッシュクリア
      CacheManager.removeAll();
    }
  }
};