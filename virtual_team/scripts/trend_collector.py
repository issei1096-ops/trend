# trend_collector.py
import ssl
import json
import urllib.request
from datetime import datetime
import xml.etree.ElementTree as ET

def fetch_rss_trends(feed_url, limit=5):
    """Fetch and parse RSS feeds via simple HTTP request."""
    try:
        req = urllib.request.Request(feed_url, headers={'User-Agent': 'Mozilla/5.0'})
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context) as response:
            xml_data = response.read()
        
        root = ET.fromstring(xml_data)
        items = root.findall('.//item')
        
        results = []
        for item in items:
            title = item.find('title').text
            link = item.find('link').text
            results.append(f"- [{title}]({link})")
            if len(results) >= limit:
                break
        return results
    except Exception as e:
        return [f"データ取得エラー ({feed_url}): {e}"]

def main():
    print(f"=== ☕️猿田彦珈琲 Virtual Team: Daily Trend Report ===")
    print(f"日付: {datetime.now().strftime('%Y-%m-%d')}\n")
    
    print("■ PR TIMES (外食・カフェ) 最新リリーストレンド")
    # PR Times generic RSS for food/beverage
    pr_times_url = "https://prtimes.jp/tv/category/restaurant/rss.xml"
    insights = fetch_rss_trends(pr_times_url)
    for insight in insights:
        print(insight)
        
    print("\n■ Google News (スペシャルティコーヒー・カフェDX)")
    # Google news RSS search format for specialty coffee / cafe dx
    google_news_url = "https://news.google.com/rss/search?q=%E3%82%B9%E3%83%9A%E3%82%B7%E3%83%A3%E3%83%AB%E3%83%86%E3%82%A3%E3%82%B3%E3%83%BC%E3%83%92%E3%83%BC+OR+%E3%82%AB%E3%83%95%E3%82%ADDX&hl=ja&gl=JP&ceid=JP:ja"
    news_insights = fetch_rss_trends(google_news_url)
    for insight in news_insights:
        print(insight)
        
    print("\n-------------------------")
    print("※このスクリプトを GitHub Actions 等でCron実行（毎日朝8時など）することで、\n自律的な情報収集とチーム内でのトレンド共有が実現します。")

if __name__ == "__main__":
    main()
