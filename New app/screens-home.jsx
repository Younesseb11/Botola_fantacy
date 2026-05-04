// screens-home.jsx — Onboarding + Home dashboard

function Onboarding({ onContinue }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `radial-gradient(ellipse at top, ${T.surface} 0%, ${T.bg} 60%)`,
      display: 'flex', flexDirection: 'column',
      paddingTop: 60, color: T.text, overflow: 'hidden',
    }}>
      {/* Pitch silhouette */}
      <div style={{
        position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.primary}33 0%, transparent 50%)`,
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      {/* Hero crest cluster */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 280, height: 280 }}>
          {/* concentric rings */}
          <div style={{ position: 'absolute', inset: 0, border: `1px solid ${T.primary}33`, borderRadius: '50%' }} />
          <div style={{ position: 'absolute', inset: 30, border: `1px solid ${T.primary}55`, borderRadius: '50%' }} />
          <div style={{ position: 'absolute', inset: 60, border: `1px solid ${T.primary}88`, borderRadius: '50%' }} />
          {/* big center crest */}
          <div style={{
            position: 'absolute', inset: 90, borderRadius: '50%',
            background: `linear-gradient(155deg, ${T.primary} 0%, ${T.cyan} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 80px -10px ${T.primary}`,
          }}>
            <div style={{ fontFamily: T.display, fontSize: 60, fontWeight: 800, color: T.bg, letterSpacing: -2 }}>BF</div>
          </div>
          {/* satellite crests */}
          {[
            { id: 'wac', x: 20,  y: 30,  s: 44 },
            { id: 'rca', x: 220, y: 50,  s: 40 },
            { id: 'far', x: 0,   y: 200, s: 36 },
            { id: 'rsb', x: 230, y: 210, s: 38 },
          ].map(c => (
            <div key={c.id} style={{ position: 'absolute', left: c.x, top: c.y, animation: 'bf-float 4s ease-in-out infinite' }}>
              <Crest club={c.id} size={c.s} ring />
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 28px 36px', position: 'relative', zIndex: 2 }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: 2, color: T.primary, textTransform: 'uppercase', marginBottom: 12 }}>
          ⚽ Botola Pro · 2025/26
        </div>
        <h1 style={{
          fontFamily: T.display, fontSize: 44, fontWeight: 800, letterSpacing: -1.8,
          margin: 0, lineHeight: 0.95, color: T.text,
        }}>
          Pick your<br/>
          <span style={{
            background: `linear-gradient(120deg, ${T.primary}, ${T.cyan})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Atlas Eleven.</span>
        </h1>
        <p style={{ fontFamily: T.font, fontSize: 15, color: T.textDim, marginTop: 14, marginBottom: 28, lineHeight: 1.5 }}>
          Build your fantasy squad from every Botola Pro club. Win mini-leagues with your friends, ride the Casablanca Derby, and climb the global ranks.
        </p>
        <button onClick={onContinue} style={{
          width: '100%', height: 56, border: 'none', cursor: 'pointer',
          borderRadius: 16, background: `linear-gradient(120deg, ${T.primary}, ${T.cyan})`,
          fontFamily: T.display, fontSize: 16, fontWeight: 700, color: '#000',
          letterSpacing: 0.2, boxShadow: `0 8px 24px -6px ${T.primary}88`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          Start your team
          <Icon name="arrow-right" size={18} color="#000" sw={2.4} />
        </button>
        <button style={{
          width: '100%', height: 48, marginTop: 10, border: 'none', cursor: 'pointer',
          background: 'transparent', color: T.textDim,
          fontFamily: T.font, fontSize: 14, fontWeight: 500,
        }}>I already have an account</button>
      </div>
      <style>{`@keyframes bf-float { 0%,100% {transform: translateY(0)} 50% {transform: translateY(-8px)} }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Home / Dashboard
// ─────────────────────────────────────────────────────────────
function HomeScreen({ onNav }) {
  const gw = window.GAMEWEEK?.id || window.CURRENT_GW;
  // Compute dynamic GW points from starting XI
  const xiIds = [...(STARTING_XI.GK||[]), ...(STARTING_XI.DEF||[]), ...(STARTING_XI.MID||[]), ...(STARTING_XI.FWD||[])];
  const gwPts = xiIds.reduce((sum, id) => {
    const p = PLAYERS.find(x => x.id === id);
    if (!p) return sum;
    return sum + (id === STARTING_XI.captain ? p.gw * 2 : p.gw);
  }, 0);
  const totalPts = PLAYERS.reduce((s, p) => s + p.t, 0);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', paddingBottom: 90 }}>
      <AppBackground />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${T.primary}, ${T.cyan})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.display, fontWeight: 800, fontSize: 16, color: '#000', letterSpacing: -0.5,
            }}>BF</div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textMute, letterSpacing: 1, fontWeight: 600 }}>SALAM, MANAGER</div>
              <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>Anas El Filali</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <Icon name="bell" size={18} color={T.textDim} />
              <div style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: '50%', background: T.magenta, boxShadow: `0 0 6px ${T.magenta}` }} />
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="user" size={18} color={T.textDim} />
            </div>
          </div>
        </div>

        {/* Hero gameweek card */}
        <div style={{ padding: '0 20px', marginBottom: 18 }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.surface} 0%, ${T.surface2} 100%)`,
            border: `1px solid ${T.borderSt}`,
            borderRadius: T.rlg, padding: 18, position: 'relative', overflow: 'hidden',
          }}>
            {/* geometric accent */}
            <div style={{
              position: 'absolute', top: -40, right: -40, width: 200, height: 200,
              background: `conic-gradient(from 200deg, ${T.primary}33, transparent 50%)`,
              borderRadius: '50%', filter: 'blur(20px)',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: T.primary, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.primary, boxShadow: `0 0 8px ${T.primary}`, animation: 'bf-pulse 1.5s infinite' }} />
                  GW {gw} · Live
                </div>
                <div style={{ fontFamily: T.font, fontSize: 11, color: T.textDim, fontWeight: 500 }}>Deadline · Sat 18:30</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                <Stat label="GW Points" value={gwPts || '—'} accent={T.primary} sub={gwPts > 0 ? `${xiIds.length} players` : 'no data yet'} />
                <Stat label="Total" value={totalPts > 0 ? totalPts.toLocaleString() : '—'} sub="—" />
                <Stat label="Rank" value="—" sub="" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => onNav('pick')} style={{
                  flex: 1, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: T.primary, color: '#000',
                  fontFamily: T.display, fontSize: 13, fontWeight: 700, letterSpacing: 0.2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Icon name="bolt" size={14} color="#000" sw={2.2}/> Manage Squad
                </button>
                <button onClick={() => onNav('live')} style={{
                  flex: 1, height: 44, borderRadius: 12, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.06)', color: T.text,
                  border: `1px solid ${T.borderSt}`,
                  fontFamily: T.display, fontSize: 13, fontWeight: 600,
                }}>Watch Live →</button>
              </div>
            </div>
          </div>
        </div>

        {/* Captain card */}
        <SectionHeader kicker="In Form" title="Your Captain" />
        <div style={{ padding: '0 20px', marginBottom: 22 }}>
          <CaptainCard />
        </div>

        {/* Featured fixture — Next Match */}
        {NEXT_FIXTURE && (
          <>
            <SectionHeader kicker="Next Match" title={`${NEXT_FIXTURE.home_team} vs ${NEXT_FIXTURE.away_team}`} />
            <div style={{ padding: '0 20px', marginBottom: 22 }}>
              <NextMatchCard />
            </div>
          </>
        )}
        {(!NEXT_FIXTURE && FEATURED_FIXTURE) && (
          <>
            <SectionHeader kicker={`Boost ×${FEATURED_FIXTURE.point_multiplier || 1.5}`} title="Featured Match" action="Use chip" onAction={() => onNav('pick')} />
            <div style={{ padding: '0 20px', marginBottom: 22 }}>
              <DerbyCard fixture={FEATURED_FIXTURE} />
            </div>
          </>
        )}

        {/* Mini-leagues */}
        <SectionHeader kicker="Friends" title="Your Leagues" action="See all" onAction={() => onNav('leagues')} />
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {LEAGUES.length === 0 ? (
            <div style={{ textAlign: 'center', color: T.textDim, fontSize: 13, padding: '20px 0', background: 'rgba(255,255,255,0.02)', borderRadius: T.rsm, border: `1px solid ${T.border}` }}>
              No leagues yet — create one!
            </div>
          ) : (
            LEAGUES.slice(0, 3).map(l => <LeagueRow key={l.id} l={l} onClick={() => onNav('leagues')} />)
          )}
        </div>

        {/* Top performers */}
        <SectionHeader kicker={`GW ${gw} So Far`} title="Top performers" action="Market" onAction={() => onNav('transfers')} />
        <div style={{ padding: '0 20px 12px', display: 'flex', gap: 10, overflowX: 'auto' }}>
          {(window.TOP_PERFORMERS || []).map(p => (
            <TopPerformerCard key={p.id} p={p} />
          ))}
        </div>
      </div>
      <style>{`@keyframes bf-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

function CaptainCard() {
  const [p, setP] = React.useState(null);

  React.useEffect(() => {
    async function fetchCaptain() {
      try {
        const uid = window.STANDINGS?.find(s => s.you)?.user_id || '9d66f4ea-4541-477c-a49d-6490e54d3c4d';
        const sq = await window.sb('user_squads', `select=id&user_id=eq.${uid}&limit=1`);
        if (sq && sq.length > 0) {
          const capData = await window.sb('squad_players', `select=player_id,players(*)&squad_id=eq.${sq[0].id}&is_captain=eq.true&limit=1`);
          if (capData && capData.length > 0 && capData[0].players) {
            setP(capData[0].players);
          }
        }
      } catch(e) {
        console.error('Failed to fetch captain', e);
      }
    }
    fetchCaptain();
  }, []);

  if (!p) return null;
  const c = window.clubById(p.team_id);
  if (!c) return null;
  
  // Format stats
  const form = (p.total_points / 3).toFixed(1);
  const own = p.s || Math.floor(Math.random() * 25) + 2; // ownership logic fallback
  
  return (
    <div style={{
      background: `linear-gradient(135deg, ${c.primary} 0%, ${c.primary}AA 60%, ${T.bg2} 130%)`,
      borderRadius: T.rlg, padding: 16, position: 'relative', overflow: 'hidden',
      border: `1px solid ${T.borderSt}`,
    }}>
      <div style={{
        position: 'absolute', right: -10, bottom: -20,
        fontFamily: T.display, fontSize: 140, fontWeight: 900, color: 'rgba(255,255,255,0.06)',
        letterSpacing: -8, lineHeight: 1, pointerEvents: 'none',
      }}>{p.id.toString().slice(-2)}</div>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: T.amber, color: '#000',
              fontFamily: T.display, fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>C</div>
            <PosChip pos={p.position || 'MID'} />
          </div>
          <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.5, marginTop: 6 }}>{p.name}</div>
          <div style={{ fontFamily: T.font, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{c.name}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: 1 }}>FORM</div>
              <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: '#fff' }}>{form}</div>
            </div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: 1 }}>OWN</div>
              <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: '#fff' }}>{own}%</div>
            </div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: 1 }}>PRICE</div>
              <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: '#fff' }}>{p.price}</div>
            </div>
          </div>
        </div>
        <Crest club={c} size={48} ring />
      </div>
    </div>
  );
}

function NextMatchCard() {
  if (!NEXT_FIXTURE) return null;
  // Try to find clubs by name for visual rendering
  const homeClub = CLUBS.find(c =>
    c.name?.toLowerCase().includes(NEXT_FIXTURE.home_team?.toLowerCase()) ||
    NEXT_FIXTURE.home_team?.toLowerCase().includes(c.name?.toLowerCase())
  );
  const awayClub = CLUBS.find(c =>
    c.name?.toLowerCase().includes(NEXT_FIXTURE.away_team?.toLowerCase()) ||
    NEXT_FIXTURE.away_team?.toLowerCase().includes(c.name?.toLowerCase())
  );
  const kickoff = NEXT_FIXTURE.kickoff_time
    ? new Date(NEXT_FIXTURE.kickoff_time).toLocaleDateString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';
  return (
    <div style={{
      borderRadius: T.rlg, padding: 18, position: 'relative', overflow: 'hidden',
      background: `linear-gradient(120deg, ${homeClub?.primary || T.primary}33 0%, ${T.surface} 50%, ${awayClub?.primary || T.cyan}33 100%)`,
      border: `1px solid ${T.borderSt}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.amber, fontWeight: 700, letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="fire" size={12} color={T.amber} sw={2}/> NEXT MATCH
        </div>
        <div style={{ fontFamily: T.font, fontSize: 11, color: T.textDim, fontWeight: 600 }}>{kickoff}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {homeClub ? <Crest club={homeClub.id} size={56} ring /> : <div style={{ width: 56, height: 56, borderRadius: 16, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.display, fontSize: 14, fontWeight: 700, color: T.textDim }}>{NEXT_FIXTURE.home_team?.slice(0,3)}</div>}
          <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text }}>{NEXT_FIXTURE.home_team}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: T.display, fontSize: 11, fontWeight: 700, color: T.amber, letterSpacing: 1 }}>VS</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {awayClub ? <Crest club={awayClub.id} size={56} ring /> : <div style={{ width: 56, height: 56, borderRadius: 16, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.display, fontSize: 14, fontWeight: 700, color: T.textDim }}>{NEXT_FIXTURE.away_team?.slice(0,3)}</div>}
          <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text }}>{NEXT_FIXTURE.away_team}</div>
        </div>
      </div>
    </div>
  );
}

function DerbyCard({ fixture }) {
  if (!fixture) return null;
  const homeClub = clubById(fixture.home_team_id) || DEFAULT_VISUAL;
  const awayClub = clubById(fixture.away_team_id) || DEFAULT_VISUAL;
  const mult = fixture.point_multiplier || 1.5;
  const matchDate = fixture.match_date ? new Date(fixture.match_date).toLocaleDateString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  
  // Calculate 'X yours'
  const allSquadIds = [...(STARTING_XI.GK||[]), ...(STARTING_XI.DEF||[]), ...(STARTING_XI.MID||[]), ...(STARTING_XI.FWD||[]), ...(STARTING_XI.bench||[])];
  let homeYours = 0;
  let awayYours = 0;
  for (const pid of allSquadIds) {
    const p = PLAYERS.find(x => x.id === pid);
    if (p) {
      if (p.club === homeClub.id) homeYours++;
      if (p.club === awayClub.id) awayYours++;
    }
  }

  return (
    <div style={{
      borderRadius: T.rlg, padding: 18, position: 'relative', overflow: 'hidden',
      background: `linear-gradient(120deg, ${homeClub.primary}33 0%, ${T.surface} 50%, ${awayClub.primary}33 100%)`,
      border: `1px solid ${T.borderSt}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.amber, fontWeight: 700, letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="fire" size={12} color={T.amber} sw={2}/> FEATURED
        </div>
        <div style={{ fontFamily: T.font, fontSize: 11, color: T.textDim, fontWeight: 600 }}>{matchDate}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Crest club={homeClub} size={56} ring />
          <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text, textAlign: 'center' }}>{homeClub.short}</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute }}>{homeYours} yours</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: T.display, fontSize: 11, fontWeight: 700, color: T.amber, letterSpacing: 1, marginBottom: 4 }}>VS</div>
          <div style={{
            padding: '6px 10px', borderRadius: 8, background: `${T.amber}22`, border: `1px solid ${T.amber}55`,
            fontFamily: T.mono, fontSize: 10, color: T.amber, fontWeight: 700, letterSpacing: 0.4,
          }}>×{mult} BOOST</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Crest club={awayClub} size={56} ring />
          <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text, textAlign: 'center' }}>{awayClub.short}</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute }}>{awayYours} yours</div>
        </div>
      </div>
    </div>
  );
}

function LeagueRow({ l, onClick }) {
  const positive = l.delta > 0, neg = l.delta < 0;
  const dColor = positive ? T.primary : neg ? T.red : T.textMute;
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14,
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rmd,
      cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: l.type === 'private' ? `${T.primary}1A` : `${T.cyan}1A`,
        border: `1px solid ${l.type === 'private' ? T.primary : T.cyan}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: l.type === 'private' ? T.primary : T.cyan,
      }}><Icon name={l.type === 'private' ? 'shield' : 'cup'} size={18} color={l.type === 'private' ? T.primary : T.cyan} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.display, fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>{l.name}</div>
        <div style={{ fontFamily: T.font, fontSize: 11, color: T.textDim }}>
          {l.rank.toLocaleString()} of {l.total.toLocaleString()}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>#{l.rank > 999 ? Math.round(l.rank/1000)+'k' : l.rank}</div>
        {l.delta !== 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: dColor, fontFamily: T.mono, fontSize: 10, fontWeight: 700 }}>
            <Icon name={positive ? 'arrow-up' : 'arrow-down'} size={10} color={dColor} sw={2.4}/>
            {Math.abs(l.delta)}
          </div>
        )}
      </div>
    </button>
  );
}

function TopPerformerCard({ p }) {
  if (!p) return null;
  const c = clubById(p.club);
  if (!c) return null;
  return (
    <div style={{
      flexShrink: 0, width: 140, padding: 12,
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rmd,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -8, right: -8, opacity: 0.15 }}>
        <Crest club={p.club} size={64}/>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 7px', borderRadius: 6,
          background: `${T.primary}22`, border: `1px solid ${T.primary}55`,
          fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: T.primary,
        }}>+{p.gw} pts</div>
        <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text, marginTop: 10, lineHeight: 1.2 }}>
          {p.n.split(' ').slice(-1)}<br/>
          <span style={{ color: T.textDim, fontWeight: 500, fontSize: 11 }}>{p.n.split(' ').slice(0, -1).join(' ')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <PosChip pos={p.pos} />
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, fontWeight: 600 }}>{p.p}m</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Onboarding, HomeScreen, CaptainCard, DerbyCard, NextMatchCard, LeagueRow, TopPerformerCard });
