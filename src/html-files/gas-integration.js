// GAS API統合用のJavaScriptファイル
// shipping-input-form.htmlと連携

// GAS WebアプリのURL（デプロイ後に設定）
const GAS_API_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

// 発送データをGASに送信する関数
async function submitShippingToGAS(shippingData, addressData, withPrint) {
    try {
        // 送信データの準備
        const requestData = {
            address: addressData,
            shippingData: shippingData,
            timestamp: new Date().toISOString(),
            userId: getCurrentUserId() // ユーザーIDがあれば設定
        };

        // GASにPOSTリクエストを送信
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'no-cors', // CORS制限を回避
            headers: {
                'Content-Type': 'text/plain' // GASはtext/plainで受け取る
            },
            body: JSON.stringify(requestData)
        });

        // no-corsモードではレスポンスを読めないので、成功と仮定
        if (withPrint) {
            // 印刷処理
            window.print();
        }

        // 成功メッセージ
        alert('発送登録が完了しました！');
        
        // フォームをリセット
        resetForm();
        
        return true;
        
    } catch (error) {
        console.error('GAS送信エラー:', error);
        alert('エラーが発生しました。もう一度お試しください。');
        return false;
    }
}

// 現在のユーザーIDを取得（実装に応じて変更）
function getCurrentUserId() {
    // セッションストレージやクッキーから取得
    return sessionStorage.getItem('userId') || 'anonymous';
}

// フォームをリセット
function resetForm() {
    // Step 1に戻る
    currentStep = 1;
    document.querySelectorAll('.step-content').forEach(content => {
        content.style.display = 'none';
    });
    document.getElementById('step1-content').style.display = 'block';
    
    // ステップインジケーターをリセット
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active', 'completed');
    });
    document.getElementById('step1').classList.add('active');
    
    // データをクリア
    selectedAddress = null;
    shippingData = {
        method: 'standard_regular',
        weight: 50,
        express: false,
        trackingNumber: '',
        contentType: '',
        contentDetail: ''
    };
}

// 発送履歴を取得
async function getShippingHistory(userId) {
    try {
        const url = `${GAS_API_URL}?action=getHistory&userId=${userId}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        } else {
            console.error('履歴取得エラー:', data.error);
            return [];
        }
    } catch (error) {
        console.error('履歴取得エラー:', error);
        return [];
    }
}