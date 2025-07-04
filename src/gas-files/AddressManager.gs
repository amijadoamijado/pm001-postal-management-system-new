/**
 * PM001 宛名管理モジュール
 * TaskMaster Task 2.2 - 宛名管理機能実装
 * 登録、編集、削除、顧客関連付け、住所検索、使用履歴管理
 */

const AddressManager = {
  
  /**
   * 宛名一覧取得（顧客別・全体）
   * @param {Object} options - 取得オプション
   */
  getAddressList(options = {}) {
    try {
      const { 
        customerId = null, 
        page = 1, 
        limit = 50, 
        sortBy = 'recipientName', 
        sortOrder = 'asc', 
        filter = null,
        includeUsageStats = false 
      } = options;
      
      Logger.info('宛名一覧取得開始', { customerId, page, limit, sortBy });
      
      // キャッシュキー生成
      const cacheKey = `address_list_${customerId || 'all'}_${page}_${limit}_${sortBy}_${sortOrder}_${filter || 'none'}_${includeUsageStats}`;
      
      return CacheManager.getCachedData(cacheKey, () => {
        let addresses = Database.getAddresses(customerId);
        
        // 削除済み宛名を除外
        addresses = addresses.filter(address => 
          !address.recipientName.startsWith('[削除済み]')
        );
        
        // フィルタリング
        if (filter) {
          const filterLower = filter.toLowerCase();
          addresses = addresses.filter(address => 
            address.recipientName.toLowerCase().includes(filterLower) ||
            address.address.toLowerCase().includes(filterLower) ||
            address.zipCode.includes(filter) ||
            (address.buildingName && address.buildingName.toLowerCase().includes(filterLower))
          );
        }
        
        // 顧客情報を追加
        const customers = Database.getCustomers();
        addresses = addresses.map(address => {
          const customer = customers.find(c => c.id === address.customerId);
          return {
            ...address,
            customerInfo: customer ? {
              name: customer.name,
              companyName: customer.companyName,
              email: customer.email
            } : null
          };
        });
        
        // 使用統計情報を追加
        if (includeUsageStats) {
          addresses = addresses.map(address => {
            const usageStats = this.getAddressUsageStats(address.id);
            return {
              ...address,
              usageStats: usageStats
            };
          });
        }
        
        // ソート
        addresses.sort((a, b) => {
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
        const paginatedAddresses = addresses.slice(startIndex, endIndex);
        
        const result = {
          addresses: paginatedAddresses,
          pagination: {
            current: page,
            total: Math.ceil(addresses.length / limit),
            count: addresses.length,
            limit: limit
          },
          customerId: customerId
        };
        
        Logger.info('宛名一覧取得完了', { 
          total: addresses.length, 
          returned: paginatedAddresses.length 
        });
        
        return result;
      });
      
    } catch (error) {
      Logger.error('宛名一覧取得エラー', error);
      throw error;
    }
  },
  
  /**
   * 宛名詳細取得（使用履歴含む）
   */
  getAddressDetail(addressId) {
    try {
      Logger.info('宛名詳細取得開始', { addressId });
      
      const cacheKey = `address_detail_${addressId}`;
      
      return CacheManager.getCachedData(cacheKey, () => {
        const addresses = Database.getAddresses();
        const address = addresses.find(addr => addr.id === addressId);
        
        if (!address) {
          throw new Error(`宛名が見つかりません: ${addressId}`);
        }
        
        // 顧客情報取得
        const customers = Database.getCustomers(address.customerId);
        const customer = customers.length > 0 ? customers[0] : null;
        
        // 発送履歴取得（この宛名を使用した履歴）
        const allShipping = Database.getShipping();
        const shippingHistory = allShipping.filter(shipping => shipping.addressId === addressId);
        
        // 使用統計計算
        const usageStats = this.getAddressUsageStats(addressId);
        
        // ユーザー別使用履歴
        const userHistory = this.getUserHistoryForAddress(addressId);
        
        const result = {
          address: address,
          customer: customer,
          shippingHistory: shippingHistory.slice(0, 20), // 最新20件
          usageStats: usageStats,
          userHistory: userHistory,
          relatedAddresses: this.getRelatedAddresses(address)
        };
        
        Logger.info('宛名詳細取得完了', { 
          addressId, 
          shippingCount: shippingHistory.length 
        });
        
        return result;
      });
      
    } catch (error) {
      Logger.error('宛名詳細取得エラー', error);
      throw error;
    }
  },
  
  /**
   * 宛名情報更新
   */
  updateAddress(addressId, updateData) {
    try {
      Logger.info('宛名更新開始', { addressId, updateData });
      
      // バリデーション
      const validation = Validator.validateAddress(updateData);
      if (!validation.isValid) {
        throw new Error(`入力エラー: ${validation.errors.join(', ')}`);
      }
      
      // 既存宛名確認
      const addresses = Database.getAddresses();
      const existingAddress = addresses.find(addr => addr.id === addressId);
      
      if (!existingAddress) {
        throw new Error(`宛名が見つかりません: ${addressId}`);
      }
      
      // 更新データ準備
      const updatedAddress = {
        ...existingAddress,
        ...updateData,
        updatedAt: new Date()
      };
      
      // データベース更新（排他制御）
      const result = LockManager.execute(() => {
        const spreadsheet = SpreadsheetApp.openById(Database.spreadsheetId);
        const sheet = spreadsheet.getSheetByName('Addresses');
        const data = sheet.getDataRange().getValues();
        
        // 該当行を検索
        let targetRow = -1;
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === addressId) {
            targetRow = i + 1;
            break;
          }
        }
        
        if (targetRow === -1) {
          throw new Error(`宛名データが見つかりません: ${addressId}`);
        }
        
        // 行更新
        const updateRow = [
          addressId,
          updatedAddress.customerId,
          updatedAddress.zipCode,
          updatedAddress.address,
          updatedAddress.buildingName || '',
          updatedAddress.recipientName,
          existingAddress.createdAt,
          updatedAddress.updatedAt
        ];
        
        sheet.getRange(targetRow, 1, 1, updateRow.length).setValues([updateRow]);
        
        Logger.info('宛名更新完了', { addressId, recipientName: updatedAddress.recipientName });
        
        return updatedAddress;
      });
      
      // キャッシュクリア
      this.clearAddressCaches(addressId, result.customerId);
      
      return result;
      
    } catch (error) {
      Logger.error('宛名更新エラー', error);
      throw error;
    }
  },
  
  /**
   * 宛名削除（論理削除）
   */
  deleteAddress(addressId, reason = '') {
    try {
      Logger.info('宛名削除開始', { addressId, reason });
      
      // 既存宛名確認
      const addresses = Database.getAddresses();
      const existingAddress = addresses.find(addr => addr.id === addressId);
      
      if (!existingAddress) {
        throw new Error(`宛名が見つかりません: ${addressId}`);
      }
      
      // 発送履歴確認
      const allShipping = Database.getShipping();
      const relatedShipping = allShipping.filter(shipping => shipping.addressId === addressId);
      
      if (relatedShipping.length > 0) {
        throw new Error('発送履歴のある宛名は削除できません');
      }
      
      // 論理削除実行（排他制御）
      const result = LockManager.execute(() => {
        const spreadsheet = SpreadsheetApp.openById(Database.spreadsheetId);
        const sheet = spreadsheet.getSheetByName('Addresses');
        const data = sheet.getDataRange().getValues();
        
        let targetRow = -1;
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === addressId) {
            targetRow = i + 1;
            break;
          }
        }
        
        if (targetRow === -1) {
          throw new Error(`宛名データが見つかりません: ${addressId}`);
        }
        
        // 宛名に[削除済み]マーク追加
        const currentRecipient = data[targetRow - 1][5];
        const deletedRecipient = `[削除済み] ${currentRecipient}`;
        sheet.getRange(targetRow, 6).setValue(deletedRecipient);
        sheet.getRange(targetRow, 8).setValue(new Date()); // 更新日
        
        // 削除ログ記録
        MonitoringSimple.logAccess(`address_delete:${addressId}:${reason}`, Session.getActiveUser().getEmail());
        
        Logger.info('宛名削除完了', { addressId });
        
        return { success: true };
      });
      
      // キャッシュクリア
      this.clearAddressCaches(addressId, existingAddress.customerId);
      
      return result;
      
    } catch (error) {
      Logger.error('宛名削除エラー', error);
      throw error;
    }
  },
  
  /**
   * 宛名複製
   */
  duplicateAddress(addressId, modifications = {}) {
    try {
      Logger.info('宛名複製開始', { addressId, modifications });
      
      // 元宛名取得
      const addresses = Database.getAddresses();
      const originalAddress = addresses.find(addr => addr.id === addressId);
      
      if (!originalAddress) {
        throw new Error(`複製元の宛名が見つかりません: ${addressId}`);
      }
      
      // 複製データ作成
      const duplicateData = {
        customerId: originalAddress.customerId,
        zipCode: originalAddress.zipCode,
        address: originalAddress.address,
        buildingName: originalAddress.buildingName,
        recipientName: `${originalAddress.recipientName} (複製)`,
        ...modifications // 修正データで上書き
      };
      
      // バリデーション
      const validation = Validator.validateAddress(duplicateData);
      if (!validation.isValid) {
        throw new Error(`複製データエラー: ${validation.errors.join(', ')}`);
      }
      
      // 新規宛名として保存
      const newAddress = Database.saveAddress(duplicateData);
      
      Logger.info('宛名複製完了', { 
        originalId: addressId, 
        newId: newAddress.id 
      });
      
      return newAddress;
      
    } catch (error) {
      Logger.error('宛名複製エラー', error);
      throw error;
    }
  },
  
  /**
   * 高度な宛名検索
   */
  advancedAddressSearch(searchOptions) {
    try {
      const {
        query = '',
        customerId = null,
        zipCodePrefix = '',
        hasUsageHistory = null,
        createdAfter = null,
        createdBefore = null,
        sortBy = 'relevance',
        limit = 100,
        includeCustomerInfo = true
      } = searchOptions;
      
      Logger.info('高度宛名検索開始', searchOptions);
      
      const cacheKey = `advanced_address_search_${JSON.stringify(searchOptions)}`;
      
      return CacheManager.getCachedData(cacheKey, () => {
        let addresses = Database.getAddresses(customerId);
        
        // 削除済み宛名を除外
        addresses = addresses.filter(address => 
          !address.recipientName.startsWith('[削除済み]')
        );
        
        // テキスト検索
        if (query) {
          const searchTerm = query.toLowerCase();
          addresses = addresses.filter(address => {
            const recipientMatch = address.recipientName.toLowerCase().includes(searchTerm);
            const addressMatch = address.address.toLowerCase().includes(searchTerm);
            const buildingMatch = address.buildingName && 
              address.buildingName.toLowerCase().includes(searchTerm);
            const zipMatch = address.zipCode.includes(searchTerm);
            
            return recipientMatch || addressMatch || buildingMatch || zipMatch;
          });
        }
        
        // 郵便番号前方一致
        if (zipCodePrefix) {
          addresses = addresses.filter(address => 
            address.zipCode.startsWith(zipCodePrefix)
          );
        }
        
        // 使用履歴フィルタ
        if (hasUsageHistory !== null) {
          const allShipping = Database.getShipping();
          addresses = addresses.filter(address => {
            const hasHistory = allShipping.some(shipping => shipping.addressId === address.id);
            return hasUsageHistory ? hasHistory : !hasHistory;
          });
        }
        
        // 作成日フィルタ
        if (createdAfter) {
          const afterDate = new Date(createdAfter);
          addresses = addresses.filter(address => 
            new Date(address.createdAt) >= afterDate
          );
        }
        
        if (createdBefore) {
          const beforeDate = new Date(createdBefore);
          addresses = addresses.filter(address => 
            new Date(address.createdAt) <= beforeDate
          );
        }
        
        // 顧客情報追加
        if (includeCustomerInfo) {
          const customers = Database.getCustomers();
          addresses = addresses.map(address => {
            const customer = customers.find(c => c.id === address.customerId);
            return {
              ...address,
              customerInfo: customer ? {
                name: customer.name,
                companyName: customer.companyName
              } : null
            };
          });
        }
        
        // ソート
        if (sortBy === 'relevance' && query) {
          addresses = addresses.map(address => ({
            ...address,
            relevanceScore: this.calculateAddressRelevanceScore(address, query)
          })).sort((a, b) => b.relevanceScore - a.relevanceScore);
        } else {
          addresses.sort((a, b) => {
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
        const limitedAddresses = addresses.slice(0, limit);
        
        Logger.info('高度宛名検索完了', { 
          query, 
          totalFound: addresses.length, 
          returned: limitedAddresses.length 
        });
        
        return {
          addresses: limitedAddresses,
          totalCount: addresses.length,
          searchOptions: searchOptions
        };
      });
      
    } catch (error) {
      Logger.error('高度宛名検索エラー', error);
      throw error;
    }
  },
  
  /**
   * 郵便番号から住所候補取得（簡易版）
   */
  getAddressSuggestions(zipCode) {
    try {
      Logger.info('住所候補取得', { zipCode });
      
      // 簡易実装：既存データから類似郵便番号を検索
      const addresses = Database.getAddresses();
      
      // 郵便番号の前3桁または前4桁で類似検索
      const zipPrefix = zipCode.replace('-', '').substring(0, 3);
      
      const suggestions = addresses
        .filter(addr => addr.zipCode.replace('-', '').startsWith(zipPrefix))
        .map(addr => ({
          zipCode: addr.zipCode,
          address: addr.address,
          count: 1 // 実際の使用頻度
        }))
        .reduce((acc, curr) => {
          const existing = acc.find(item => 
            item.zipCode === curr.zipCode && item.address === curr.address
          );
          if (existing) {
            existing.count++;
          } else {
            acc.push(curr);
          }
          return acc;
        }, [])
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      Logger.info('住所候補取得完了', { count: suggestions.length });
      
      return suggestions;
      
    } catch (error) {
      Logger.error('住所候補取得エラー', error);
      return [];
    }
  },
  
  /**
   * 宛名使用統計取得
   */
  getAddressUsageStats(addressId) {
    try {
      const allShipping = Database.getShipping();
      const usageHistory = allShipping.filter(shipping => shipping.addressId === addressId);
      
      if (usageHistory.length === 0) {
        return {
          totalUsage: 0,
          lastUsed: null,
          firstUsed: null,
          uniqueUsers: 0,
          totalAmount: 0,
          averageAmount: 0
        };
      }
      
      const uniqueUsers = new Set(usageHistory.map(shipping => shipping.userId || 'unknown')).size;
      const totalAmount = usageHistory.reduce((sum, shipping) => sum + (shipping.fee || 0), 0);
      
      return {
        totalUsage: usageHistory.length,
        lastUsed: usageHistory[0].shippingDate,
        firstUsed: usageHistory[usageHistory.length - 1].shippingDate,
        uniqueUsers: uniqueUsers,
        totalAmount: totalAmount,
        averageAmount: Math.round(totalAmount / usageHistory.length)
      };
      
    } catch (error) {
      Logger.error('宛名使用統計取得エラー', error);
      return null;
    }
  },
  
  /**
   * ユーザー別使用履歴取得
   */
  getUserHistoryForAddress(addressId) {
    try {
      const allShipping = Database.getShipping();
      const usageHistory = allShipping.filter(shipping => shipping.addressId === addressId);
      
      const userStats = {};
      
      usageHistory.forEach(shipping => {
        const userId = shipping.userId || 'unknown';
        if (!userStats[userId]) {
          userStats[userId] = {
            userId: userId,
            count: 0,
            totalAmount: 0,
            lastUsed: null,
            firstUsed: null
          };
        }
        
        userStats[userId].count++;
        userStats[userId].totalAmount += (shipping.fee || 0);
        
        if (!userStats[userId].lastUsed || new Date(shipping.shippingDate) > new Date(userStats[userId].lastUsed)) {
          userStats[userId].lastUsed = shipping.shippingDate;
        }
        
        if (!userStats[userId].firstUsed || new Date(shipping.shippingDate) < new Date(userStats[userId].firstUsed)) {
          userStats[userId].firstUsed = shipping.shippingDate;
        }
      });
      
      return Object.values(userStats).sort((a, b) => b.count - a.count);
      
    } catch (error) {
      Logger.error('ユーザー別使用履歴取得エラー', error);
      return [];
    }
  },
  
  /**
   * 関連宛名取得（同一顧客・類似住所）
   */
  getRelatedAddresses(address) {
    try {
      const allAddresses = Database.getAddresses();
      
      // 同一顧客の他の宛名
      const sameCustomerAddresses = allAddresses
        .filter(addr => 
          addr.customerId === address.customerId && 
          addr.id !== address.id &&
          !addr.recipientName.startsWith('[削除済み]')
        )
        .slice(0, 5);
      
      // 類似住所（同一郵便番号など）
      const similarAddresses = allAddresses
        .filter(addr => 
          addr.id !== address.id &&
          addr.customerId !== address.customerId &&
          addr.zipCode === address.zipCode &&
          !addr.recipientName.startsWith('[削除済み]')
        )
        .slice(0, 3);
      
      return {
        sameCustomer: sameCustomerAddresses,
        similarAddress: similarAddresses
      };
      
    } catch (error) {
      Logger.error('関連宛名取得エラー', error);
      return { sameCustomer: [], similarAddress: [] };
    }
  },
  
  /**
   * 宛名関連性スコア計算（検索用）
   */
  calculateAddressRelevanceScore(address, query) {
    const queryLower = query.toLowerCase();
    let score = 0;
    
    // 宛名マッチ
    if (address.recipientName.toLowerCase().includes(queryLower)) {
      score += address.recipientName.toLowerCase().startsWith(queryLower) ? 100 : 80;
    }
    
    // 住所マッチ
    if (address.address.toLowerCase().includes(queryLower)) {
      score += address.address.toLowerCase().startsWith(queryLower) ? 90 : 70;
    }
    
    // 建物名マッチ
    if (address.buildingName && address.buildingName.toLowerCase().includes(queryLower)) {
      score += 60;
    }
    
    // 郵便番号マッチ
    if (address.zipCode.includes(query)) {
      score += 50;
    }
    
    return score;
  },
  
  /**
   * 宛名関連キャッシュクリア
   */
  clearAddressCaches(addressId = null, customerId = null) {
    if (addressId) {
      CacheManager.remove(`address_detail_${addressId}`);
    }
    
    if (customerId) {
      CacheManager.remove(`addresses_customer_${customerId}`);
    }
    
    CacheManager.remove('addresses_all');
    CacheManager.remove('customers_with_addresses');
    
    // リスト系キャッシュクリア
    CacheManager.removeAll();
  },
  
  /**
   * 宛名一括インポート（CSV）
   */
  importAddresses(csvData, options = {}) {
    try {
      const { skipDuplicates = true, validateOnly = false, defaultCustomerId = null } = options;
      
      Logger.info('宛名インポート開始', { skipDuplicates, validateOnly });
      
      const lines = csvData.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      // 必須ヘッダー検証
      const requiredHeaders = ['recipientName', 'zipCode', 'address'];
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
      
      // データ処理
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) continue;
        
        const addressData = {};
        headers.forEach((header, index) => {
          addressData[header] = values[index];
        });
        
        // デフォルト顧客ID設定
        if (!addressData.customerId && defaultCustomerId) {
          addressData.customerId = defaultCustomerId;
        }
        
        results.processed++;
        
        try {
          // バリデーション
          const validation = Validator.validateAddress(addressData);
          if (!validation.isValid) {
            results.errors.push(`行 ${i + 1}: ${validation.errors.join(', ')}`);
            continue;
          }
          
          // 重複チェック（簡易：同一顧客の同一宛名・住所）
          if (skipDuplicates) {
            const existingAddresses = Database.getAddresses(addressData.customerId);
            const isDuplicate = existingAddresses.some(addr => 
              addr.recipientName === addressData.recipientName &&
              addr.address === addressData.address &&
              addr.zipCode === addressData.zipCode
            );
            
            if (isDuplicate) {
              results.skipped++;
              continue;
            }
          }
          
          // プレビューに追加
          results.preview.push({
            line: i + 1,
            data: addressData
          });
          
          // 実際のインポート実行
          if (!validateOnly) {
            Database.saveAddress(addressData);
            results.imported++;
          }
          
        } catch (error) {
          results.errors.push(`行 ${i + 1}: ${error.message}`);
        }
      }
      
      // キャッシュクリア
      if (!validateOnly && results.imported > 0) {
        this.clearAddressCaches();
      }
      
      Logger.info('宛名インポート完了', results);
      
      return results;
      
    } catch (error) {
      Logger.error('宛名インポートエラー', error);
      throw error;
    }
  },
  
  /**
   * 宛名エクスポート（CSV）
   */
  exportAddresses(options = {}) {
    try {
      const { customerId = null, includeUsageStats = false, includeCustomerInfo = true } = options;
      
      Logger.info('宛名エクスポート開始', options);
      
      const addresses = Database.getAddresses(customerId);
      
      // ヘッダー構築
      let headers = ['ID', '顧客ID', '郵便番号', '住所', '建物名', '宛名', '作成日', '更新日'];
      
      if (includeCustomerInfo) {
        headers.push('顧客名', '会社名');
      }
      
      if (includeUsageStats) {
        headers.push('使用回数', '最終使用日', '累計金額');
      }
      
      const csvLines = [headers.join(',')];
      
      // 顧客情報取得（必要な場合）
      let customers = [];
      if (includeCustomerInfo) {
        customers = Database.getCustomers();
      }
      
      // データ行構築
      addresses.forEach(address => {
        let row = [
          address.id,
          address.customerId,
          address.zipCode,
          `"${address.address}"`,
          `"${address.buildingName || ''}"`,
          `"${address.recipientName}"`,
          DateUtils.formatDateTime(address.createdAt),
          DateUtils.formatDateTime(address.updatedAt)
        ];
        
        if (includeCustomerInfo) {
          const customer = customers.find(c => c.id === address.customerId);
          row.push(
            `"${customer ? customer.name : ''}"`,
            `"${customer ? (customer.companyName || '') : ''}"`
          );
        }
        
        if (includeUsageStats) {
          const stats = this.getAddressUsageStats(address.id);
          row.push(
            stats.totalUsage,
            stats.lastUsed ? DateUtils.formatDate(stats.lastUsed) : '',
            stats.totalAmount
          );
        }
        
        csvLines.push(row.join(','));
      });
      
      const csvContent = csvLines.join('\n');
      
      Logger.info('宛名エクスポート完了', { count: addresses.length });
      
      return {
        content: csvContent,
        filename: `addresses_export_${DateUtils.formatDate(new Date()).replace(/-/g, '')}.csv`,
        count: addresses.length
      };
      
    } catch (error) {
      Logger.error('宛名エクスポートエラー', error);
      throw error;
    }
  }
};