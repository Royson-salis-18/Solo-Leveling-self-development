import React from 'react';
import { Activity, X } from 'lucide-react';

interface ZoneOverlayProps {
  isActive: boolean;
  onExit: () => void;
}

export const ZoneOverlay: React.FC<ZoneOverlayProps> = ({ isActive, onExit }) => {
  if (!isActive) return null;

  return (
    <div className="zone-overlay-fixed fixed inset-0 z-[9999] pointer-events-none">
      <div className="absolute inset-0 bg-blue-900/10 backdrop-blur-[2px] mix-blend-overlay animate-pulse-slow" />
      <div className="absolute inset-0 border-[20px] border-blue-500/10 pointer-events-none" />
      
      <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-blue-600/20 backdrop-blur-xl border border-blue-500/30 px-6 py-2 rounded-full flex items-center gap-4 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
          <div className="flex items-center gap-2">
            <Activity className="text-blue-400 animate-bounce" size={18} />
            <span className="text-blue-100 font-black tracking-[0.3em] uppercase text-sm">IN THE ZONE</span>
          </div>
          <div className="h-4 w-[1px] bg-blue-500/30" />
          <div className="text-blue-300 text-[10px] font-bold tracking-widest uppercase">
            XP RESONANCE: 2.5X
          </div>
          <button 
            onClick={onExit}
            className="ml-2 p-1 hover:bg-blue-500/20 rounded-full transition-colors group"
            title="Exit Zone"
          >
            <X size={14} className="text-blue-400 group-hover:text-white" />
          </button>
        </div>
      </div>

      <div className="absolute bottom-12 right-12 pointer-events-none">
        <div className="flex flex-col items-end gap-1">
          <div className="text-blue-400/30 font-black text-6xl tracking-tighter italic">FLOW</div>
          <div className="text-blue-400/20 font-black text-2xl tracking-[0.5em] uppercase">ABSOLUTE</div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.2; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        .zone-overlay-fixed {
          background: radial-gradient(circle at center, transparent 30%, rgba(0,20,50,0.1) 100%);
        }
      `}</style>
    </div>
  );
};
