"""
check_schedule.py
---------------------------------------------------------------------------
Scrapes the next scheduled Botola Pro match from Flashscore and updates
the single row in the Supabase `next_fixture` table (id = 1).

Usage:
    py check_schedule.py
---------------------------------------------------------------------------
"""

import os, sys
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
def supa_patch(data):
    """UPDATE next_fixture SET ... WHERE id = 1"""
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/next_fixture?id=eq.1",
        headers={
            "apikey":        SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "return=representation",
        },
        json=data,
        timeout=15,
    )
    if r.status_code not in (200, 204):
        print(f"[ERROR] Supabase returned {r.status_code}: {r.text[:300]}")
        sys.exit(1)
    return r.json() if r.text else []


# ---- Scraper ---------------------------------------------------------------
def scrape_next_match():
    """
    Open Flashscore Botola Pro summary page, find the first match row
    inside the 'Scheduled' block, and return {home, away, date_str, time_str, url}.
    """
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            timezone_id="Africa/Casablanca",
            locale="en-GB",
        )
        page = ctx.new_page()
        page.set_default_timeout(20_000)

        # Accept cookies
        try:
            page.goto("https://www.flashscore.com", wait_until="domcontentloaded")
            page.wait_for_timeout(2_000)
            btn = page.locator("#onetrust-accept-btn-handler")
            if btn.is_visible(timeout=4_000):
                btn.click()
                page.wait_for_timeout(800)
        except PWTimeout:
            pass

        # Load Botola Pro summary
        print(f"[*] Loading {BOTOLA_URL}")
        page.goto(BOTOLA_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(5_000)

        # Save a debug screenshot so we can see exactly what loaded
        page.screenshot(path="debug_schedule.png")
        print("[*] Saved debug_schedule.png")

        try:
            page.wait_for_selector(".event__match", timeout=12_000)
        except PWTimeout:
            print("[!] No .event__match rows found on page at all.")
            browser.close()
            return None

        # Dump every match row's class list + text for debugging
        debug_info = page.evaluate(r"""
        () => {
            const info = [];
            document.querySelectorAll('.event__match, [class*="event__match"]')
                .forEach((row, i) => {
                    const cls  = row.className || '';
                    const text = row.textContent.trim().substring(0, 120);
                    info.push({ i, cls, text });
                });
            return info;
        }
        """)
        print(f"\n[DEBUG] Found {len(debug_info)} match row(s):")
        for d in debug_info[:10]:
            print(f"  [{d['i']}] class='{d['cls']}'")
            print(f"       text='{d['text']}'")

        # Try to find a scheduled match using multiple strategies
        match = page.evaluate(r"""
        () => {
            // Strategy 1: explicit --scheduled class
            let rows = document.querySelectorAll('.event__match--scheduled');

            // Strategy 2: any match row that is NOT finished and NOT live
            if (!rows.length) {
                const all = document.querySelectorAll('.event__match, [class*="event__match"]');
                const upcoming = [];
                all.forEach(row => {
                    const cls = (row.className || '').toLowerCase();
                    // Skip finished and live matches
                    if (cls.includes('finished') || cls.includes('live')) return;
                    upcoming.push(row);
                });
                rows = upcoming;
            }

            if (!rows.length) return null;

            const row    = rows[0];
            const timeEl = row.querySelector('.event__time, [class*="event__time"]');

            // Use specific home/away selectors to avoid duplicates
            const homeEl = row.querySelector('[class*="homeParticipant"] .event__participant, .event__homeParticipant');
            const awayEl = row.querySelector('[class*="awayParticipant"] .event__participant, .event__awayParticipant');

            // Fallback: grab the two .event__participant elements in order
            let home = '', away = '';
            if (homeEl && awayEl) {
                home = homeEl.textContent.trim();
                away = awayEl.textContent.trim();
            } else {
                const parts = row.querySelectorAll('.event__participant');
                home = parts[0] ? parts[0].textContent.trim() : '';
                away = parts[1] ? parts[1].textContent.trim() : '';
            }

            const rawTime = timeEl ? timeEl.textContent.trim() : '';

            let date_str = '', time_str = '';
            // Pattern: "12.04. 20:00"
            const m = rawTime.match(/(\d{2}\.\d{2}\.)\s*(\d{2}:\d{2})/);
            if (m) { date_str = m[1]; time_str = m[2]; }

            return {
                home, away, date_str, time_str,
                raw_time: rawTime,
                row_class: row.className || '',
            };
        }
        """)

        if match:
            print(f"\n[DEBUG] Selected row class: '{match.get('row_class', '')}'")
            print(f"[DEBUG] Raw time text: '{match.get('raw_time', '')}'")

        browser.close()
        return match


# ---- Build ISO timestamp ---------------------------------------------------
def build_kickoff_iso(date_str, time_str):
    """
    Convert Flashscore "12.04." + "20:00" into a full ISO 8601 timestamp
    in the Africa/Casablanca timezone.
    """
    try:
        d, m = date_str.rstrip(".").split(".")
        year = datetime.now().year
        h, mn = time_str.split(":")
        dt = datetime(year, int(m), int(d), int(h), int(mn), tzinfo=TZ)
        return dt.isoformat()
    except (ValueError, AttributeError):
        return None


# ---- Main ------------------------------------------------------------------
def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
        sys.exit(1)

    print("=" * 55)
    print("  Botola Fantasy -- Schedule Checker")
    print("=" * 55)

    match = scrape_next_match()

    if not match or not match.get("home"):
        print("\n[!] No scheduled match found. Nothing to update.\n")
        sys.exit(0)

    kickoff = build_kickoff_iso(match["date_str"], match["time_str"])

    print(f"\n  Next match : {match['home']} vs {match['away']}")
    print(f"  Kickoff    : {match['date_str']} {match['time_str']}")
    print(f"  ISO        : {kickoff}")

    # Update Supabase
    print("\n[*] Updating next_fixture (id=1) in Supabase ...")
    result = supa_patch({
        "home_team":    match["home"],
        "away_team":    match["away"],
        "kickoff_time": kickoff,
    })

    print(f"[OK] Updated successfully.")
    if result:
        print(f"     Row: {result}")
    print()


if __name__ == "__main__":
    main()
