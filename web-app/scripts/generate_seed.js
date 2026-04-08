const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataPath = path.join(__dirname, '../Scrapper/botola_players.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const players = JSON.parse(rawData);

// Deduplicate teams
const teamNames = [...new Set(players.map(p => p.team))];

// Generate short names (Acronyms)
function getShortName(name) {
    if (name === "FAR Rabat") return "FAR";
    if (name === "Wydad AC") return "WAC";
    if (name === "Raja CA") return "RCA";
    if (name === "Maghreb Fez") return "MAS";
    if (name === "Olympique de Safi") return "OCS";
    if (name === "FUS Rabat") return "FUS";
    if (name === "Hassania Agadir") return "HUSA";
    if (name === "Ittihad Tanger") return "IRT";
    if (name === "Renaissance Berkane") return "RSB";
    if (name === "Chabab Mohammedia") return "SCCM";
    if (name === "Mouloudia Oujda") return "MCO";
    if (name === "Youssoufia Berrechid") return "CAYB";
    if (name === "Renaissance Zemamra") return "RCAZ";
    if (name === "Jeunesse Soualem") return "JSS";
    return name.substring(0, 3).toUpperCase();
}

let sql = `-- Seed file generated for Botola Fantasy
-- Paste this into your Supabase SQL Editor to populate Teams and Players

DELETE FROM public.squad_players;
DELETE FROM public.players;
DELETE FROM public.teams;

`;

// Generate proper UUIDs securely to ensure compatibility with Supabase
const teamToId = {};
teamNames.forEach(t => {
    const id = crypto.randomUUID();
    teamToId[t] = id;
    sql += `INSERT INTO public.teams (id, name, short_name) VALUES ('${id}', '${t.replace(/'/g, "''")}', '${getShortName(t)}');\n`;
});

sql += `\n`;

// Deduplicate players by exact name + team combination since Scrapper logged duplicates
const uniquePlayersMap = new Map();
players.forEach(p => {
    const key = `${p.name}-${p.team}`;
    if (!uniquePlayersMap.has(key)) {
        uniquePlayersMap.set(key, p);
    }
});

const uniquePlayers = Array.from(uniquePlayersMap.values());

const nameToPositionFix = (pos) => {
    // Normalizing positions to ENUM expected ('GK', 'DEF', 'MID', 'FWD')
    if (pos === "AT") return "FWD";
    if (pos === "ML") return "MID";
    if (pos === "DF") return "DEF";
    return pos;
};

uniquePlayers.forEach(p => {
    const teamId = teamToId[p.team];
    const playerUuid = crypto.randomUUID();
    
    // Generate realistic fantasy prices based on position
    let price = 5.0;
    const pos = nameToPositionFix(p.position);
    if (pos === 'FWD') price = (Math.random() * 5 + 6).toFixed(1); // 6.0 - 11.0 M
    else if (pos === 'MID') price = (Math.random() * 3.5 + 5.5).toFixed(1); // 5.5 - 9.0 M
    else if (pos === 'DEF') price = (Math.random() * 1.5 + 4.5).toFixed(1); // 4.5 - 6.0 M
    else if (pos === 'GK') price = (Math.random() * 1.0 + 4.0).toFixed(1); // 4.0 - 5.0 M

    sql += `INSERT INTO public.players (id, team_id, name, position, price) VALUES ('${playerUuid}', '${teamId}', '${p.name.replace(/'/g, "''")}', '${pos}', ${price});\n`;
});

const outputPath = path.join(__dirname, 'seed_botola.sql');
fs.writeFileSync(outputPath, sql);
console.log('✅ Generated seed_botola.sql successfully!');
console.log(`Teams: ${teamNames.length}`);
console.log(`Players: ${uniquePlayers.length} (Deduplicated)`);
