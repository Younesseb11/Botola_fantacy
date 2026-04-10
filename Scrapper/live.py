"""
live.py  --  Botola Fantasy Live Runner
============================================================================
Handles the live scraping loop for Botola Pro.
1. Checks the Botola Pro summary page for any match currently marked as 'LIVE'.
2. If a live match is found, starts the 60-second polling loop.
3. Calculates fantasy points for goals, cards, and assists.
4. Pushes events to the player_live_points table in Supabase.

Usage:
    py live.py

Set DEBUG_MODE = True below to test with a past match immediately.
============================================================================
"""

# ---------------------------------------------------------------------------
#  Toggle this to True to test right now with a recent past match
# ---------------------------------------------------------------------------
DEBUG_MODE = False
# ---------------------------------------------------------------------------

import os, sys, time, re, json
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
BOTOLA_URL = "https://www.flashscore.com/football/morocco/botola-pro/"
TZ         = ZoneInfo("Africa/Casablanca")
POLL_SECS  = 60

# Debug: a finished match with real events we can scrape right now
DEBUG_MATCH_URL = (
    "https://www.flashscore.com/match/football/"
    "difaa-el-jadidi-Iui2yZzh/wydad-athletic-2yuuwjkA/"
)
DEBUG_MATCH = {
    "home": "Wydad AC",
    "away": "Difaa El Jadidi",
    "url":  DEBUG_MATCH_URL,
}

# Fantasy points
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

# Positional goal points (official FPL rules)
GOAL_PTS_BY_POS = {
    "GK":  10,
    "DEF":  6,
    "MID":  5,
    "FWD":  4,
}

# ===========================================================================
#  SUPABASE REST (no SDK needed)
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
    """Inserts rows with a 2-second retry if the first attempt fails."""
    def _do():
        return requests.post(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=_h({"Prefer": "return=representation"}),
            json=rows, timeout=15,
        )
    
    r = _do()
    if r.status_code not in (200, 201):
        print(f"  [!] Supabase Insert failed ({r.status_code}). Retrying in 2s...")
        time.sleep(2)
        r = _do()
        
    if r.status_code not in (200, 201):
        print(f"  [CRITICAL] Supabase second attempt failed: {r.text[:300]}")
        return []
    
    return r.json()


# ===========================================================================
#  PLAYER / TEAM CACHE
# ===========================================================================

_players = []
_teams   = []


def load_cache():
    global _players, _teams
    print("[*] Loading player + team data from Supabase ...")
    try:
        _players = supa_get("players", {"select": "id,name,team_id,position"})
        _teams   = supa_get("teams",   {"select": "id,name,short_name"})
        print(f"    {len(_players)} players, {len(_teams)} teams")
    except Exception as e:
        print(f"  [!] Failed to load cache: {e}")
        sys.exit(1)


def _sim(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _find_player(name, team_hint=""):
    """Return the best-matching player dict from _players, or None."""
    if not name or not _players:
        return None
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
            s *= 1.3          # boost same-team matches
        if s > best_s:
            best_s, best_p = s, p
    return best_p if best_s >= 0.65 else None


def find_player_id(name, team_hint=""):
    p = _find_player(name, team_hint)
    return p["id"] if p else None


def find_player_position(name, team_hint=""):
    """Return the player's position (GK/DEF/MID/FWD) or None."""
    p = _find_player(name, team_hint)
    return p["position"] if p else None


# ===========================================================================
#  ACTIVE ROSTER TRACKER
# ===========================================================================

class ActiveRoster:
    """
    Tracks which players are currently on the pitch for each side.
    Maintains two sets: home and away.  Updates on substitutions.
    Can resolve the current GK for either side via the Supabase cache.
    """

    def __init__(self, starters, match_ctx):
        """
        starters : dict with keys 'home' and 'away', each a list of names.
        match_ctx: dict with keys 'home' and 'away' (team display names).
        """
        self.home_team = match_ctx.get("home", "")
        self.away_team = match_ctx.get("away", "")
        self.home = set(starters.get("home", [])) if starters else set()
        self.away = set(starters.get("away", [])) if starters else set()
        self._original_home = list(starters.get("home", [])) if starters else []
        self._original_away = list(starters.get("away", [])) if starters else []

    # ---- mutations --------------------------------------------------------

    def sub(self, team_name, player_in, player_out):
        """Process a substitution: remove player_out, add player_in."""
        roster = self._roster_for(team_name)
        if roster is not None:
            if player_out and player_out in roster:
                roster.remove(player_out)
            if player_in:
                roster.add(player_in)

    # ---- queries ----------------------------------------------------------

    def on_pitch(self, team_name):
        """Return the set of player names currently on the pitch for a team."""
        r = self._roster_for(team_name)
        return r if r is not None else set()

    def active_starters(self):
        """Return the union of both rosters (players still on the pitch)."""
        return self.home | self.away

    def was_starter(self, name):
        return name in self._original_home or name in self._original_away

    def team_for_starter(self, name):
        if name in self._original_home:
            return self.home_team
        if name in self._original_away:
            return self.away_team
        return ""

    def opposing_team(self, team_name):
        """Return the opposing team's display name."""
        if self._matches(team_name, self.home_team):
            return self.away_team
        if self._matches(team_name, self.away_team):
            return self.home_team
        return ""

    def active_gk(self, team_name):
        """
        Return (name, player_id) of the GK currently on the pitch for
        the given team, by cross-referencing roster names with the
        Supabase _players cache.
        """
        roster = self.on_pitch(team_name)
        for name in roster:
            pos = find_player_position(name, team_name)
            if pos == "GK":
                pid = find_player_id(name, team_name)
                return name, pid
        return None, None

    # ---- internals --------------------------------------------------------

    def _roster_for(self, team_name):
        if self._matches(team_name, self.home_team):
            return self.home
        if self._matches(team_name, self.away_team):
            return self.away
        return None

    @staticmethod
    def _matches(a, b):
        """Flexible team-name comparison (case-insensitive, substring)."""
        al, bl = a.lower().strip(), b.lower().strip()
        return al == bl or al in bl or bl in al


# ===========================================================================
#  PHASE 1 -- FIND LIVE MATCHES
# ===========================================================================

def get_live_match(page):
    """
    Search for a match currently marked as 'LIVE' on the summary page.
    Returns dict: {home, away, url}
    """
    print(f"[*] Checking {BOTOLA_URL} for live matches...")
    page.goto(BOTOLA_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(4_000)

    try:
        page.wait_for_selector(".event__match", timeout=12_000)
    except PWTimeout:
        return None

    match = page.evaluate(r"""
    () => {
        const liveRows = document.querySelectorAll('.event__match--live');
        if (!liveRows.length) return null;

        const row = liveRows[0];
        const parts = row.querySelectorAll('.event__participant');
        const home  = parts[0] ? parts[0].textContent.trim() : '';
        const away  = parts[1] ? parts[1].textContent.trim() : '';
        
        const link = row.querySelector('a[href]');
        const url  = link ? link.href : '';

        return { home, away, url };
    }
    """)
    return match


# ===========================================================================
#  PHASE 2 -- LINEUPS & SUBSTITUTIONS
# ===========================================================================

def scrape_lineups(page, match_url):
    """
    Navigate to the Lineups tab and extract the starting 11 for both teams.
    Returns: { 'home': [names], 'away': [names] }
    """
    lineups_url = match_url.rstrip("/") + "/lineups/"
    print(f"[*] Scraping lineups from {lineups_url} ...")
    try:
        page.goto(lineups_url, wait_until="domcontentloaded")
        page.wait_for_timeout(4_000)
    except Exception as e:
        print(f"  [!] Could not load lineups: {e}")
        return None

    return page.evaluate(r"""
    () => {
        const starters = { home: [], away: [] };
        
        // 1. Helper to find element by text
        const findByText = (text, selector = '*') => {
             return Array.from(document.querySelectorAll(selector))
                 .find(el => el.textContent.trim().toUpperCase() === text.toUpperCase());
        };

        // 2. Wait for the STARTING LINEUPS header
        const starterHeader = findByText('STARTING LINEUPS', '.wcl-categoryHeader_4XfR3, .wcl-title_78-X8, div');
        
        if (starterHeader) {
            // Find the container block
            const parent = starterHeader.closest('.wcl-content_vE8-B') || document;
            
            // Home side (usually left)
            const homePlayers = parent.querySelectorAll('[class*="home_"] [class*="nameWrapper"]');
            homePlayers.forEach(el => starters.home.push(el.textContent.trim()));
            
            // Away side (usually right)
            const awayPlayers = parent.querySelectorAll('[class*="away_"] [class*="nameWrapper"]');
            awayPlayers.forEach(el => starters.away.push(el.textContent.trim()));
        }
        
        // Final fallback: if names are still empty, just grab first 22 nameWrappers on page
        if (!starters.home.length) {
            const allNames = Array.from(document.querySelectorAll('[class*="nameWrapper"]')).map(el => el.textContent.trim());
            // This is risky but better than 0. We'll take first 11 as Home, next 11 as Away
            if (allNames.length >= 22) {
                starters.home = allNames.slice(0, 11);
                starters.away = allNames.slice(11, 22);
            }
        }
        
        return starters;
    }
    """)


# ===========================================================================
#  PHASE 2 -- SCRAPE LIVE EVENTS FROM A MATCH PAGE
# ===========================================================================

def scrape_events(page, url):
    """
    Navigate to a Flashscore match page and return all events found.
    Each event: {player, assist, event_type, minute, team}
    """
    try:
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(4_000)
    except Exception as e:
        print(f"  [!] Could not load {url}: {e}")
        return []

    return page.evaluate(r"""
    () => {
        const out = [];

        // Team names for attribution
        const hEl = document.querySelector(
            '.duelParticipant__home .participant__participantName'
        );
        const aEl = document.querySelector(
            '.duelParticipant__away .participant__participantName'
        );
        const homeTeam = hEl ? hEl.textContent.trim() : '';
        const awayTeam = aEl ? aEl.textContent.trim() : '';

        function side(el) {
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
                if (!text || text.length > 300) return;

                let evType = null;
                let isOwnGoal = false;
                let isPenaltyMiss = false;

                // ---- Penalty miss detection ----
                // Flashscore marks missed/saved penalties with specific icons
                // and text like "Penalty - Missed" or "(Missed penalty)"
                if (html.includes('penaltymissed') || html.includes('penalty-missed')
                    || html.includes('missedpenalty')
                    || (textLower.includes('penalty') && (textLower.includes('missed') || textLower.includes('saved')))
                    || (html.includes('penalty') && html.includes('missed'))) {
                    isPenaltyMiss = true;
                    evType = 'penalty_miss';
                }
                // ---- Goal detection (including own goal) ----
                else if (html.includes('soccer-ball') || html.includes('goal') ||
                    (html.includes('footballorange') && !html.includes('yellow'))) {
                    // Check for own goal
                    if (textLower.includes('own goal') || textLower.includes('(og)')
                        || html.includes('own-goal') || html.includes('owngoal')) {
                        isOwnGoal = true;
                        evType = 'own_goal';
                    } else {
                        evType = 'goal';
                    }
                }
                // ---- Card detection ----
                else if (html.includes('yellowred') || html.includes('yellow-red'))
                    evType = 'red_card';
                else if (html.includes('yellow'))
                    evType = 'yellow_card';
                else if (html.includes('redcard') || html.includes('red-card') ||
                         (html.includes('card') && html.includes('red')))
                    evType = 'red_card';
                // ---- Substitution detection ----
                else if (html.includes('substitution') || html.includes('replacement'))
                    evType = 'substitution';

                if (!evType) return;

                const mm = text.match(/(\d{1,3}['`+]?\+?\d*)/);
                const minute = mm ? mm[0].trim() : '';

                const links = row.querySelectorAll('a');
                if (evType === 'substitution') {
                    // Player IN is usually the first name without subDown class
                    // Player OUT has .smv__subDown class
                    const outEl = row.querySelector('.smv__subDown');
                    const playerOut = outEl ? outEl.textContent.trim() : '';

                    const inEl = Array.from(links).find(a => !a.classList.contains('smv__subDown'));
                    const playerIn = inEl ? inEl.textContent.trim() : '';

                    const team = side(row);
                    if (playerIn) {
                        out.push({
                            player: playerIn,
                            player_out: playerOut,
                            event_type: 'substitution',
                            minute,
                            team
                        });
                    }
                } else {
                    const player = links[0] ? links[0].textContent.trim() : '';
                    let assist = '';

                    // Own goals and penalty misses don't have assists
                    if (evType === 'goal') {
                        assist = links.length >= 2 ? links[1].textContent.trim() : '';
                        if (!assist) {
                            const am = text.match(/\(([^)]+)\)/);
                            if (am && !am[1].toLowerCase().includes('og')
                                   && !am[1].toLowerCase().includes('own goal')
                                   && !am[1].toLowerCase().includes('penalty')) {
                                assist = am[1].trim();
                            }
                        }
                    }

                    const team = side(links[0] || row);

                    if (player) {
                        out.push({ player, assist, event_type: evType, minute, team });
                    }
                }
            });

        return out;
    }
    """)


# ===========================================================================
#  PHASE 3 -- PUSH TO SUPABASE
# ===========================================================================

def _goal_points(player_name, team_hint):
    """Return point value for a goal based on the player's position."""
    pos = find_player_position(player_name, team_hint)
    pts = GOAL_PTS_BY_POS.get(pos, 4)   # default to FWD (4) if unknown
    return pts


def push_events(events, match_ctx):
    rows = []
    today_iso = date.today().isoformat()

    for ev in events:
        pid   = find_player_id(ev["player"], ev.get("team", ""))
        etype = ev["event_type"]

        # Calculate points based on event type
        if etype == "goal":
            pts = _goal_points(ev["player"], ev.get("team", ""))
        else:
            pts = PTS.get(etype, 0)

        rows.append({
            "player_name":     ev["player"],
            "player_id":       pid,
            "team_name":       ev.get("team", ""),
            "event_type":      etype,
            "points":          pts,
            "minute":          ev.get("minute", ""),
            "match_home_team": match_ctx.get("home", ""),
            "match_away_team": match_ctx.get("away", ""),
            "match_date":      today_iso,
        })

        # Auto-create an assist event when a goal has an assist
        if etype == "goal" and ev.get("assist"):
            aid = find_player_id(ev["assist"], ev.get("team", ""))
            rows.append({
                "player_name":     ev["assist"],
                "player_id":       aid,
                "team_name":       ev.get("team", ""),
                "event_type":      "assist",
                "points":          PTS["assist"],
                "minute":          ev.get("minute", ""),
                "match_home_team": match_ctx.get("home", ""),
                "match_away_team": match_ctx.get("away", ""),
                "match_date":      today_iso,
            })

    if rows:
        result = supa_insert("player_live_points", rows)
        if result:
            # Create a nice summary string for the terminal
            summary_parts = []
            for r in rows:
                p_name = r.get("player_name", "Unknown")
                pts_val = r.get("points", 0)
                etype_label = r["event_type"].replace('_', ' ').title()
                summary_parts.append(f"{etype_label}: {p_name} +{pts_val}pts")
            
            print(f"    [PUSHED] {' | '.join(summary_parts)}")
        else:
            print(f"    [!] Failed to push {len(rows)} events to player_live_points")
    return rows


# ===========================================================================
#  DE-DUPLICATION
# ===========================================================================

def ekey(ev, match):
    return (
        match.get("home", ""),
        match.get("away", ""),
        ev["player"],
        ev["event_type"],
        ev.get("minute", ""),
    )


# ===========================================================================
#  LIVE POLLING LOOP
# ===========================================================================

def polling_loop(page, match_ctx, starters=None, max_polls=None):
    """
    Poll the match page every POLL_SECS, detect new events, push them to Supabase.
    Exits when the match finishes or max_polls is reached.
    """
    seen = set()
    poll_count = 0

    # ---- Active Roster ----------------------------------------------------
    roster = ActiveRoster(starters, match_ctx)
    print(f"   [ROSTER] Home pitch: {len(roster.home)} players")
    print(f"   [ROSTER] Away pitch: {len(roster.away)} players")
    gk_home, _ = roster.active_gk(match_ctx["home"])
    gk_away, _ = roster.active_gk(match_ctx["away"])
    print(f"   [ROSTER] Home GK: {gk_home or '?'}  |  Away GK: {gk_away or '?'}")

    awarded_60_min = False

    # Get into match summary if not already there
    if page.url.rstrip("/") != match_ctx["url"].rstrip("/"):
        page.goto(match_ctx["url"], wait_until="domcontentloaded")

    while True:
        poll_count += 1
        now_str = datetime.now(TZ).strftime("%H:%M:%S")
        label   = f"{match_ctx['home']} vs {match_ctx['away']}"
        print(f"\n-- Poll #{poll_count} @ {now_str}  [{label}] ", "-" * 30)

        # 1. Scrape Events
        events = scrape_events(page, match_ctx["url"])
        new = [e for e in events if ekey(e, match_ctx) not in seen]

        print(f"   {len(events)} event(s) on page, {len(new)} new")

        for ev in new:
            etype = ev["event_type"]

            # ---- Substitution -------------------------------------------------
            if etype == "substitution":
                player_in  = ev["player"]
                player_out = ev.get("player_out")
                team       = ev.get("team", "")

                # Update Active Roster
                roster.sub(team, player_in, player_out)

                print(f"   >> {ev['minute']:>5}  SUB IN  {player_in:<25}  (+1 appearance)")
                if player_out:
                    print(f"             SUB OUT {player_out:<25}")

                # Log updated GK if relevant
                new_gk, _ = roster.active_gk(team)
                if new_gk:
                    print(f"             Active GK ({team}): {new_gk}")

                # Push appearance point for sub in
                push_events([{
                    "player": player_in,
                    "event_type": "appearance",
                    "minute": ev["minute"],
                    "team": team,
                }], match_ctx)

            # ---- Penalty miss → auto-generate penalty_save -------------------
            elif etype == "penalty_miss":
                miss_team = ev.get("team", "")
                opp_team  = roster.opposing_team(miss_team)

                # Credit the shooter with -2
                pts  = PTS["penalty_miss"]
                pid  = find_player_id(ev["player"], miss_team)
                tag  = "MATCHED" if pid else "NO MATCH"
                print(
                    f"   >> {ev['minute']:>5}  "
                    f"{'PENALTY MISS':14}  "
                    f"{ev['player']:<25}  {pts} pts  [{tag}]"
                )
                push_events([ev], match_ctx)

                # Find the opposing team's active GK and award +5
                gk_name, gk_id = roster.active_gk(opp_team)
                if gk_name:
                    save_ev = {
                        "player":     gk_name,
                        "event_type": "penalty_save",
                        "minute":     ev.get("minute", ""),
                        "team":       opp_team,
                    }
                    save_tag = "MATCHED" if gk_id else "NO MATCH"
                    print(
                        f"             PENALTY SAVE    "
                        f"{gk_name:<25}  +{PTS['penalty_save']} pts  [{save_tag}]"
                    )
                    push_events([save_ev], match_ctx)
                    # Add to seen so we don't duplicate
                    seen.add(ekey(save_ev, match_ctx))
                else:
                    print(
                        f"  [!] Could not identify active GK for {opp_team} "
                        f"-- penalty_save NOT awarded"
                    )

            # ---- All other events (goal, own_goal, cards) ---------------------
            else:
                if etype == "goal":
                    pts = _goal_points(ev["player"], ev.get("team", ""))
                    pos = find_player_position(ev["player"], ev.get("team", "")) or "?"
                else:
                    pts = PTS.get(etype, 0)
                    pos = ""
                sign = "+" if pts > 0 else ""
                pid  = find_player_id(ev["player"], ev.get("team", ""))
                tag  = "MATCHED" if pid else "NO MATCH"
                pos_tag = f" ({pos})" if pos else ""
                print(
                    f"   >> {ev['minute']:>5}  "
                    f"{etype.upper():14}  "
                    f"{ev['player']:<25}{pos_tag}  {sign}{pts} pts  [{tag}]"
                )
                if ev.get("assist") and etype == "goal":
                    print(
                        f"             ASSIST          "
                        f"{ev['assist']:<25}  +{PTS['assist']} pts"
                    )
                push_events([ev], match_ctx)

            seen.add(ekey(ev, match_ctx))

        # 2. Monitor Match Minute for 60' points
        try:
            status_el = page.locator(".detailMS__status, .fixedHeaderDuel__detailStatus").first
            if status_el.is_visible(timeout=2_000):
                status_text = (status_el.text_content() or "").strip()

                should_award = False
                if any(w in status_text.lower() for w in ("finished", "ft", "ended", "aet")):
                    should_award = True
                else:
                    minute_match = re.search(r'(\d+)', status_text)
                    if minute_match:
                        match_minute = int(minute_match.group(1))
                        if match_minute >= 60:
                            should_award = True

                if not awarded_60_min and should_award:
                    still_on = roster.active_starters()
                    # Only award to players who were original starters
                    eligible = [n for n in still_on if roster.was_starter(n)]
                    print(f"\n   [60-MINUTE MARK / END] Awarding points to {len(eligible)} starters who played 60 mins...")
                    events_to_push = []
                    for s_name in eligible:
                        team_name = roster.team_for_starter(s_name)
                        events_to_push.append({
                            "player": s_name,
                            "event_type": "played_60_mins",
                            "minute": "60'",
                            "team": team_name,
                        })
                    if events_to_push:
                        push_events(events_to_push, match_ctx)
                    awarded_60_min = True
        except Exception as e:
            print(f"  [!] Error checking match minute: {e}")

        # 3. Check for match finished
        try:
            st = page.locator(".fixedHeaderDuel__detailStatus")
            if st.is_visible(timeout=2_000):
                txt = (st.text_content() or "").lower()
                if any(w in txt for w in ("finished", "ended", "after")):
                    print(f"\n   [DONE] Match finished!")
                    return
        except Exception:
            pass

        if max_polls and poll_count >= max_polls:
            print(f"\n   [DEBUG] Reached {max_polls} poll(s). Stopping.")
            return

        print(f"   Next poll in {POLL_SECS}s ...")
        time.sleep(POLL_SECS)


# ===========================================================================
#  MAIN
# ===========================================================================

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\n[ERROR] Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env\n")
        sys.exit(1)

    print("=" * 62)
    print("  Botola Fantasy -- Live Runner")
    now = datetime.now(TZ)
    print(f"  {now.strftime('%A %d %B %Y  %H:%M')}")
    if DEBUG_MODE:
        print("  >>> DEBUG MODE ON <<<")
    print("=" * 62)

    load_cache()

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

        # -- cookies -------------------------------------------------------
        try:
            page.goto("https://www.flashscore.com", wait_until="domcontentloaded")
            page.wait_for_timeout(2_000)
            btn = page.locator("#onetrust-accept-btn-handler")
            if btn.is_visible(timeout=4_000):
                btn.click()
                page.wait_for_timeout(800)
        except PWTimeout:
            pass

        # DEBUG MODE
        if DEBUG_MODE:
            print(f"\n[DEBUG] Testing with: {DEBUG_MATCH['home']} vs {DEBUG_MATCH['away']}")
            # 1. Scrape Lineups
            starters = scrape_lineups(page, DEBUG_MATCH["url"])
            if starters:
                print(f"[DEBUG] Found {len(starters['home'])} Home and {len(starters['away'])} Away starters.")
                # Push appearance points
                starter_events = []
                for s in starters['home']: 
                    starter_events.append({"player": s, "event_type": "appearance", "minute": "0'", "team": DEBUG_MATCH['home']})
                for s in starters['away']:
                    starter_events.append({"player": s, "event_type": "appearance", "minute": "0'", "team": DEBUG_MATCH['away']})
                push_events(starter_events, DEBUG_MATCH)
                
            polling_loop(page, DEBUG_MATCH, starters=starters, max_polls=2)
            browser.close()
            return

        # NORMAL MODE: Find LIVE matches
        live_match = get_live_match(page)

        if not live_match:
            print("\nNo live matches right now.\n")
            browser.close()
            return

        print(f"\n[*] Found LIVE match: {live_match['home']} vs {live_match['away']}")
        
        # 1. Scrape Lineups
        starters = scrape_lineups(page, live_match['url'])
        if starters:
            print(f"[*] Found lineups. Pushing appearance points for 22 starters...")
            starter_events = []
            for s in starters['home']: 
                starter_events.append({"player": s, "event_type": "appearance", "minute": "0'", "team": live_match['home']})
            for s in starters['away']:
                starter_events.append({"player": s, "event_type": "appearance", "minute": "0'", "team": live_match['away']})
            push_events(starter_events, live_match)

        print(f"[*] Starting live polling loop...\n")

        try:
            polling_loop(page, live_match, starters=starters)
        except KeyboardInterrupt:
            print("\n[*] Stopped.\n")
        finally:
            browser.close()

    print("[*] Live runner complete.\n")


if __name__ == "__main__":
    main()