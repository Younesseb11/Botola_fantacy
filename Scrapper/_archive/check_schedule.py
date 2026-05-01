"""
check_schedule.py
---------------------------------------------------------------------------
Scrapes the next scheduled Botola Pro match from Flashscore and updates
the single row in the Supabase `next_fixture` table (id = 1).

Usage:
    py check_schedule.py
---------------------------------------------------------------------------
"""

import os, sys, json
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# ---- env ------------------------------------------------------------------
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

BOTOLA_URL = "https://www.flashscore.com/football/morocco/botola-pro/"
TZ = ZoneInfo("Africa/Casablanca")


# ---- Supabase helper ------------------------------------------------------
def supa_upsert(data):
    """UPSERT next_fixture WHERE id = 1"""
    url = f"{SUPABASE_URL}/rest/v1/next_fixture"
    
    # Crucial for UPSERT: ensure we target the id=1 row
    data["id"] = 1
    
    print("-" * 50)
    print(f"[Supabase] Sending UPSERT (POST) to: {url}")
    print(f"[Supabase] Payload: {json.dumps(data, indent=2)}")
    
    headers = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "resolution=merge-duplicates,return=representation",
    }
    
    try:
        # Use POST for Upsert in PostgREST
        r = requests.post(url, headers=headers, json=data, timeout=15)
        
        print(f"[Supabase] Response Status: {r.status_code}")
        print(f"[Supabase] Response Body: {r.text if r.text else '(empty)'}")
        print("-" * 50)
        
        if r.status_code not in (200, 201, 204):
            print(f"[ERROR] Supabase update failed (Status {r.status_code})")
            return None
            
        # With return=representation, we expect the updated row in a list
        if r.text:
            resp_data = r.json()
            if isinstance(resp_data, list) and len(resp_data) > 0:
                return resp_data[0]
        
        return True
    except Exception as e:
        print(f"[ERROR] Connection error: {e}")
        return None


# ---- Scraper ---------------------------------------------------------------
def scrape_next_match():
    """
    Open Flashscore Botola Pro summary page, find the first match row
    inside the 'Scheduled' block.
    """
    print("[*] Launching browser...")
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            timezone_id="Africa/Casablanca",
            locale="en-GB",
        )
        page = ctx.new_page()
        page.set_default_timeout(20_000)

        print(f"[*] Loading {BOTOLA_URL} ...")
        try:
            page.goto(BOTOLA_URL, wait_until="domcontentloaded")
            page.wait_for_timeout(4000)
            
            # Dismiss cookie banner
            btn = page.locator("#onetrust-accept-btn-handler")
            if btn.is_visible(timeout=3000):
                btn.click()
                page.wait_for_timeout(1000)
                
            page.wait_for_selector(".event__match", timeout=10000)
        except Exception as e:
            print(f"[!] Page load failed: {e}")
            browser.close()
            return None

        # Logic to find the FIRST upcoming (scheduled) match
        match = page.evaluate("""
        () => {
            const rows = Array.from(document.querySelectorAll('.event__match'));
            const upcoming = rows.find(r => 
                !r.className.includes('--finished') && 
                !r.className.includes('--live')
            );
            
            if (!upcoming) return null;
            
            const timeEl = upcoming.querySelector('.event__time');
            const homeEl = upcoming.querySelector('.event__homeParticipant');
            const awayEl = upcoming.querySelector('.event__awayParticipant');
            
            const rawTime = timeEl ? timeEl.textContent.trim() : '';
            const home = homeEl ? homeEl.textContent.trim() : '';
            const away = awayEl ? awayEl.textContent.trim() : '';
            
            let date_str = '', time_str = '';
            const m = rawTime.match(/(\\d{2}\\.\\d{2}\\.)\\s*(\\d{2}:\\d{2})/);
            if (m) {
                date_str = m[1];
                time_str = m[2];
            }
            
            return { home, away, date_str, time_str, raw_time: rawTime };
        }
        """)

        browser.close()
        return match


def build_kickoff_iso(date_str, time_str):
    """Converts '12.04.' and '20:00' to ISO timestamp."""
    if not date_str or not time_str:
        return None
    try:
        d, m = date_str.rstrip(".").split(".")
        year = datetime.now().year
        if int(m) < datetime.now().month and datetime.now().month > 10:
            year += 1
            
        h, mn = time_str.split(":")
        dt = datetime(year, int(m), int(d), int(h), int(mn), tzinfo=TZ)
        return dt.isoformat()
    except Exception as e:
        print(f"[!] Date parse error: {e}")
        return None


# ---- Main ------------------------------------------------------------------
def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] Credentials missing in .env")
        sys.exit(1)

    print("=" * 60)
    print("  BOTOLA FANTASY - NEXT FIXTURE UPDATE")
    print("=" * 60)

    match = scrape_next_match()
    if not match or not match.get("home"):
        print("[!] No upcoming match found on Flashscore.")
        sys.exit(0)

    kickoff = build_kickoff_iso(match["date_str"], match["time_str"])
    
    print(f"\n[OK] Scraped Fixture: {match['home']} vs {match['away']}")
    print(f"[OK] Time detected: {match['date_str']} at {match['time_str']}")
    print(f"[OK] ISO Kickoff: {kickoff}")

    if not kickoff:
        print("[ERROR] Failed to generate a valid kickoff timestamp.")
        sys.exit(1)

    # Push to Supabase via UPSERT
    payload = {
        "home_team": match["home"],
        "away_team": match["away"],
        "kickoff_time": kickoff
    }

    print("\n[*] Upserting Supabase row (id=1)...")
    result = supa_upsert(payload)

    if result:
        print("\n[SUCCESS] Feature updated in database.")
        if isinstance(result, dict):
            print(f"          Verified Data: {result.get('home_team')} vs {result.get('away_team')}")
    else:
        print("\n[FAILURE] Supabase was NOT updated.")


if __name__ == "__main__":
    main()
