"use client";

import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowLeft, KeyRound, UserCheck, AlertCircle, Train } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen?: boolean;
  onLoginSuccess: () => void;
  onClose?: () => void;
  onCancel?: () => void;
}

export default function AdminLoginModal({
  isOpen = true,
  onLoginSuccess,
  onClose,
  onCancel
}: AdminLoginModalProps) {
  const handleDismiss = onClose || onCancel || (() => {});
  if (!isOpen) return null;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate credentials: username "admin", password "admin2026"
    setTimeout(() => {
      if (username.trim() === "admin" && password === "admin2026") {
        onLoginSuccess();
      } else {
        setError("Invalid credentials. Railway Traffic Control authorization failed.");
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070d18]/90 backdrop-blur-2xl flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl bg-gradient-to-b from-[#0e1726] to-[#080e1a] relative overflow-hidden">
        {/* Subtle top ambient glow */}
        <div className="absolute -right-20 -top-20 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Operations Control Center</h2>
              <p className="text-[11px] font-mono text-slate-400">Authorized Personnel Only</p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Return to Passenger View"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 text-xs font-mono mb-6 flex items-start gap-2.5">
          <Lock className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          <span>
            Operations Mode provides real-time sectional telemetry, GBDT parameter controls, and What-If disruption simulation.
          </span>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
              Operator Username
            </label>
            <div className="relative">
              <UserCheck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Enter 'admin'"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-900/90 border border-white/15 focus:border-emerald-500/60 rounded-xl py-2.5 pl-10 pr-3 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
              Access Passcode
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                placeholder="Enter 'admin2026'"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/90 border border-white/15 focus:border-emerald-500/60 rounded-xl py-2.5 pl-10 pr-3 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-mono font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Log In to Operations"}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-[10px] font-mono text-slate-500 border-t border-white/5 pt-4">
          Demo Credentials: Username <code className="text-slate-300">admin</code> · Password <code className="text-slate-300">admin2026</code>
        </div>
      </div>
    </div>
  );
}
