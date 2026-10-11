import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useGameStore, NavigationDestination } from '../stores/gameStore';
import {
  getAllCampusLocations,
  CampusRegistryLocation,
  CampusCategory,
  worldToSvgCoords,
  getCampusRoadNetwork,
  CAMPUS_MAP_BOUNDS,
} from '../config/campusRegistry';
import {
  X,
  Compass,
  Navigation,
  Crosshair,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MapPin,
  Layers,
  Search,
  Check,
} from 'lucide-react';

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 880;
const MARGIN = 45;

export const CampusMapModal: React.FC = () => {
  const {
    myPosition,
    myRotation,
    navigationDestination,
    setNavigationDestination,
    clearNavigationDestination,
    closeMap,
  } = useGameStore();

  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedLocation, setSelectedLocation] = useState<CampusRegistryLocation | null>(null);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CampusCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const touchStartDist = useRef<number | null>(null);

  const allLocations = useMemo(() => getAllCampusLocations(), []);
  const roadNetwork = useMemo(() => getCampusRoadNetwork(), []);

  // Filtered locations
  const filteredLocations = useMemo(() => {
    return allLocations.filter((loc) => {
      const matchesCategory = activeCategory === 'all' || loc.category === activeCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allLocations, activeCategory, searchQuery]);

  // Convert player position to SVG coordinates
  const playerSvg = useMemo(() => {
    return worldToSvgCoords(myPosition[0], myPosition[2], SVG_WIDTH, SVG_HEIGHT, MARGIN);
  }, [myPosition]);

  // Player distance from selected location
  const distanceToSelected = useMemo(() => {
    if (!selectedLocation) return null;
    const dist = Math.hypot(
      myPosition[0] - selectedLocation.position[0],
      myPosition[2] - selectedLocation.position[2]
    );
    return Math.round(dist);
  }, [myPosition, selectedLocation]);

  // Auto-select if there is an active navigation destination
  useEffect(() => {
    if (navigationDestination && !selectedLocation) {
      const loc = allLocations.find((l) => l.id === navigationDestination.id);
      if (loc) setSelectedLocation(loc);
    }
  }, [navigationDestination, allLocations, selectedLocation]);

  // Keyboard navigation & Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMap();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeMap]);

  // Center on player smoothly
  const handleRecenterOnPlayer = useCallback(() => {
    const { svgX, svgY } = playerSvg;
    // Target SVG center is (500, 440)
    setPan({
      x: (SVG_WIDTH / 2 - svgX) * zoom,
      y: (SVG_HEIGHT / 2 - svgY) * zoom,
    });
  }, [playerSvg, zoom]);

  // Center on a specific location
  const handleLocateLocation = useCallback(
    (loc: CampusRegistryLocation) => {
      const { svgX, svgY } = worldToSvgCoords(loc.position[0], loc.position[2], SVG_WIDTH, SVG_HEIGHT, MARGIN);
      const targetZoom = Math.max(zoom, 1.4);
      setZoom(targetZoom);
      setPan({
        x: (SVG_WIDTH / 2 - svgX) * targetZoom,
        y: (SVG_HEIGHT / 2 - svgY) * targetZoom,
      });
      setSelectedLocation(loc);
    },
    [zoom]
  );

  // Reset map view
  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(3.2, z + 0.3));
  const handleZoomOut = () => setZoom((z) => Math.max(0.75, z - 0.3));

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((z) => Math.min(3.2, Math.max(0.75, z * zoomFactor)));
  };

  // Mouse drag pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Touch pan & pinch zoom for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - lastMousePos.current.x;
      const dy = e.touches[0].clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else if (e.touches.length === 2 && touchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartDist.current;
      touchStartDist.current = dist;
      setZoom((z) => Math.min(3.2, Math.max(0.75, z * ratio)));
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    touchStartDist.current = null;
  };

  // Set / Clear destination toggle
  const handleToggleDestination = (loc: CampusRegistryLocation) => {
    if (navigationDestination?.id === loc.id) {
      clearNavigationDestination();
    } else {
      const dest: NavigationDestination = {
        id: loc.id,
        name: loc.name,
        shortName: loc.shortName,
        position: loc.entrance || loc.position,
        category: loc.category,
        icon: loc.icon,
      };
      setNavigationDestination(dest);
    }
  };

  const categories: { id: CampusCategory | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: '🗺️' },
    { id: 'college', label: 'Colleges', icon: '🏛️' },
    { id: 'library', label: 'Library', icon: '📚' },
    { id: 'food', label: 'Food', icon: '🍲' },
    { id: 'transport', label: 'Transport', icon: '🛺' },
    { id: 'sports', label: 'Sports', icon: '⚽' },
    { id: 'hostel', label: 'Hostel', icon: '🏠' },
    { id: 'service', label: 'Services', icon: '🏧' },
    { id: 'landmark', label: 'Landmarks', icon: '⭐' },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md font-['Plus_Jakarta_Sans'] select-none animate-in fade-in"
      onClick={closeMap}
    >
      <div
        className="relative w-full max-w-6xl h-[95vh] sm:h-[90vh] rounded-3xl bg-[#0a1412] border-2 border-emerald-500/40 shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── 1. TOP HEADER & CATEGORY BAR ─── */}
        <div className="flex flex-col gap-2.5 px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#061914] via-[#09221b] to-[#061914] border-b border-emerald-500/30 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-inner">
                <Compass className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white font-['Outfit'] tracking-wider uppercase flex items-center gap-2 leading-tight">
                  CAMPUS DIRECTORY & MAP
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-black uppercase">
                    Live
                  </span>
                </h2>
                <p className="text-[11px] text-emerald-200/70 hidden sm:block">
                  Federal University of Agriculture, Abeokuta (FUNAAB) • Interactive 3D World Spatial Map
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={closeMap}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-red-950/80 text-slate-400 hover:text-white border border-slate-700/60 transition"
              title="Close Map (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Category Filter Pills & Search */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-1">
            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar py-0.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                    activeCategory === cat.id
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Quick Search Input */}
            <div className="relative min-w-[140px] max-w-[220px] hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search building..."
                className="w-full pl-8 pr-3 py-1 text-xs rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── 2. MAP CANVAS VIEWPORT ─── */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative flex-1 bg-[#12231e] overflow-hidden cursor-grab active:cursor-grabbing select-none"
        >
          {/* Transforming SVG Viewport */}
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out origin-center pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full h-full max-w-none max-h-none pointer-events-auto overflow-visible"
              style={{
                filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.6))',
              }}
            >
              <defs>
                {/* Grass & Terrain Pattern */}
                <radialGradient id="campusGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#254238" />
                  <stop offset="65%" stopColor="#1b332b" />
                  <stop offset="100%" stopColor="#12241e" />
                </radialGradient>

                {/* Building Drop Shadow */}
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.45" />
                </filter>
                <filter id="glowGreen" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#10b981" floodOpacity="0.9" />
                </filter>
              </defs>

              {/* Campus Boundary Base Plate */}
              <rect
                x="20"
                y="20"
                width={SVG_WIDTH - 40}
                height={SVG_HEIGHT - 40}
                rx="28"
                fill="url(#campusGlow)"
                stroke="#2b5043"
                strokeWidth="4"
              />

              {/* Perimeter Fence Line */}
              <rect
                x="30"
                y="30"
                width={SVG_WIDTH - 60}
                height={SVG_HEIGHT - 60}
                rx="22"
                fill="none"
                stroke="#17352b"
                strokeWidth="2"
                strokeDasharray="8 6"
              />

              {/* ─── A. FOOTBALL PITCH & SPORTS CENTRE AT [-100, 0] ─── */}
              {(() => {
                const pitchCoord = worldToSvgCoords(-100, 0, SVG_WIDTH, SVG_HEIGHT, MARGIN);
                return (
                  <g transform={`translate(${pitchCoord.svgX - 55}, ${pitchCoord.svgY - 70})`}>
                    {/* Green Turf */}
                    <rect x="0" y="0" width="110" height="140" rx="8" fill="#1b5e20" stroke="#2e7d32" strokeWidth="2" />
                    {/* White Markings */}
                    <rect x="8" y="8" width="94" height="124" fill="none" stroke="#e8f5e9" strokeWidth="1.5" opacity="0.65" />
                    <line x1="8" y1="70" x2="102" y2="70" stroke="#e8f5e9" strokeWidth="1.5" opacity="0.65" />
                    <circle cx="55" cy="70" r="16" fill="none" stroke="#e8f5e9" strokeWidth="1.5" opacity="0.65" />
                    <circle cx="55" cy="70" r="2.5" fill="#e8f5e9" opacity="0.8" />
                    {/* Goal Boxes */}
                    <rect x="30" y="8" width="50" height="20" fill="none" stroke="#e8f5e9" strokeWidth="1.5" opacity="0.65" />
                    <rect x="30" y="112" width="50" height="20" fill="none" stroke="#e8f5e9" strokeWidth="1.5" opacity="0.65" />
                  </g>
                );
              })()}

              {/* ─── B. PAVED ROAD NETWORK ─── */}
              <g id="roads">
                {/* 1. Road base / asphalt lines */}
                {roadNetwork.edges.map(([nodeA, nodeB], idx) => {
                  const p1 = roadNetwork.nodes[nodeA];
                  const p2 = roadNetwork.nodes[nodeB];
                  if (!p1 || !p2) return null;
                  const c1 = worldToSvgCoords(p1[0], p1[2], SVG_WIDTH, SVG_HEIGHT, MARGIN);
                  const c2 = worldToSvgCoords(p2[0], p2[2], SVG_WIDTH, SVG_HEIGHT, MARGIN);
                  return (
                    <g key={`road-${idx}`}>
                      {/* Pavement border */}
                      <line
                        x1={c1.svgX}
                        y1={c1.svgY}
                        x2={c2.svgX}
                        y2={c2.svgY}
                        stroke="#2f3739"
                        strokeWidth="24"
                        strokeLinecap="round"
                      />
                      {/* Asphalt dark road */}
                      <line
                        x1={c1.svgX}
                        y1={c1.svgY}
                        x2={c2.svgX}
                        y2={c2.svgY}
                        stroke="#475254"
                        strokeWidth="18"
                        strokeLinecap="round"
                      />
                      {/* Dashed center yellow line */}
                      <line
                        x1={c1.svgX}
                        y1={c1.svgY}
                        x2={c2.svgX}
                        y2={c2.svgY}
                        stroke="#fbbf24"
                        strokeWidth="2"
                        strokeDasharray="8 6"
                        opacity="0.85"
                      />
                    </g>
                  );
                })}

                {/* 2. Pedestrian pathways */}
                {roadNetwork.pedestrianPaths.map((p) => {
                  const midX = (p.bounds.minX + p.bounds.maxX) / 2;
                  const midZ = (p.bounds.minZ + p.bounds.maxZ) / 2;
                  const c = worldToSvgCoords(midX, midZ, SVG_WIDTH, SVG_HEIGHT, MARGIN);
                  const w = Math.max(8, ((p.bounds.maxX - p.bounds.minX) / (CAMPUS_MAP_BOUNDS.maxX - CAMPUS_MAP_BOUNDS.minX)) * (SVG_WIDTH - MARGIN * 2));
                  const h = Math.max(8, ((p.bounds.maxZ - p.bounds.minZ) / (CAMPUS_MAP_BOUNDS.maxZ - CAMPUS_MAP_BOUNDS.minZ)) * (SVG_HEIGHT - MARGIN * 2));
                  return (
                    <rect
                      key={p.id}
                      x={c.svgX - w / 2}
                      y={c.svgY - h / 2}
                      width={w}
                      height={h}
                      rx="3"
                      fill="#818c86"
                      opacity="0.45"
                    />
                  );
                })}
              </g>

              {/* ─── C. BUILDING FOOTPRINTS ─── */}
              <g id="building-footprints">
                {allLocations.map((loc) => {
                  const { svgX, svgY } = worldToSvgCoords(loc.position[0], loc.position[2], SVG_WIDTH, SVG_HEIGHT, MARGIN);
                  const isSelected = selectedLocation?.id === loc.id;
                  const isHovered = hoveredLocationId === loc.id;
                  const w = Math.max(30, (loc.footprint[0] / (CAMPUS_MAP_BOUNDS.maxX - CAMPUS_MAP_BOUNDS.minX)) * (SVG_WIDTH - MARGIN * 2) * 1.5);
                  const d = Math.max(22, (loc.footprint[1] / (CAMPUS_MAP_BOUNDS.maxZ - CAMPUS_MAP_BOUNDS.minZ)) * (SVG_HEIGHT - MARGIN * 2) * 1.5);

                  return (
                    <g
                      key={`footprint-${loc.id}`}
                      transform={`translate(${svgX}, ${svgY})`}
                      className="cursor-pointer transition-transform"
                      onClick={() => setSelectedLocation(loc)}
                      onMouseEnter={() => setHoveredLocationId(loc.id)}
                      onMouseLeave={() => setHoveredLocationId(null)}
                    >
                      {/* Building base footprint */}
                      <rect
                        x={-w / 2}
                        y={-d / 2}
                        width={w}
                        height={d}
                        rx="6"
                        fill={isSelected ? '#064e3b' : isHovered ? '#1e3831' : '#152b24'}
                        stroke={isSelected ? '#34d399' : loc.color || '#334155'}
                        strokeWidth={isSelected ? '3.5' : '2'}
                        filter="url(#shadow)"
                      />

                      {/* Roof structure line decoration */}
                      <rect
                        x={-w / 2 + 3}
                        y={-d / 2 + 3}
                        width={w - 6}
                        height={d - 6}
                        rx="4"
                        fill="none"
                        stroke={loc.color || '#475569'}
                        strokeWidth="1"
                        opacity={isSelected ? '0.9' : '0.4'}
                      />
                    </g>
                  );
                })}
              </g>

              {/* ─── D. INTERACTIVE BUILDING MARKER PINS ─── */}
              <g id="location-pins">
                {filteredLocations.map((loc) => {
                  const { svgX, svgY } = worldToSvgCoords(loc.position[0], loc.position[2], SVG_WIDTH, SVG_HEIGHT, MARGIN);
                  const isSelected = selectedLocation?.id === loc.id;
                  const isHovered = hoveredLocationId === loc.id;
                  const isDest = navigationDestination?.id === loc.id;

                  return (
                    <g
                      key={`pin-${loc.id}`}
                      transform={`translate(${svgX}, ${svgY})`}
                      className="cursor-pointer transition-transform group"
                      onClick={() => setSelectedLocation(loc)}
                      onMouseEnter={() => setHoveredLocationId(loc.id)}
                      onMouseLeave={() => setHoveredLocationId(null)}
                    >
                      {/* Active Destination Target Pulse Ring */}
                      {isDest && (
                        <circle
                          r="28"
                          fill="none"
                          stroke="#34d399"
                          strokeWidth="2.5"
                          className="animate-ping opacity-60"
                        />
                      )}

                      {/* Selected Highlight Aura */}
                      {isSelected && (
                        <circle
                          r="24"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          filter="url(#glowGreen)"
                        />
                      )}

                      {/* Pin Circle Body */}
                      <circle
                        r={isSelected ? '16' : '13'}
                        fill={isDest ? '#059669' : isSelected ? '#10b981' : '#0f2921'}
                        stroke={isSelected ? '#ffffff' : loc.color || '#34d399'}
                        strokeWidth={isSelected ? '3' : '2'}
                        filter="url(#shadow)"
                      />

                      {/* Location Category Icon */}
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={isSelected ? '14' : '11'}
                        className="pointer-events-none"
                      >
                        {loc.icon}
                      </text>

                      {/* Building Name Pill Label */}
                      <g transform={`translate(0, ${isSelected ? 26 : 22})`}>
                        <rect
                          x={-(loc.shortName.length * 4.2 + 10)}
                          y="-9"
                          width={loc.shortName.length * 8.4 + 20}
                          height="18"
                          rx="9"
                          fill={isSelected ? '#042f2e' : '#091c16'}
                          stroke={isSelected ? '#34d399' : '#1e3a32'}
                          strokeWidth={isSelected ? '1.5' : '1'}
                          filter="url(#shadow)"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="9.5"
                          fontWeight={isSelected ? '800' : '700'}
                          fill={isSelected ? '#a7f3d0' : '#e2e8f0'}
                          className="font-['Outfit'] tracking-wider"
                        >
                          {loc.shortName}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>

              {/* ─── E. LIVE PLAYER POSITION MARKER ─── */}
              <g transform={`translate(${playerSvg.svgX}, ${playerSvg.svgY})`}>
                {/* Radar Waves */}
                <circle r="32" fill="none" stroke="#38bdf8" strokeWidth="1.5" className="animate-ping opacity-40" />
                <circle r="18" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" strokeWidth="2" />

                {/* Heading Direction Cone */}
                <g transform={`rotate(${(-myRotation * 180) / Math.PI + 180})`}>
                  <polygon points="0,-16 -7,0 7,0" fill="#38bdf8" />
                </g>

                {/* Player Dot */}
                <circle r="8" fill="#0284c7" stroke="#ffffff" strokeWidth="2.5" />

                {/* "YOU" Label */}
                <g transform="translate(0, -18)">
                  <rect x="-18" y="-7" width="36" height="14" rx="7" fill="#0284c7" stroke="#ffffff" strokeWidth="1" />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="8.5"
                    fontWeight="900"
                    fill="#ffffff"
                    className="font-['Outfit']"
                  >
                    YOU
                  </text>
                </g>
              </g>
            </svg>
          </div>

          {/* ─── 3. FLOATING MAP NAVIGATION TOOLS (TOP RIGHT) ─── */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-10 pointer-events-auto">
            {/* Recenter on Player */}
            <button
              onClick={handleRecenterOnPlayer}
              className="w-10 h-10 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-sky-400 hover:text-white border border-slate-700/80 shadow-xl flex items-center justify-center transition active:scale-95"
              title="Recenter on My Student"
            >
              <Crosshair className="w-5 h-5" />
            </button>

            {/* Zoom In */}
            <button
              onClick={handleZoomIn}
              className="w-10 h-10 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 shadow-xl flex items-center justify-center transition active:scale-95"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>

            {/* Zoom Out */}
            <button
              onClick={handleZoomOut}
              className="w-10 h-10 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 shadow-xl flex items-center justify-center transition active:scale-95"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>

            {/* Reset View */}
            <button
              onClick={handleResetView}
              className="w-10 h-10 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 shadow-xl flex items-center justify-center transition active:scale-95"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* ─── 4. FLOATING MAP INFO & STATUS (BOTTOM LEFT) ─── */}
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none hidden sm:flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] text-slate-300 shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Campus Coordinate: [{myPosition[0].toFixed(1)}, {myPosition[2].toFixed(1)}]</span>
              <span className="text-slate-500">|</span>
              <span>Zoom: {Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>

        {/* ─── 5. BOTTOM DRAWER: SELECTED LOCATION CARD ─── */}
        {selectedLocation && (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#061914] via-[#0b241d] to-[#061914] border-t-2 border-emerald-500/40 shrink-0 animate-in slide-in-from-bottom-4 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Left Details */}
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div
                  className="w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl shadow-xl shrink-0"
                  style={{
                    backgroundColor: `${selectedLocation.color}25`,
                    borderColor: `${selectedLocation.color}60`,
                  }}
                >
                  {selectedLocation.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-white font-['Outfit'] tracking-wide truncate">
                      {selectedLocation.name}
                    </h3>
                    <span
                      className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border text-white"
                      style={{
                        backgroundColor: `${selectedLocation.color}35`,
                        borderColor: `${selectedLocation.color}80`,
                      }}
                    >
                      {selectedLocation.categoryLabel}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                    {selectedLocation.description}
                  </p>

                  <div className="flex items-center gap-3 mt-1.5 text-[11px] font-semibold text-emerald-300">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Coordinates: [{selectedLocation.position[0]}, {selectedLocation.position[2]}]</span>
                    </span>
                    {distanceToSelected !== null && (
                      <span className="text-slate-300">
                        • 🚶 <strong className="text-emerald-400 font-mono">{distanceToSelected}m</strong> from your position
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end pt-2 sm:pt-0">
                {/* Locate / Center Button */}
                <button
                  onClick={() => handleLocateLocation(selectedLocation)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 text-xs font-bold transition flex items-center gap-1.5"
                  title="Center map on this building"
                >
                  <Crosshair className="w-4 h-4 text-emerald-400" />
                  <span>Locate</span>
                </button>

                {/* Set / Clear Destination Button */}
                <button
                  onClick={() => handleToggleDestination(selectedLocation)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg ${
                    navigationDestination?.id === selectedLocation.id
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                      : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                  }`}
                  title="Mark this building as your destination"
                >
                  {navigationDestination?.id === selectedLocation.id ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Destination Active</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4" />
                      <span>Set Destination</span>
                    </>
                  )}
                </button>

                {/* Dismiss Drawer */}
                <button
                  onClick={() => setSelectedLocation(null)}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition"
                  title="Dismiss details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
