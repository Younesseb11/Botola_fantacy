// data.jsx — Botola Pro Fantasy data layer
// Real Botola Pro clubs + realistic-sounding squad

const CLUBS = [
  { id: 'wac', name: 'Wydad AC',         short: 'WAC', city: 'Casablanca',  primary: '#C8102E', secondary: '#ffffff', crestBg: '#C8102E', crestFg: '#ffffff', glyph: 'W' },
  { id: 'rca', name: 'Raja CA',          short: 'RCA', city: 'Casablanca',  primary: '#0E8C4A', secondary: '#ffffff', crestBg: '#0E8C4A', crestFg: '#ffffff', glyph: 'R' },
  { id: 'far', name: 'AS FAR',           short: 'FAR', city: 'Rabat',       primary: '#1B4332', secondary: '#F5C842', crestBg: '#1B4332', crestFg: '#F5C842', glyph: 'F' },
  { id: 'rsb', name: 'RS Berkane',       short: 'RSB', city: 'Berkane',     primary: '#FF6B1A', secondary: '#0B1220', crestBg: '#FF6B1A', crestFg: '#0B1220', glyph: 'B' },
  { id: 'mas', name: 'Maghreb Fès',      short: 'MAS', city: 'Fès',         primary: '#7A1F2B', secondary: '#F2D27A', crestBg: '#7A1F2B', crestFg: '#F2D27A', glyph: 'M' },
  { id: 'fus', name: 'FUS Rabat',        short: 'FUS', city: 'Rabat',       primary: '#0B3D91', secondary: '#ffffff', crestBg: '#0B3D91', crestFg: '#ffffff', glyph: 'U' },
  { id: 'mat', name: 'Moghreb Tétouan',  short: 'MAT', city: 'Tétouan',     primary: '#D72638', secondary: '#0B1220', crestBg: '#0B1220', crestFg: '#D72638', glyph: 'T' },
  { id: 'hus', name: 'Hassania Agadir',  short: 'HUS', city: 'Agadir',      primary: '#E63946', secondary: '#ffffff', crestBg: '#E63946', crestFg: '#ffffff', glyph: 'H' },
  { id: 'ojm', name: 'Olympic Safi',     short: 'OCS', city: 'Safi',        primary: '#0E7C66', secondary: '#ffffff', crestBg: '#0E7C66', crestFg: '#ffffff', glyph: 'S' },
  { id: 'jsm', name: 'JS Soualem',       short: 'JSS', city: 'Berrechid',   primary: '#1F6FEB', secondary: '#ffffff', crestBg: '#1F6FEB', crestFg: '#ffffff', glyph: 'J' },
  { id: 'cay', name: 'Chabab Mohammédia',short: 'SCCM',city: 'Mohammédia',  primary: '#F2C200', secondary: '#0B1220', crestBg: '#F2C200', crestFg: '#0B1220', glyph: 'C' },
  { id: 'ujs', name: 'Union Touarga',    short: 'UTS', city: 'Rabat',       primary: '#5E2BFF', secondary: '#ffffff', crestBg: '#5E2BFF', crestFg: '#ffffff', glyph: 'U' },
];

const clubById = (id) => CLUBS.find(c => c.id === id);

// We will fetch real players/fixtures from Scrapper, replacing the mock.
let PLAYERS = [];
let FIXTURES_GW14 = [];

const STARTING_XI = {
  formation: '4-3-3',
  GK:  [1],
  DEF: [14, 10, 11, 13],
  MID: [31, 30, 32],
  FWD: [50, 51, 53],
  bench: [4, 18, 39, 56],
  captain: 50,
  viceCaptain: 31,
};

const FORMATIONS = {
  '3-4-3': { DEF: 3, MID: 4, FWD: 3 },
  '3-5-2': { DEF: 3, MID: 5, FWD: 2 },
  '4-3-3': { DEF: 4, MID: 3, FWD: 3 },
  '4-4-2': { DEF: 4, MID: 4, FWD: 2 },
  '4-5-1': { DEF: 4, MID: 5, FWD: 1 },
  '5-3-2': { DEF: 5, MID: 3, FWD: 2 },
  '5-4-1': { DEF: 5, MID: 4, FWD: 1 },
};

const LEAGUES = [
  { id: 'l1', name: 'Casa Boys 🏆',         rank: 3,  total: 24,   delta: +2, type: 'private' },
  { id: 'l2', name: 'DXC Maroc',            rank: 12, total: 87,   delta: -1, type: 'private' },
  { id: 'l3', name: 'Botola Pro Overall',   rank: 4218, total: 184523, delta: +312, type: 'public' },
];

const STANDINGS = [
  { rank: 1, name: 'Anas El Filali',     team: 'Atlas FC',           gw: 87, total: 1124, you: false, badge: '👑' },
  { rank: 2, name: 'Mehdi Bennani',      team: 'Casa Kings XI',      gw: 72, total: 1098, you: false },
  { rank: 3, name: 'You',                team: 'DXC Atlas',          gw: 81, total: 1067, you: true  },
];

const CHIPS = [
  { id: 'wc',  name: 'Wildcard',         desc: 'Unlimited free transfers in one gameweek.', icon: '∞', used: false, available: true },
];

// Fetch data from the scraper output. 
// Tries new gameweek_output.json first, falls back to legacy scrapper-output.json
window.loadScrapperData = async () => {
  try {
    let res = await fetch('../Scrapper/data/gameweek_output.json');
    if (!res.ok) res = await fetch('../Scrapper/scrapper-output.json');
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    
    window.SCRAPPER_DATA = data;

    const clubMapping = {
      'Wydad': 'wac', 'Raja': 'rca', 'AS FAR': 'far', 'RS Berkane': 'rsb',
      'Maghreb Fez': 'mas', 'Maghreb Fès': 'mas', 'FUS Rabat': 'fus',
      'Moghreb Tétouan': 'mat', 'Hassania Agadir': 'hus', 'Olympic Safi': 'ojm',
      'JS Soualem': 'jsm', 'Chabab Mohammédia': 'cay', 'Union Touarga': 'ujs'
    };

    // Map players and sort by total points
    const allPlayers = Object.keys(data.players || {}).map((fullName, i) => {
      const namePart = fullName.split(' (')[0];
      const clubPart = fullName.match(/\(([^)]+)\)/)?.[1] || 'Wydad';
      
      // Basic fuzzy match for club
      let clubId = 'wac';
      for (const [key, id] of Object.entries(clubMapping)) {
        if (clubPart.includes(key)) { clubId = id; break; }
      }

      return {
        id: i + 1,
        n: namePart,
        pos: namePart.includes('(G)') ? 'GK' : (i % 3 === 0 ? 'DEF' : (i % 2 === 0 ? 'MID' : 'FWD')), 
        club: clubId,
        p: 5.0 + (Math.random() * 4), 
        f: (data.players[fullName].total / 2).toFixed(1),
        t: data.players[fullName].total,
        s: Math.floor(Math.random() * 20) + 5,
        gw: data.players[fullName].total
      };
    });

    // Sort by points descending
    const sorted = [...allPlayers].sort((a, b) => b.t - a.t);
    
    window.PLAYERS = allPlayers;
    window.TOP_PERFORMERS = sorted.slice(0, 5);
    
    if (sorted.length > 0) {
      window.STARTING_XI.captain = sorted[0].id;
      window.STARTING_XI.viceCaptain = sorted[1]?.id || sorted[0].id;
      
      // Fill Starting XI arrays with available players
      const gks = allPlayers.filter(p => p.pos === 'GK');
      const defs = allPlayers.filter(p => p.pos === 'DEF');
      const mids = allPlayers.filter(p => p.pos === 'MID');
      const fwds = allPlayers.filter(p => p.pos === 'FWD');

      if (gks.length > 0) window.STARTING_XI.GK = [gks[0].id];
      window.STARTING_XI.DEF = defs.slice(0, 4).map(p => p.id);
      window.STARTING_XI.MID = mids.slice(0, 3).map(p => p.id);
      window.STARTING_XI.FWD = fwds.slice(0, 3).map(p => p.id);
      window.STARTING_XI.bench = allPlayers.slice(11, 15).map(p => p.id);
    }

    window.FIXTURES_GW14 = [
       { id: 'm1', home: 'mas', away: 'hus', hs: 3, as: 0, status: 'FT', minute: 90, kickoff: '20:00', isDerby: false }
    ];
    
    return true;
  } catch (err) {
    console.error(err);
    throw new Error('No data yet — run the scraper first');
  }
};

Object.assign(window, { CLUBS, clubById, PLAYERS, STARTING_XI, FORMATIONS, FIXTURES_GW14, LEAGUES, STANDINGS, CHIPS });
