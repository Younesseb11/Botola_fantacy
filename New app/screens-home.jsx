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
                  GW 14 · Live
                </div>
                <div style={{ fontFamily: T.font, fontSize: 11, color: T.textDim, fontWeight: 500 }}>Deadline · Sat 18:30</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                <Stat label="GW Points" value="68" accent={T.primary} sub="↑ 12 vs avg" />
                <Stat label="Total" value="1,067" sub="—" />
                <Stat label="Rank" value="4.2k" sub="↑ 312" />
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
          <CaptainCard playerId={STARTING_XI.captain} />
        </div>

        {/* Featured fixture — Casablanca Derby */}
        <SectionHeader kicker="Derby Boost ×1.5" title="Casablanca Derby" action="Use chip" onAction={() => onNav('pick')} />
        <div style={{ padding: '0 20px', marginBottom: 22 }}>
          <DerbyCard />
        </div>

        {/* Mini-leagues */}
        <SectionHeader kicker="Friends" title="Your Leagues" action="See all" onAction={() => onNav('leagues')} />
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {LEAGUES.slice(0, 3).map(l => <LeagueRow key={l.id} l={l} onClick={() => onNav('leagues')} />)}
        </div>

        {/* Top performers */}
        <SectionHeader kicker="GW 14 So Far" title="Top performers" action="Market" onAction={() => onNav('transfers')} />
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

function CaptainCard({ playerId }) {
  const p = PLAYERS.find(x => x.id === playerId);
  if (!p) return null;
  const c = clubById(p.club);
  if (!c) return null;
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
      }}>{p.id}</div>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: T.amber, color: '#000',
              fontFamily: T.display, fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>C</div>
            <PosChip pos={p.pos} />
          </div>
          <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.5, marginTop: 6 }}>{p.n}</div>
          <div style={{ fontFamily: T.font, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{c.name} · GW {p.gw} pts</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: 1 }}>FORM</div>
              <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: '#fff' }}>{p.f}</div>
            </div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: 1 }}>OWN</div>
              <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: '#fff' }}>{p.s}%</div>
            </div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: 1 }}>PRICE</div>
              <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: '#fff' }}>{p.p}</div>
            </div>
          </div>
        </div>
        <Crest club={p.club} size={48} ring />
      </div>
    </div>
  );
}

function DerbyCard() {
  const wac = clubById('wac');
  const rca = clubById('rca');
  return (
    <div style={{
      borderRadius: T.rlg, padding: 18, position: 'relative', overflow: 'hidden',
      background: `linear-gradient(120deg, ${wac.primary}33 0%, ${T.surface} 50%, ${rca.primary}33 100%)`,
      border: `1px solid ${T.borderSt}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.amber, fontWeight: 700, letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="fire" size={12} color={T.amber} sw={2}/> DERBY · CASA
        </div>
        <div style={{ fontFamily: T.font, fontSize: 11, color: T.textDim, fontWeight: 600 }}>Sat · 20:00</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Crest club="wac" size={56} ring />
          <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text }}>Wydad</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute }}>3 yours</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: T.display, fontSize: 11, fontWeight: 700, color: T.amber, letterSpacing: 1, marginBottom: 4 }}>VS</div>
          <div style={{
            padding: '6px 10px', borderRadius: 8, background: `${T.amber}22`, border: `1px solid ${T.amber}55`,
            fontFamily: T.mono, fontSize: 10, color: T.amber, fontWeight: 700, letterSpacing: 0.4,
          }}>×1.5 BOOST</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Crest club="rca" size={56} ring />
          <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text }}>Raja</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute }}>4 yours</div>
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

Object.assign(window, { Onboarding, HomeScreen, CaptainCard, DerbyCard, LeagueRow, TopPerformerCard });
