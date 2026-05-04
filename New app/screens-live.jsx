// screens-live.jsx — Live gameweek + Fixtures + Leagues + Standings

function LiveScreen() {
  const [tab, setTab] = React.useState('mine');
  const gw = window.GAMEWEEK?.id || window.CURRENT_GW;
  // Compute dynamic stats
  const xiIds = [...(STARTING_XI.GK||[]), ...(STARTING_XI.DEF||[]), ...(STARTING_XI.MID||[]), ...(STARTING_XI.FWD||[])];
  const played = xiIds.filter(id => { const p = PLAYERS.find(x => x.id === id); return p && p.gw > 0; }).length;
  const totalXi = xiIds.length;
  const gwPts = xiIds.reduce((sum, id) => {
    const p = PLAYERS.find(x => x.id === id);
    if (!p) return sum;
    return sum + (id === STARTING_XI.captain ? p.gw * 2 : p.gw);
  }, 0);
  const pct = totalXi > 0 ? Math.round((played / totalXi) * 100) : 0;
  const liveMatches = FIXTURES_GW14.filter(f => f.status === 'LIVE').length;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', paddingBottom: 90 }}>
      <AppBackground/>
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Live header */}
        <div style={{ padding: '8px 20px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              padding: '4px 10px', borderRadius: 6, background: T.magenta,
              fontFamily: T.mono, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#fff',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'bf-pulse 1.2s infinite' }}/>
              LIVE
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, fontWeight: 600 }}>GW {gw} · {liveMatches > 0 ? `${liveMatches} IN PLAY` : 'NO LIVE'}</div>
          </div>
          <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.5, marginTop: 4 }}>Live Gameweek</div>
        </div>

        {/* Big score banner */}
        <div style={{ padding: '0 20px 14px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.surface} 0%, ${T.surface2} 100%)`,
            border: `1px solid ${T.borderSt}`, borderRadius: T.rlg, padding: 18,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at top right, ${T.primary}1A, transparent 60%)` }}/>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'end', marginBottom: 14 }}>
                <Stat label="GW Live" value={gwPts || '—'} accent={T.primary} sub={gwPts > 0 ? `↑ vs avg` : ''}/>
                <Stat label="Players Played" value={`${played}/${totalXi}`}/>
                <Stat label="Bonus" value="—"/>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${T.primary}, ${T.cyan})`, borderRadius: 3 }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: T.mono, fontSize: 10, color: T.textDim, fontWeight: 600 }}>
                <span>{pct}% · {played} OF {totalXi} PLAYED</span>
                <span>{totalXi - played} LEFT</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '0 20px 12px' }}>
          <Pill active={tab === 'mine'} onClick={() => setTab('mine')}>My Players</Pill>
          <Pill active={tab === 'matches'} onClick={() => setTab('matches')} color={T.cyan}>All Matches</Pill>
        </div>

        {tab === 'mine' && <LivePlayers/>}
        {tab === 'matches' && <FixtureList/>}
      </div>
    </div>
  );
}

function LivePlayers() {
  const ids = [...(STARTING_XI.GK||[]), ...(STARTING_XI.DEF||[]), ...(STARTING_XI.MID||[]), ...(STARTING_XI.FWD||[])];
  // Build set of team IDs currently in a live match
  const liveTeamIds = new Set();
  for (const f of FIXTURES_GW14) {
    if (f.status === 'LIVE') { liveTeamIds.add(f.home); liveTeamIds.add(f.away); }
  }
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {ids.map(id => {
        const p = PLAYERS.find(x => x.id === id);
        if (!p) return null;
        const c = clubById(p.club);
        if (!c) return null;
        const isCap = id === STARTING_XI.captain;
        const live = liveTeamIds.has(p.club) || p.gw > 0;
        return (
          <div key={id} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 10,
            padding: '10px 12px', background: T.surface, border: `1px solid ${live ? `${T.primary}33` : T.border}`, borderRadius: T.rsm,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ position: 'relative' }}>
                <Crest club={c} size={32}/>
                {live && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: T.magenta, border: `2px solid ${T.surface}`, animation: 'bf-pulse 1.2s infinite' }}/>}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text }}>{p.n}</div>
                  {isCap && <div style={{ width: 14, height: 14, borderRadius: '50%', background: T.amber, color: '#000', fontFamily: T.display, fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>C</div>}
                </div>
                <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.textDim }}>
                  {live ? <span style={{ color: T.magenta, fontWeight: 700 }}>● {p.gw} pts</span> : <span>{c.short} · upcoming</span>}
                </div>
              </div>
            </div>
            <PosChip pos={p.pos}/>
            <div style={{
              minWidth: 50, textAlign: 'center',
              padding: '6px 10px', borderRadius: 8,
              background: p.gw >= 8 ? `${T.primary}22` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${p.gw >= 8 ? `${T.primary}55` : T.border}`,
            }}>
              <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 800, color: p.gw >= 8 ? T.primary : T.text }}>
                {isCap ? p.gw * 2 : p.gw}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FixtureList() {
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {FIXTURES_GW14.map(f => <FixtureCard key={f.id} f={f}/>)}
    </div>
  );
}

function FixtureCard({ f }) {
  const home = clubById(f.home), away = clubById(f.away);
  const isLive = f.status === 'LIVE';
  const isFT = f.status === 'FT';
  return (
    <div style={{
      background: T.surface, border: `1px solid ${isLive ? `${T.magenta}44` : T.border}`,
      borderRadius: T.rmd, padding: 14, position: 'relative', overflow: 'hidden',
    }}>
      {f.isDerby && (
        <div style={{ position: 'absolute', top: 0, right: 0,
          background: `linear-gradient(135deg, ${T.amber}, ${T.red})`,
          fontFamily: T.mono, fontSize: 8.5, fontWeight: 800, letterSpacing: 1, color: '#000',
          padding: '3px 8px', borderBottomLeftRadius: 8,
        }}>🔥 DERBY</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Crest club={home} size={32}/>
          <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text }}>{home.short}</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          {f.status === 'UPCOMING' ? (
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, fontWeight: 600 }}>{f.kickoff}</div>
          ) : (
            <>
              <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>
                {f.hs} <span style={{ color: T.textMute }}>—</span> {f.as}
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700,
                color: isLive ? T.magenta : T.textMute, marginTop: 2,
              }}>
                {isLive ? `${f.minute}'` : 'FT'}
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
          <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text }}>{away.short}</div>
          <Crest club={away} size={32}/>
        </div>
      </div>
    </div>
  );
}

// ─── Leagues ───
function LeaguesScreen({ onOpen }) {
  const [action, setAction] = React.useState(null);
  const [val, setVal] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleAction = async () => {
    if (!val.trim()) return;
    setLoading(true); setMsg('');
    // fallback user_id until auth is added
    const uid = window.STANDINGS?.find(s => s.you)?.user_id || '9d66f4ea-4541-477c-a49d-6490e54d3c4d'; 
    try {
      if (action === 'create') {
        const lRes = await window.sb('leagues', '', { method: 'POST', body: JSON.stringify({ name: val, created_by: uid, type: 'private', total: 0, delta: 0, rank: 1 }) });
        if (lRes && lRes.length > 0) {
          await window.sb('league_members', '', { method: 'POST', body: JSON.stringify({ league_id: lRes[0].id, user_id: uid }) });
          setMsg(`Created! Share code: ${lRes[0].id}`);
        }
      } else if (action === 'join') {
        const check = await window.sb('leagues', `select=id,name&id=eq.${val.trim()}`);
        if (check && check.length > 0) {
          await window.sb('league_members', '', { method: 'POST', body: JSON.stringify({ league_id: val.trim(), user_id: uid }) });
          setMsg('Joined successfully!');
          setTimeout(() => onOpen(check[0]), 1000);
        } else {
          setMsg('League not found.');
        }
      }
    } catch(e) {
      setMsg(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', paddingBottom: 90 }}>
      <AppBackground/>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '8px 20px 14px' }}>
          <div style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, color: T.amber }}>COMPETITIONS</div>
          <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.5, marginTop: 2 }}>Leagues</div>
        </div>

        {/* Create / Join */}
        <div style={{ padding: '0 20px 18px', display: 'flex', gap: 8 }}>
          <button onClick={() => { setAction('create'); setVal(''); setMsg(''); }} style={{
            flex: 1, height: 56, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: action === 'create' ? T.primary : 'rgba(255,255,255,0.05)',
            color: action === 'create' ? '#000' : T.text,
            fontFamily: T.display, fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="plus" size={18} color={action === 'create' ? '#000' : T.text} sw={2.4}/>
            Create
          </button>
          <button onClick={() => { setAction('join'); setVal(''); setMsg(''); }} style={{
            flex: 1, height: 56, borderRadius: 14, cursor: 'pointer',
            background: action === 'join' ? T.primary : 'rgba(255,255,255,0.05)',
            color: action === 'join' ? '#000' : T.text,
            border: `1px solid ${action === 'join' ? T.primary : T.borderSt}`,
            fontFamily: T.display, fontSize: 13, fontWeight: 600,
          }}>Join</button>
        </div>

        {action && (
          <div style={{ padding: '0 20px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={val} onChange={e => setVal(e.target.value)}
                placeholder={action === 'create' ? "League Name" : "League Code"}
                style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.border}`, padding: '12px 14px', borderRadius: 12, fontFamily: T.font, fontSize: 14, color: T.text, outline: 'none' }}
              />
              <button onClick={handleAction} disabled={loading} style={{ background: T.cyan, color: '#000', border: 'none', borderRadius: 12, padding: '0 20px', fontFamily: T.display, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
                {loading ? '...' : 'Go'}
              </button>
            </div>
            {msg && <div style={{ fontFamily: T.font, fontSize: 13, color: T.textDim, padding: '0 4px' }}>{msg}</div>}
          </div>
        )}

        {LEAGUES.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: T.textDim, fontFamily: T.font, fontSize: 14 }}>
            No leagues yet — create one!
          </div>
        ) : (
          <>
            <SectionHeader kicker="Private" title="Friends & Family"/>
            <div style={{ padding: '0 20px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LEAGUES.filter(l => l.type === 'private' || !l.type).map(l => <LeagueRow key={l.id} l={l} onClick={() => onOpen(l)}/>)}
            </div>

            <SectionHeader kicker="Public" title="Open Leagues"/>
            <div style={{ padding: '0 20px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LEAGUES.filter(l => l.type === 'public').map(l => <LeagueRow key={l.id} l={l} onClick={() => onOpen(l)}/>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Standings ───
function StandingsScreen({ league, onBack }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', paddingBottom: 90 }}>
      <AppBackground/>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '8px 20px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{
            background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.border}`, cursor: 'pointer',
            width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name="chevron-l" size={18} color={T.text}/></button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: T.amber }}>STANDINGS · GW {window.GAMEWEEK?.id || window.CURRENT_GW}</div>
            <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: -0.4 }}>{league.name}</div>
          </div>
        </div>

        {/* Top 3 podium */}
        <div style={{ padding: '0 20px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 8, alignItems: 'end' }}>
            {[STANDINGS[1], STANDINGS[0], STANDINGS[2]].map((s, i) => {
              const place = i === 1 ? 1 : i === 0 ? 2 : 3;
              const h = place === 1 ? 110 : place === 2 ? 90 : 76;
              const colors = { 1: T.amber, 2: '#C0C0C0', 3: '#CD7F32' };
              return (
                <div key={s.rank} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${colors[place]}, ${colors[place]}88)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: T.display, fontSize: 18, fontWeight: 800, color: '#000',
                    border: `2px solid ${colors[place]}`,
                  }}>{s.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div>
                  <div style={{ fontFamily: T.display, fontSize: 11, fontWeight: 700, color: T.text, textAlign: 'center', maxWidth: 90, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, fontWeight: 600 }}>{s.total} pts</div>
                  <div style={{
                    width: '100%', height: h, borderRadius: '12px 12px 0 0',
                    background: `linear-gradient(180deg, ${colors[place]} 0%, ${colors[place]}33 100%)`,
                    border: `1px solid ${colors[place]}55`, borderBottom: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: T.display, fontSize: 32, fontWeight: 900, color: '#000',
                  }}>{place}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 50px 60px', padding: '0 12px 6px', fontFamily: T.mono, fontSize: 9, color: T.textMute, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
            <div>#</div><div>Manager</div><div style={{ textAlign: 'right' }}>GW</div><div style={{ textAlign: 'right' }}>Total</div>
          </div>
          {STANDINGS.map(s => (
            <div key={s.rank} style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 50px 60px', alignItems: 'center', gap: 8,
              padding: '12px', borderRadius: T.rsm,
              background: s.you ? `${T.primary}1A` : T.surface,
              border: `1px solid ${s.you ? `${T.primary}66` : T.border}`,
            }}>
              <div style={{ fontFamily: T.display, fontSize: 14, fontWeight: 800, color: s.you ? T.primary : T.text }}>{s.rank}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text }}>{s.name}</div>
                  {s.badge}
                </div>
                <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.textDim, marginTop: 1 }}>{s.team}</div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: s.gw >= 70 ? T.primary : T.text }}>{s.gw}</div>
              <div style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.text }}>{s.total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LiveScreen, LeaguesScreen, StandingsScreen, FixtureCard });
