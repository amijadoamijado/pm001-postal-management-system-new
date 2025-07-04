# Brother製ラベルプリンター連携実装計画

## 🎯 概要
郵便物発送管理システムにBrother製ラベルプリンターとの連携機能を追加し、発送登録と同時に宛名ラベルを自動印刷する仕組みを実装します。

## 📋 要件定義

### 機能要件
1. **自動ラベル印刷**
   - 発送登録ボタンクリックで宛名ラベル自動印刷
   - 印刷プレビュー機能
   - 印刷枚数指定機能

2. **ラベルフォーマット**
   - 郵便番号（〒マーク付き）
   - 送付先住所（都道府県から）
   - 宛名（様・御中の自動判定）
   - 会社名（ある場合）
   - 差出人情報（固定またはユーザー別）

3. **対応プリンター**
   - Brother QLシリーズ（QL-800、QL-820NWBなど）
   - 対応ラベルサイズ：103×164mm（宛名ラベル）

### 非機能要件
1. **パフォーマンス**
   - 印刷開始まで3秒以内
   - 複数枚連続印刷対応

2. **エラーハンドリング**
   - プリンター未接続時の警告
   - 用紙切れ通知
   - 印刷失敗時の再印刷機能

## 🏗️ システム設計

### アーキテクチャ
```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Webブラウザ    │────▶│  Google Apps    │────▶│ スプレッドシート  │
│  (発送入力画面)  │     │    Script       │     │  (データ保存)     │
└─────────────────┘     └─────────────────┘     └──────────────────┘
         │                        │
         │                        │ ラベルデータ
         ▼                        ▼
┌─────────────────┐     ┌─────────────────┐
│ ローカル印刷     │◀────│   印刷データ     │
│  サービス        │     │   (JSON/CSV)     │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Brother         │
│ ラベルプリンター │
└─────────────────┘
```

### 実装方式の選択肢

#### 方式1: Chrome拡張機能方式
- **メリット**: セットアップが簡単、クロスプラットフォーム対応
- **デメリット**: 拡張機能のインストールが必要
- **推奨度**: ★★★★☆

#### 方式2: Electronアプリ方式
- **メリット**: 完全な制御が可能、スタンドアロンアプリ
- **デメリット**: 別途アプリ開発が必要
- **推奨度**: ★★★☆☆

#### 方式3: Brother b-PAC方式（Windows限定）
- **メリット**: Brother公式SDK、高機能
- **デメリット**: Windows限定、ActiveX依存
- **推奨度**: ★★★☆☆

## 💻 実装詳細

### 1. GAS側の実装

```javascript
// ラベルデータ生成API
function generateLabelDataAPI(shippingId) {
  const shipping = Database.getShipping(shippingId);
  const address = Database.getAddresses(shipping.addressId);
  const customer = Database.getCustomers(shipping.customerId);
  
  const labelData = {
    id: Utilities.getUuid(),
    timestamp: new Date().toISOString(),
    
    // 送付先情報
    recipient: {
      postalCode: formatPostalCode(address.zipCode),
      address1: address.address,
      address2: address.buildingName || '',
      name: address.recipientName + determineSuffix(customer),
      company: customer.companyName || ''
    },
    
    // 差出人情報
    sender: getSenderInfo(),
    
    // 印刷設定
    settings: {
      printerName: 'Brother QL-800',
      labelSize: '103x164',
      copies: 1,
      orientation: 'landscape',
      darkness: 0 // 印字濃度
    },
    
    // メタデータ
    metadata: {
      shippingId: shippingId,
      shippingMethod: shipping.shippingMethod,
      trackingNumber: shipping.trackingNumber || null
    }
  };
  
  return labelData;
}

// 敬称の自動判定
function determineSuffix(customer) {
  if (customer.companyName) {
    return ' 御中';
  } else {
    return ' 様';
  }
}

// 郵便番号フォーマット
function formatPostalCode(zipCode) {
  return '〒' + zipCode;
}
```

### 2. フロントエンド側の実装

```javascript
// 発送登録＋ラベル印刷
async function submitShippingWithLabel() {
  try {
    // 1. 発送データ登録
    const shippingResult = await submitShipping();
    
    if (shippingResult.success) {
      // 2. ラベルデータ生成
      const labelData = await generateLabelData(shippingResult.data.id);
      
      // 3. 印刷プレビュー表示
      const confirmed = await showPrintPreview(labelData);
      
      if (confirmed) {
        // 4. ローカル印刷サービスに送信
        await sendToPrinter(labelData);
        
        showSuccess('発送登録とラベル印刷が完了しました');
      }
    }
  } catch (error) {
    showError('エラーが発生しました: ' + error.message);
  }
}

// 印刷プレビュー
function showPrintPreview(labelData) {
  const previewHtml = `
    <div class="label-preview" style="width: 164mm; height: 103mm; border: 1px solid #000; padding: 10mm;">
      <div class="postal-code" style="font-size: 14pt; margin-bottom: 5mm;">
        ${labelData.recipient.postalCode}
      </div>
      <div class="address" style="font-size: 12pt; margin-bottom: 3mm;">
        ${labelData.recipient.address1}<br>
        ${labelData.recipient.address2}
      </div>
      <div class="company" style="font-size: 14pt; margin-bottom: 2mm;">
        ${labelData.recipient.company}
      </div>
      <div class="name" style="font-size: 18pt; font-weight: bold;">
        ${labelData.recipient.name}
      </div>
      <div class="sender" style="position: absolute; bottom: 10mm; right: 10mm; font-size: 9pt;">
        ${labelData.sender.postalCode}<br>
        ${labelData.sender.address}<br>
        ${labelData.sender.company}<br>
        ${labelData.sender.name}
      </div>
    </div>
  `;
  
  // プレビューモーダル表示
  return showModal('印刷プレビュー', previewHtml, ['印刷', 'キャンセル']);
}
```

### 3. ローカル印刷サービス（Chrome拡張機能案）

```javascript
// manifest.json
{
  "manifest_version": 3,
  "name": "郵便物発送管理システム - ラベル印刷",
  "version": "1.0",
  "permissions": ["printerProvider"],
  "background": {
    "service_worker": "background.js"
  }
}

// background.js
chrome.runtime.onMessageExternal.addListener(
  function(request, sender, sendResponse) {
    if (request.action === "printLabel") {
      printLabelWithBrother(request.labelData)
        .then(result => sendResponse({success: true, result: result}))
        .catch(error => sendResponse({success: false, error: error.message}));
      return true; // 非同期レスポンス
    }
  }
);

async function printLabelWithBrother(labelData) {
  // Brother Web SDK を使用した印刷実装
  const printer = new BrotherPrinter();
  await printer.connect(labelData.settings.printerName);
  
  const label = printer.createLabel(labelData.settings.labelSize);
  
  // テキスト配置
  label.addText(labelData.recipient.postalCode, {x: 10, y: 10, fontSize: 14});
  label.addText(labelData.recipient.address1, {x: 10, y: 30, fontSize: 12});
  label.addText(labelData.recipient.name, {x: 10, y: 60, fontSize: 18, bold: true});
  
  // 印刷実行
  return await printer.print(label, labelData.settings.copies);
}
```

## 📅 実装ロードマップ

### Phase 1: 基本実装（2週間）
- [ ] GAS側のラベルデータ生成API実装
- [ ] 印刷プレビュー機能実装
- [ ] 手動でのCSVダウンロード機能

### Phase 2: 自動印刷実装（3週間）
- [ ] Chrome拡張機能開発
- [ ] Brother Web SDK統合
- [ ] エラーハンドリング実装

### Phase 3: 高度な機能（2週間）
- [ ] 複数ラベル一括印刷
- [ ] カスタムラベルテンプレート
- [ ] 印刷履歴管理

## 🎯 期待される効果

1. **作業効率向上**
   - 手書き作業の完全排除
   - 発送作業時間を50%削減

2. **品質向上**
   - 宛名の誤記防止
   - 統一されたラベル品質

3. **コスト削減**
   - 宛名シール購入費用削減
   - 作業人件費削減

## 📝 補足事項

- Brother QL-800は103×164mmの宛名ラベルに対応
- レターパックライトの場合は追跡番号バーコードも印刷可能
- 将来的にはQRコード（追跡用）の印刷も検討