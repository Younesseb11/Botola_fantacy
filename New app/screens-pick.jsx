// screens-pick.jsx — Pick Team / Formation pitch (signature screen)

function PickTeamScreen({ tweaks, setTweak }) {
  const [squad, setSquad] = React.useState(STARTING_XI);
  const [selected, setSelected] = React.useState(null); // {id, role: 'starter'|'bench'}
  const [showFormations, setShowFormations] = React.useState(false);
  const [showChips, setShowChips] = React.useState(false);
  const view = tweaks.pitchView || '2d';

  const captainAction = (id) => {
    setSquad(s => ({ ...s, viceCaptain: s.captain, captain: id }));
    setSelected(null);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <AppBackground />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 12px' }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, color: T.primary }}>GW 14 · DEADLINE 06:32:18</div>
            <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.5, marginTop: 2 }}>Pick Team</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <IconBtn icon="cog" onClick={() => setShowFormations(true)} />
            <IconBtn icon="bolt" onClick={() => setShowChips(true)} highlight />
          </div>
        </div>

        {/* Budget bar */}
        <div style={{ padding: '0 20px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 12,
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rmd,
          }}>
            <BudgetItem label="Squad" val="100.0" max="100.0" />
            <Sep />
            <BudgetItem label="Bank" val="0.5" />
            <Sep />
            <BudgetItem label="Free Tx" val="2" />
            <Sep />
            <BudgetItem label="Form" val={squad.formation} accent={T.cyan} />
          </div>
        </div>

        {/* View toggle */}
        <div style={{ padding: '0 20px 8px', display: 'flex', gap: 6 }}>
          {[
            { id: '2d',     label: '2D Pitch' },
            { id: '3d',     label: '3D View' },
            { id: 'list',   label: 'List' },
          ].map(v => (
            <Pill key={v.id} active={view === v.id} onClick={() => setTweak('pitchView', v.id)}>{v.label}</Pill>
          ))}
        </div>

        {/* Pitch / list */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: view === 'list' ? 'auto' : 'hidden' }}>
          {view === '2d' && <Pitch2D squad={squad} selected={selected} setSelected={setSelected} />}
          {view === '3d' && <Pitch3D squad={squad} selected={selected} setSelected={setSelected} />}
          {view === 'list' && <PitchList squad={squad} selected={selected} setSelected={setSelected} />}
        </div>

        {/* Bench */}
        {view !== 'list' && <Bench squad={squad} selected={selected} setSelected={setSelected} />}

        {/* Player action sheet */}
        {selected && (
          <PlayerActionSheet
            squad={squad}
            selection={selected}
            onClose={() => setSelected(null)}
            onCaptain={captainAction}
            onVice={(id) => { setSquad(s => ({...s, viceCaptain: id})); setSelected(null); }}
          />
        )}

        {/* Formation picker sheet */}
        {showFormations && (
          <FormationSheet
            current={squad.formation}
            onPick={(f) => { setSquad(s => ({...s, formation: f})); setShowFormations(false); }}
            onClose={() => setShowFormations(false)}
          />
        )}

        {/* Chips sheet */}
        {showChips && <ChipsSheet onClose={() => setShowChips(false)} />}
      </div>
    </div>
  );
}

function IconBtn({ icon, onClick, highlight }) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 40, borderRadius: 12, cursor: 'pointer',
      background: highlight ? `${T.primary}1F` : 'rgba(255,255,255,0.05)',
      border: `1px solid ${highlight ? `${T.primary}66` : T.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={icon} size={18} color={highlight ? T.primary : T.textDim} />
    </button>
  );
}

function BudgetItem({ label, val, max, accent }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: T.mono, fontSize: 8.5, color: T.textMute, fontWeight: 600, letterSpacing: 1, marginBottom: 1 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: T.display, fontSize: 14, fontWeight: 700, color: accent || T.text, letterSpacing: -0.3 }}>
        {val}{max && <span style={{ color: T.textMute, fontSize: 11, fontWeight: 500 }}>/{max}</span>}
      </div>
    </div>
  );
}
const Sep = () => <div style={{ width: 1, height: 24, background: T.border }}/>;

// ─── 2D pitch ───
function Pitch2D({ squad, selected, setSelected }) {
  const rows = [
    { key: 'FWD', ids: squad.FWD },
    { key: 'MID', ids: squad.MID },
    { key: 'DEF', ids: squad.DEF },
    { key: 'GK',  ids: squad.GK  },
  ];
  return (
    <div style={{ position: 'absolute', inset: '8px 14px 0', display: 'flex', flexDirection: 'column' }}>
      {/* pitch */}
      <div style={{
        flex: 1, position: 'relative', borderRadius: T.rlg, overflow: 'hidden',
        background: `linear-gradient(180deg, #0a3d1f 0%, #0d4a26 50%, #0a3d1f 100%)`,
        border: `1px solid ${T.borderSt}`,
      }}>
        {/* stripes */}
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute', left: 0, right: 0,
            top: `${i * 12.5}%`, height: '12.5%',
            background: i % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.05)',
          }}/>
        ))}
        {/* pitch markings */}
        <PitchLines />
        {/* radial glow under captain */}
        <div style={{
          position: 'absolute', inset: 0, padding: '14px 12px 18px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          {rows.map((r, idx) => (
            <div key={r.key} style={{
              display: 'flex', justifyContent: 'space-around', alignItems: 'center',
            }}>
              {r.ids.map(id => {
                const p = PLAYERS.find(x => x.id === id);
                const isCap = id === squad.captain;
                const isVice = id === squad.viceCaptain;
                const isSel = selected && selected.id === id;
                return <PitchPlayer key={id} p={p} isCap={isCap} isVice={isVice} isSel={isSel} onClick={() => setSelected({ id, role: 'starter' })} />;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PitchLines() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 140" preserveAspectRatio="none">
      <g stroke="rgba(255,255,255,0.18)" strokeWidth="0.4" fill="none">
        <rect x="2" y="2" width="96" height="136"/>
        <line x1="2" y1="70" x2="98" y2="70"/>
        <circle cx="50" cy="70" r="11"/>
        <circle cx="50" cy="70" r="0.8" fill="rgba(255,255,255,0.18)"/>
        {/* top box */}
        <rect x="22" y="2" width="56" height="18"/>
        <rect x="36" y="2" width="28" height="7"/>
        <path d="M 38 20 Q 50 28 62 20" />
        {/* bottom box */}
        <rect x="22" y="120" width="56" height="18"/>
        <rect x="36" y="131" width="28" height="7"/>
        <path d="M 38 120 Q 50 112 62 120" />
      </g>
    </svg>
  );
}

function PitchPlayer({ p, isCap, isVice, isSel, onClick, compact }) {
  const c = clubById(p.club);
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      position: 'relative', transition: 'transform 160ms', transform: isSel ? 'scale(1.08)' : 'scale(1)',
    }}>
      {/* shirt */}
      <div style={{
        width: compact ? 40 : 52, height: compact ? 44 : 56,
        position: 'relative',
        filter: isSel ? `drop-shadow(0 0 12px ${T.primary})` : 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))',
      }}>
        <Shirt club={c} />
        {isCap && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 18, height: 18, borderRadius: '50%',
            background: T.amber, color: '#000',
            fontFamily: T.display, fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }}>C</div>
        )}
        {isVice && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 18, height: 18, borderRadius: '50%',
            background: T.textDim, color: '#000',
            fontFamily: T.display, fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>V</div>
        )}
      </div>
      {/* name plate */}
      <div style={{
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
        borderRadius: 6, padding: '3px 6px', minWidth: 56,
        textAlign: 'center', border: `1px solid rgba(255,255,255,0.08)`,
      }}>
        <div style={{ fontFamily: T.display, fontSize: 10.5, fontWeight: 700, color: '#fff', letterSpacing: -0.1, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 70 }}>
          {p.n.split(' ').slice(-1).join(' ')}
        </div>
        <div style={{
          fontFamily: T.mono, fontSize: 9, fontWeight: 700,
          color: isCap ? T.amber : T.primary, marginTop: 1,
        }}>{isCap ? p.gw * 2 : p.gw}{isCap && <span style={{ color: T.amber }}> ×2</span>}</div>
      </div>
    </button>
  );
}

function Shirt({ club }) {
  // simple stylized jersey
  return (
    <svg viewBox="0 0 52 56" width="100%" height="100%">
      <defs>
        <linearGradient id={`sg-${club.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={club.primary} stopOpacity="1"/>
          <stop offset="1" stopColor={club.primary} stopOpacity="0.7"/>
        </linearGradient>
      </defs>
      <path d="M 14 4 L 4 10 L 8 22 L 14 20 L 14 52 Q 14 54 16 54 L 36 54 Q 38 54 38 52 L 38 20 L 44 22 L 48 10 L 38 4 L 32 6 Q 26 12 20 6 Z"
        fill={`url(#sg-${club.id})`} stroke="rgba(0,0,0,0.4)" strokeWidth="0.6"/>
      {/* collar */}
      <path d="M 20 6 Q 26 12 32 6 L 30 4 Q 26 8 22 4 Z" fill={club.secondary} opacity="0.9"/>
      {/* center stripe accent */}
      <rect x="25" y="14" width="2" height="36" fill={club.secondary} opacity="0.3"/>
    </svg>
  );
}

// ─── 3D pitch (perspective) ───
function Pitch3D({ squad, selected, setSelected }) {
  const rows = [
    { key: 'FWD', ids: squad.FWD, y: 0.18 },
    { key: 'MID', ids: squad.MID, y: 0.40 },
    { key: 'DEF', ids: squad.DEF, y: 0.62 },
    { key: 'GK',  ids: squad.GK,  y: 0.84 },
  ];
  return (
    <div style={{ position: 'absolute', inset: '8px 14px 0', perspective: 800 }}>
      <div style={{
        position: 'relative', height: '100%', borderRadius: T.rlg, overflow: 'hidden',
        transform: 'rotateX(28deg)', transformOrigin: 'center top',
        background: `linear-gradient(180deg, #0a3d1f 0%, #06291a 100%)`,
        border: `1px solid ${T.borderSt}`,
      }}>
        {[...Array(10)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute', left: 0, right: 0, top: `${i*10}%`, height: '10%',
            background: i % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.06)',
          }}/>
        ))}
        <PitchLines />
      </div>
      {/* players overlay (no transform so cards stay readable) */}
      <div style={{ position: 'absolute', inset: '8px 14px 0' }}>
        {rows.map(r => (
          <div key={r.key} style={{
            position: 'absolute', left: 0, right: 0, top: `${r.y * 100}%`,
            display: 'flex', justifyContent: 'space-around',
            transform: `translateY(-50%) scale(${1 - r.y * 0.18})`,
            transformOrigin: 'center',
          }}>
            {r.ids.map(id => {
              const p = PLAYERS.find(x => x.id === id);
              const isCap = id === squad.captain;
              const isVice = id === squad.viceCaptain;
              const isSel = selected && selected.id === id;
              return <PitchPlayer key={id} p={p} isCap={isCap} isVice={isVice} isSel={isSel} onClick={() => setSelected({ id, role: 'starter' })} compact />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── List view ───
function PitchList({ squad, selected, setSelected }) {
  const groups = [
    { key: 'GK',  ids: squad.GK },
    { key: 'DEF', ids: squad.DEF },
    { key: 'MID', ids: squad.MID },
    { key: 'FWD', ids: squad.FWD },
  ];
  return (
    <div style={{ padding: '0 20px 12px' }}>
      {groups.map(g => (
        <div key={g.key} style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: posColor(g.key), marginBottom: 6 }}>{g.key}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.ids.map(id => {
              const p = PLAYERS.find(x => x.id === id);
              return <PlayerListRow key={id} p={p} isCap={id === squad.captain} isVice={id === squad.viceCaptain} onClick={() => setSelected({ id, role: 'starter' })}/>;
            })}
          </div>
        </div>
      ))}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: T.textMute, marginBottom: 6 }}>BENCH</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {squad.bench.map(id => {
            const p = PLAYERS.find(x => x.id === id);
            return <PlayerListRow key={id} p={p} bench onClick={() => setSelected({ id, role: 'bench' })}/>;
          })}
        </div>
      </div>
    </div>
  );
}

function PlayerListRow({ p, isCap, isVice, bench, onClick }) {
  const c = clubById(p.club);
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
      background: bench ? 'rgba(255,255,255,0.02)' : T.surface,
      border: `1px solid ${T.border}`, borderRadius: T.rsm, cursor: 'pointer', textAlign: 'left',
    }}>
      <Crest club={c} size={32}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: -0.2 }}>{p.n}</div>
          {isCap && <div style={{ width: 16, height: 16, borderRadius: '50%', background: T.amber, color: '#000', fontFamily: T.display, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>C</div>}
          {isVice && <div style={{ width: 16, height: 16, borderRadius: '50%', background: T.textDim, color: '#000', fontFamily: T.display, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>V</div>}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 11, color: T.textDim, marginTop: 1 }}>{c.short} · GW {p.gw}</div>
      </div>
      <PosChip pos={p.pos}/>
      <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.text, minWidth: 40, textAlign: 'right' }}>{p.p}</div>
    </button>
  );
}

// ─── Bench ───
function Bench({ squad, selected, setSelected }) {
  return (
    <div style={{
      padding: '10px 14px 92px', position: 'relative',
      background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.3))',
    }}>
      <div style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: T.textMute, marginBottom: 6, paddingLeft: 6 }}>SUBS</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        background: 'rgba(255,255,255,0.03)', borderRadius: T.rmd,
        padding: '10px 6px', border: `1px solid ${T.border}`,
      }}>
        {squad.bench.map((id, idx) => {
          const p = PLAYERS.find(x => x.id === id);
          const isSel = selected && selected.id === id;
          return (
            <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -8, left: 8, fontFamily: T.mono, fontSize: 8.5, fontWeight: 700, color: T.textMute }}>{idx + 1}</div>
              <PitchPlayer p={p} isSel={isSel} onClick={() => setSelected({ id, role: 'bench' })} compact />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Action sheet ───
function PlayerActionSheet({ squad, selection, onClose, onCaptain, onVice }) {
  const p = PLAYERS.find(x => x.id === selection.id);
  const c = clubById(p.club);
  const isCap = squad.captain === p.id;
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Crest club={c} size={48} ring />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: -0.4 }}>{p.n}</div>
          <div style={{ fontFamily: T.font, fontSize: 12, color: T.textDim, marginTop: 2 }}>{c.name} · {p.pos} · {p.p}m</div>
        </div>
        <PosChip pos={p.pos} size="lg"/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 16 }}>
        <MiniStat l="GW" v={p.gw}/>
        <MiniStat l="Form" v={p.f}/>
        <MiniStat l="Total" v={p.t}/>
        <MiniStat l="Own" v={p.s + '%'}/>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SheetAction icon="cap" label={isCap ? 'Already Captain' : 'Make Captain'} disabled={isCap} onClick={() => onCaptain(p.id)} primary={!isCap}/>
        <SheetAction icon="star" label="Make Vice-Captain" onClick={() => onVice(p.id)} />
        <SheetAction icon="swap" label="Substitute" />
        <SheetAction icon="user" label="View Profile" />
        <SheetAction icon="x" label="Transfer Out" danger/>
      </div>
    </Sheet>
  );
}

function MiniStat({ l, v }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
      <div style={{ fontFamily: T.mono, fontSize: 8.5, color: T.textMute, fontWeight: 600, letterSpacing: 1 }}>{l.toUpperCase()}</div>
      <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 2 }}>{v}</div>
    </div>
  );
}

function SheetAction({ icon, label, onClick, primary, danger, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      background: primary ? T.primary : danger ? `${T.red}1A` : 'rgba(255,255,255,0.04)',
      border: `1px solid ${primary ? T.primary : danger ? `${T.red}55` : T.border}`,
      borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
      fontFamily: T.display, fontSize: 14, fontWeight: 600,
      color: primary ? '#000' : danger ? T.red : T.text, textAlign: 'left',
    }}>
      <Icon name={icon} size={18} color={primary ? '#000' : danger ? T.red : T.textDim} sw={2}/>
      {label}
    </button>
  );
}

function Sheet({ children, onClose, title }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 30 }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 31,
        background: T.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        border: `1px solid ${T.borderSt}`, borderBottom: 'none',
        padding: '14px 18px 36px', maxHeight: '70%', overflow: 'auto',
        animation: 'bf-sheet-up 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 14px' }}/>
        {title && <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 14 }}>{title}</div>}
        {children}
      </div>
      <style>{`@keyframes bf-sheet-up { from {transform: translateY(20px); opacity:0} to {transform: translateY(0); opacity:1} }`}</style>
    </>
  );
}

function FormationSheet({ current, onPick, onClose }) {
  return (
    <Sheet onClose={onClose} title="Choose Formation">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {Object.keys(FORMATIONS).map(f => {
          const active = f === current;
          return (
            <button key={f} onClick={() => onPick(f)} style={{
              padding: 14, border: `1px solid ${active ? T.primary : T.border}`,
              background: active ? `${T.primary}1F` : 'rgba(255,255,255,0.03)',
              borderRadius: T.rmd, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <FormationMini f={f} active={active}/>
              <div style={{ fontFamily: T.display, fontSize: 14, fontWeight: 700, color: active ? T.primary : T.text }}>{f}</div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function FormationMini({ f, active }) {
  const conf = FORMATIONS[f];
  const rows = [conf.FWD, conf.MID, conf.DEF, 1];
  return (
    <div style={{ width: 60, height: 80, background: active ? `${T.primary}33` : 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 4, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
      {rows.map((n, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-around' }}>
          {[...Array(n)].map((_, j) => <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: active ? T.primary : T.textDim }}/>)}
        </div>
      ))}
    </div>
  );
}

function ChipsSheet({ onClose }) {
  return (
    <Sheet onClose={onClose} title="Chips">
      <div style={{ fontFamily: T.font, fontSize: 12, color: T.textDim, marginTop: -8, marginBottom: 14 }}>One chip per gameweek. Use them wisely.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CHIPS.map(c => <ChipRow key={c.id} c={c}/>)}
      </div>
    </Sheet>
  );
}

function ChipRow({ c }) {
  const accent = c.special ? T.amber : T.primary;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: 14,
      background: c.used ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${c.used ? T.border : `${accent}33`}`,
      borderRadius: T.rmd, opacity: c.used ? 0.5 : 1,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: `${accent}1F`, border: `1px solid ${accent}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.display, fontSize: 18, fontWeight: 800, color: accent,
      }}>{c.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontFamily: T.display, fontSize: 14, fontWeight: 700, color: T.text }}>{c.name}</div>
          {c.special && <span style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: T.amber, background: `${T.amber}22`, padding: '2px 5px', borderRadius: 4 }}>NEW</span>}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 11.5, color: T.textDim, marginTop: 2, lineHeight: 1.35 }}>{c.desc}</div>
      </div>
      {c.used ? (
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMute, fontWeight: 700 }}>USED GW{c.usedGw}</div>
      ) : (
        <button style={{
          padding: '7px 12px', borderRadius: 8, border: `1px solid ${accent}`,
          background: 'transparent', color: accent, cursor: 'pointer',
          fontFamily: T.display, fontSize: 12, fontWeight: 700,
        }}>Use</button>
      )}
    </div>
  );
}

Object.assign(window, { PickTeamScreen });
