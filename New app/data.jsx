// data.jsx — Botola Pro Fantasy data layer (Supabase-backed)
// ═══════════════════════════════════════════════════════════

// ─── Supabase config ─────────────────────────────────────
const SUPABASE_URL = 'https://ndiaojnxyweibjkifvmx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaWFvam54eXdlaWJqa2lmdm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDIwODgsImV4cCI6MjA5MTA3ODA4OH0.oYd3o8dZ6t_U82N-1iMD1tXsh-o0DFvAmaiDuYdeNiI';

const sb = (table, query = '', opts = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers || {})
    },
  }).then(async r => {
    if (!r.ok) throw new Error(`Supabase ${table}: ${r.status} ${r.statusText}`);
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  });

// ─── Visual constants for teams (colors / glyphs for the crest component) ──
// These can't come from DB so we keep a local map keyed by short_name
const TEAM_VISUALS = {
  'WAC':  { primary: '#C8102E', secondary: '#ffffff', crestBg: '#C8102E', crestFg: '#ffffff', glyph: 'W', city: 'Casablanca' },
  'RAJ':  { primary: '#0E8C4A', secondary: '#ffffff', crestBg: '#0E8C4A', crestFg: '#ffffff', glyph: 'R', city: 'Casablanca' },
  'FAR':  { primary: '#1B4332', secondary: '#F5C842', crestBg: '#1B4332', crestFg: '#F5C842', glyph: 'F', city: 'Rabat' },
  'BER':  { primary: '#FF6B1A', secondary: '#0B1220', crestBg: '#FF6B1A', crestFg: '#0B1220', glyph: 'B', city: 'Berkane' },
  'MAS':  { primary: '#7A1F2B', secondary: '#F2D27A', crestBg: '#7A1F2B', crestFg: '#F2D27A', glyph: 'M', city: 'Fès' },
  'FUS':  { primary: '#0B3D91', secondary: '#ffffff', crestBg: '#0B3D91', crestFg: '#ffffff', glyph: 'U', city: 'Rabat' },
  'HUSA': { primary: '#E63946', secondary: '#ffffff', crestBg: '#E63946', crestFg: '#ffffff', glyph: 'H', city: 'Agadir' },
  'OCS':  { primary: '#0E7C66', secondary: '#ffffff', crestBg: '#0E7C66', crestFg: '#ffffff', glyph: 'S', city: 'Safi' },
  'UNI':  { primary: '#5E2BFF', secondary: '#ffffff', crestBg: '#5E2BFF', crestFg: '#ffffff', glyph: 'U', city: 'Rabat' },
  'COD':  { primary: '#2D6A4F', secondary: '#ffffff', crestBg: '#2D6A4F', crestFg: '#ffffff', glyph: 'C', city: 'Meknès' },
  'DCH':  { primary: '#D4A017', secondary: '#0B1220', crestBg: '#D4A017', crestFg: '#0B1220', glyph: 'D', city: 'Dcheira' },
  'DIF':  { primary: '#FFD700', secondary: '#006400', crestBg: '#006400', crestFg: '#FFD700', glyph: 'D', city: 'El Jadida' },
  'IR ':  { primary: '#1F6FEB', secondary: '#ffffff', crestBg: '#1F6FEB', crestFg: '#ffffff', glyph: 'I', city: 'Tanger' },
  'KAW':  { primary: '#D72638', secondary: '#ffffff', crestBg: '#D72638', crestFg: '#ffffff', glyph: 'K', city: 'Marrakech' },
  'RCAZ': { primary: '#F2C200', secondary: '#0B1220', crestBg: '#F2C200', crestFg: '#0B1220', glyph: 'Z', city: 'Zemamra' },
  'YAC':  { primary: '#4361EE', secondary: '#ffffff', crestBg: '#4361EE', crestFg: '#ffffff', glyph: 'Y', city: 'Rabat' },
};

// Default visuals for any team not in the map
const DEFAULT_VISUAL = { primary: '#888', secondary: '#fff', crestBg: '#888', crestFg: '#fff', glyph: '?', city: '' };

// ─── Mutable global state ───────────────────────────────
let CLUBS = [];
let PLAYERS = [];
let FIXTURES_GW14 = [];
let STARTING_XI = {
  formation: '4-3-3',
  GK: [], DEF: [], MID: [], FWD: [],
  bench: [],
  captain: null,
  viceCaptain: null,
};
let LEAGUES = [];
let STANDINGS = [];
let CHIPS = [
  { id: 'wc', name: 'Wildcard', desc: 'Unlimited free transfers in one gameweek.', icon: '∞', used: false, available: true },
];

const FORMATIONS = {
  '3-4-3': { DEF: 3, MID: 4, FWD: 3 },
  '3-5-2': { DEF: 3, MID: 5, FWD: 2 },
  '4-3-3': { DEF: 4, MID: 3, FWD: 3 },
  '4-4-2': { DEF: 4, MID: 4, FWD: 2 },
  '4-5-1': { DEF: 4, MID: 5, FWD: 1 },
  '5-3-2': { DEF: 5, MID: 3, FWD: 2 },
  '5-4-1': { DEF: 5, MID: 4, FWD: 1 },
};

// ─── Club lookup ─────────────────────────────────────────
const clubById = (id) => CLUBS.find(c => c.id === id);

// ─── Live points cache (keyed by player_id → {total, events[]}) ──
let LIVE_POINTS = {};

// ─── Next fixture data ──────────────────────────────────
let NEXT_FIXTURE = null;
let FEATURED_FIXTURE = null;

// ─── Gameweek config ────────────────────────────────────
let GAMEWEEK = { id: 14, deadline: null };

// ─── User Budget info ───────────────────────────────────
let USER_SQUAD_INFO = { bank: 0.5, freeTx: 2 };

// ═══════════════════════════════════════════════════════════
//  loadAllData() — single async entry point for the app
// ═══════════════════════════════════════════════════════════
window.loadAllData = async () => {
  const errors = [];

  // ── 1. Teams ────────────────────────────────────────────
  try {
    const rawTeams = await sb('teams', 'select=id,name,short_name,logo_url,primary_color,secondary_color,city&order=name');
    CLUBS = rawTeams.map(t => {
      const vis = TEAM_VISUALS[t.short_name?.trim()] || DEFAULT_VISUAL;
      return {
        id: t.id,
        name: t.name,
        short: t.short_name?.trim() || t.name.slice(0, 3).toUpperCase(),
        logo_url: t.logo_url,
        primary: t.primary_color || vis.primary,
        secondary: t.secondary_color || vis.secondary,
        crestBg: t.primary_color || vis.crestBg,
        crestFg: t.secondary_color || vis.crestFg,
        glyph: vis.glyph || t.name[0],
        city: t.city || vis.city
      };
    });
    console.log(`[data] ✓ ${CLUBS.length} teams loaded`);
  } catch (e) {
    errors.push(`Teams: ${e.message}`);
    console.error('[data] ✗ Teams fetch failed, using fallback', e);
    // Fallback: use the hardcoded visuals list as clubs
    CLUBS = Object.entries(TEAM_VISUALS).map(([short, vis]) => ({
      id: short.toLowerCase(),
      name: short,
      short,
      logo_url: null,
      ...vis,
    }));
  }

  // ── 1b. User Squads & Ownership Base ─────────────────────
  let totalSquadsCount = 1;
  let allSquadPlayers = [];
  try {
    const squads = await sb('user_squads', 'select=*');
    totalSquadsCount = Math.max(1, squads.length);
    allSquadPlayers = await sb('squad_players', 'select=player_id');
    
    // Grab budget info from first squad as fallback
    if (squads && squads.length > 0) {
      USER_SQUAD_INFO.bank = squads[0].bank !== undefined ? squads[0].bank : 0.5;
      USER_SQUAD_INFO.freeTx = squads[0].free_transfers !== undefined ? squads[0].free_transfers : 2;
    }
  } catch (e) {
    console.warn('[data] Could not fetch ownership base', e);
  }

  // ── 1c. Gameweeks ─────────────────────────────────────────
  try {
    const gws = await sb('gameweeks', 'select=*&is_current=eq.true&limit=1');
    if (gws && gws.length > 0) {
      GAMEWEEK.id = gws[0].number || 14;
      GAMEWEEK.deadline = gws[0].deadline_time;
      window.CURRENT_GW = GAMEWEEK.id;
      window.GW_DEADLINE = GAMEWEEK.deadline;
    }
  } catch (e) {
    console.warn('[data] Could not fetch gameweeks', e);
  }

  // ── 2. Players ──────────────────────────────────────────
  try {
    const rawPlayers = await sb('players', 'select=id,name,position,price,total_points,team_id,photo_url&order=total_points.desc');
    PLAYERS = rawPlayers.map((p, idx) => {
      const team = CLUBS.find(c => c.id === p.team_id);
      const ownedCount = allSquadPlayers.filter(sp => sp.player_id === p.id).length;
      const ownership = Math.round((ownedCount / totalSquadsCount) * 100) || 0;
      
      return {
        id: p.id,
        n: p.name,
        pos: p.position || 'MID',
        club: team ? team.id : (CLUBS[0]?.id || 'unknown'),
        p: p.price || 5.0,
        f: (p.total_points / 3).toFixed(1),  // form ~ recent average
        t: p.total_points || 0,
        s: ownership,
        gw: 0, // will be filled by live points
        photo_url: p.photo_url,
      };
    });
    console.log(`[data] ✓ ${PLAYERS.length} players loaded`);
  } catch (e) {
    errors.push(`Players: ${e.message}`);
    console.error('[data] ✗ Players fetch failed', e);
  }

  // ── 3. Live Points (player_live_points) ─────────────────
  try {
    const rawLive = await sb('player_live_points', 'select=player_id,player_name,team_name,event_type,points,minute&order=created_at.desc');
    // Aggregate by player_id
    LIVE_POINTS = {};
    for (const ev of rawLive) {
      if (!LIVE_POINTS[ev.player_id]) {
        LIVE_POINTS[ev.player_id] = { total: 0, events: [], name: ev.player_name, team: ev.team_name };
      }
      LIVE_POINTS[ev.player_id].total += ev.points;
      LIVE_POINTS[ev.player_id].events.push(`${ev.event_type} @ ${ev.minute} (${ev.points} pts)`);
    }
    // Merge live GW points into PLAYERS
    for (const p of PLAYERS) {
      if (LIVE_POINTS[p.id]) {
        p.gw = LIVE_POINTS[p.id].total;
      }
    }
    console.log(`[data] ✓ ${rawLive.length} live point events loaded`);
  } catch (e) {
    errors.push(`Live points: ${e.message}`);
    console.error('[data] ✗ Live points fetch failed', e);
  }

  // ── 4. Fixtures ─────────────────────────────────────────
  try {
    const rawFixtures = await sb('fixtures', 'select=id,home_team_id,away_team_id,match_date,gameweek,status,home_score,away_score&order=match_date.desc');
    // Find the latest gameweek
    const maxGw = Math.max(...rawFixtures.map(f => f.gameweek || 0), 0);
    const gwFixtures = rawFixtures.filter(f => f.gameweek === maxGw);

    FIXTURES_GW14 = gwFixtures.map(f => {
      const homeClub = CLUBS.find(c => c.id === f.home_team_id);
      const awayClub = CLUBS.find(c => c.id === f.away_team_id);
      const isLive = f.status?.toLowerCase() === 'live' || f.status?.toLowerCase() === 'in play';
      const isFT = f.status?.toLowerCase() === 'finished' || f.status?.toLowerCase() === 'ft';
      const isDerby = homeClub && awayClub &&
        ((homeClub.short === 'WAC' && awayClub.short === 'RAJ') ||
         (homeClub.short === 'RAJ' && awayClub.short === 'WAC'));
      return {
        id: f.id,
        home: homeClub?.id || f.home_team_id,
        away: awayClub?.id || f.away_team_id,
        hs: f.home_score ?? null,
        as: f.away_score ?? null,
        status: isLive ? 'LIVE' : isFT ? 'FT' : 'UPCOMING',
        minute: isLive ? 45 : (isFT ? 90 : null),
        kickoff: f.match_date ? new Date(f.match_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—',
        isDerby,
        gameweek: f.gameweek,
        match_date: f.match_date,
      };
    });
    window.CURRENT_GW = maxGw;
    console.log(`[data] ✓ ${FIXTURES_GW14.length} fixtures for GW${maxGw}`);
  } catch (e) {
    errors.push(`Fixtures: ${e.message}`);
    console.error('[data] ✗ Fixtures fetch failed', e);
  }

  // ── 5. Next Fixture & Featured ─────────────────────────
  try {
    const nf = await sb('next_fixture', 'select=*&limit=1');
    NEXT_FIXTURE = Array.isArray(nf) ? nf[0] : nf;
    console.log(`[data] ✓ Next fixture: ${NEXT_FIXTURE?.home_team} vs ${NEXT_FIXTURE?.away_team}`);
    
    // Check if we have an active featured fixture for the DerbyCard
    const featured = await sb('fixtures', 'select=*&is_featured=eq.true&status=eq.upcoming&limit=1');
    if (featured && featured.length > 0) {
      FEATURED_FIXTURE = featured[0];
    }
  } catch (e) {
    errors.push(`Next fixture: ${e.message}`);
    console.error('[data] ✗ Next fixture fetch failed', e);
  }

  // ── 6. Squad Composition ────────────────────────────────
  try {
    const comp = await sb('squad_composition', 'select=*&limit=1');
    const c = Array.isArray(comp) ? comp[0] : comp;
    if (c && c.squad_id) {
      // Derive formation from composition
      const formKey = `${c.def_starters}-${c.mid_starters}-${c.fwd_starters}`;
      if (FORMATIONS[formKey]) {
        STARTING_XI.formation = formKey;
      }
      console.log(`[data] ✓ Squad composition: ${formKey}`);
    }
  } catch (e) {
    errors.push(`Squad composition: ${e.message}`);
    console.error('[data] ✗ Squad composition fetch failed', e);
  }

  // ── 7. User Squad (squad_players) ───────────────────────
  try {
    const squadPlayers = await sb('squad_players', 'select=*');
    if (Array.isArray(squadPlayers) && squadPlayers.length > 0) {
      // If squad_players has data, use it
      const starters = squadPlayers.filter(sp => sp.is_starter || !sp.is_bench);
      const bench = squadPlayers.filter(sp => sp.is_bench);
      // Map to player IDs
      const gks = starters.filter(sp => {
        const p = PLAYERS.find(x => x.id === sp.player_id);
        return p && p.pos === 'GK';
      }).map(sp => sp.player_id);
      const defs = starters.filter(sp => {
        const p = PLAYERS.find(x => x.id === sp.player_id);
        return p && p.pos === 'DEF';
      }).map(sp => sp.player_id);
      const mids = starters.filter(sp => {
        const p = PLAYERS.find(x => x.id === sp.player_id);
        return p && p.pos === 'MID';
      }).map(sp => sp.player_id);
      const fwds = starters.filter(sp => {
        const p = PLAYERS.find(x => x.id === sp.player_id);
        return p && p.pos === 'FWD';
      }).map(sp => sp.player_id);

      STARTING_XI.GK = gks;
      STARTING_XI.DEF = defs;
      STARTING_XI.MID = mids;
      STARTING_XI.FWD = fwds;
      STARTING_XI.bench = bench.map(sp => sp.player_id);
      if (squadPlayers.find(sp => sp.is_captain)) {
        STARTING_XI.captain = squadPlayers.find(sp => sp.is_captain).player_id;
      }
      if (squadPlayers.find(sp => sp.is_vice_captain)) {
        STARTING_XI.viceCaptain = squadPlayers.find(sp => sp.is_vice_captain).player_id;
      }
      console.log(`[data] ✓ ${squadPlayers.length} squad players loaded`);
    } else {
      throw new Error('squad_players empty');
    }
  } catch (e) {
    // ── Fallback: auto-generate a starting XI from top players ──
    console.warn('[data] squad_players unavailable, building auto-squad from player list');
    _buildAutoSquad();
  }

  // ── 8. Leagues & Standings & Chips ───────────────────────
  try {
    const rawLeagues = await sb('leagues', 'select=*');
    if (Array.isArray(rawLeagues) && rawLeagues.length > 0) {
      LEAGUES = rawLeagues.map(l => ({
        id: l.id,
        name: l.name,
        rank: l.rank || Math.floor(Math.random() * 10) + 1,
        total: l.total || Math.floor(Math.random() * 100) + 10,
        delta: l.delta || 0,
        type: l.type || 'private'
      }));
      console.log(`[data] ✓ ${LEAGUES.length} leagues loaded`);
    } else {
      LEAGUES = [];
      console.log('[data] ✓ No leagues found');
    }
    
    // Dynamic Standings
    const mems = await sb('league_members', 'select=*');
    const sqds = await sb('user_squads', 'select=id,user_id,team_name,total_points');
    if (Array.isArray(mems) && Array.isArray(sqds) && mems.length > 0) {
      const usersDict = {};
      for (const s of sqds) usersDict[s.user_id] = s;
      
      const st = mems.map(m => {
        const u = usersDict[m.user_id];
        return {
          rank: 0,
          name: u?.team_name || 'Manager',
          team: u?.team_name || 'FC',
          gw: 0,
          total: u?.total_points || 0,
          you: false,
          user_id: m.user_id
        };
      }).sort((a,b) => b.total - a.total);
      
      st.forEach((s, idx) => s.rank = idx + 1);
      if (st.length > 0) st[0].badge = '👑';
      STANDINGS = st;
    } else {
      STANDINGS = [];
    }

    // Dynamic Chips
    const rawChips = await sb('user_chips', 'select=*');
    if (Array.isArray(rawChips)) {
      CHIPS = [
        { id: 'wc', name: 'Wildcard', desc: 'Unlimited free transfers in one gameweek.', icon: '∞', used: rawChips.some(c => c.chip_type === 'wildcard'), available: true },
      ];
    }
  } catch (e) {
    errors.push(`Leagues/Standings: ${e.message}`);
    console.error('[data] ✗ Leagues fetch failed', e);
  }

  // ── 9. Scrapper fallback: fill GW points if live_points was empty ──
  if (Object.keys(LIVE_POINTS).length === 0 && PLAYERS.every(p => p.gw === 0)) {
    try {
      await _loadScrapperFallback();
    } catch (e) {
      console.warn('[data] Scrapper fallback also unavailable', e);
    }
  }

  // ── Build TOP_PERFORMERS ───────────────────────────────
  const sorted = [...PLAYERS].sort((a, b) => b.gw - a.gw || b.t - a.t);
  window.TOP_PERFORMERS = sorted.slice(0, 5);

  // ── Expose everything globally ─────────────────────────
  Object.assign(window, {
    CLUBS, clubById, PLAYERS, STARTING_XI, FORMATIONS,
    FIXTURES_GW14, LEAGUES, STANDINGS, CHIPS,
    LIVE_POINTS, NEXT_FIXTURE, FEATURED_FIXTURE, GAMEWEEK, USER_SQUAD_INFO, sb
  });

  if (errors.length > 0) {
    console.warn(`[data] Completed with ${errors.length} warning(s):\n  • ${errors.join('\n  • ')}`);
  } else {
    console.log('[data] ✓ All data loaded successfully from Supabase');
  }

  return { errors };
};

// ─── Auto-generate a squad from top available players ────
function _buildAutoSquad() {
  if (PLAYERS.length === 0) return;

  const byPos = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of PLAYERS) {
    if (byPos[p.pos]) byPos[p.pos].push(p);
  }

  // Sort each position by total points descending
  for (const pos of Object.keys(byPos)) {
    byPos[pos].sort((a, b) => b.t - a.t);
  }

  // Pick based on 4-3-3
  STARTING_XI.GK  = byPos.GK.slice(0, 1).map(p => p.id);
  STARTING_XI.DEF = byPos.DEF.slice(0, 4).map(p => p.id);
  STARTING_XI.MID = byPos.MID.slice(0, 3).map(p => p.id);
  STARTING_XI.FWD = byPos.FWD.slice(0, 3).map(p => p.id);
  STARTING_XI.formation = '4-3-3';

  // Bench: next best from each position
  STARTING_XI.bench = [
    byPos.GK[1],
    byPos.DEF[4],
    byPos.MID[3],
    byPos.FWD[3],
  ].filter(Boolean).map(p => p.id);

  // Captain = highest total points overall
  const sorted = [...PLAYERS].sort((a, b) => b.t - a.t);
  STARTING_XI.captain = sorted[0]?.id || null;
  STARTING_XI.viceCaptain = sorted[1]?.id || null;
}

// ─── Scrapper JSON fallback (legacy) ─────────────────────
async function _loadScrapperFallback() {
  let res = await fetch('../Scrapper/data/gameweek_output.json');
  if (!res.ok) res = await fetch('../Scrapper/scrapper-output.json');
  if (!res.ok) throw new Error('No scrapper fallback found');
  const data = await res.json();

  console.log('[data] Using scrapper fallback for GW points');
  window.SCRAPPER_DATA = data;

  // Map scrapper player names to our PLAYERS by fuzzy name match
  const scrapperPlayers = data.players || {};
  for (const [fullKey, pData] of Object.entries(scrapperPlayers)) {
    const namePart = fullKey.split(' (')[0].trim();
    // Try to find by name similarity
    const match = PLAYERS.find(p =>
      p.n.toLowerCase().includes(namePart.toLowerCase()) ||
      namePart.toLowerCase().includes(p.n.split(' ')[0]?.toLowerCase())
    );
    if (match) {
      match.gw = pData.total || 0;
    }
  }

  // If we have no PLAYERS at all, build from scrapper
  if (PLAYERS.length === 0) {
    const clubMapping = {
      'Wydad': 'wac', 'Raja': 'rca', 'AS FAR': 'far', 'RS Berkane': 'rsb',
      'Maghreb Fez': 'mas', 'Maghreb Fès': 'mas', 'FUS Rabat': 'fus',
      'Moghreb Tétouan': 'mat', 'Hassania Agadir': 'hus', 'Olympic Safi': 'ojm',
      'JS Soualem': 'jsm', 'Chabab Mohammédia': 'cay', 'Union Touarga': 'ujs'
    };
    PLAYERS = Object.keys(scrapperPlayers).map((fullName, i) => {
      const namePart = fullName.split(' (')[0];
      const clubPart = fullName.match(/\(([^)]+)\)/)?.[1] || '';
      let clubId = CLUBS[0]?.id || 'unknown';
      for (const [key, shortId] of Object.entries(clubMapping)) {
        if (clubPart.includes(key)) {
          const club = CLUBS.find(c => c.short?.toLowerCase() === shortId || c.id === shortId);
          if (club) clubId = club.id;
          break;
        }
      }
      return {
        id: `scrp-${i}`,
        n: namePart,
        pos: namePart.includes('(G)') ? 'GK' : (i % 3 === 0 ? 'DEF' : i % 2 === 0 ? 'MID' : 'FWD'),
        club: clubId,
        p: 5.0 + (Math.random() * 4),
        f: (scrapperPlayers[fullName].total / 2).toFixed(1),
        t: scrapperPlayers[fullName].total,
        s: Math.floor(Math.random() * 20) + 5,
        gw: scrapperPlayers[fullName].total,
      };
    });
    _buildAutoSquad();
  }
}

// ─── Legacy alias (backwards compat for Botola Fantasy.html) ──
window.loadScrapperData = window.loadAllData;

// ─── Initial export ──────────────────────────────────────
Object.assign(window, { CLUBS, clubById, PLAYERS, STARTING_XI, FORMATIONS, FIXTURES_GW14, LEAGUES, STANDINGS, CHIPS });
