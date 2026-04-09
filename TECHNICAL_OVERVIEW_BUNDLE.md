# 🏆 Botola Fantasy: Technical Documentation & Code Bundle

This document is a comprehensive technical guide for the Botola Fantasy project. It combines high-level architecture explanations with actual code snippets to help a developer understand the system end-to-end.

---

## 🏗️ 1. Project Vision
**Botola Fantasy** is a real-time fantasy football platform for the Moroccan Pro League. 
- **The Backend**: Monitors live matches and assigns points based on custom positional logic.
- **The Frontend**: Allows users to draft a 15-player squad within a budget and track live performance.

---

## 🗄️ 2. Database Architecture (Supabase)

Below is the core schema used to power the platform.

```sql
-- Core Player Catalog
CREATE TABLE public.players (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    team_id UUID REFERENCES teams(id),
    position TEXT CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
    price NUMERIC(4,1) NOT NULL
);

-- Real-time Event Log
CREATE TABLE public.player_live_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id),
    event_type TEXT, -- 'goal', 'assist', 'yellow_card', 'played_60_mins', etc.
    points INTEGER,
    minute TEXT,
    match_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Squad Relationship
CREATE TABLE public.squad_players (
    squad_id UUID REFERENCES user_squads(id),
    player_id UUID REFERENCES players(id),
    is_starter BOOLEAN DEFAULT FALSE,
    points_multiplier INTEGER DEFAULT 1 -- Captain support
);
```

---

## 🕷️ 3. Backend Logic: The Scraper (`live.py`)

The scraper uses **Playwright** to "watch" matches and calculate points. Here is the custom scoring logic and how it handles different positions:

```python
# Custom Fantasy Point Values
PTS = {
    "assist":          3,
    "yellow_card":    -1,
    "red_card":       -3,
    "appearance":      1,
    "played_60_mins":  1, # Bonus for staying on pitch
}

# Positional Goal Bonus
GOAL_PTS_BY_POS = {
    "GK":  10,  -- Goalkeepers get massive points for scoring
    "DEF":  6,
    "MID":  5,
    "FWD":  4,
}

# Real-time Substitution Tracking
def sub(self, team_name, player_in, player_out):
    """Update active roster so the system knows who is currently on pitch."""
    roster = self._roster_for(team_name)
    if player_out in roster:
        roster.remove(player_out)
    roster.add(player_in)
    # Log appearance point for the sub coming in
```

---

## 💻 4. Frontend Logic: The Draft Wizard (`page.tsx`)

The **Draft Wizard** ensures users stay within budget and selection quotas. Here is the core validation logic:

```typescript
const BUDGET_TOTAL = 100.0;
const LIMITS = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

const addPlayer = (player: Player) => {
  // 1. Check if already selected
  if (draft.find(p => p.id === player.id)) return;
  
  // 2. Enforce Budget
  if (remainingBudget < player.price) {
    showError("Insufficient budget!");
    return;
  }
  
  // 3. Enforce Position Limits
  if (counts[player.position] >= LIMITS[player.position]) {
    showError(`Limit reached for ${player.position}s`);
    return;
  }
  
  // 4. Update state
  setDraft([...draft, player]);
};
```

---

## 🔄 5. End-to-End Integration Flow

1.  **Real World**: A goal is scored in the Botola league.
2.  **Scraper (`live.py`)**: Detects the goal via Flashscore polling.
3.  **Fuzzy Match**: The script matches "A. Kaabi" to "Ayoub El Kaabi" in our DB.
4.  **Database**: Inserts a row into `player_live_points` with the calculated score (+10, +6, etc.).
5.  **Supabase Realtime**: Broadcasts the change to all connected clients.
6.  **Next.js Frontend**: The UI receives the message and updates the player's live performance score instantly.

---

## 🚀 6. How to Run

### Scraper
1. `cd Scrapper`
2. `pip install -r requirements.txt`
3. `python live.py` (Ensure `.env` contains your Supabase Service Key)

### Web App
1. `cd web-app`
2. `npm install`
3. `npm run dev`
