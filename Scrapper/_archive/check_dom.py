from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('https://www.flashscore.com/match/4r3fB1Ks/lineups/')
    page.wait_for_timeout(4000)
    page.screenshot(path="scratch/flashscore_lineups.png")
    html = page.evaluate("() => document.body.innerHTML")
    with open("scratch/dom.html", "w", encoding="utf-8") as f:
        f.write(html)
    b.close()
