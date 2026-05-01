"""
test_historical_match.py
---------------------------------------------------------------------------
Simulates a live match experience by scraping historical data from a 
Flashscore match URL and pushing events to Supabase sequentially.

Usage:
    py test_historical_match.py "MATCH_URL" [--clear]

Example:
    py test_historical_match.py "https://www.flashscore.com/match/Iui2yZzh/" --clear
---------------------------------------------------------------------------
"""

import os
import sys
import time
import re
import json
import argparse
from datetime import datetime, date
from zoneinfo import ZoneInfo
from difflib import SequenceMatcher

import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# ---- env ------------------------------------------------------------------
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

# ---- constants ------------------------------------------------------------
TZ = ZoneInfo("Africa/Casablanca")

# Scoring Logic (Must match live.py)
PTS = {
    "assist":          3,
    "yellow_card":    -1,
    "red_card":       -3,
    "own_goal":       -2,
    "penalty_miss":   -2,
    "penalty_save":    5,
    "appearance":      1,
    "played_60_mins":  1,
}

GOAL_PTS_BY_POS = {
    "GK":  10,
    "DEF":  6,
    "MID":  5,
    "FWD":  4,
}

# ===========================================================================
#  SUPABASE REST HELPERS
# ===========================================================================

def _h(extra=None):
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h

def supa_get(table, params=None):
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=_h(), params=params or {}, timeout=15,
    )
    r.raise_for_status()
    return r.json()

def supa_insert(table, rows):
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=_h({"Prefer": "return=representation"}),
        json=rows, timeout=15,
    )
    if r.status_code not in (200, 201):
        print(f"  [!] Supabase Insert failed: {r.text[:300]}")
        return []
    return r.json()

def supa_delete_all(table):
    """Deletes all rows in the table (requires service-role key)."""
    r = requests.delete(
        f"{SUPABASE_URL}/rest/v1/{table}?id=not.is.null", # dummy filter to allow delete
        headers=_h(), timeout=15,
    )
    if r.status_code not in (200, 204):
        print(f"  [!] Failed to clear {table}: {r.text}")
    else:
        print(f"  [OK] Cleared table: {table}")

# ===========================================================================
#  PLAYER / TEAM CACHE
# ===========================================================================

_players = []
_teams   = []

def load_cache():
    global _players, _teams
    print("[*] Loading player + team cache from Supabase ...")
    try:
        _players = supa_get("players", {"select": "id,name,team_id,position"})
        _teams   = supa_get("teams",   {"select": "id,name,short_name"})
        print(f"    Loaded {len(_players)} players and {len(_teams)} teams.")
    except Exception as e:
        print(f"  [!] Cache load failed: {e}")
        sys.exit(1)

def _sim(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def _find_player(name, team_hint=""):
    if not name or not _players: return None
    
    team_id = None
    for t in _teams:
        if (team_hint.lower() in t["name"].lower()
                or t["name"].lower() in team_hint.lower()
                or t["short_name"].strip().lower() == team_hint.strip().lower()):
            team_id = t["id"]
            break

    best_p, best_s = None, 0.0
    for p in _players:
        s = _sim(name, p["name"])
        if team_id and p["team_id"] == team_id:
            s *= 1.3 # Boost same-team matches
        if s > best_s:
            best_s, best_p = s, p
            
    return best_p if best_s >= 0.65 else None

# ===========================================================================
#  SCRAPER
# ===========================================================================

def scrape_lineups(page, match_url):
    """
    Navigate to the Lineups tab by clicking it and extract the starting 11 for both teams.
    """
    print(f"[*] Extracting lineups for {match_url} ...")
    try:
        # Click the lineups tab directly instead of navigating to a URL
        # which avoids the ?mid= issues.
        page.click('a[href*="/lineups"]', timeout=5000)
        page.wait_for_timeout(3000)
    except Exception as e:
        print(f"  [!] Could not click lineups tab: {e}")
        return None

    return page.evaluate(r"""
    () => {
        const starters = { home: [], away: [] };
        
        // Find all non-empty links that point to a player profile
        const playerLinks = Array.from(document.querySelectorAll('a'))
            .filter(a => a.href && a.href.includes('/player/'))
            .map(a => a.textContent.trim())
            .filter(t => t.length > 0);
            
        if (playerLinks.length >= 22) {
            starters.home = playerLinks.slice(0, 11);
            starters.away = playerLinks.slice(11, 22);
        } else {
            // Fallback for older DOM structures
            const nameWrappers = Array.from(document.querySelectorAll('[class*="nameWrapper"]'))
                .map(el => el.textContent.trim())
                .filter(t => t.length > 0);
                
            if (nameWrappers.length >= 22) {
                starters.home = nameWrappers.slice(0, 11);
                starters.away = nameWrappers.slice(11, 22);
            }
        }
        
        return starters;
    }
    """)

def scrape_match_data(page, url):
    """Scrapes team names and all match events."""
    print(f"[*] Loading match URL: {url} ...")
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(4000)

    # Get team names
    teams = page.evaluate("""
    () => {
        const hEl = document.querySelector('.duelParticipant__home .participant__participantName');
        const aEl = document.querySelector('.duelParticipant__away .participant__participantName');
        return {
            home: hEl ? hEl.textContent.trim() : 'Home Team',
            away: aEl ? aEl.textContent.trim() : 'Away Team'
        };
    }
    """)

    # Get events
    events = page.evaluate("""
    () => {
        const out = [];
        const homeTeam = document.querySelector('.duelParticipant__home .participant__participantName').textContent.trim();
        const awayTeam = document.querySelector('.duelParticipant__away .participant__participantName').textContent.trim();

        function getSide(el) {
            let n = el;
            while (n) {
                if (n.classList) {
                    if (n.classList.contains('smv__homeParticipant')) return homeTeam;
                    if (n.classList.contains('smv__awayParticipant')) return awayTeam;
                }
                n = n.parentElement;
            }
            return '';
        }

        document.querySelectorAll('.smv__incident, [class*="smv__incident"]')
            .forEach(row => {
                const html = row.innerHTML.toLowerCase();
                const text = row.textContent.trim();
                const textLower = text.toLowerCase();
                
                let evType = null;
                if (html.includes('penalty-missed') || textLower.includes('penalty missed')) evType = 'penalty_miss';
                else if (html.includes('own-goal') || textLower.includes('own goal')) evType = 'own_goal';
                else if (html.includes('soccer-ball') || html.includes('goal')) evType = 'goal';
                else if (html.includes('yellowred') || html.includes('red-card')) evType = 'red_card';
                else if (html.includes('yellow')) evType = 'yellow_card';
                else if (html.includes('substitution')) evType = 'substitution';

                if (!evType) return;

                const mm = text.match(/(\\d{1,3})/);
                const minute = mm ? mm[0] + "'" : '';
                const links = row.querySelectorAll('a');
                
                if (evType === 'substitution') {
                    const outEl = row.querySelector('.smv__subDown');
                    const playerOut = outEl ? outEl.textContent.trim() : '';
                    const inEl = Array.from(links).find(a => !a.classList.contains('smv__subDown'));
                    const playerIn = inEl ? inEl.textContent.trim() : '';
                    const team = getSide(row);
                    if (playerIn) out.push({ player: playerIn, player_out: playerOut, event_type: 'substitution', minute, team });
                } else {
                    const player = links[0] ? links[0].textContent.trim() : '';
                    let assist = links.length >= 2 ? links[1].textContent.trim() : '';
                    const team = getSide(links[0] || row);
                    if (player) out.push({ player, assist, event_type: evType, minute, team });
                }
            });
        return out;
    }
    """)

    return teams, events

# ===========================================================================
#  SIMULATION LOGIC
# ===========================================================================

def run_simulation(match_url, clear_table=False):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] Database credentials missing in .env")
        return

    if clear_table:
        supa_delete_all("player_live_points")

    load_cache()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        
        starters_dict = scrape_lineups(page, match_url)
        teams, events = scrape_match_data(page, match_url)
        
        browser.close()

    if not events:
        print("[!] No events found to simulate.")
        return

    print(f"[*] Found {len(events)} events. Starting simulation (2s delay between pushes)...")
    print(f"[*] Match: {teams['home']} vs {teams['away']}")
    print("-" * 60)

    today_iso = date.today().isoformat()

    # --- KICKOFF: Ensure Starters get Appearance Points ---
    print(f"[*] Simulating Kickoff... Pushing appearance points for starting XI.")
    kickoff_rows = []
    
    if starters_dict and (starters_dict.get("home") or starters_dict.get("away")):
        for side_key, team_name in [("home", teams["home"]), ("away", teams["away"])]:
            for p_name in starters_dict.get(side_key, []):
                player_p = _find_player(p_name, team_name)
                pid = player_p["id"] if player_p else None
                
                kickoff_rows.append({
                    "player_name":     p_name,
                    "player_id":       pid,
                    "team_name":       team_name,
                    "event_type":      "appearance",
                    "points":          PTS["appearance"],
                    "minute":          "0'",
                    "match_home_team": teams["home"],
                    "match_away_team": teams["away"],
                    "match_date":      today_iso,
                    "match_side":      side_key,
                })
    else:
        print("  [!] Lineup scrape failed or empty. Falling back to event extraction...")
        # Fallback if lineups tab failed
        all_players = set()
        subbed_in = set()
        player_to_team = {}
        
        for ev in events:
            t = ev.get("team", "")
            if ev.get("player"):
                all_players.add(ev["player"])
                player_to_team[ev["player"]] = t
            if ev.get("assist"):
                all_players.add(ev["assist"])
                player_to_team[ev["assist"]] = t
            if ev.get("player_out"):
                all_players.add(ev["player_out"])
                player_to_team[ev["player_out"]] = t
                
            if ev.get("event_type") == "substitution" and ev.get("player"):
                subbed_in.add(ev["player"])
                
        fallback_starters = all_players - subbed_in
        for p_name in fallback_starters:
            t_name = player_to_team.get(p_name, "")
            player_p = _find_player(p_name, t_name)
            pid = player_p["id"] if player_p else None
            
            side = None
            if t_name == teams["home"]: side = "home"
            elif t_name == teams["away"]: side = "away"
            
            kickoff_rows.append({
                "player_name":     p_name,
                "player_id":       pid,
                "team_name":       t_name,
                "event_type":      "appearance",
                "points":          PTS["appearance"],
                "minute":          "0'",
                "match_home_team": teams["home"],
                "match_away_team": teams["away"],
                "match_date":      today_iso,
                "match_side":      side,
            })

    if kickoff_rows:
        res = supa_insert("player_live_points", kickoff_rows)
        if res:
            print(f"    [OK] Pushed +{sum(r['points'] for r in kickoff_rows)} total points for {len(kickoff_rows)} starters.")
        time.sleep(2)
    # --------------------------------------------------------

    for i, ev in enumerate(events, 1):
        player_p = _find_player(ev["player"], ev["team"])
        pid = player_p["id"] if player_p else None
        etype = ev["event_type"]

        # Calc Points
        pts = 0
        if etype == "goal":
            pos = player_p["position"] if player_p else "FWD"
            pts = GOAL_PTS_BY_POS.get(pos, 4)
        elif etype == "substitution":
            pts = PTS["appearance"]
        else:
            pts = PTS.get(etype, 0)

        # Determine match side for this event
        ev_team = ev["team"]
        side = None
        if ev_team == teams["home"]: side = "home"
        elif ev_team == teams["away"]: side = "away"

        rows_to_push = []
        rows_to_push.append({
            "player_name":     ev["player"],
            "player_id":       pid,
            "team_name":       ev["team"],
            "event_type":      etype,
            "points":          pts,
            "minute":          ev["minute"],
            "match_home_team": teams["home"],
            "match_away_team": teams["away"],
            "match_date":      today_iso,
            "match_side":      side,
        })

        # Add assist if present
        if etype == "goal" and ev.get("assist"):
            assistant_p = _find_player(ev["assist"], ev["team"])
            aid = assistant_p["id"] if assistant_p else None
            rows_to_push.append({
                "player_name":     ev["assist"],
                "player_id":       aid,
                "team_name":       ev["team"],
                "event_type":      "assist",
                "points":          PTS["assist"],
                "minute":          ev["minute"],
                "match_home_team": teams["home"],
                "match_away_team": teams["away"],
                "match_date":      today_iso,
                "match_side":      side,
            })

        # Push to Supabase
        print(f"[{i}/{len(events)}] Pushing {etype.upper()} - {ev['player']} ({ev['minute']}) ...")
        res = supa_insert("player_live_points", rows_to_push)
        if res:
            print(f"    [OK] Pushed +{sum(r['points'] for r in rows_to_push)} total points.")
        
        if i < len(events):
            time.sleep(2)

    print("-" * 60)
    print("[SUCCESS] Historical simulation complete.")

# ===========================================================================
#  MAIN
# ===========================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Flashscore Historical Match Simulator")
    parser.add_argument("url", help="Flashscore match summary URL")
    parser.add_argument("--clear", action="store_true", help="Clear player_live_points table before starting")
    
    args = parser.parse_args()
    
    run_simulation(args.url, args.clear)
