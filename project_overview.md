# Botola Fantasy - Project Overview

This document provides a technical summary of the Botola Fantasy project to facilitate backend-frontend integration.

## 1. Core Architecture
- **Database**: Supabase (PostgreSQL) with Realtime enabled.
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS.
- **Backend/Scrapers**: Python 3.9+ using Playwright and Requests.

---

## 2. Database Schema (Supabase)

### Key Tables
| Table | Description | Realtime |
| :--- | :--- | :--- |
| `players` | Master player list (Name, Position, Price, Team). | No |
| `teams` | Botola Pro team definitions. | No |
| `fixtures` | Match schedule with `status` (Upcoming, Live, Finished). | No |
| `player_live_points` | **Main Live Feed**: Player events and points for active games. | **Yes** |
| `user_squads` | User team metadata (Formation, Budget, Points). | No |
| `squad_players` | Players selected by each user in their squad. | No |
| `next_fixture` | Single-row table identifying the very next match. | No |

### Important Constraints
- **Positional Scoring**: Handled by `live.py` (GK=10, DEF=6, MID=5, FWD=4).
- **Event Limits**: `player_live_points` allows `goal`, `assist`, `yellow_card`, `red_card`, `appearance`, `played_60_mins`.

---

## 3. Project Structure

### `/Scrapper` (Python)
- **`live.py`**: The main live engine. Tracks active rosters and pushes points.
- **`check_schedule.py`**: Updates the countdown clock for the frontend.
- **`seed_fixtures.py`**: Initial season setup utility.
- **`botola_players.json`**: Static cache of player data for position lookups.

### `/web-app` (Next.js)
- **`/src/app`**: Pages for Home, Squad, Leagues, Profile, and Live Points.
- **`/src/components`**: Shared UI like `TopNav` and `BottomNav`.
- **`/src/lib/supabase.ts`**: Client-side initialization.
- **`/db_migrations`**: Centralized SQL scripts for schema updates.

---

## 4. Environment Configuration

### Frontend (`web-app/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Scrapers (`Scrapper/.env`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (Required for RLS bypass during writes)

---

## 5. Dependencies

### Frontend (`package.json`)
- `@supabase/supabase-js`
- `lucide-react`
- `next` (14.2.35)
- `react` / `react-dom`
- `tailwind-merge`

### Scrapers (`requirements.txt`)
- `playwright`
- `requests`
- `python-dotenv`
- `zoneinfo` (Python 3.9+)

---

## 6. Current Integration Status
- [x] Scrapers pushed to GitHub.
- [x] Database migrations organized.
- [x] Initial Next.js structure deployed.
- [ ] **Next Step**: Connect `src/app/live-points/page.tsx` to the `player_live_points` realtime stream.
