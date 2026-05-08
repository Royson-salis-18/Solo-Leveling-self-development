import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MODE_CONFIGS, type ModeType } from '../lib/modeConfig';
import { supabase } from '../lib/supabase';

export const ModeSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  const handleSelectMode = async (mode: ModeType) => {
    setLoading(true);
    try {
      if (!supabase) {
        throw new Error("Supabase client unavailable");
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const seasonEndDate = mode === 'Nightmare' 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await supabase.from('user_profiles').update({
        current_mode: mode,
        season_end_date: seasonEndDate,
        last_mode_switch: new Date().toISOString()
      }).eq('user_id', user.id);

      // Log season start
      await supabase.from('season_records').insert({
        user_id: user.id,
        mode: mode,
        start_date: new Date().toISOString(),
        end_date: seasonEndDate
      });

      navigate('/');
    } catch (err) {
      console.error("Failed to select mode:", err);
      alert("System Error: Failed to initialize mode.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mode-selection-container p-8 flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold tracking-tighter mb-4 text-blue-500">SYSTEM INITIALIZATION</h1>
          <p className="text-gray-400 text-lg">Select your hunter difficulty. Higher risks yield greater essence.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(Object.keys(MODE_CONFIGS) as ModeType[]).map((modeKey) => {
            const config = MODE_CONFIGS[modeKey];
            const isNightmare = modeKey === 'Nightmare';
            
            return (
              <div 
                key={modeKey}
                className={`mode-card relative group cursor-pointer border border-gray-800 rounded-xl p-6 transition-all hover:border-blue-500 hover:scale-105 ${isNightmare ? 'hover:border-red-600' : ''}`}
                onClick={() => !loading && handleSelectMode(modeKey)}
              >
                {isNightmare && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                    30-DAY LOCK-IN
                  </div>
                )}
                
                <h2 className={`text-2xl font-bold mb-2 ${isNightmare ? 'text-red-500' : 'text-blue-400'}`}>
                  {modeKey.toUpperCase()}
                </h2>
                <div className="text-xs font-medium text-gray-500 mb-4 tracking-widest uppercase">
                  {config.riskReward}
                </div>
                
                <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                  {config.description}
                </p>

                <div className="space-y-3 border-t border-gray-800 pt-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">XP MULTIPLIER</span>
                    <span className="text-blue-400 font-bold">{config.xpMultiplier}x</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">XP DECAY</span>
                    <span className="text-gray-300">{config.decayRate > 0 ? `${(config.decayRate * 100).toFixed(0)}% / day` : 'NONE'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">PERMADEATH</span>
                    <span className={config.permadeathChance > 0 ? 'text-red-500' : 'text-gray-300'}>
                      {config.permadeathChance > 0 ? `${(config.permadeathChance * 100).toFixed(0)}%` : 'DISABLED'}
                    </span>
                  </div>
                </div>

                <div className="mt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className={`w-full py-2 rounded font-bold text-sm ${isNightmare ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    INITIALIZE {modeKey.toUpperCase()}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center text-gray-600 text-xs uppercase tracking-[0.2em]">
          Proceed with caution. The system does not tolerate the weak.
        </div>
      </div>

      <style>{`
        .mode-card {
          background: rgba(10, 10, 10, 0.8);
          backdrop-filter: blur(10px);
        }
        .mode-selection-container {
          background: radial-gradient(circle at center, #111 0%, #000 100%);
        }
      `}</style>
    </div>
  );
};
