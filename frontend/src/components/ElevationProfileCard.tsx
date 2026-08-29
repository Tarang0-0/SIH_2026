"use client";

import React, { useEffect, useState } from 'react';
import { Mountain, ArrowUpRight, ArrowDownRight, Minus, TrendingUp, Info, Sparkles } from 'lucide-react';

interface StationElevationNode {
  sequence: number;
  station_code: string;
  station_name: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
}

interface ElevationProfileData {
  profile: StationElevationNode[];
  max_elevation_m: number;
  min_elevation_m: number;
  highest_station: string;
  highest_station_name: string;
  elevation_range_m: number;
  data_source?: string;
}

interface ElevationProfileCardProps {
  stationCodes: string[];
  currentStationCode?: string;
  isLightMode?: boolean;
}

export const ElevationProfileCard: React.FC<ElevationProfileCardProps> = ({
  stationCodes,
  currentStationCode,
  isLightMode = false
}) => {
  const [data, setData] = useState<ElevationProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hoveredNode, setHoveredNode] = useState<StationElevationNode | null>(null);

  useEffect(() => {
    if (!stationCodes || stationCodes.length === 0) return;

    let isMounted = true;
    setLoading(true);

    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/v1/topography/corridor?stations=${encodeURIComponent(stationCodes.join(','))}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setData(json);
          }
        }
      } catch (err) {
        console.debug("Elevation profile fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => { isMounted = false; };
  }, [stationCodes]);

  if (loading) {
    return (
      <div className={`p-5 rounded-2xl border transition-all ${
        isLightMode ? 'bg-white/80 border-slate-200 shadow-sm' : 'bg-slate-900/60 border-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mountain className="w-5 h-5 text-emerald-500 animate-pulse" />
            <div className="h-5 w-48 bg-slate-300 dark:bg-slate-800 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="h-40 w-full bg-slate-200/50 dark:bg-slate-800/40 rounded-xl skeleton-shimmer" />
      </div>
    );
  }

  if (!data || !data.profile || data.profile.length === 0) {
    return null;
  }

  const nodes = data.profile;
  const minElev = Math.max(0, data.min_elevation_m - 30);
  const maxElev = data.max_elevation_m + 40;
  const range = Math.max(1, maxElev - minElev);

  const svgWidth = 600;
  const svgHeight = 160;
  const paddingX = 30;
  const paddingY = 25;

  const getX = (index: number) => {
    if (nodes.length <= 1) return svgWidth / 2;
    return paddingX + (index / (nodes.length - 1)) * (svgWidth - paddingX * 2);
  };

  const getY = (elev: number) => {
    const normalized = (elev - minElev) / range;
    return svgHeight - paddingY - normalized * (svgHeight - paddingY * 2);
  };

  // Generate SVG path points
  const points = nodes.map((node, i) => `${getX(i)},${getY(node.elevation_m)}`).join(' ');
  const areaPoints = `${getX(0)},${svgHeight - paddingY} ${points} ${getX(nodes.length - 1)},${svgHeight - paddingY}`;

  // Current train node
  const currentNode = nodes.find(n => n.station_code === currentStationCode) || nodes[0];
  const highestNode = nodes.find(n => n.elevation_m === data.max_elevation_m) || nodes[0];

  return (
    <div className={`p-5 rounded-2xl border transition-all ${
      isLightMode
        ? 'bg-white/90 border-slate-200 shadow-sm backdrop-blur-md text-slate-800'
        : 'bg-slate-900/70 border-slate-800/80 backdrop-blur-xl text-slate-100'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <Mountain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Corridor Elevation Profile</h3>
            <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              SRTM Global DEM Terrain Altimetry Along Railway Track
            </p>
          </div>
        </div>

        {/* Highest Elevation Badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${
          isLightMode
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
        }`}>
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          <span>Peak: <strong className="font-mono">{data.max_elevation_m}m</strong> at {data.highest_station}</span>
        </div>
      </div>

      {/* Interactive SVG Elevation Curve */}
      <div className="relative w-full overflow-hidden rounded-xl bg-slate-950/5 dark:bg-slate-950/40 p-2 border border-slate-200/50 dark:border-slate-800/50">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-36 overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="elevationAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="elevationLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines */}
          <line
            x1={paddingX} y1={paddingY}
            x2={svgWidth - paddingX} y2={paddingY}
            stroke={isLightMode ? "#e2e8f0" : "#334155"}
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <line
            x1={paddingX} y1={svgHeight - paddingY}
            x2={svgWidth - paddingX} y2={svgHeight - paddingY}
            stroke={isLightMode ? "#cbd5e1" : "#475569"}
            strokeWidth="1"
          />

          {/* Filled Area */}
          <polygon points={areaPoints} fill="url(#elevationAreaGrad)" />

          {/* Elevation Line */}
          <polyline
            points={points}
            fill="none"
            stroke="url(#elevationLineGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Station Nodes */}
          {nodes.map((node, i) => {
            const x = getX(i);
            const y = getY(node.elevation_m);
            const isCurrent = node.station_code === currentStationCode;
            const isHighest = node.elevation_m === data.max_elevation_m;

            return (
              <g
                key={node.station_code}
                className="cursor-pointer transition-transform hover:scale-125"
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={isCurrent ? 6 : isHighest ? 5 : 3.5}
                  fill={isCurrent ? "#06b6d4" : isHighest ? "#10b981" : isLightMode ? "#ffffff" : "#0f172a"}
                  stroke={isCurrent ? "#06b6d4" : isHighest ? "#10b981" : "#64748b"}
                  strokeWidth={isCurrent || isHighest ? "2.5" : "1.5"}
                />

                {/* Station Code Label below chart */}
                <text
                  x={x}
                  y={svgHeight - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight={isCurrent ? "bold" : "normal"}
                  fill={isCurrent ? "#06b6d4" : isLightMode ? "#64748b" : "#94a3b8"}
                  className="font-mono"
                >
                  {node.station_code}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hovered / Current Station Tooltip */}
        {hoveredNode && (
          <div className="absolute top-2 right-2 px-3 py-1.5 rounded-lg bg-slate-900/90 text-white border border-slate-700 text-xs shadow-lg backdrop-blur-md animate-fadeIn pointer-events-none">
            <span className="font-bold text-emerald-400">{hoveredNode.station_name}</span> ({hoveredNode.station_code}):{' '}
            <span className="font-mono font-bold text-cyan-300">{hoveredNode.elevation_m}m</span> altitude
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
        <div>
          <span className={`block text-[10px] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Current Altitude</span>
          <span className="font-mono font-bold text-cyan-500">{currentNode?.elevation_m ?? '216'}m</span>
        </div>
        <div>
          <span className={`block text-[10px] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Max Elevation Peak</span>
          <span className="font-mono font-bold text-emerald-500">{data.max_elevation_m}m</span>
        </div>
        <div>
          <span className={`block text-[10px] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Total Elevation Delta</span>
          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">±{data.elevation_range_m}m</span>
        </div>
      </div>
    </div>
  );
};
