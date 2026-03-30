/**
 * 猿田彦珈琲 Google口コミ分析システム (Gemini API 連携)
 * 収集した口コミを一定の期間でまとめ、店舗ごとに「良い点」「悪い点・改善点」を
 * 生成AI (Gemini) で分析し、別シートに出力します。
 */

// Gemini API のエンドポイントとモデル
// 最新のモデル(gemini-2.0-flash または gemini-1.5-flash-latest)を使用します
const GEMINI_MODEL = "gemini-2.0-flash";

/**
 * 口コミ分析を実行するメイン関数
 * (毎日特定の時間にトリガー設定し、1日1店舗ずつ分析を進めることをお勧めします)
 */
function analyzeStoreReviewsWithGemini() {
    const props = PropertiesService.getScriptProperties();
    const spreadsheetId = props.getProperty('SPREADSHEET_ID');
    const geminiApiKey = props.getProperty('GEMINI_API_KEY');

    if (!spreadsheetId || !geminiApiKey) {
        console.error("スクリプトプロパティに 'SPREADSHEET_ID' と 'GEMINI_API_KEY' を設定してください。");
        return;
    }

    const ss = SpreadsheetApp.openById(spreadsheetId);

    // 元データのシート (先頭のシートを想定)
    const dataSheet = ss.getSheets()[0];
    const data = dataSheet.getDataRange().getValues();

    // ヘッダー行を除外
    if (data.length <= 1) {
        console.log("分析する口コミデータがありません。");
        return;
    }
    const headers = data.shift(); // 先頭行削除

    // 分析結果を出力するシートの準備
    let reportSheet = ss.getSheetByName('分析レポート');
    if (!reportSheet) {
        reportSheet = ss.insertSheet('分析レポート');
        // レポート用のヘッダーを作成
        reportSheet.appendRow(['分析実行日', '対象店舗', '対象件数', '平均評価', '👍 良い点 (Gemini分析)', '📉 悪い点・課題 (Gemini分析)', '💡 具体的な改善アクション (Gemini提案)']);
        reportSheet.getRange(1, 1, 1, 7).setBackground('#e3f2fd').setFontWeight('bold');
        reportSheet.setFrozenRows(1);
        reportSheet.setColumnWidth(5, 300);
        reportSheet.setColumnWidth(6, 300);
        reportSheet.setColumnWidth(7, 300);
    }

    // --- データの店舗別集計 ---
    // dataの列インデックス: 1=店舗名, 2=評価, 3=口コミ内容
    const storeData = {};

    data.forEach(row => {
        const storeName = row[1];
        const rating = parseInt(row[2], 10);
        const reviewText = row[3];

        // 内容が空、または店舗名が取れない場合はスキップ
        if (!storeName || !reviewText || reviewText.trim() === '') return;

        if (!storeData[storeName]) {
            storeData[storeName] = { reviews: [], totalRating: 0, count: 0 };
        }

        // プロンプトに渡すテキストとして、評価情報を付与
        storeData[storeName].reviews.push(`【評価: ${rating}】 ${reviewText}`);
        storeData[storeName].totalRating += rating;
        storeData[storeName].count++;
    });

    // --- 対象店舗リストの作成 ---
    const storesToAnalyze = Object.keys(storeData).filter(storeName => {
        return storeData[storeName].count >= 3;
    });

    if (storesToAnalyze.length === 0) {
        console.log("分析対象となる十分な件数の店舗がありません。");
        return;
    }

    // 前回の続きから行うためのインデックス取得
    let currentIndex = parseInt(props.getProperty('ANALYZER_CURRENT_INDEX') || '0', 10);
    if (currentIndex >= storesToAnalyze.length) {
        console.log("全店舗の分析が一巡しました。インデックスを0に戻します。");
        currentIndex = 0;
    }

    const storeName = storesToAnalyze[currentIndex];
    const info = storeData[storeName];
    const averageRating = (info.totalRating / info.count).toFixed(2);
    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');

    console.log(`[${currentIndex + 1}/${storesToAnalyze.length}] ${storeName} の口コミを分析中... (対象 ${info.count}件)`);

    try {
        // Geminiで分析 (1店舗のみ)
        const analysisResult = callGeminiApi(storeName, info.reviews, geminiApiKey);

        // レポートシートに追記
        reportSheet.appendRow([
            today,
            storeName,
            info.count,
            averageRating,
            analysisResult.goodPoints,
            analysisResult.badPoints,
            analysisResult.actionPlan
        ]);

        console.log(`${storeName} の分析が完了し、シートに書き込みました。`);

        // 次回の実行用にインデックスを進める
        props.setProperty('ANALYZER_CURRENT_INDEX', (currentIndex + 1).toString());

    } catch (e) {
        console.error(`${storeName} の分析中にエラーが発生しました: ${e.message}`);
    }
}

/**
 * Gemini API を呼び出して口コミを分析する関数
 * @param {string} storeName - 店舗名
 * @param {Array<string>} reviews - 口コミテキストの配列
 * @param {string} apiKey - Gemini API Key
 * @returns {Object} { goodPoints, badPoints, actionPlan }
 */
function callGeminiApi(storeName, reviews, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    // API制限(特に入力トークン数)を回避するため、送る口コミを絞り込む
    // 直近15件までに制限し、長すぎる口コミは省略する
    const maxReviewsToSend = 15;
    const maxCharsPerReview = 200;

    // 最新（配列の後ろ）のものを優先して取得
    const recentReviews = reviews.slice(-maxReviewsToSend).map(text => {
        if (text.length > maxCharsPerReview) {
            return text.substring(0, maxCharsPerReview) + "...(省略)";
        }
        return text;
    });

    // プロンプトの構築
    const combinedReviews = recentReviews.join('\n---\n');

    const systemPrompt = `
あなたは猿田彦珈琲の店舗改善コンサルタントです。
以下の${storeName}に寄せられたGoogle口コミデータを分析し、JSON形式でレポートを作成してください。

【分析ルール】
1. 口コミには【評価: N】というプレフィックスがついています。高評価は良い点、低評価は悪い点・改善点の参考にしてください。
2. 良い点は、お客様が特に価値を感じている部分を箇条書きで具体的に3つ程度挙げてください。
3. 悪い点・課題は、接客、品質、環境などの具体的な不満やミスを箇条書きで抽出してください。もし悪い点が全くなければ「特に目立った悪い点なし」としてください。
4. 改善アクションは、現場のマネージャーやスタッフがすぐに取り組める具体的な提案を2〜3つ挙げてください。

【出力フォーマット（必ず以下のJSONキーのみを含む生のJSONで返すこと。Markdownの\`\`\`jsonブロックなどは不要）】
{
  "goodPoints": "- 〇〇が良い\\n- 〇〇が評価されている",
  "badPoints": "- 〇〇に関する不満がある\\n- 〇〇が指摘されている",
  "actionPlan": "- スタッフ間で〇〇を共有する\\n- 〇〇のオペレーションを見直す"
}

【対象の口コミデータ】
${combinedReviews}
`;

    const payload = {
        "contents": [{
            "parts": [{
                "text": systemPrompt
            }]
        }],
        "generationConfig": {
            "temperature": 0.2, // 分析タスクなので低めに設定し、一貫性を保つ
            "responseMimeType": "application/json" // JSON形式での返却を強制
        }
    };

    const options = {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true
    };

    let response;
    let responseCode;
    let responseText;
    let maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        response = UrlFetchApp.fetch(url, options);
        responseCode = response.getResponseCode();
        responseText = response.getContentText();

        if (responseCode === 429 || responseCode >= 500) {
            // 429エラー(Token制限やリクエスト数超過)の場合は、非常に長く待機する
            const waitTime = responseCode === 429 ? 65000 : (10000 * (attempt + 1));
            console.warn(`API制限または一時エラー(${responseCode})。${waitTime / 1000}秒待機して再試行します... (試行 ${attempt + 1}/${maxRetries})`);
            Utilities.sleep(waitTime);
            attempt++;
        } else {
            break;
        }
    }

    if (responseCode !== 200) {
        throw new Error(`Gemini API Error after retries (${responseCode}): ${responseText}`);
    }

    const jsonResponse = JSON.parse(responseText);

    // 返却されたテキストを取得
    let generatedText = "";
    try {
        generatedText = jsonResponse.candidates[0].content.parts[0].text;
    } catch (e) {
        throw new Error(`予期しないレスポンスフォーマット: ${responseText}`);
    }

    // JSONをパースして返す
    try {
        const parsedData = JSON.parse(generatedText.trim());
        return {
            goodPoints: parsedData.goodPoints || "解析不能",
            badPoints: parsedData.badPoints || "解析不能",
            actionPlan: parsedData.actionPlan || "解析不能"
        };
    } catch (parseError) {
        console.warn("JSONのパージングに失敗しました。生テキスト:", generatedText);
        return {
            goodPoints: generatedText, // フォールバックとして生テキストを出力
            badPoints: "フォーマットエラー",
            actionPlan: "フォーマットエラー"
        };
    }
}
