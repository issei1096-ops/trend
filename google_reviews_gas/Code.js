/**
 * 猿田彦珈琲 Google口コミ収集システム
 * Google Places APIを使用して、設定された店舗の口コミを取得し、
 * スプレッドシートに記録します。
 */

// 収集対象の30店舗リスト（プレイスIDを設定してください）
const TARGET_STORES = [
    // TODO: 残りの店舗のPlace IDをGoogle Maps Place ID Finderで取得して追加してください
    { name: "猿田彦珈琲 恵比寿本店", placeId: "ChIJRaBmLUCLGGARbU1gw-zbld0" },
    { name: "猿田彦珈琲 別館 豆屋", placeId: "ChIJAQBkLkCLGGARO3_MrFyxFLc" },
    { name: "猿田彦珈琲 The Bridge 原宿駅店", placeId: "ChIJJ7chkaKNGGAR16fsJLpLTLk" },
    { name: "猿田彦珈琲 調布焙煎ホール", placeId: "ChIJAQBkLkCLGGARO3_MrFyxFLc" },
    { name: "猿田彦珈琲 アトレ恵比寿店", placeId: "ChIJg6YtW0CLGGARX7cb5SWFCho" },
    { name: "猿田彦珈琲 秋葉原アトレ1店", placeId: "ChIJbZjXKvKNGGAR3uVsiHX-ZDY" },
    { name: "猿田彦珈琲 神奈川県立図書館", placeId: "ChIJ5Z2-T1hdGGARKEA-a5t1Fc4" },
    { name: "猿田彦珈琲 立川高島屋S.C.店", placeId: "ChIJWd4BjgPhGGARAh2fEkM96sI" },
    { name: "猿田彦珈琲 池袋店", placeId: "ChIJx2CCofSNGGARisbPw8loe3M" },
    { name: "猿田彦珈琲 エキュートエディション御茶ノ水店", placeId: "ChIJac8mJACNGGAR_Mzf1X-jYV4" },
    { name: "猿田彦珈琲 Special Edition 東京大学ダイワユビキタス学術研究館1階", placeId: "ChIJeX5fNgCNGGARgK_cj31MlTA" },
    { name: "猿田彦珈琲 駒沢大学駅店", placeId: "ChIJsTjIcQD1GGARFWqD68kB5yI" },
    { name: "猿田彦珈琲 アトリエ仙川店", placeId: "ChIJlRwJ9LzxGGARnMGzqtyuOuQ" },
    { name: "猿田彦珈琲 渋谷道玄坂店", placeId: "ChIJQ4KyM8mNGGARx7UDIN0vfeU" },
    { name: "猿田彦珈琲 下北沢店", placeId: "ChIJH1Kbg5LzGGARnUoZlwfsPs8" },
    { name: "猿田彦珈琲 丸の内 二重橋前駅", placeId: "ChIJH7bcXwCLGGAR6TND8tiYzQs" },
    { name: "猿田彦珈琲 吉祥寺 井の頭公園前店", placeId: "ChIJQ9h1XgbvGGARqJeqtVkbJb0" },
    { name: "猿田彦珈琲 亀戸店", placeId: "ChIJC7OcHFCJGGARrI0DCStmJ98" },
    { name: "猿田彦珈琲 名古屋 則武新町店", placeId: "ChIJ77bkvS53A2ARP8-xiX_aNVc" },
    { name: "猿田彦珈琲 伊勢国 多気店", placeId: "ChIJTYCCag4_BGAR2febExR_BjQ" },
    { name: "猿田彦珈琲 京都 祇園店", placeId: "ChIJXSnN6fUJAWAR8DYPgDvMqtw" },
    { name: "猿田彦珈琲 阪急西宮ガーデンズ店", placeId: "ChIJC6aqp3XzAGARbQzvmfEPw9o" },
    { name: "猿田彦珈琲 くずはモール店", placeId: "ChIJbaiaTcUdAWARK2qolTq6Xbk" },
    { name: "猿田彦珈琲 淀屋橋駅店", placeId: "ChIJgdBhTwDnAGARGFhZJLGftK8" },
    { name: "猿田彦珈琲 大阪駅イノゲート店", placeId: "ChIJLwFFRADnAGARCKNoL254DQo" },
    { name: "猿田彦珈琲 アクアイグニス仙台店", placeId: "ChIJ2xl4KYAhil8RKhdibmePBWU" },
    { name: "猿田彦珈琲 奈良 鹿猿狐ビルヂング", placeId: "ChIJZVxLu6I5AWARUcEIeyNO90U" },
    { name: "猿田彦珈琲 D-LIFEPLACE 札幌", placeId: "ChIJSW2nHfgpC18RO97wgRMzgM8" },
    { name: "猿田彦珈琲 エディオンピースウイング広島店", placeId: "ChIJTya_LACZWjURwCN6tgEMpi0" },
    { name: "猿田彦珈琲 サウスウッド センター南店", placeId: "" },
    { name: "猿田彦珈琲とティキタカアイスクリームのお店", placeId: "ChIJq6qq-dCMGGARq5EWlc0Ala8" }
];

// 1回の実行で処理する店舗数（APIの制限や処理時間への配慮）
const BATCH_SIZE = 3;

/**
 * 毎日定期実行されるメイン関数
 * スクリプトプロパティから現在のインデックスを読み取り、
 * 3店舗ずつ処理を行い、終わったら次のインデックスを保存する。
 */
function fetchDailyReviews() {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    console.log("Current Script Properties keys:", Object.keys(allProps));
    const apiKey = props.getProperty('API_KEY');
    const spreadsheetId = props.getProperty('SPREADSHEET_ID');

    // プロパティが存在しない場合はエラー
    if (!apiKey || !spreadsheetId) {
        console.error("スクリプトプロパティに 'API_KEY' と 'SPREADSHEET_ID' を設定してください。");
        return;
    }

    // 現在のインデックスを取得（無い場合は0から）
    let currentIndex = parseInt(props.getProperty('CURRENT_INDEX') || '0', 10);

    // もしターゲット数を超えていたら0に戻す
    if (currentIndex >= TARGET_STORES.length) {
        currentIndex = 0;
    }

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheets()[0]; // 最初のシートを使用

    // 初回実行時のみヘッダーを作成
    if (sheet.getLastRow() === 0) {
        sheet.appendRow(['取得日時', '対象店舗', '評価', '口コミ内容', '投稿者名', '口コミ日時', 'GoogleマップURL']);
        // ヘッダー行を装飾
        sheet.getRange(1, 1, 1, 7)
            .setBackground('#f3f3f3')
            .setFontWeight('bold');
        sheet.setFrozenRows(1);
    }

    console.log(`処理開始: インデックス ${currentIndex} から ${BATCH_SIZE} 店舗分`);

    const now = new Date();
    const formattedNow = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

    // バッチ対象の店舗を処理
    for (let i = 0; i < BATCH_SIZE; i++) {
        const targetIndex = (currentIndex + i) % TARGET_STORES.length;
        const store = TARGET_STORES[targetIndex];

        console.log(`${store.name} の口コミを取得中... (${store.placeId})`);

        try {
            const reviews = fetchReviewsForPlace(store.placeId, apiKey);

            if (reviews && reviews.length > 0) {
                // 新しい口コミをシートに追記
                const rows = reviews.map(r => {
                    // UNIXタイムスタンプ(秒)をDateに変換してフォーマット
                    const reviewDate = new Date(r.time * 1000);
                    const formattedReviewDate = Utilities.formatDate(reviewDate, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

                    return [
                        formattedNow,
                        store.name,
                        r.rating,
                        r.text,
                        r.author_name,
                        formattedReviewDate,
                        r.author_url // ユーザーページ等
                    ];
                });

                // 複数行を一度に書き込む
                sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
                console.log(`- ${rows.length}件の口コミを書き込みました`);
            } else {
                console.log(`- 口コミ情報がありませんでした`);
            }

        } catch (e) {
            console.error(`${store.name} の取得中にエラーが発生しました: ${e.message}`);
        }
    }

    // 次回実行用にインデックスを更新して保存
    const nextIndex = (currentIndex + BATCH_SIZE) % TARGET_STORES.length;
    props.setProperty('CURRENT_INDEX', nextIndex.toString());

    console.log(`処理完了: 次回の開始インデックスを ${nextIndex} に設定しました。`);
}

/**
 * Google Places API (Place Details) を呼び出して口コミを取得するヘルパー関数
 * @param {string} placeId - 対象のPlace ID
 * @param {string} apiKey - Places APIキー
 * @returns {Array} reviews配列
 */
function fetchReviewsForPlace(placeId, apiKey) {
    // language=ja を指定して日本語の口コミや情報を取得する
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,reviews&language=ja&key=${apiKey}`;

    const options = {
        method: 'get',
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    if (data.status === 'OK' && data.result) {
        return data.result.reviews || [];
    } else {
        throw new Error(`APIレスポンスエラー: ${data.status} - ${data.error_message || ''}`);
    }
}
