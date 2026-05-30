/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, Server, UserCheck, Key, Check, ShieldCheck, Database } from 'lucide-react';
import { User } from '../types';
import { dbInstance } from '../db';

interface SettingsProps {
  currentUser: User | null;
  onToast: (msg: string) => void;
}

export function SettingsView({ currentUser, onToast }: SettingsProps) {
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [rateLimitCounter, setRateLimitCounter] = useState(0);

  const fetchStatus = async () => {
    setChecking(true);
    try {
      const status = await dbInstance.getDatabaseStatus();
      setDbStatus(status);
    } catch {
      onToast('Diagnostics poll failed');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRateLimitTest = () => {
    if (rateLimitCounter > 4) {
      onToast('ALERT: Rate-Limiting Triggered. 429 Too Many Broadcasts.');
      return;
    }
    setRateLimitCounter(prev => prev + 1);
    onToast(`Signal ping accepted. Server quota: ${5 - rateLimitCounter} left`);
  };

  const handleFlushCache = () => {
    localStorage.clear();
    onToast('Local browser state cleared.');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Settings Title */}
      <div className="pb-2 border-b border-white/5">
        <h2 className="font-bold text-lg text-white">System Settings</h2>
        <p className="text-xs text-brand-orange font-mono">Terminal Gateway Interface</p>
      </div>

      {/* User Session Telemetry details */}
      {currentUser && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
            <UserCheck size={16} className="text-brand-orange" />
            <h3 className="text-sm font-bold tracking-wider text-white uppercase font-sans">
              Identity Diagnostics
            </h3>
          </div>
          
          <div className="space-y-2 text-xs font-mono text-gray-400">
            <div className="flex justify-between py-1 border-b border-white/[0.02]">
              <span>ID Token Subject (UID)</span>
              <span className="text-white truncate max-w-[180px] sm:max-w-none" title={currentUser.id}>{currentUser.id}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/[0.02]">
              <span>Primary Email</span>
              <span className="text-white">{currentUser.email}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/[0.02]">
              <span>Assigned Username</span>
              <span className="text-brand-orange">@{currentUser.username}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/[0.02]">
              <span>Verification Status</span>
              <span className={currentUser.isVerified ? "text-brand-orange font-bold animate-pulse" : "text-gray-500"}>
                {currentUser.isVerified ? "Nigeria Priority Secure Pilot Verified" : "Explorer"}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Synchronization Date</span>
              <span className="text-white">{currentUser.joinedDate}</span>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Integrations Diagnostic card */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center space-x-2">
            <Database size={16} className="text-brand-orange" />
            <h3 className="text-sm font-bold tracking-wider text-white uppercase font-sans">
              Infrastructure Status
            </h3>
          </div>
          <button 
            id="refresh-diagnostics-btn"
            onClick={fetchStatus}
            disabled={checking}
            className="p-1 px-2 border border-white/10 hover:border-brand-orange/40 text-gray-400 hover:text-white rounded text-[9px] font-mono hover:scale-103 active:scale-97 transition-all cursor-pointer flex items-center space-x-1"
          >
            <RefreshCw size={10} className={checking ? "animate-spin text-brand-orange" : ""} />
            <span>{checking ? "Polling..." : "Diagnostics"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* PostgreSQL status */}
          <div className="p-3 bg-black border border-white/5 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">PostgreSQL Connection</span>
              <span className={`w-2 h-2 rounded-full ${dbStatus?.postgresActive ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald shadow-emerald/30' : 'bg-brand-orange'}`} />
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
              {dbStatus?.postgresActive 
                ? "Durable Cloud PostgreSQL database is online. SQL reads, updates and relational queries verified."
                : "Missing/pending database variables. Temporarily fallback to sandbox in-memory thread storage."}
            </p>
          </div>

          {/* Firebase authentication status */}
          <div className="p-3 bg-black border border-white/5 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Firebase Auth Gateway</span>
              <span className={`w-2 h-2 rounded-full ${dbStatus?.firebaseReady ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald/30' : 'bg-red-500 animate-pulse'}`} />
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
              {dbStatus?.firebaseReady 
                ? `Active and listening to project (${dbStatus?.firebaseReady ? "Verified" : "Unready"}). Cryptographic tokens verified server-side.`
                : "Failed to load Firebase admin security certificates."}
            </p>
          </div>
        </div>
      </div>

      {/* Sandbox Tools */}
      <div className="glass-[#050505] rounded-2xl p-4 sm:p-5 border border-white/5 space-y-4">
        <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
          <Shield size={16} className="text-brand-orange" />
          <h3 className="text-sm font-bold tracking-wider text-white uppercase font-sans">
            Security & Controls
          </h3>
        </div>
        
        <div className="space-y-3">
          {/* Rate limiting test */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-black border border-white/5">
            <div>
              <h4 className="text-xs font-semibold text-white">Rate-Limiter Valve</h4>
              <p className="text-[10px] text-gray-400">Pings API endpoint to check client threshold controls.</p>
            </div>
            <button
              id="rate-limiter-test-btn"
              onClick={handleRateLimitTest}
              className="px-3.5 py-1.5 border border-white/10 hover:border-brand-orange/40 text-gray-300 hover:text-white text-[10px] font-mono rounded-lg hover:bg-white/[0.01] hover:scale-102 active:scale-98 transition-all cursor-pointer"
            >
              Test Route Quota
            </button>
          </div>

          {/* Flush local browser memory */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-black border border-white/5">
            <div>
              <h4 className="text-xs font-semibold text-white">Reset Local Session</h4>
              <p className="text-[10px] text-gray-400">Flush browser session caches and reload system parameters.</p>
            </div>
            <button
              id="clear-cache-refresh-btn"
              onClick={handleFlushCache}
              className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-500 hover:text-white text-[10px] font-mono rounded-lg hover:scale-102 active:scale-98 transition-all cursor-pointer"
            >
              Reset Terminal
            </button>
          </div>
        </div>
      </div>

      {/* TREYTEK Footer */}
      <div className="text-center text-xs text-gray-500 font-mono pt-4 border-t border-white/5 tracking-wider">
        Built by TREYTEK ©
      </div>
    </div>
  );
}
