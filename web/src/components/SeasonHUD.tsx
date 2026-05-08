import React from 'react';
import { Skull, Clock } from 'lucide-react';

interface SeasonHUDProps {
  mode: string;
  darkMana: number;
  endDate: string | null;
}

export const SeasonHUD: React.FC<SeasonHUDProps> = ({ mode, darkMana, endDate }) => {
  if (mode !== 'Nightmare') return null;

  const daysLeft = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 3600 * 24)) : 0;
  const progress = Math.min(100, (darkMana / 100) * 100);
  const isDanger = darkMana > 70;

  return (
    <div className="nightmare-season-hud fixed top-0 left-0 right-0 z-[10000] h-1 bg-gray-900 overflow-hidden">
      <div 
        className={`h-full transition-all duration-1000 ${isDanger ? 'bg-red-600 shadow-[0_0_10px_red]' : 'bg-blue-600'}`}
        style={{ width: `${progress}%` }}
      />
      
      <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-gray-800 rounded-b-xl px-4 py-1 flex items-center gap-6 shadow-2xl">
        <div className="flex items-center gap-2">
          <Skull size={14} className={isDanger ? 'text-red-600 animate-pulse' : 'text-gray-500'} />
          <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">SEASON: NIGHTMARE</span>
        </div>
        
        <div className="flex items-center gap-2 border-l border-gray-800 pl-6">
          <Clock size={12} className="text-gray-500" />
          <span className="text-[10px] font-bold text-gray-300 uppercase">{daysLeft} DAYS REMAINING</span>
        </div>

        <div className="flex items-center gap-3 border-l border-gray-800 pl-6">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-500">DM CORRUPTION:</span>
            <span className={`text-[10px] font-black ${isDanger ? 'text-red-500' : 'text-blue-400'}`}>{darkMana}%</span>
          </div>
          <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${isDanger ? 'bg-red-600' : 'bg-blue-600'}`} 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
      </div>

      <style>{`
        .nightmare-season-hud {
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
      `}</style>
    </div>
  );
};
