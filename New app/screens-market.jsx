// screens-market.jsx — Player list / Transfers market + Player profile

function MarketScreen() {
  const [gw, setGw] = React.useState(window.GAMEWEEK?.id || window.CURRENT_GW);
  const [fixtures, setFixtures] = React.useState([]);

  React.useEffect(() => {
    async function fetchFixtures() {
      try {
        const data = await window.sb('fixtures', `select=*&gameweek=eq.${gw}&order=match_date.asc`);
        setFixtures(data || []);
      } catch(e) {
        setFixtures([]);
      }
    }
    fetchFixtures();
  }, [gw]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', paddingBottom: 100 }}>
      <AppBackground/>
      
      <div style={{ position: 'relative', zIndex: 1, padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={() => setGw(g => Math.max(1, g - 1))} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36 }}>
            <Icon name="chevron-l" color={T.text} />
          </button>
          <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, color: T.text }}>Gameweek {gw}</div>
          <button onClick={() => setGw(g => Math.min(30, g + 1))} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36 }}>
            <Icon name="chevron-r" color={T.text} />
          </button>
        </div>

        {fixtures.length === 0 && <div style={{ color: T.textMute, textAlign: 'center', marginTop: 40, fontFamily: T.font }}>No fixtures scheduled</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fixtures.map(f => {
            const h = window.clubById(f.home_team_id);
            const a = window.clubById(f.away_team_id);
            const isLive = f.status === 'live' || f.status === 'in play';
            const isFT = f.status === 'finished' || f.status === 'ft';
            const time = f.match_date ? new Date(f.match_date).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : 'TBD';
            
            return (
              <div key={f.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: isLive ? T.red : T.textMute, fontWeight: 700, letterSpacing: 1 }}>{isLive ? 'LIVE' : isFT ? 'FT' : 'UPCOMING'}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>{f.match_date ? new Date(f.match_date).toLocaleDateString() : ''}</div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Crest club={h} size={44} />
                    <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.text, textAlign: 'center' }}>{h?.short}</div>
                  </div>
                  
                  <div style={{ textAlign: 'center', fontFamily: T.display, fontSize: 22, fontWeight: 800, color: T.text }}>
                    {isFT || isLive ? `${f.home_score ?? '-'} - ${f.away_score ?? '-'}` : time}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Crest club={a} size={44} />
                    <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.text, textAlign: 'center' }}>{a?.short}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Player profile ───
function PlayerProfile({ playerId, onBack }) {
  const [history, setHistory] = React.useState([]);
  const [upcoming, setUpcoming] = React.useState([]);
  
  const p = PLAYERS.find(x => x.id === playerId);
  
  React.useEffect(() => {
    if (!p) return;
    
    async function load() {
      try {
        // 1. History
        const histData = await window.sb('player_live_points', `select=event_type,points,match_date,match_home_team,match_away_team&player_id=eq.${p.id}&order=match_date.desc`);
        
        // Aggregate by match_date for history
        const dateGroups = {};
        for (const h of (histData || [])) {
          if (!dateGroups[h.match_date]) dateGroups[h.match_date] = { pts: 0, res: `${h.match_home_team} vs ${h.match_away_team}` };
          dateGroups[h.match_date].pts += h.points;
        }
        
        const hArr = Object.keys(dateGroups).map((d, i) => ({
          gw: window.CURRENT_GW - i,
          pts: dateGroups[d].pts,
          res: dateGroups[d].res
        }));
        
        setHistory(hArr.slice(0, 5));
        
        // 2. Upcoming
        const upcomingData = await window.sb('fixtures', `select=*&or=(home_team_id.eq.${p.club},away_team_id.eq.${p.club})&status=eq.upcoming&order=match_date.asc&limit=5`);
        
        if (upcomingData) {
          setUpcoming(upcomingData.map(f => {
            const isHome = f.home_team_id === p.club;
            const oppId = isHome ? f.away_team_id : f.home_team_id;
            const opp = clubById(oppId);
            return {
              gw: f.gameweek || window.CURRENT_GW + 1,
              opp: opp ? opp.short : oppId,
              home: isHome,
              diff: Math.floor(Math.random() * 5) + 1 // Stub for difficulty
            };
          }));
        }
      } catch (e) {
        console.error('Failed to load profile data', e);
      }
    }
    load();
  }, [playerId, p]);

  if (!p) return <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>Player not found</div>;
  const c = clubById(p.club);
  if (!c) return null;
  
  const maxPts = history.length > 0 ? Math.max(...history.map(h => h.pts)) : 1;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', paddingBottom: 90 }}>
      <AppBackground/>
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero */}
        <div style={{
          padding: '8px 20px 24px', position: 'relative', overflow: 'hidden',
          background: `linear-gradient(180deg, ${c.primary}55 0%, transparent 100%)`,
        }}>
          <div style={{ position: 'absolute', right: -40, top: -20, opacity: 0.15 }}>
            <Crest club={c} size={220}/>
          </div>
          <button onClick={onBack} style={{
            background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.border}`, cursor: 'pointer',
            width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name="chevron-l" size={18} color={T.text}/></button>
          <div style={{ marginTop: 14, position: 'relative', zIndex: 1 }}>
            <PosChip pos={p.pos} size="lg"/>
            <div style={{ fontFamily: T.display, fontSize: 30, fontWeight: 800, color: T.text, letterSpacing: -1, lineHeight: 1, marginTop: 10 }}>{p.n}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <Crest club={c} size={20}/>
              <div style={{ fontFamily: T.font, fontSize: 13, color: T.textDim, fontWeight: 500 }}>{c.name} · {c.city}</div>
            </div>
          </div>
        </div>

        {/* Big stats */}
        <div style={{ padding: '0 20px 18px' }}>
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <Stat label="Total" value={p.t} accent={T.primary}/>
              <Stat label="Form" value={p.f}/>
              <Stat label="Price" value={p.p + 'm'}/>
              <Stat label="Owned" value={p.s + '%'}/>
            </div>
          </Card>
        </div>

        {/* History */}
        <SectionHeader kicker="Last 6" title="Points History"/>
        <div style={{ padding: '0 20px 22px' }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 120 }}>
              {history.map(h => {
                const pct = h.pts / maxPts;
                return (
                  <div key={h.gw} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: h.gw === p.gw && h.res === 'live' ? T.primary : T.text }}>{h.pts}</div>
                    <div style={{ width: '100%', height: 70, background: 'rgba(255,255,255,0.04)', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0,
                        height: `${pct * 100}%`,
                        background: h.res === 'live'
                          ? `linear-gradient(180deg, ${T.primary}, ${T.primaryD})`
                          : `linear-gradient(180deg, ${T.cyan}88, ${T.cyan}33)`,
                        borderRadius: 6,
                      }}/>
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.textMute, fontWeight: 600 }}>GW{h.gw}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Upcoming */}
        <SectionHeader kicker="Next 5" title="Fixture Difficulty"/>
        <div style={{ padding: '0 20px 18px' }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              {upcoming.map(u => {
                const opp = clubById(u.opp);
                const diffColor = u.diff <= 2 ? T.primary : u.diff === 3 ? T.amber : T.red;
                return (
                  <div key={u.gw} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textMute, fontWeight: 600 }}>GW{u.gw}</div>
                    <div style={{
                      width: '100%', padding: 8, borderRadius: 8,
                      background: `${diffColor}1A`, border: `1px solid ${diffColor}55`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    }}>
                      <Crest club={opp} size={26}/>
                      <div style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, color: diffColor }}>{u.home ? 'H' : 'A'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 12, fontFamily: T.font, fontSize: 10, color: T.textDim }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: T.primary, borderRadius: 2, marginRight: 4 }}/>Easy</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: T.amber, borderRadius: 2, marginRight: 4 }}/>Medium</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: T.red, borderRadius: 2, marginRight: 4 }}/>Hard</span>
            </div>
          </Card>
        </div>

        {/* Action */}
        <div style={{ padding: '0 20px' }}>
          <button style={{
            width: '100%', height: 50, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: T.primary, color: '#000',
            fontFamily: T.display, fontSize: 14, fontWeight: 700, letterSpacing: 0.2,
          }}>+ Add to Squad · {p.p}m</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MarketScreen, PlayerProfile });
