// PM001 郵便物発送管理システム - GAS Backend
// TypeScriptで実装

interface ShippingData {
  method: string;
  weight: number;
  express: boolean;
  trackingNumber: string;
  contentType: string;
  contentDetail: string;
  postingMethod: string;
}

interface AddressData {
  name: string;
  company?: string;
  postalCode: string;
  address: string;
}

interface ShippingRequest {
  address: AddressData;
  shippingData: ShippingData;
  timestamp: string;
  userId?: string;
}

// スプレッドシートIDを環境変数から取得（PropertiesServiceを使用）
function getSpreadsheetId(): string {
  const scriptProperties = PropertiesService.getScriptProperties();
  return scriptProperties.getProperty('SPREADSHEET_ID') || '';
}

// CORS対応のレスポンスヘッダーを設定
function createCorsResponse(data: any): GoogleAppsScript.Content.TextOutput {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// メインのPOSTリクエストハンドラー
function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    // リクエストボディをパース
    const requestData: ShippingRequest = JSON.parse(e.postData.contents);
    
    // データのバリデーション
    if (!requestData.address || !requestData.shippingData) {
      return createCorsResponse({
        success: false,
        error: '必須データが不足しています'
      });
    }
    
    // スプレッドシートに記録
    const result = recordShipping(requestData);
    
    return createCorsResponse({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error in doPost:', error);
    return createCorsResponse({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラーが発生しました'
    });
  }
}

// GETリクエストハンドラー（テスト用）
function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  return createCorsResponse({
    success: true,
    message: 'PM001 Shipping System API is running',
    version: '1.0.0'
  });
}

// スプレッドシートにデータを記録
function recordShipping(data: ShippingRequest): any {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error('スプレッドシートIDが設定されていません');
  }
  
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  
  // シートが存在しない場合は作成
  let sheet = spreadsheet.getSheetByName('発送記録');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('発送記録');
    // ヘッダー行を設定
    const headers = [
      '記録日時',
      '宛名',
      '会社名',
      '郵便番号',
      '住所',
      '発送方法',
      '重量(g)',
      '速達',
      '追跡番号',
      '内容1',
      '内容2',
      '投函方法',
      '料金',
      'ユーザーID'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  
  // 料金計算
  const fee = calculateFee(data.shippingData);
  
  // データを配列に変換
  const rowData = [
    new Date(data.timestamp),
    data.address.name,
    data.address.company || '',
    data.address.postalCode,
    data.address.address,
    getShippingMethodName(data.shippingData.method),
    data.shippingData.weight,
    data.shippingData.express ? '速達' : '',
    data.shippingData.trackingNumber || '',
    data.shippingData.contentType,
    data.shippingData.contentDetail || '',
    data.shippingData.postingMethod === 'metered-mail' ? '後納郵便' : '自分で投函',
    fee,
    data.userId || ''
  ];
  
  // 最終行に追加
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);
  
  // 記録IDを生成（行番号ベース）
  const recordId = `PM001-${lastRow}`;
  
  return {
    recordId: recordId,
    fee: fee,
    timestamp: data.timestamp
  };
}

// 発送方法の日本語名を取得
function getShippingMethodName(method: string): string {
  const methods: { [key: string]: string } = {
    'standard_regular': '普通郵便（規格内）',
    'standard_irregular': '普通郵便（規格外）',
    'letterpack-light': 'レターパックライト',
    'letterpack-plus': 'レターパックプラス'
  };
  return methods[method] || method;
}

// 料金計算
function calculateFee(data: ShippingData): number {
  let baseFee = 0;
  
  switch (data.method) {
    case 'letterpack-light':
      baseFee = 430;
      break;
    case 'letterpack-plus':
      baseFee = 600;
      break;
    case 'standard_regular':
      // 規格内料金
      if (data.weight <= 50) baseFee = 140;
      else if (data.weight <= 100) baseFee = 180;
      else if (data.weight <= 150) baseFee = 270;
      else if (data.weight <= 250) baseFee = 320;
      else baseFee = 320;
      break;
    case 'standard_irregular':
      // 規格外料金
      if (data.weight <= 50) baseFee = 260;
      else if (data.weight <= 100) baseFee = 290;
      else if (data.weight <= 150) baseFee = 390;
      else if (data.weight <= 250) baseFee = 450;
      else baseFee = 450;
      break;
  }
  
  // 速達料金
  const expressFee = data.express ? 250 : 0;
  
  return baseFee + expressFee;
}

// 発送履歴を取得（API用）
function getShippingHistory(userId?: string): any[] {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    return [];
  }
  
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName('発送記録');
  
  if (!sheet) {
    return [];
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  
  // データを整形して返す
  return data.map((row, index) => ({
    recordId: `PM001-${index + 2}`,
    timestamp: row[0],
    address: {
      name: row[1],
      company: row[2],
      postalCode: row[3],
      address: row[4]
    },
    shippingData: {
      method: row[5],
      weight: row[6],
      express: row[7] === '速達',
      trackingNumber: row[8],
      contentType: row[9],
      contentDetail: row[10],
      postingMethod: row[11]
    },
    fee: row[12],
    userId: row[13]
  })).filter(record => !userId || record.userId === userId);
}