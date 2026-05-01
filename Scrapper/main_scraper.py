"""
main_scraper.py — Botola Fantasy Gameweek Pipeline
===================================================
Step 1: fetch_schedule()       → scrape fixtures, save data/gameweek_schedule.json
Step 2: check_live_matches()   → find live/today matches, scrape each one
Step 3: update_gameweek_output → merge per-match points into data/gameweek_output.json
Step 4: Main loop              → check_live every 5 min, fetch_schedule once/day
"""

import os
import sys
import time
import json
import re
from datetime import datetime, date
from zoneinfo import ZoneInfo

import schedule as sched_lib
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# Import scoring logic & scraper helpers from test_match (unchanged)
from test_match import (
    _find_player,
    load_cache,
    PTS,
    GOAL_PTS_BY_POS,
    scrape_lineups,
    scrape_match_data,
)

# ---------------------------------------------------------------------------
#  CONSTANTS
# ---------------------------------------------------------------------------
BOTOLA_URL = "https://www.flashscore.com/football/morocco/botola-pro/"
TZ = ZoneInfo("Africa/Casablanca")
POLL_SECS = 60  # seconds between polls during a live match

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
SCHEDULE_FILE = os.path.join(DATA_DIR, "gameweek_schedule.json")
GW_OUTPUT_FILE = os.path.join(DATA_DIR, "gameweek_output.json")
# Keep legacy output path so the frontend still works
LEGACY_OUTPUT = os.path.join(BASE_DIR, "scrapper-output.json")

os.makedirs(DATA_DIR, exist_ok=True)


def _now():
    return datetime.now(TZ)


def _today_str():
    return _now().strftime("%Y-%m-%d")


def _log(msg):
    print(f"[{_now().strftime('%H:%M:%S')}] {msg}")


# ===========================================================================
#  STEP 1 — fetch_schedule()
# ===========================================================================

def fetch_schedule(page):
    """
    Scrape the Botola Pro fixtures page on Flashscore.
    Saves every match for the current gameweek to data/gameweek_schedule.json.
    """
    _log(f"STEP 1 ▸ Fetching schedule from {BOTOLA_URL}")
    try:
        page.goto(BOTOLA_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        page.wait_for_selector(".event__match", timeout=15000)
    except PWTimeout:
        _log("  ✗ No matches found on page (timeout).")
        return []

    matches = page.evaluate(r"""
    () => {
        const rows = document.querySelectorAll('.event__match');
        const out = [];

        rows.forEach(row => {
            // Extract teams
            const parts = row.querySelectorAll('.event__participant');
            const home = parts[0] ? parts[0].textContent.trim() : '';
            const away = parts[1] ? parts[1].textContent.trim() : '';
            if (!home || !away) return;

            // Extract match link → match_id
            const link = row.querySelector('a[href]');
            const href = link ? link.getAttribute('href') || '' : '';
            const idMatch = href.match(/\/match\/([^/]+)/);
            const match_id = idMatch ? idMatch[1] : '';
            const url = match_id
                ? `https://www.flashscore.com/match/${match_id}/`
                : (link ? link.href : '');

            // Detect status
            let status = 'upcoming';
            if (row.classList.contains('event__match--live')) {
                status = 'live';
            } else if (row.classList.contains('event__match--scheduled')) {
                status = 'upcoming';
            } else {
                // Check for a final score indicator
                const scoreH = row.querySelector('.event__score--home');
                const scoreA = row.querySelector('.event__score--away');
                if (scoreH && scoreA) {
                    const h = scoreH.textContent.trim();
                    const a = scoreA.textContent.trim();
                    if (h !== '' && a !== '' && h !== '-') status = 'finished';
                }
            }

            // Extract time/date text
            const timeEl = row.querySelector('.event__time');
            const timeText = timeEl ? timeEl.textContent.trim() : '';

            // Extract scores if available
            const scoreH = row.querySelector('.event__score--home');
            const scoreA = row.querySelector('.event__score--away');
            const homeScore = scoreH ? scoreH.textContent.trim() : null;
            const awayScore = scoreA ? scoreA.textContent.trim() : null;

            out.push({
                match_id,
                url,
                home_team: home,
                away_team: away,
                time: timeText,
                status,
                home_score: homeScore,
                away_score: awayScore,
            });
        });

        return out;
    }
    """)

    # Add today's date and scrape timestamp
    today = _today_str()
    for m in matches:
        m["date"] = today
        m["scraped_at"] = _now().isoformat()

    # Save schedule
    schedule_data = {
        "gameweek_date": today,
        "last_fetched": _now().isoformat(),
        "matches": matches,
    }

    with open(SCHEDULE_FILE, "w", encoding="utf-8") as f:
        json.dump(schedule_data, f, indent=2, ensure_ascii=False)

    _log(f"  ✓ Saved {len(matches)} matches to {SCHEDULE_FILE}")
    for m in matches:
        _log(f"    • {m['home_team']} vs {m['away_team']}  [{m['status']}]  {m['time']}")

    return matches


# ===========================================================================
#  STEP 2 — check_live_matches()
# ===========================================================================

def _load_schedule():
    """Read the saved schedule from disk."""
    if not os.path.exists(SCHEDULE_FILE):
        return []
    with open(SCHEDULE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("matches", [])


def _scrape_single_match(page, match):
    """
    Scrape a single match: lineups + events → calculate points.
    Returns a dict of { "PlayerName (Team)": { total, events[] } }
    """
    url = match["url"]
    if not url:
        _log(f"  ✗ No URL for {match['home_team']} vs {match['away_team']}, skipping.")
        return None, None, None

    _log(f"  ▸ Scraping: {match['home_team']} vs {match['away_team']}")

    # Navigate to match page first, then get lineups
    try:
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
    except Exception as e:
        _log(f"  ✗ Failed to load match page: {e}")
        return None, None, None

    starters_dict = scrape_lineups(page, url)
    teams, events = scrape_match_data(page, url)

    if not teams:
        _log(f"  ✗ Could not extract teams for match.")
        return None, None, None

    # ── Calculate points ──
    player_scores = {}

    def add_points(p_name, t_name, event_label, pts):
        if not p_name:
            return
        key = f"{p_name} ({t_name})"
        if key not in player_scores:
            player_scores[key] = {"total": 0, "events": []}
        player_scores[key]["total"] += pts
        player_scores[key]["events"].append(f"{event_label} ({pts} pts)")

    # 1. Starters → appearance points
    if starters_dict:
        for side_key, team_name in [("home", teams["home"]), ("away", teams["away"])]:
            for p_name in starters_dict.get(side_key, []):
                add_points(p_name, team_name, "appearance", PTS["appearance"])

    # 2. Match events
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

        add_points(p_name, t_name, f"{etype} @ {ev.get('minute', '')}", pts)

        if etype == "goal" and ev.get("assist"):
            add_points(ev["assist"], t_name, f"assist @ {ev.get('minute', '')}", PTS["assist"])

    match_label = f"{teams['home']} vs {teams['away']}"
    _log(f"  ✓ {len(player_scores)} players scored in {match_label}")
    return match_label, player_scores, teams


def check_live_matches():
    """
    Read gameweek_schedule.json → find live or today's matches → scrape each.
    """
    _log("STEP 2 ▸ Checking for live matches …")
    matches = _load_schedule()

    if not matches:
        _log("  ✗ No schedule found. Run fetch_schedule() first.")
        return

    today = _today_str()
    targets = [
        m for m in matches
        if m["status"] == "live" or m.get("date") == today
    ]

    if not targets:
        _log("  — No live or today's matches in schedule.")
        return

    _log(f"  Found {len(targets)} target match(es).")

    # Load player cache once for all matches
    load_cache()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        for match in targets:
            if match["status"] == "finished":
                _log(f"  ⏭ {match['home_team']} vs {match['away_team']} already finished, scraping final data.")

            match_label, player_scores, teams = _scrape_single_match(page, match)
            if player_scores is not None:
                update_gameweek_output(match, match_label, player_scores)

        browser.close()


# ===========================================================================
#  STEP 3 — update_gameweek_output()
# ===========================================================================

def update_gameweek_output(match_info, match_label, player_scores):
    """
    Merge a single match's player points into data/gameweek_output.json.
    Cumulative across all matches in the gameweek.
    """
    _log(f"STEP 3 ▸ Merging points into {GW_OUTPUT_FILE}")

    # Load existing gameweek output
    gw_data = {"last_updated": "", "matches_scraped": [], "players": {}}
    if os.path.exists(GW_OUTPUT_FILE):
        with open(GW_OUTPUT_FILE, "r", encoding="utf-8") as f:
            try:
                gw_data = json.load(f)
            except json.JSONDecodeError:
                pass

    # Track which matches have been scraped
    match_id = match_info.get("match_id", match_label)
    scraped_list = gw_data.get("matches_scraped", [])

    # Update match entry in scraped list
    match_entry = {
        "match_id": match_id,
        "label": match_label,
        "status": match_info.get("status", "unknown"),
        "last_scraped": _now().isoformat(),
    }
    # Replace existing entry for this match or append
    existing_idx = next((i for i, m in enumerate(scraped_list) if m["match_id"] == match_id), None)
    if existing_idx is not None:
        scraped_list[existing_idx] = match_entry
    else:
        scraped_list.append(match_entry)

    gw_data["matches_scraped"] = scraped_list
    gw_data["last_updated"] = _now().isoformat()

    # Merge player scores (overwrite per-match, cumulative across matches)
    # Strategy: each player key is unique (name + team), so we simply
    # overwrite their score from the latest scrape of that match.
    existing_players = gw_data.get("players", {})
    for p_key, p_data in player_scores.items():
        if p_key in existing_players:
            # Overwrite events from this match (same match re-scraped)
            existing_players[p_key] = p_data
        else:
            existing_players[p_key] = p_data

    gw_data["players"] = existing_players

    # Save
    with open(GW_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(gw_data, f, indent=2, ensure_ascii=False)

    # Also write legacy output for the frontend
    legacy_data = {
        "last_updated": gw_data["last_updated"],
        "match": match_label,
        "players": gw_data["players"],
    }
    with open(LEGACY_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(legacy_data, f, indent=2, ensure_ascii=False)

    _log(f"  ✓ Gameweek total: {len(existing_players)} players across {len(scraped_list)} match(es)")


# ===========================================================================
#  STEP 4 — Main Loop
# ===========================================================================

def job_fetch_schedule():
    """Scheduled task: fetch the full fixtures page once."""
    _log("━" * 60)
    _log("DAILY SCHEDULE FETCH")
    _log("━" * 60)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            fetch_schedule(page)
            browser.close()
    except Exception as e:
        _log(f"✗ Schedule fetch failed: {e}")


def job_check_live():
    """Scheduled task: look for live matches and scrape them."""
    _log("─" * 60)
    _log("LIVE CHECK")
    _log("─" * 60)
    try:
        check_live_matches()
    except Exception as e:
        _log(f"✗ Live check failed: {e}")


def run():
    print("=" * 60)
    print(" BOTOLA FANTASY — MAIN SCRAPER")
    print(f" Started at {_now().strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f" Schedule file : {SCHEDULE_FILE}")
    print(f" Output file   : {GW_OUTPUT_FILE}")
    print("=" * 60)

    # ── Run fetch_schedule immediately on startup ──
    job_fetch_schedule()

    # ── Run a live check immediately ──
    job_check_live()

    # ── Schedule recurring jobs ──
    sched_lib.every(5).minutes.do(job_check_live)
    sched_lib.every().day.at("06:00").do(job_fetch_schedule)  # Re-fetch fixtures daily at 6 AM

    _log("Entering scheduler loop. Ctrl+C to stop.")
    _log("  • check_live_matches() → every 5 minutes")
    _log("  • fetch_schedule()     → daily at 06:00")
    print()

    try:
        while True:
            sched_lib.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        _log("Shutting down.")


if __name__ == "__main__":
    run()
