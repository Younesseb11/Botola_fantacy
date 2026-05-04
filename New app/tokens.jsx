// tokens.jsx — Design tokens + shared UI primitives for Botola Fantasy
// Modern dark sports app, FPL-energy with Moroccan-inflected accents.

const T = {
  // Surfaces
  bg:       '#06070D',
  bg2:      '#0B0E1A',
  surface:  '#10142A',
  surface2: '#161B33',
  card:     '#1A2040',
  border:   'rgba(255,255,255,0.08)',
  borderSt: 'rgba(255,255,255,0.14)',

  // Text
  text:     '#F4F6FF',
  textDim:  '#A6ADD0',
  textMute: '#6B7299',

  // Brand accents (FPL-energy palette: cyan + lime + magenta)
  primary:  '#00FF87',   // FPL lime
  primaryD: '#00CC6B',
  cyan:     '#04F5FF',
  magenta:  '#E90052',
  amber:    '#FFB31A',
  red:      '#FF3B57',

  // Position colors
  posGK:  '#FFB31A',
  posDEF: '#04F5FF',
  posMID: '#00FF87',
  posFWD: '#E90052',

  // Radii / shadows
  rxs: 8, rsm: 12, rmd: 16, rlg: 20, rxl: 28,
  shadow: '0 8px 24px -8px rgba(0,0,0,0.6)',
  glow:   '0 0 32px -4px rgba(0, 255, 135, 0.35)',

  // Type
  font: '"Space Grotesk", "Inter", -apple-system, system-ui, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
  display: '"Space Grotesk", "Inter", system-ui, sans-serif',
};

// Position color helper
const posColor = (pos) => ({GK: T.posGK, DEF: T.posDEF, MID: T.posMID, FWD: T.posFWD}[pos]);

// ─────────────────────────────────────────────────────────────
// Club crest — stylized monogram badge (no real logos)
// ─────────────────────────────────────────────────────────────
function Crest({ club, size = 36, ring = false }) {
  const c = typeof club === 'string' ? clubById(club) : club;
  if (!c) return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: `linear-gradient(155deg, ${c.crestBg} 0%, ${c.crestBg}DD 60%, #000 200%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: c.crestFg, fontFamily: T.display, fontWeight: 800,
      fontSize: size * 0.5, letterSpacing: -0.5,
      boxShadow: ring ? `0 0 0 2px rgba(255,255,255,0.18), 0 6px 14px -4px ${c.crestBg}80` : '0 2px 6px rgba(0,0,0,0.4)',
      flexShrink: 0, position: 'relative', overflow: 'hidden',
    }}>
      {c.logo_url ? (
        <img src={c.logo_url} alt={c.short} style={{ width: '80%', height: '80%', objectFit: 'contain', position: 'relative', zIndex: 1 }} />
      ) : (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.18), transparent 50%)',
            pointerEvents: 'none',
          }} />
          <span style={{ position: 'relative', zIndex: 1 }}>{c.glyph}</span>
        </>
      )}
    </div>
  );
}

// Tiny pos chip
function PosChip({ pos, size = 'sm' }) {
  const c = posColor(pos);
  const fs = size === 'lg' ? 11 : 9.5;
  const py = size === 'lg' ? 4 : 2.5;
  const px = size === 'lg' ? 8 : 6;
  return (
    <span style={{
      fontFamily: T.font, fontSize: fs, fontWeight: 700, letterSpacing: 0.5,
      color: c, background: `${c}1F`, border: `1px solid ${c}55`,
      padding: `${py}px ${px}px`, borderRadius: 6, lineHeight: 1,
      display: 'inline-flex', alignItems: 'center', textTransform: 'uppercase',
    }}>{pos}</span>
  );
}

// Pill button
function Pill({ children, active, onClick, color = T.primary, style }) {
  return (
    <button onClick={onClick} style={{
      border: 'none', cursor: 'pointer',
      fontFamily: T.font, fontSize: 12, fontWeight: 600, letterSpacing: 0.2,
      color: active ? '#000' : T.text,
      background: active ? color : 'rgba(255,255,255,0.06)',
      padding: '8px 14px', borderRadius: 999,
      transition: 'all 160ms ease',
      ...style,
    }}>{children}</button>
  );
}

// Section header
function SectionHeader({ kicker, title, action, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 20px', marginBottom: 12 }}>
      <div>
        {kicker && <div style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: T.primary, textTransform: 'uppercase', marginBottom: 2 }}>{kicker}</div>}
        <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: -0.4 }}>{title}</div>
      </div>
      {action && <button onClick={onAction} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: T.font, fontSize: 12, fontWeight: 600, color: T.textDim,
      }}>{action} →</button>}
    </div>
  );
}

// Card surface
function Card({ children, style, glow }) {
  return (
    <div style={{
      background: `linear-gradient(180deg, ${T.surface} 0%, ${T.bg2} 100%)`,
      border: `1px solid ${T.border}`,
      borderRadius: T.rmd,
      padding: 16,
      boxShadow: glow ? T.glow : T.shadow,
      ...style,
    }}>{children}</div>
  );
}

// Stat block
function Stat({ label, value, accent, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <div style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: 1.2, color: T.textMute, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: accent || T.text, letterSpacing: -0.6, lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 500, color: T.textDim }}>{sub}</div>}
    </div>
  );
}

// Tab bar at the bottom
function TabBar({ active, onChange, tweaks }) {
  const tabs = [
    { id: 'home',     label: 'Home',     icon: 'home' },
    { id: 'pick',     label: 'Pick Team',icon: 'pitch' },
    { id: 'transfers',label: 'Fixtures',   icon: 'swap' },
    { id: 'live',     label: 'Live',     icon: 'live' },
    { id: 'leagues',  label: 'Leagues',  icon: 'cup' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(180deg, rgba(6,7,13,0) 0%, rgba(6,7,13,0.92) 35%, rgba(6,7,13,1) 100%)',
      paddingBottom: 28, paddingTop: 12,
      display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
      zIndex: 10,
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '6px 8px', minWidth: 56, position: 'relative',
          }}>
            <TabIcon name={t.icon} active={isActive} />
            <div style={{
              fontFamily: T.font, fontSize: 9.5, fontWeight: 600, letterSpacing: 0.3,
              color: isActive ? T.primary : T.textMute,
            }}>{t.label}</div>
            {isActive && <div style={{
              position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
              width: 28, height: 3, borderRadius: 2, background: T.primary,
              boxShadow: `0 0 12px ${T.primary}`,
            }} />}
          </button>
        );
      })}
    </div>
  );
}

function TabIcon({ name, active }) {
  const c = active ? T.primary : T.textMute;
  const sw = active ? 2.2 : 1.8;
  const props = { width: 22, height: 22, fill: 'none', stroke: c, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home':  return <svg {...props} viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>;
    case 'pitch': return <svg {...props} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><circle cx="12" cy="12" r="2.4"/><path d="M3 8h3v8H3M21 8h-3v8h3"/></svg>;
    case 'swap':  return <svg {...props} viewBox="0 0 24 24"><path d="M7 4l-4 4 4 4"/><path d="M3 8h13a4 4 0 014 4"/><path d="M17 20l4-4-4-4"/><path d="M21 16H8a4 4 0 01-4-4"/></svg>;
    case 'live':  return <svg {...props} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill={c}/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="10"/></svg>;
    case 'cup':   return <svg {...props} viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 01-10 0V4z"/><path d="M7 6H4a3 3 0 003 3M17 6h3a3 3 0 01-3 3"/><path d="M9 16h6M10 20h4M12 14v2"/></svg>;
    default: return null;
  }
}

// Generic icon
function Icon({ name, size = 18, color = T.text, sw = 1.8 }) {
  const props = { width: size, height: size, fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'arrow-up':   return <svg {...props} viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case 'arrow-down': return <svg {...props} viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>;
    case 'arrow-right':return <svg {...props} viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
    case 'chevron-r':  return <svg {...props} viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevron-l':  return <svg {...props} viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>;
    case 'plus':       return <svg {...props} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>;
    case 'x':          return <svg {...props} viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'search':     return <svg {...props} viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>;
    case 'filter':     return <svg {...props} viewBox="0 0 24 24"><path d="M3 5h18M6 12h12M10 19h4"/></svg>;
    case 'star':       return <svg {...props} viewBox="0 0 24 24"><path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9L12 3z"/></svg>;
    case 'bolt':       return <svg {...props} viewBox="0 0 24 24"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>;
    case 'fire':       return <svg {...props} viewBox="0 0 24 24"><path d="M12 2s4 4 4 8a4 4 0 01-8 0c0-2 2-3 2-5 0 0 2 1 2-3z"/><path d="M12 22a6 6 0 006-6c0-3-3-4-3-7 0 0-3 3-3 7 0 0-3-2-3-4 0 3 0 5-3 6a6 6 0 006 4z" opacity=".6"/></svg>;
    case 'shield':     return <svg {...props} viewBox="0 0 24 24"><path d="M12 2l8 3v7a9 9 0 01-8 10 9 9 0 01-8-10V5l8-3z"/></svg>;
    case 'bell':       return <svg {...props} viewBox="0 0 24 24"><path d="M6 8a6 6 0 0112 0v5l2 3H4l2-3V8z"/><path d="M10 20a2 2 0 004 0"/></svg>;
    case 'user':       return <svg {...props} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>;
    case 'cog':        return <svg {...props} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.4.9a7 7 0 00-2.1-1.2L14 3h-4l-.4 2.6a7 7 0 00-2.1 1.2l-2.4-.9-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-.9a7 7 0 002.1 1.2L10 21h4l.4-2.6a7 7 0 002.1-1.2l2.4.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>;
    case 'cap':        return <svg {...props} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>;
    case 'check':      return <svg {...props} viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>;
    case 'eye':        return <svg {...props} viewBox="0 0 24 24"><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'trend-up':   return <svg {...props} viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8M14 7h7v7"/></svg>;
    case 'medal':      return <svg {...props} viewBox="0 0 24 24"><circle cx="12" cy="14" r="6"/><path d="M8 4l4 5 4-5M9 14l1 2M15 14l-1 2"/></svg>;
    default: return null;
  }
}

// Background — subtle Moroccan zellige hint + glow
function AppBackground() {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: T.bg, zIndex: 0 }} />
      <div style={{
        position: 'absolute', top: -120, left: -80, width: 360, height: 360,
        background: `radial-gradient(circle, ${T.primary}22 0%, transparent 60%)`,
        filter: 'blur(40px)', zIndex: 0, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 200, right: -100, width: 300, height: 300,
        background: `radial-gradient(circle, ${T.cyan}1A 0%, transparent 60%)`,
        filter: 'blur(40px)', zIndex: 0, pointerEvents: 'none',
      }} />
    </>
  );
}

Object.assign(window, { T, posColor, Crest, PosChip, Pill, SectionHeader, Card, Stat, TabBar, Icon, AppBackground });
