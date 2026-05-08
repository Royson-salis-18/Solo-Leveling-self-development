import React from 'react';
import { type ModeType } from '../lib/modeConfig';

interface ModeBadgeProps {
  mode: ModeType;
  darkMana: number;
}

export const ModeBadge: React.FC<ModeBadgeProps> = ({ mode, darkMana }) => {
  const isHell = mode === 'Hell';
  const isDanger = isHell && darkMana > 70;

  return (
    <div className={`mode-badge-pill flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${isDanger ? 'animate-pulse border-red-600 bg-red-950/30' : 'border-gray-800 bg-gray-900/50'}`}>
      <div className={`w-2 h-2 rounded-full ${isHell ? (isDanger ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-red-600') : 'bg-blue-500'}`} />
      <span className={`text-[10px] font-black tracking-widest uppercase ${isHell ? 'text-red-400' : 'text-blue-400'}`}>
        {mode} MODE
      </span>
      {isHell && (
        <div className="flex items-center gap-1 ml-1 border-l border-gray-800 pl-2">
          <span className="text-[9px] text-gray-500">DM:</span>
          <span className={`text-[10px] font-bold ${isDanger ? 'text-red-500' : 'text-gray-400'}`}>
            {darkMana}/100
          </span>
        </div>
      )}
      <style>{`
        .mode-badge-pill {
          backdrop-filter: blur(8px);
        }
      `}</style>
    </div>
  );
};
