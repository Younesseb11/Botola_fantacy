// screens-market.jsx — Player list / Transfers market + Player profile

function MarketScreen({ onSelectPlayer }) {
  const [pos, setPos] = React.useState('ALL');
  const [sort, setSort] = React.useState('total');
  const [q, setQ] = React.useState('');
  const filtered = PLAYERS
    .filter(p => pos === 'ALL' || p.pos === pos)
    .filter(p => !q || p.n.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === 'total' ? b.t - a.t : sort === 'form' ? b.f - a.f : sort === 'price' ? b.p - a.p : b.s - a.s);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', paddingBottom: 90 }}>
      <AppBackground/>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '8px 20px 12px' }}>
          <div style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, color: T.cyan }}>TRANSFER MARKET</div>
          <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.5, marginTop: 2 }}>{PLAYERS.length} players</div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 20px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
          }}>
            <Icon name="search" size={16} color={T.textDim}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search Botola Pro players…" style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: T.font, fontSize: 14, color: T.text,
            }}/>
            <Icon name="filter" size={16} color={T.textDim}/>
          </div>
        </div>

        {/* Filters */}
        <div style={{ padding: '0 20px 10px', display: 'flex', gap: 6, overflowX: 'auto' }}>
          {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map(x => (
            <Pill key={x} active={pos === x} onClick={() => setPos(x)} color={x === 'ALL' ? T.text : posColor(x)}>{x}</Pill>
          ))}
          <div style={{ width: 1, background: T.border, margin: '4px 4px' }}/>
          {[['total','Total'], ['form','Form'], ['price','Price'], ['s','Owned']].map(([k, l]) => (
            <Pill key={k} active={sort === k} onClick={() => setSort(k)} color={T.cyan}>{l}</Pill>
          ))}
        </div>

        {/* List */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px', padding: '0 12px', fontFamily: T.mono, fontSize: 9, color: T.textMute, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
            <div>Player</div>
            <div style={{ textAlign: 'right' }}>{sort === 'price' ? 'Price' : 'Form'}</div>
            <div style={{ textAlign: 'right' }}>Total</div>
            <div style={{ textAlign: 'right' }}>Own%</div>
          </div>
          {filtered.slice(0, 30).map(p => (
            <MarketRow key={p.id} p={p} onClick={() => onSelectPlayer(p.id)} sort={sort}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketRow({ p, onClick, sort }) {
  const c = clubById(p.club);
  return (
    <button onClick={onClick} style={{
      display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px', alignItems: 'center', gap: 8,
      padding: '10px 12px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rsm,
      cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Crest club={c} size={32}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.n}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <PosChip pos={p.pos}/>
            <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.textDim }}>{c.short}</div>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.text }}>
        {sort === 'price' ? p.p : p.f}
      </div>
      <div style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.primary }}>{p.t}</div>
      <div style={{ textAlign: 'right', fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.textDim }}>{p.s}%</div>
    </button>
  );
}

// ─── Player profile ───
function PlayerProfile({ playerId, onBack }) {
  const p = PLAYERS.find(x => x.id === playerId);
  const c = clubById(p.club);
  const history = [
    { gw: 9,  pts: 8,  res: 'W 2-0' },
    { gw: 10, pts: 12, res: 'W 3-1' },
    { gw: 11, pts: 6,  res: 'D 1-1' },
    { gw: 12, pts: 14, res: 'W 4-0' },
    { gw: 13, pts: 9,  res: 'W 2-1' },
    { gw: 14, pts: p.gw, res: 'live' },
  ];
  const upcoming = [
    { gw: 15, opp: 'rsb', home: true,  diff: 3 },
    { gw: 16, opp: 'fus', home: false, diff: 2 },
    { gw: 17, opp: 'mas', home: true,  diff: 2 },
    { gw: 18, opp: 'rca', home: false, diff: 5 },
    { gw: 19, opp: 'mat', home: true,  diff: 1 },
  ];
  const maxPts = Math.max(...history.map(h => h.pts));

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
