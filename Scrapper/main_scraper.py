"""
main_scraper.py — Botola Fantasy Gameweek Pipeline (Supabase Integrated)
===================================================
1. fetch_schedule()       → scrape fixtures, upsert to Supabase
2. check_todays_matches() → set today's matches to upcoming
3. detect_live_matches()  → find LIVE matches, update status
4. scrape_live_match()    → scrape events, push to player_live_points
Main loop                 → manages intervals (60s live, 5min idle)
"""

import os
import time
import json
from datetime import datetime
from zoneinfo import ZoneInfo
import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# Import scoring logic & scraper helpers from test_match
from test_match import (
    _find_player,
    load_cache,
    PTS,
    GOAL_PTS_BY_POS,
    scrape_lineups,
    scrape_match_data,
    _teams,
)

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

BOTOLA_URL = "https://www.flashscore.com/football/morocco/botola-pro/"
TZ = ZoneInfo("Africa/Casablanca")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LEGACY_OUTPUT = os.path.join(BASE_DIR, "scrapper-output.json")

def _now():
    return datetime.now(TZ)

def _today_str():
    return _now().strftime("%Y-%m-%d")

def _log(msg):
    print(f"[{_now().strftime('%H:%M:%S')}] {msg}")

def _h(extra=None):
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    if extra: h.update(extra)
    return h

def _get_team_id(team_name):
    for t in _teams:
        if t["name"].lower() == team_name.lower() or t.get("short_name", "").lower() == team_name.lower():
            return t["id"]
        if team_name.lower() in t["name"].lower():
            return t["id"]
    return None

# ===========================================================================
#  1. fetch_schedule()
# ===========================================================================
def fetch_schedule():
    _log("STEP 1 ▸ Fetching schedule from Flashscore")
    load_cache() # Ensure teams are loaded
    matches = []
    
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto(BOTOLA_URL, wait_until="domcontentloaded")
            page.wait_for_timeout(4000)
            page.wait_for_selector(".event__match", timeout=15000)
            
            matches = page.evaluate(r"""
            () => {
                const rows = document.querySelectorAll('.event__match');
                const out = [];
                let currentGw = 1;

                rows.forEach(row => {
                    const roundEl = row.previousElementSibling;
                    if (roundEl && roundEl.classList.contains('event__round')) {
                        const m = roundEl.textContent.match(/Round (\d+)/i);
                        if (m) currentGw = parseInt(m[1], 10);
                    }

                    const parts = row.querySelectorAll('.event__participant');
                    const home = parts[0] ? parts[0].textContent.trim() : '';
                    const away = parts[1] ? parts[1].textContent.trim() : '';
                    if (!home || !away) return;

                    let status = 'upcoming';
                    if (row.classList.contains('event__match--live')) status = 'live';
                    else if (!row.classList.contains('event__match--scheduled')) status = 'finished';

                    const timeEl = row.querySelector('.event__time');
                    const timeText = timeEl ? timeEl.textContent.trim() : '';

                    out.push({
                        home_team: home,
                        away_team: away,
                        time: timeText,
                        status,
                        gameweek: currentGw
                    });
                });
                return out;
            }
            """)
        except Exception as e:
            _log(f"  ✗ Failed to fetch schedule: {e}")
        finally:
            browser.close()

    if not matches:
        return

    next_match = None
    today_date = _today_str()
    
    for m in matches:
        home_id = _get_team_id(m['home_team'])
        away_id = _get_team_id(m['away_team'])
        if not home_id or not away_id:
            continue
            
        match_date = today_date
        try:
            if "." in m["time"]:
                day_month = m["time"].split(" ")[0]
                d, mo = day_month.split(".")[:2]
                dt = datetime(year=_now().year, month=int(mo), day=int(d))
                match_date = dt.strftime("%Y-%m-%d")
        except:
            pass

        payload = {
            "home_team_id": home_id,
            "away_team_id": away_id,
            "gameweek": m["gameweek"],
            "status": m["status"],
            "match_date": match_date
        }
        
        # Upsert fixture
        r = requests.get(f"{SUPABASE_URL}/rest/v1/fixtures", params={"home_team_id": f"eq.{home_id}", "away_team_id": f"eq.{away_id}", "gameweek": f"eq.{m['gameweek']}"}, headers=_h())
        if r.status_code == 200 and len(r.json()) > 0:
            fid = r.json()[0]["id"]
            requests.patch(f"{SUPABASE_URL}/rest/v1/fixtures", params={"id": f"eq.{fid}"}, json=payload, headers=_h())
        else:
            requests.post(f"{SUPABASE_URL}/rest/v1/fixtures", json=payload, headers=_h())
            
        if m["status"] == "upcoming" and next_match is None:
            next_match = m

    if next_match:
        nf_payload = {
            "home_team": next_match["home_team"],
            "away_team": next_match["away_team"],
            "kickoff_time": next_match["time"]
        }
        r = requests.get(f"{SUPABASE_URL}/rest/v1/next_fixture", params={"id": "eq.1"}, headers=_h())
        if r.status_code == 200 and len(r.json()) > 0:
            requests.patch(f"{SUPABASE_URL}/rest/v1/next_fixture", params={"id": "eq.1"}, json=nf_payload, headers=_h())
        else:
            nf_payload["id"] = 1
            requests.post(f"{SUPABASE_URL}/rest/v1/next_fixture", json=nf_payload, headers=_h())

    _log(f"  ✓ Schedule updated ({len(matches)} matches).")

# ===========================================================================
#  2. check_todays_matches()
# ===========================================================================
def check_todays_matches():
    _log("STEP 2 ▸ Checking today's matches")
    today = _today_str()
    r = requests.get(f"{SUPABASE_URL}/rest/v1/fixtures", params={"match_date": f"eq.{today}", "status": "neq.finished"}, headers=_h())
    if r.status_code == 200:
        matches = r.json()
        for m in matches:
            if m["status"] != "upcoming" and m["status"] != "live":
                requests.patch(f"{SUPABASE_URL}/rest/v1/fixtures", params={"id": f"eq.{m['id']}"}, json={"status": "upcoming"}, headers=_h())
        _log(f"  ✓ {len(matches)} matches scheduled for today.")
    else:
        _log("  ✗ Failed to query today's matches.")

# ===========================================================================
#  3. detect_live_matches()
# ===========================================================================
def detect_live_matches():
    _log("STEP 3 ▸ Detecting live matches")
    live_urls = []
    
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto(BOTOLA_URL, wait_until="domcontentloaded")
            page.wait_for_timeout(4000)
            
            live_matches = page.evaluate(r"""
            () => {
                const rows = document.querySelectorAll('.event__match--live');
                const out = [];
                rows.forEach(row => {
                    const parts = row.querySelectorAll('.event__participant');
                    const home = parts[0] ? parts[0].textContent.trim() : '';
                    const away = parts[1] ? parts[1].textContent.trim() : '';
                    
                    const link = row.querySelector('a[href]');
                    const href = link ? link.getAttribute('href') || '' : '';
                    const idMatch = href.match(/\/match\/([^/]+)/);
                    const match_id = idMatch ? idMatch[1] : '';
                    const url = match_id ? `https://www.flashscore.com/match/${match_id}/` : '';
                    
                    if (url) out.push({ home, away, url });
                });
                return out;
            }
            """)
            
            for m in live_matches:
                live_urls.append(m["url"])
                home_id = _get_team_id(m["home"])
                away_id = _get_team_id(m["away"])
                if home_id and away_id:
                    requests.patch(
                        f"{SUPABASE_URL}/rest/v1/fixtures", 
                        params={"home_team_id": f"eq.{home_id}", "away_team_id": f"eq.{away_id}"}, 
                        json={"status": "LIVE"}, 
                        headers=_h()
                    )
                    
        except Exception as e:
            _log(f"  ✗ Failed to detect live matches: {e}")
        finally:
            browser.close()
            
    _log(f"  ✓ Found {len(live_urls)} live matches.")
    return live_urls

# ===========================================================================
#  4. scrape_live_match(match_url)
# ===========================================================================
def scrape_live_match(match_url):
    _log(f"STEP 4 ▸ Scraping live match: {match_url}")
    load_cache()
    
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            page.goto(match_url, wait_until="domcontentloaded")
            page.wait_for_timeout(3000)
        except Exception as e:
            _log(f"  ✗ Failed to load match page: {e}")
            browser.close()
            return
            
        starters_dict = scrape_lineups(page, match_url)
        teams, events = scrape_match_data(page, match_url)
        browser.close()
        
    if not teams:
        return

    player_scores = {}

    def add_event(p_name, t_name, event_label, pts, minute="0'"):
        if not p_name: return
        player_p = _find_player(p_name, t_name)
        if not player_p: return
        
        pid = player_p["id"]
        
        # Save to player_live_points
        payload = {
            "player_id": pid,
            "player_name": p_name,
            "team_name": t_name,
            "event_type": event_label,
            "points": pts,
            "minute": minute,
            "match_home_team": teams["home"],
            "match_away_team": teams["away"],
            "match_date": _today_str()
        }
        
        # Check if event already exists (to avoid duplicates)
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/player_live_points", 
            params={"player_id": f"eq.{pid}", "event_type": f"eq.{event_label}", "minute": f"eq.{minute}", "match_date": f"eq.{_today_str()}"}, 
            headers=_h()
        )
        if r.status_code == 200 and len(r.json()) == 0:
            requests.post(f"{SUPABASE_URL}/rest/v1/player_live_points", json=payload, headers=_h())
            
            # Update total points
            new_total = player_p.get("total_points", 0) + pts
            requests.patch(f"{SUPABASE_URL}/rest/v1/players", params={"id": f"eq.{pid}"}, json={"total_points": new_total}, headers=_h())
            
        key = f"{p_name} ({t_name})"
        if key not in player_scores:
            player_scores[key] = {"total": 0, "events": []}
        player_scores[key]["total"] += pts
        player_scores[key]["events"].append(f"{event_label} @ {minute} ({pts} pts)")

    # 1. Starters
    if starters_dict:
        for side_key, team_name in [("home", teams["home"]), ("away", teams["away"])]:
            for p_name in starters_dict.get(side_key, []):
                add_event(p_name, team_name, "appearance", PTS["appearance"])

    # 2. Events
    for ev in events:
        p_name = ev["player"]
        t_name = ev["team"]
        etype = ev["event_type"]
        minute = ev.get("minute", "0'")
        
        player_p = _find_player(p_name, t_name)
        pts = 0
        if etype == "goal":
            pos = player_p["position"] if player_p else "FWD"
            pts = GOAL_PTS_BY_POS.get(pos, 4)
        elif etype == "substitution":
            pts = PTS["appearance"]
        else:
            pts = PTS.get(etype, 0)
            
        add_event(p_name, t_name, etype, pts, minute)
        
        if etype == "goal" and ev.get("assist"):
            add_event(ev["assist"], t_name, "assist", PTS["assist"], minute)

    # Save to local scrapper-output.json backup
    legacy_data = {
        "last_updated": _now().isoformat(),
        "match": f"{teams['home']} vs {teams['away']}",
        "players": player_scores,
    }
    with open(LEGACY_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(legacy_data, f, indent=2, ensure_ascii=False)
        
    _log(f"  ✓ Match processed. {len(player_scores)} players scored.")

# ===========================================================================
#  MAIN LOOP
# ===========================================================================
def main():
    _log("BOTOLA FANTASY — MAIN SCRAPER STARTED")
    
    # Initialize timestamps to 0 so they trigger immediately on first run
    last_schedule_fetch = 0
    last_todays_check = 0
    
    try:
        while True:
            now_ts = time.time()
            
            # 1. fetch_schedule() - once per day (86400 seconds)
            if now_ts - last_schedule_fetch > 86400:
                fetch_schedule()
                last_schedule_fetch = time.time()
                
            # 2. check_todays_matches() - every 30 mins (1800 seconds)
            if now_ts - last_todays_check > 1800:
                check_todays_matches()
                last_todays_check = time.time()
                
            # 3. detect_live_matches() - every 5 mins
            live_urls = detect_live_matches()
            
            # 4. If live matches exist, scrape them every 60s
            if live_urls:
                _log(f"  Entering LIVE mode for {len(live_urls)} match(es)...")
                # Scrape 5 times (5 mins) before breaking out to re-detect live matches
                for _ in range(5): 
                    for url in live_urls:
                        scrape_live_match(url)
                    _log("  Sleeping 60s...")
                    time.sleep(60)
            else:
                _log("  No live matches. Sleeping 5 mins...")
                time.sleep(300)
    except KeyboardInterrupt:
        _log("Shutting down gracefully.")

if __name__ == "__main__":
    main()
