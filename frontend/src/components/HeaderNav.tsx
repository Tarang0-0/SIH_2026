"use client";

import React from 'react';
import { Train, RefreshCw, Radio, User, Sliders, ShieldCheck, Map, Search, LayoutDashboard, Lock, Home } from 'lucide-react';
import TrainSearchBar from './TrainSearchBar';
import { TrainSummary } from '../types/raileta';

export type MainNavTab = 'overview' | 'trains' | 'map' | 'operations';

interface HeaderNavProps {
  activeTab: MainNavTab;
  onTabChange: (tab: MainNavTab) => void;
  onRefresh?: () => void;
  loading?: boolean;
  isWsConnected?: boolean;
  isAdminAuthenticated: boolean;
  onSelectTrain: (train: TrainSummary) => void;
  selectedTrainNumber?: string;
  dataSource?: string;
}

export default function HeaderNav({
  activeTab,
  onTabChange,
  onRefresh,
  loading = false,
  isWsConnected = true,
  isAdminAuthenticated = false,
  onSelectTrain,
  selectedTrainNumber,
  dataSource = "SIMULATED"
}: HeaderNavProps) {
  return (
    <header className="h-16 px-4 sm:px-6 fixed top-0 left-0 right-0 z-50 bg-[#070d18]/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between gap-4">
      {/* Brand & Problem Statement Badge - Click goes Home */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onTabChange('overview')}
          className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
          title="Return to Home / Overview"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] group-hover:scale-105 transition-transform">
            <Train className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white font-sans group-hover:text-cyan-300 transition-colors">RailETA</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono font-medium flex items-center gap-1.5 shadow-[0_0_8px_rgba(78,222,163,0.2)]">
                <span className="glow-dot-emerald"></span>
                SIH 26028
              </span>
            </div>
          </div>
        </button>

        {/* Primary View Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 ml-4 border-l border-white/10 pl-4 text-xs font-mono">
          <button
            onClick={() => onTabChange('overview')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => onTabChange('trains')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'trains'
                ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Train className="w-3.5 h-3.5" />
            <span>Find Train</span>
          </button>

          <button
            onClick={() => onTabChange('map')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'map'
                ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>Live Map</span>
          </button>

          <button
            onClick={() => onTabChange('operations')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'operations'
                ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {isAdminAuthenticated ? (
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Operations {isAdminAuthenticated ? '(Admin)' : ''}</span>
          </button>
        </nav>
      </div>

      {/* Center Search Bar */}
      <div className="flex-1 max-w-md hidden md:block">
        <TrainSearchBar 
          onSelectTrain={(train) => {
            onSelectTrain(train);
            onTabChange('trains');
          }} 
          selectedTrainNumber={selectedTrainNumber}
        />
      </div>

      {/* Right Controls: Data Provenance Badge & Replay Trigger */}
      <div className="flex items-center gap-3">
        {/* Data Provenance Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] font-mono text-slate-300">
          <span className={isWsConnected ? "glow-dot-emerald" : "glow-dot-amber"}></span>
          <span>{dataSource === 'REAL' ? 'LIVE DATA' : 'DEMO REPLAY'}</span>
        </div>

        {/* Quick Back to Home Button (Visible on mobile/tablet or when not on overview) */}
        {activeTab !== 'overview' && (
          <button
            onClick={() => onTabChange('overview')}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-mono font-medium transition-all flex items-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </button>
        )}

        {onRefresh && (
          <button 
            onClick={onRefresh}
            title="Replay Feed & Refresh ETAs"
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(78,222,163,0.15)]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Replay</span>
          </button>
        )}
      </div>
    </header>
  );
}
