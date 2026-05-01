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

# Scoring Logic
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
#  PLAYER / TEAM CACHE
# ===========================================================================

_players = []
_teams   = []

def _h(extra=None):
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if extra: h.update(extra)
    return h

def load_cache():
    global _players, _teams
    print("[*] Loading player + team cache from Supabase ...")
    try:
        r_p = requests.get(f"{SUPABASE_URL}/rest/v1/players", headers=_h(), params={"select": "id,name,team_id,position"}, timeout=15)
        r_t = requests.get(f"{SUPABASE_URL}/rest/v1/teams", headers=_h(), params={"select": "id,name,short_name"}, timeout=15)
        r_p.raise_for_status()
        r_t.raise_for_status()
        _players = r_p.json()
        _teams   = r_t.json()
        print(f"    Loaded {len(_players)} players and {len(_teams)} teams.")
    except Exception as e:
        print(f"  [!] Cache load failed: {e}")
        # Optionally, fallback to local botola_players.json if supabase fails
        try:
            with open("botola_players.json", "r", encoding="utf-8") as f:
                _players = json.load(f)
            print(f"    Fallback: Loaded {len(_players)} players from local JSON.")
        except Exception as e2:
            pass

def _sim(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _team_matches(player_record, team_id, team_hint):
    """Check if a player record belongs to the hinted team.
    Returns: 'same', 'different', or 'unknown'.
    """
    if not team_hint:
        return "unknown"

    # Supabase teams cache path
    if team_id and player_record.get("team_id"):
        if player_record["team_id"] == team_id:
            return "same"
        else:
            return "different"

    # Local JSON fallback path
    p_team = player_record.get("team", "")
    if p_team:
        sim = _sim(p_team, team_hint)
        if sim > 0.8:
            return "same"
        elif sim < 0.4:
            return "different"

    return "unknown"


def _find_player(name, team_hint=""):
    if not name or not _players: return None

    team_id = None
    if team_hint:
        for t in _teams:
            if (team_hint.lower() in t["name"].lower()
                    or t["name"].lower() in team_hint.lower()
                    or t.get("short_name", "").strip().lower() == team_hint.strip().lower()):
                team_id = t["id"]
                break

    best_p, best_s = None, 0.0
    for p in _players:
        s = _sim(name, p["name"])

        affinity = _team_matches(p, team_id, team_hint)
        if affinity == "same":
            s *= 1.8          # strong boost for correct team
        elif affinity == "different":
            s *= 0.4          # heavy penalty for wrong team
        # "unknown" → no adjustment

        if s > best_s:
            best_s, best_p = s, p

    return best_p if best_s >= 0.55 else None

# ===========================================================================
#  SCRAPER
# ===========================================================================

def scrape_lineups(page, match_url):
    print(f"[*] Extracting lineups for {match_url} ...")
    try:
        page.click('a[href*="/lineups"]', timeout=5000)
        page.wait_for_timeout(3000)
    except Exception as e:
        print(f"  [!] Could not click lineups tab: {e}")
        return None

    return page.evaluate(r"""
    () => {
        const starters = { home: [], away: [] };

        // ── Strategy 1: Use Flashscore's home/away lineup containers ──
        const homeSection = document.querySelector(
            '[class*="lineupsSide--home"], [class*="lf__side--home"], ' +
            '[class*="section--home"], [class*="lineup"][class*="home"]'
        );
        const awaySection = document.querySelector(
            '[class*="lineupsSide--away"], [class*="lf__side--away"], ' +
            '[class*="section--away"], [class*="lineup"][class*="away"]'
        );

        function extractNames(container) {
            if (!container) return [];
            return Array.from(container.querySelectorAll('[class*="nameWrapper"]'))
                .map(el => el.textContent.trim())
                .filter(t => t.length > 0)
                .slice(0, 11);
        }

        if (homeSection && awaySection) {
            starters.home = extractNames(homeSection);
            starters.away = extractNames(awaySection);
            return starters;
        }

        // ── Strategy 2: Look for two lineup columns/sections ──
        const sections = document.querySelectorAll(
            '[class*="lineupsSide"], [class*="lf__side"], ' +
            '[class*="section--lineups"]'
        );
        if (sections.length >= 2) {
            starters.home = extractNames(sections[0]);
            starters.away = extractNames(sections[1]);
            return starters;
        }

        // ── Strategy 3 (fallback): Flat list split at 11 ──
        const nameWrappers = Array.from(document.querySelectorAll('[class*="nameWrapper"]'))
            .map(el => el.textContent.trim())
            .filter(t => t.length > 0);

        if (nameWrappers.length >= 22) {
            starters.home = nameWrappers.slice(0, 11);
            starters.away = nameWrappers.slice(11, 22);
        }
        return starters;
    }
    """)

def scrape_match_data(page, url):
    print(f"[*] Loading match URL: {url} ...")
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(4000)

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

                const mm = text.match(/(\d{1,3})/);
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

def run_test(match_id):
    if match_id.startswith("http"):
        match_url = match_id
    else:
        match_url = f"https://www.flashscore.com/match/{match_id}/"

    load_cache()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        
        starters_dict = scrape_lineups(page, match_url)
        teams, events = scrape_match_data(page, match_url)
        
        browser.close()

    print(f"\n[*] Match: {teams['home']} vs {teams['away']}")
    print("-" * 60)

    player_scores = {}

    def add_points(p_name, t_name, event, pts):
        if not p_name: return
        key = f"{p_name} ({t_name})"
        if key not in player_scores:
            player_scores[key] = {"total": 0, "events": []}
        player_scores[key]["total"] += pts
        player_scores[key]["events"].append(f"{event} ({pts} pts)")

    # 1. Starters Appearance Points
    if starters_dict:
        for side_key, team_name in [("home", teams["home"]), ("away", teams["away"])]:
            for p_name in starters_dict.get(side_key, []):
                add_points(p_name, team_name, "appearance", PTS["appearance"])

    # 2. Match Events
    for ev in events:
        p_name = ev["player"]
        t_name = ev["team"]
        etype = ev["event_type"]

        player_p = _find_player(p_name, t_name)
        
        pts = 0
        if etype == "goal":
            pos = player_p["position"] if player_p else "FWD"
            pts = GOAL_PTS_BY_POS.get(pos, 4)
        elif etype == "substitution":
            pts = PTS["appearance"]
        else:
            pts = PTS.get(etype, 0)
            
        add_points(p_name, t_name, f"{etype} @ {ev['minute']}", pts)
        
        if etype == "goal" and ev.get("assist"):
            add_points(ev["assist"], t_name, f"assist @ {ev['minute']}", PTS["assist"])

    # 3. Print Breakdown
    print("\n[POINTS BREAKDOWN]")
    sorted_players = sorted(player_scores.items(), key=lambda x: x[1]["total"], reverse=True)
    for p_key, data in sorted_players:
        ev_str = ", ".join(data["events"])
        print(f"{p_key:<40} | {data['total']:>3} pts | {ev_str}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test Match Scoring System")
    parser.add_argument("match_id", help="Flashscore match ID or URL")
    args = parser.parse_args()
    
    run_test(args.match_id)
