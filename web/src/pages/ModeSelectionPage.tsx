import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MODE_CONFIGS, type ModeType } from '../lib/modeConfig';
import { supabase } from '../lib/supabase';
import { Zap, Skull, Activity, ChevronRight, Lock } from 'lucide-react';

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

      const seasonEndDate = mode === 'Hell' 
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
    <div className="mode-selection-page">
      <div className="system-bg" />
      <div className="system-overlay" />
      
      <div className="selection-content">
        <header className="selection-header">
          <div className="system-tag">SYSTEM_INITIALIZATION_V5</div>
          <h1 className="main-title">Select Your Path</h1>
          <p className="main-subtitle">Choose the difficulty that matches your resonance. High-rank gates require absolute discipline.</p>
        </header>

        <div className="mode-grid">
          {(Object.keys(MODE_CONFIGS) as ModeType[]).map((modeKey) => {
            const config = MODE_CONFIGS[modeKey];
            const isHell = modeKey === 'Hell';
            const isHard = modeKey === 'Hard';
            
            const Icon = isHell ? Skull : isHard ? Activity : Zap;
            const accentColor = isHell ? '#ff4444' : isHard ? '#ffa500' : modeKey === 'Normal' ? '#4488ff' : '#44ff88';

            return (
              <div 
                key={modeKey}
                className={`mode-card-v2 ds-glass ${isHell ? 'hell-card' : ''}`}
                style={{ '--accent': accentColor } as any}
                onClick={() => !loading && handleSelectMode(modeKey)}
              >
                {isHell && (
                  <div className="lock-badge">
                    <Lock size={10} /> 30-DAY LOCK-IN
                  </div>
                )}
                
                <div className="card-top">
                  <div className="mode-icon-box" style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}44` }}>
                    <Icon size={24} color={accentColor} />
                  </div>
                  <div className="mode-title-group">
                    <h2 className="mode-name">{modeKey.toUpperCase()}</h2>
                    <span className="mode-risk">{config.riskReward}</span>
                  </div>
                </div>

                <p className="mode-description">{config.description}</p>

                <div className="config-stats">
                  <div className="stat-item">
                    <span className="stat-label">POWER GAIN</span>
                    <span className="stat-value" style={{ color: accentColor }}>{config.xpMultiplier}x XP</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">DECAY RATE</span>
                    <span className="stat-value">{config.decayRate > 0 ? `${(config.decayRate * 100).toFixed(0)}%` : '0%'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">GRACE PERIOD</span>
                    <span className="stat-value">{config.gracePeriod} Days</span>
                  </div>
                </div>

                <button className="initialize-btn">
                  {loading ? 'SYNCING...' : 'MANIFEST MODE'}
                  <ChevronRight size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <footer className="selection-footer">
          <p>⚠️ PROCEED WITH CAUTION. THE SYSTEM DOES NOT TOLERATE STAGNATION.</p>
        </footer>
      </div>

      <style>{`
        .mode-selection-page {
          min-height: 100vh;
          background: #050508;
          color: #fff;
          position: relative;
          overflow-x: hidden;
          padding: 80px 24px;
          display: flex;
          justify-content: center;
          font-family: 'Inter', sans-serif;
        }
        .system-bg {
          position: fixed;
          inset: 0;
          background: 
            radial-gradient(circle at 20% 30%, rgba(68, 136, 255, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(255, 68, 68, 0.05) 0%, transparent 40%);
          z-index: 0;
        }
        .system-overlay {
          position: fixed;
          inset: 0;
          background: url("https://www.transparenttextures.com/patterns/carbon-fibre.png");
          opacity: 0.1;
          z-index: 1;
          pointer-events: none;
        }
        .selection-content {
          position: relative;
          z-index: 2;
          max-width: 1200px;
          width: 100%;
        }
        .selection-header {
          text-align: center;
          margin-bottom: 60px;
        }
        .system-tag {
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 6px;
          color: var(--accent-primary);
          opacity: 0.6;
          margin-bottom: 16px;
        }
        .main-title {
          font-size: 4rem;
          font-weight: 950;
          letter-spacing: -2px;
          text-transform: uppercase;
          margin-bottom: 12px;
          background: linear-gradient(to bottom, #fff, #888);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .main-subtitle {
          color: rgba(255,255,255,0.4);
          font-size: 1.1rem;
          max-width: 600px;
          margin: 0 auto;
        }
        .mode-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
        }
        .mode-card-v2 {
          position: relative;
          padding: 32px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.05);
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          gap: 24px;
          background: rgba(255,255,255,0.02);
        }
        .mode-card-v2:hover {
          transform: translateY(-8px);
          background: rgba(255,255,255,0.05);
          border-color: var(--accent);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 20px var(--accent)22;
        }
        .hell-card:hover {
          box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(255, 68, 68, 0.2);
        }
        .lock-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: #ff4444;
          color: #fff;
          font-size: 0.6rem;
          font-weight: 900;
          padding: 4px 12px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);
          animation: badge-pulse 2s infinite;
        }
        @keyframes badge-pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
        }
        .card-top {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .mode-icon-box {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }
        .mode-card-v2:hover .mode-icon-box {
          transform: scale(1.1) rotate(5deg);
        }
        .mode-name {
          font-size: 1.5rem;
          font-weight: 900;
          letter-spacing: 1px;
          margin: 0;
        }
        .mode-risk {
          font-size: 0.6rem;
          font-weight: 800;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .mode-description {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.5);
          line-height: 1.6;
          min-height: 60px;
        }
        .config-stats {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px 0;
          border-top: 1px solid rgba(255,255,255,0.05);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stat-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: rgba(255,255,255,0.3);
          letter-spacing: 1px;
        }
        .stat-value {
          font-size: 0.8rem;
          font-weight: 800;
        }
        .initialize-btn {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03);
          color: #fff;
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .mode-card-v2:hover .initialize-btn {
          background: var(--accent);
          border-color: var(--accent);
          color: #000;
          box-shadow: 0 10px 20px var(--accent)33;
        }
        .selection-footer {
          margin-top: 80px;
          text-align: center;
          font-size: 0.7rem;
          font-weight: 900;
          color: rgba(255,255,255,0.2);
          letter-spacing: 3px;
        }
      `}</style>
    </div>
  );
};
