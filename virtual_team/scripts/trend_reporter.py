import warnings
warnings.filterwarnings("ignore")
import os
import ssl
import urllib.request
import urllib.parse
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import xml.etree.ElementTree as ET
import google.generativeai as genai

def generate_ai_insight(news_items):
    """取得したニュース一覧からGeminiを用いて示唆を生成する"""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return "<p style='color: #999; font-size: 0.9em;'><em>※Gemini APIキーが設定されていないため、AIによる示唆生成はスキップされました。</em></p>"
    
    genai.configure(api_key=api_key)
    
    # URLタグ等を除外しテキストのみを抽出
    import re
    text_content = re.sub(r'<[^>]+>', '', "".join(news_items))
    
    prompt = f"""
あなたは猿田彦珈琲の敏腕マーケティング戦略担当（Virtual Team）です。
以下のカフェ・飲食に関する最新ニュース記事群を分析し、猿田彦珈琲が「テレビの朝の情報番組等で露出」を獲得するための具体的施策とクリエイティブなPR戦略を提案してください。

【本日のニュース一覧】
{text_content}

【出力条件（厳守事項）】
1. トレンドを掴み活かしていくために必要な視点を「網羅的」に出してください。
2. その中で、猿田彦珈琲において最も優先度の高い視点・施策を「3つ」選び、詳細かつ具体的に解説してください（テレビでどういう「画」になるか等）。
3. それ以外の視点は、箇条書きを用いて「極めて簡潔（短文）」に記載してください。
4. この出力はそのままHTMLメールの一部として埋め込まれます。Markdown形式（**や##など）は一切使わず、必ずHTMLタグ（<h3>, <h4>, <p>, <ul>, <li>, <strong>等）のみを使用して構造化してください。<html>, <body>タグは含めないでください。
"""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        html_output = response.text.strip()
        # Markdownブロック指定（```html など）が含まれてしまう場合の除去
        html_output = re.sub(r'^```html\n?', '', html_output)
        html_output = re.sub(r'\n?```$', '', html_output)
        
        return f'<div style="background-color: #f8f6f0; padding: 20px; border-left: 5px solid #c88d3e; margin: 20px 0;">{html_output}</div>'
    except Exception as e:
        return f"<p><em>※AI示唆の生成中にエラーが発生しました: {e}</em></p>"

def fetch_rss(feed_url, limit=5):
    """RSSフィードから指定件数の記事タイトルとリンクを取得する"""
    try:
        req = urllib.request.Request(feed_url, headers={'User-Agent': 'Mozilla/5.0'})
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        items = root.findall('.//item')
        
        results = []
        for item in items:
            title = item.find('title')
            link = item.find('link')
            if title is not None and link is not None:
                results.append(f"<li><a href='{link.text}'>{title.text}</a></li>")
            if len(results) >= limit:
                break
        return results if results else ["<li>該当ニュースなし</li>"]
    except Exception as e:
        return [f"<li>データ取得エラー: {e}</li>"]

def send_email(subject, body_html):
    """Gmail SMTP経由でHTMLメールを送信する（以前構築したSNSアラートと同じ仕組み）"""
    sender = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")
    receiver = os.environ.get("ALERT_RECEIVER_EMAIL", sender)
    
    if not sender or not password:
        print("Gmailの環境変数が設定されていません。コンソールに出力します：\n")
        print(body_html.replace('<li>', '- ').replace('</li>', '').replace('<br>', '\n'))
        return

    msg = MIMEMultipart("alternative")
    msg['Subject'] = subject
    msg['From'] = f"Virtual Team Researcher <{sender}>"
    msg['To'] = receiver
    
    part = MIMEText(body_html, "html")
    msg.attach(part)
    
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender, password)
            server.send_message(msg)
        print("メールを正常に送信しました。")
    except Exception as e:
        print(f"メール送信エラー: {e}")

def main():
    today_str = datetime.now().strftime('%Y-%m-%d')
    subject = f"【猿田彦珈琲 Virtual Team】最新トレンドレポート ({today_str})"
    
    # --- 1. 戦略リサーチ：季節限定・先行予約・シズル感 ---
    # SHIROやBAKEの戦略を抽象化した、カフェ・スイーツプロモーションの「勝ちパターン」を監視する
    query_seasonal = urllib.parse.quote('("先行予約" OR "シズル感" OR "季節限定" OR "期間限定") AND ("カフェ" OR "ドリンク" OR "スイーツ" OR "コーヒー")')
    url_seasonal = f"https://news.google.com/rss/search?q={query_seasonal}&hl=ja&gl=JP&ceid=JP:ja"
    seasonal_trends = fetch_rss(url_seasonal, limit=5)

    # --- 2. 猿田彦の年間フック：ひまわり・お月見・クリスマス ---
    # 今年の3つの山場（アレンジドリンク連動企画）に関連する競合や世の中の動きを監視する
    query_sp = urllib.parse.quote('("ひまわり" OR "お月見" OR "月見" OR "クリスマス") AND "ドリンク"')
    url_sp = f"https://news.google.com/rss/search?q={query_sp}&hl=ja&gl=JP&ceid=JP:ja"
    sp_trends = fetch_rss(url_sp, limit=4)

    # --- 3. カフェ・飲食全体の最新リリース（Google News経由） ---
    query_pr = urllib.parse.quote('("PR TIMES" OR "プレスリリース" OR "新商品") AND ("カフェ" OR "喫茶" OR "コーヒー")')
    url_prtimes = f"https://news.google.com/rss/search?q={query_pr}&hl=ja&gl=JP&ceid=JP:ja"
    general_trends = fetch_rss(url_prtimes, limit=3)

    # ニュースからAI示唆を生成
    all_news = seasonal_trends + sp_trends + general_trends
    print("ニュース収集完了。AIインサイトを生成中...")
    ai_insight_html = generate_ai_insight(all_news)

    # HTMLメール本文の構築（リサーチャーペルソナとしての報告）
    html_body = f"""
    <html>
    <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2>☕️ 猿田彦珈琲 マーケティング戦略部（リサーチャー）より</h2>
        <p>おはようございます。CEO（あなた）との会議で決定した「他業界の季節施策アプローチ」および「3シーズンの確実なヒット戦略」に基づく、本日の最新トレンドレポートをお届けします。</p>
        
        {ai_insight_html}
        
        <h3 style="color: #c88d3e;">🌸 1. 【戦略リサーチ】季節限定・先行予約・シズル感関連の最新動向</h3>
        <p style="font-size: 0.9em; color: #666;">（他社のアプリ先行予約や、視覚的な『パケ買い』を誘発するプロモーション事例の抽出）</p>
        <ul>
            {''.join(seasonal_trends)}
        </ul>

        <h3 style="color: #c88d3e;">🌻 2. 【年間フック】『ひまわり・お月見・クリスマス』のアプローチ事例</h3>
        <p style="font-size: 0.9em; color: #666;">（年3回のアレンジドリンク連動企画に向けた、世の中の競合他社の動き）</p>
        <ul>
            {''.join(sp_trends)}
        </ul>

        <h3 style="color: #666;">🗞 3. 【全体俯瞰】PR TIMES カフェ・最新リリース</h3>
        <ul>
            {''.join(general_trends)}
        </ul>
        
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 0.8em; color: #999;">※このレポートは Virtual Team の自動プログラム (GitHub Actions) により毎朝配信されています。</p>
    </body>
    </html>
    """
    
    send_email(subject, html_body)

if __name__ == "__main__":
    main()
