import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('https://www.flashscore.com/match/football/union-touarga-GKY9yk5c/wydad-athletic-2yuuwjkA/?mid=4r3fB1Ks')
    page.wait_for_timeout(4000)
    
    # Click lineups tab
    try:
        page.click('a[href*="/lineups"]', timeout=5000)
        print("Clicked lineups tab")
        page.wait_for_timeout(3000)
    except Exception as e:
        print('Could not click lineups tab:', e)
        
    html = page.evaluate('() => document.body.innerHTML')
    with open('dom.html', 'w', encoding='utf-8') as f:
        f.write(html)
    b.close()
