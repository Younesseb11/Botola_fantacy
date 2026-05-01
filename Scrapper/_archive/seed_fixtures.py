"""
seed_fixtures.py
─────────────────────────────────────────────────────────────────────────────
Scrapes upcoming Botola Pro fixtures from Flashscore using Playwright,
then upserts them into the Supabase `fixtures` table via the REST API
(uses only `requests` + `playwright` — no heavy supabase SDK needed).

Usage:
    py seed_fixtures.py

One-time setup:
    py -m pip install playwright python-dotenv requests
    py -m playwright install chromium

Environment variables — create a file called .env in the Scrapper/ folder:
    SUPABASE_URL          – e.g. https://xyzxyz.supabase.co
    SUPABASE_SERVICE_KEY  – service-role key (bypasses RLS for writes)
    GAMEWEEK              – (optional) integer override, e.g. 28
"""

import os
import re
import sys
import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo  # built-in since Python 3.9

import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# ─── Config ───────────────────────────────────────────────────────────────────

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
GAMEWEEK_OVERRIDE = os.getenv("GAMEWEEK", "").strip()

FIXTURES_URL = "https://www.flashscore.com/football/morocco/botola-pro/fixtures/"
TIMEZONE = "Africa/Casablanca"  # UTC+1, used when emulating the browser locale

# ─── Team name aliases ────────────────────────────────────────────────────────
# Maps every known Flashscore label → our exact DB team name.
# Add entries here if the script warns "unmapped team".
TEAM_NAME_ALIASES: dict[str, str] = {
    # Exact DB names
    "FAR Rabat":            "FAR Rabat",
    "Maghreb Fez":          "Maghreb Fez",
    "Olympique de Safi":    "Olympique de Safi",
    "Wydad AC":             "Wydad AC",
    "Dcheira":              "Dcheira",
    "Berkane":              "Berkane",
    "Difaa El Jadidi":      "Difaa El Jadidi",
    "Hassania Agadir":      "Hassania Agadir",
    "IR Tanger":            "IR Tanger",
    "FUS Rabat":            "FUS Rabat",
    "Renaissance Zemamra":  "Renaissance Zemamra",
    "Raja Casablanca":      "Raja Casablanca",
    "Yacoub El Mansour":    "Yacoub El Mansour",
    "Union Touarga":        "Union Touarga",
    "COD Meknes":           "COD Meknes",
    "Kawkab Marrakech":     "Kawkab Marrakech",
    # Flashscore alternates / abbreviations
    "Wydad Athletic":       "Wydad AC",
    "Wydad Casablanca":     "Wydad AC",
    "WAC":                  "Wydad AC",
    "Raja":                 "Raja Casablanca",
    "FAR":                  "FAR Rabat",
    "FUS":                  "FUS Rabat",
    "MAS Fez":              "Maghreb Fez",
    "MAS":                  "Maghreb Fez",
    "OCS":                  "Olympique de Safi",
    "Olympique Safi":       "Olympique de Safi",
    "RS Berkane":           "Berkane",
    "RSB":                  "Berkane",
    "Difaa Jadida":         "Difaa El Jadidi",
    "HUSA":                 "Hassania Agadir",
    "Hassania USAM":        "Hassania Agadir",
    "IRT":                  "IR Tanger",
    "Ittihad Riadi Tanger": "IR Tanger",
    "RCAZ":                 "Renaissance Zemamra",
    "Renaissance Chaouia":  "Renaissance Zemamra",
    "YMR":                  "Yacoub El Mansour",
    "Union Touarga SC":     "Union Touarga",
    "UTS":                  "Union Touarga",
    "COD":                  "COD Meknes",
    "CODM":                 "COD Meknes",
    "KACM":                 "Kawkab Marrakech",
    "Kawkab":               "Kawkab Marrakech",
    "Dcheira IH":           "Dcheira",
    "DHJ":                  "Dcheira",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def normalise_team(name: str) -> str | None:
    """Return canonical DB team name or None if no alias found."""
    name = name.strip()
    if name in TEAM_NAME_ALIASES:
        return TEAM_NAME_ALIASES[name]
    lower = name.lower()
    for alias, canonical in TEAM_NAME_ALIASES.items():
        if alias.lower() in lower or lower in alias.lower():
            return canonical
    return None


def parse_datetime(date_str: str, time_str: str) -> str | None:
    """
    Build an ISO 8601 timestamp from Flashscore date + time strings.
    date_str examples: '12.04.'  '12.04.2026'
    time_str examples: '15:00'
    Returns e.g. '2026-04-12T15:00:00+01:00'
    """
    try:
        year = datetime.now().year
        date_clean = date_str.rstrip(".")
        # Remove a 4-digit year if already present, we'll add it ourselves
        parts = date_clean.split(".")
        if len(parts) == 3 and len(parts[2]) == 4:
            year = int(parts[2])
            date_clean = f"{parts[0]}.{parts[1]}"
        dt_naive = datetime.strptime(f"{date_clean}.{year} {time_str}", "%d.%m.%Y %H:%M")
        tz = ZoneInfo(TIMEZONE)
        return dt_naive.replace(tzinfo=tz).isoformat()
    except (ValueError, KeyError):
        return None


def detect_gameweek(raw_fixtures: list[dict]) -> int:
    if GAMEWEEK_OVERRIDE.isdigit():
        return int(GAMEWEEK_OVERRIDE)
    for f in raw_fixtures:
        label = f.get("gameweek_label") or ""
        m = re.search(r"(\d+)", label)
        if m:
            return int(m.group(1))
    return 1


# ─── Supabase REST helpers (no SDK) ──────────────────────────────────────────

def supa_headers() -> dict:
    return {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    }


def load_team_map() -> dict[str, str]:
    """Return {team_name: uuid, short_name: uuid} from Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/teams?select=id,name,short_name"
    resp = requests.get(url, headers=supa_headers(), timeout=15)
    resp.raise_for_status()
    mapping: dict[str, str] = {}
    for row in resp.json():
        mapping[row["name"].strip()]       = row["id"]
        mapping[row["short_name"].strip()] = row["id"]
    return mapping


def upsert_fixtures(records: list[dict]) -> list[dict]:
    """
    Upsert into fixtures using the REST API.
    ON CONFLICT (home_team_id, gameweek) → update match_date + status.
    """
    url = f"{SUPABASE_URL}/rest/v1/fixtures"
    headers = supa_headers()
    # PostgREST upsert with resolution on the unique DB constraint
    headers["Prefer"] = "resolution=merge-duplicates,return=representation"

    resp = requests.post(url, headers=headers, json=records, timeout=30)
    if resp.status_code not in (200, 201):
        print(f"[ERROR] Supabase returned {resp.status_code}: {resp.text}")
        resp.raise_for_status()
    return resp.json()


# ─── Scraper ──────────────────────────────────────────────────────────────────

def scrape_fixtures() -> list[dict]:
    """Use Playwright to render Flashscore and extract fixture rows."""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            timezone_id=TIMEZONE,
            locale="en-GB",
        )
        page = context.new_page()
        page.set_default_timeout(20_000)

        # Accept cookies on the homepage first (sets the cookie for all pages)
        try:
            page.goto("https://www.flashscore.com", wait_until="domcontentloaded")
            page.wait_for_timeout(2_000)
            btn = page.locator("#onetrust-accept-btn-handler")
            if btn.is_visible(timeout=4_000):
                btn.click()
                page.wait_for_timeout(800)
                print("[*] Cookie banner dismissed")
        except PWTimeout:
            pass

        print(f"[*] Loading {FIXTURES_URL}")
        page.goto(FIXTURES_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(4_000)

        # Wait for at least one match row
        try:
            page.wait_for_selector(".event__match", timeout=12_000)
        except PWTimeout:
            print("[!] Timed out waiting for .event__match — saving debug screenshot")
            page.screenshot(path="debug_fixtures.png")
            browser.close()
            return []

        raw: list[dict] = page.evaluate(r"""
        () => {
            const results = [];
            let currentDate = null;
            let currentRound = null;

            // The fixture page renders a flat list inside a container
            const allNodes = document.querySelectorAll(
                '[class*="event__round"], [class*="event__header"], .event__match'
            );

            allNodes.forEach(node => {
                const cls = node.className || '';

                // ── Round header (gameweek label) ────────────────────────────
                if (cls.includes('event__round')) {
                    currentRound = node.textContent.trim();
                    return;
                }

                // ── Date header ("Tuesday 12.04.2026") ───────────────────────
                if (cls.includes('event__header') || cls.includes('wclLeagueHeader')) {
                    const txt = node.textContent.trim();
                    const m = txt.match(/(\d{2}\.\d{2}\.(?:\d{4})?)/);
                    if (m) currentDate = m[1];
                    return;
                }

                // ── Match row ────────────────────────────────────────────────
                if (!cls.includes('event__match')) return;

                // Skip live/finished rows (should not appear on fixtures page, but guard anyway)
                if (cls.includes('--live') || cls.includes('--finished')) return;

                const timeEl = node.querySelector('.event__time');
                let timeRaw  = timeEl ? timeEl.textContent.trim() : '';

                // Some rows embed date in the time cell: "12.04.  15:00"
                let dateStr = currentDate || '';
                let timeStr = timeRaw;

                const combinedMatch = timeRaw.match(/(\d{2}\.\d{2}\.?\d*)\s+(\d{2}:\d{2})/);
                if (combinedMatch) {
                    dateStr = combinedMatch[1];
                    timeStr = combinedMatch[2];
                } else if (!/^\d{2}:\d{2}$/.test(timeRaw)) {
                    // Unexpected format — skip
                    return;
                }

                // Home/away participant names
                // Flashscore uses slightly different class names over time:
                const homeEl = node.querySelector(
                    '.event__homeParticipant, [class*="homeParticipant"], [class*="Home"] .event__participant'
                );
                const awayEl = node.querySelector(
                    '.event__awayParticipant, [class*="awayParticipant"], [class*="Away"] .event__participant'
                );

                // As a last resort grab the first two .event__participant spans
                const participants = node.querySelectorAll('.event__participant');
                const homeText = (homeEl || participants[0] || {}).textContent?.trim() || '';
                const awayText = (awayEl || participants[1] || {}).textContent?.trim() || '';

                if (homeText && awayText && timeStr && dateStr) {
                    results.push({
                        home_team:      homeText,
                        away_team:      awayText,
                        date:           dateStr,
                        time:           timeStr,
                        gameweek_label: currentRound,
                    });
                }
            });

            return results;
        }
        """)

        browser.close()

    print(f"[*] Raw fixture rows from Flashscore: {len(raw)}")
    return raw


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(
            "\n[ERROR] Missing credentials.\n"
            "Create Scrapper\\.env with:\n\n"
            "    SUPABASE_URL=https://xxxx.supabase.co\n"
            "    SUPABASE_SERVICE_KEY=eyJ...\n"
        )
        sys.exit(1)

    print("=" * 60)
    print("  Botola Fantasy — Fixture Seeder")
    print("=" * 60)

    # 1. Scrape
    raw_fixtures = scrape_fixtures()
    if not raw_fixtures:
        print("[!] No fixtures found. Try again later or check debug_fixtures.png")
        sys.exit(0)

    # 2. Load teams from DB
    print("\n[*] Fetching team list from Supabase...")
    db_team_map = load_team_map()
    print(f"    {len(db_team_map)} team entries loaded")

    # 3. Detect gameweek
    gameweek = detect_gameweek(raw_fixtures)
    print(f"[*] Gameweek: {gameweek}")

    # 4. Resolve each fixture
    print("\n[*] Resolving fixtures...")
    to_upsert: list[dict] = []
    skipped:   list[dict] = []

    for f in raw_fixtures:
        home_canonical = normalise_team(f["home_team"])
        away_canonical = normalise_team(f["away_team"])

        home_id = db_team_map.get(home_canonical) if home_canonical else None
        away_id = db_team_map.get(away_canonical) if away_canonical else None

        # Fallback: direct lookup by raw name
        if not home_id:
            home_id = db_team_map.get(f["home_team"].strip())
        if not away_id:
            away_id = db_team_map.get(f["away_team"].strip())

        match_dt = parse_datetime(f["date"], f["time"])

        errors: list[str] = []
        if not home_id:
            errors.append(f"unmapped home team: '{f['home_team']}'")
        if not away_id:
            errors.append(f"unmapped away team: '{f['away_team']}'")
        if not match_dt:
            errors.append(f"bad datetime date='{f['date']}' time='{f['time']}'")
        if home_id and away_id and home_id == away_id:
            errors.append("home and away resolved to the same ID")

        if errors:
            f["_errors"] = errors
            skipped.append(f)
            continue

        to_upsert.append({
            "home_team_id": home_id,
            "away_team_id": away_id,
            "match_date":   match_dt,
            "gameweek":     gameweek,
            "status":       "Upcoming",
        })

    # 5. Preview
    print(f"\n  ✓ Ready to insert : {len(to_upsert)}")
    print(f"  ✗ Skipped         : {len(skipped)}\n")

    reverse_map = {v: k for k, v in db_team_map.items() if len(k) > 5}
    for r in to_upsert:
        h = reverse_map.get(r["home_team_id"], r["home_team_id"])
        a = reverse_map.get(r["away_team_id"], r["away_team_id"])
        print(f"    GW{r['gameweek']:>2}  {h:<22} vs  {a:<22}  {r['match_date']}")

    if skipped:
        print("\n  ⚠ Skipped (add missing teams to TEAM_NAME_ALIASES):")
        for s in skipped:
            print(f"    {s['home_team']} vs {s['away_team']}  →  {', '.join(s['_errors'])}")

    if not to_upsert:
        print("\n[!] Nothing to insert.")
        sys.exit(0)

    # 6. Confirm
    try:
        answer = input("\nProceed with upsert? [y/N] ").strip().lower()
    except EOFError:
        answer = "y"  # non-interactive mode

    if answer != "y":
        print("Aborted.")
        sys.exit(0)

    # 7. Upsert
    result = upsert_fixtures(to_upsert)
    print(f"\n[✓] Done! {len(result)} fixture(s) upserted.")

    # 8. Save log
    log_path = os.path.join(os.path.dirname(__file__), "fixtures_seed_log.json")
    with open(log_path, "w", encoding="utf-8") as lf:
        json.dump(
            {
                "seeded_at": datetime.now(timezone.utc).isoformat(),
                "gameweek":  gameweek,
                "upserted":  to_upsert,
                "skipped":   [
                    {k: v for k, v in s.items() if k != "_errors"} | {"errors": s.get("_errors", [])}
                    for s in skipped
                ],
            },
            lf, ensure_ascii=False, indent=2, default=str,
        )
    print(f"[*] Log saved → {log_path}")


if __name__ == "__main__":
    main()
