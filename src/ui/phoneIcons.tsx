import React from 'react';

// Flat, hand-drawn SVG artwork for the campus phone and HUD launchers. Kept in-repo (no icon
// font or third-party licence); every glyph is white on a coloured app tile.

/** The phone launcher: a little flat smartphone with a lit home screen. */
export function PhoneLauncherArt({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="8" y="2" width="16" height="28" rx="4" fill="#1d2b36" />
      <rect x="9.5" y="4.5" width="13" height="22" rx="2" fill="#2fbf71" />
      <rect x="9.5" y="4.5" width="13" height="22" rx="2" fill="url(#phone-sheen)" />
      <rect x="13.5" y="3" width="5" height="1" rx="0.5" fill="#0f1a22" />
      {[[11, 8, '#ffd166'], [15, 8, '#ef476f'], [19, 8, '#4cc9f0'], [11, 12, '#f8f9fa'], [15, 12, '#ff9f1c'], [19, 12, '#9b5de5']].map(([x, y, c], i) => (
        <rect key={i} x={x as number} y={y as number} width="2.6" height="2.6" rx="0.7" fill={c as string} />
      ))}
      <rect x="13" y="27.6" width="6" height="1" rx="0.5" fill="#55636e" />
      <defs>
        <linearGradient id="phone-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Flat house for the hostel gate launcher. */
export function HostelLauncherArt({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 15 16 5l12 10" fill="none" stroke="#9a3412" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 14h18v14H7z" fill="#f2c57c" />
      <path d="M7 14h18v3H7z" fill="#e0a85a" />
      <rect x="13.5" y="19" width="5" height="9" rx="1" fill="#7c4a2d" />
      <rect x="9" y="18" width="3" height="3" rx="0.6" fill="#4cc9f0" />
      <rect x="20" y="18" width="3" height="3" rx="0.6" fill="#4cc9f0" />
    </svg>
  );
}

// 24×24 white glyphs for app tiles.
const W = '#fff';
export const APP_GLYPHS: Record<string, React.ReactNode> = {
  profile: <><circle cx="12" cy="8.5" r="4" fill={W} /><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6z" fill={W} /></>,
  hostel: <><path d="M3 11.5 12 4l9 7.5" fill="none" stroke={W} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 11h12v9H6z" fill={W} /><rect x="10.5" y="14" width="3" height="6" fill="#00000033" /></>,
  friends: <><circle cx="8.5" cy="9" r="3.2" fill={W} /><circle cx="16" cy="8" r="2.7" fill={W} opacity=".8" /><path d="M2.5 19c.6-3.3 3-5 6-5s5.4 1.7 6 5z" fill={W} /><path d="M14 13.2c3.3-.6 6.6 1 7.4 4.8h-5.3c-.4-1.9-1-3.5-2.1-4.8z" fill={W} opacity=".8" /></>,
  messages: <><path d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17h-9l-4.5 3.5V17H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 5z" fill={W} /><circle cx="8" cy="11" r="1.2" fill="#00000040" /><circle cx="12" cy="11" r="1.2" fill="#00000040" /><circle cx="16" cy="11" r="1.2" fill="#00000040" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2.5" fill={W} /><path d="M3 9h18" stroke="#00000030" strokeWidth="1.5" /><rect x="14.5" y="11.5" width="6.5" height="4" rx="1.5" fill="#00000030" /><circle cx="17" cy="13.5" r="1" fill={W} /></>,
  jobs: <><rect x="3" y="8" width="18" height="11.5" rx="2" fill={W} /><path d="M9 8V6.2A1.2 1.2 0 0 1 10.2 5h3.6A1.2 1.2 0 0 1 15 6.2V8" fill="none" stroke={W} strokeWidth="2" /><path d="M3 13h18" stroke="#00000030" strokeWidth="1.5" /></>,
  map: <><path d="M3 6.5 8.5 4.5l7 2 5.5-2v13l-5.5 2-7-2L3 19.5z" fill={W} /><path d="M8.5 4.5v13M15.5 6.5v13" stroke="#00000030" strokeWidth="1.4" /><circle cx="12" cy="10" r="1.8" fill="#ef476f" /></>,
  inventory: <><path d="M6 9.5h12l-1 10.5H7z" fill={W} /><path d="M9 9.5V7.5a3 3 0 0 1 6 0v2" fill="none" stroke={W} strokeWidth="2" /><rect x="9.5" y="13" width="5" height="2.4" rx="1" fill="#00000030" /></>,
  timetable: <><rect x="3.5" y="5.5" width="17" height="15" rx="2.5" fill={W} /><path d="M3.5 9.5h17" stroke="#00000035" strokeWidth="2" /><path d="M8 3.5v4M16 3.5v4" stroke={W} strokeWidth="2" strokeLinecap="round" />{[7.5, 12, 16.5].map((x) => [13, 16.5].map((y) => <rect key={`${x}-${y}`} x={x - 1.3} y={y - 1.1} width="2.6" height="2.2" rx=".5" fill="#00000030" />))}</>,
  daily: <><rect x="4" y="10" width="16" height="10" rx="1.5" fill={W} /><rect x="3" y="7.5" width="18" height="4" rx="1.2" fill={W} /><path d="M12 7.5V20" stroke="#00000035" strokeWidth="2" /><path d="M12 7.5c-1.5-3.5-5.5-3.5-5-1 .3 1.4 3 1 5 1zm0 0c1.5-3.5 5.5-3.5 5-1-.3 1.4-3 1-5 1z" fill={W} /></>,
  feedback: <><rect x="4" y="3.5" width="12.5" height="17" rx="2" fill={W} /><path d="M7 8h6.5M7 11h6.5M7 14h4" stroke="#00000035" strokeWidth="1.5" strokeLinecap="round" /><path d="m14.5 18.5 1-3.6 5.4-5.4a1.6 1.6 0 0 1 2.3 2.3l-5.4 5.4z" fill={W} stroke="#00000045" strokeWidth=".9" strokeLinejoin="round" /><path d="m14.5 18.5 1-3.6 2.6 2.6z" fill="#00000045" /></>,
  soundOn: <><path d="M3.5 9.5v5h3.5l5 4v-13l-5 4z" fill={W} /><path d="M15 9a4.2 4.2 0 0 1 0 6M17.6 6.5a7.8 7.8 0 0 1 0 11" fill="none" stroke={W} strokeWidth="1.9" strokeLinecap="round" /></>,
  soundOff: <><path d="M3.5 9.5v5h3.5l5 4v-13l-5 4z" fill={W} /><path d="m15.5 9.5 5 5m0-5-5 5" stroke={W} strokeWidth="2" strokeLinecap="round" /></>,
  help: <><circle cx="12" cy="12" r="9" fill={W} /><path d="M9.3 9.5a2.8 2.8 0 1 1 3.8 2.6c-.8.3-1.1.9-1.1 1.7v.4" fill="none" stroke="#00000055" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="17.2" r="1.2" fill="#00000055" /></>,
  signout: <><path d="M5 4h8v16H5z" fill={W} /><circle cx="11" cy="12" r=".9" fill="#00000050" /><path d="M14.5 12H21m-2.5-3 3 3-3 3" fill="none" stroke={W} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>,
};

export function AppTile({ glyph, colors }: { glyph: string; colors: [string, string] }) {
  return (
    <span
      className="campus-app-tile"
      style={{ background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})` }}
    >
      <svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden="true">{APP_GLYPHS[glyph]}</svg>
    </span>
  );
}
