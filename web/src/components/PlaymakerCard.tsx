import React from 'react';
import { Trophy, Star, TrendingUp } from 'lucide-react';

interface PlaymakerCardProps {
  rating: number;
  topTasks: any[];
  streak: number;
}

export const PlaymakerCard: React.FC<PlaymakerCardProps> = ({ rating, topTasks, streak }) => {
  const getRatingLabel = (val: number) => {
    if (val >= 90) return 'S-TIER PLAYMAKER';
    if (val >= 75) return 'A-TIER STRATEGIST';
    if (val >= 50) return 'B-TIER TACTICIAN';
    return 'C-TIER NEWCOMER';
  };

  const label = getRatingLabel(rating);
  const isHighRating = rating >= 75;
  const isSRating = rating >= 90;

  return (
    <div className="playmaker-card ds-glass group">
      <div className="pm-glow-orb" />
      
      <div className="pm-header">
        <div className="pm-title-stack">
          <h3 className="pm-sublabel">Weekly Performance</h3>
          <h2 className={`pm-label ${isSRating ? 'pm-s' : isHighRating ? 'pm-a' : 'pm-c'}`}>
            {label}
          </h2>
        </div>
        <div className="pm-rating-stack">
          <div className="pm-rating-val">{rating}</div>
          <div className="pm-rating-sys">SYSTEM_RATING</div>
        </div>
      </div>

      <div className="pm-stats">
        <div className="pm-stat-row">
          <div className="pm-stat-info">
            <TrendingUp size={14} />
            <span>Active Streak</span>
          </div>
          <span className="pm-stat-val-text">{streak} DAYS</span>
        </div>
        <div className="pm-progress-bg">
          <div 
            className="pm-progress-fill" 
            style={{ width: `${rating}%` }} 
          />
        </div>
      </div>

      <div className="pm-missions">
        <h4 className="pm-mission-header">
          <Star size={10} style={{ color: '#fbbf24' }} /> Top Weekly Missions
        </h4>
        <div className="pm-mission-list">
          {topTasks.length > 0 ? topTasks.slice(0, 3).map((t, i) => (
            <div key={t.id || i} className="pm-mission-item">
              <span className="pm-mission-title">{t.title}</span>
              <span className="pm-mission-xp">+{t.points} XP</span>
            </div>
          )) : (
            <div className="pm-no-missions">No missions recorded this week.</div>
          )}
        </div>
      </div>

      <div className="pm-footer">
        <button className="pm-action-btn">
          View Detailed Analytics
        </button>
      </div>

      <style>{`
        .playmaker-card {
          padding: 24px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(135deg, rgba(15,15,20,0.95) 0%, rgba(5,5,5,0.98) 100%);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          position: relative;
          overflow: hidden;
          flex: 1;
          min-width: 280px;
        }
        .pm-glow-orb {
          position: absolute;
          top: -40px;
          right: -40px;
          width: 128px;
          height: 128px;
          background: rgba(59, 130, 246, 0.1);
          filter: blur(32px);
          transition: all 0.4s;
          pointer-events: none;
        }
        .playmaker-card:hover .pm-glow-orb {
          background: rgba(59, 130, 246, 0.2);
        }

        .pm-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        .pm-sublabel {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.3em;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .pm-label {
          font-size: 1.25rem;
          font-weight: 900;
          letter-spacing: -0.02em;
        }
        .pm-s { color: #fbbf24; }
        .pm-a { color: #60a5fa; }
        .pm-c { color: #9ca3af; }

        .pm-rating-stack {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .pm-rating-val {
          font-size: 2.25rem;
          font-weight: 900;
          color: #fff;
          line-height: 1;
        }
        .pm-rating-sys {
          font-size: 8px;
          font-weight: 700;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.2em;
          margin-top: 4px;
        }

        .pm-stats {
          margin-bottom: 24px;
        }
        .pm-stat-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.75rem;
          margin-bottom: 8px;
        }
        .pm-stat-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.5);
        }
        .pm-stat-val-text {
          font-weight: 900;
          color: #fff;
        }

        .pm-progress-bg {
          width: 100%;
          height: 4px;
          background: rgba(255,255,255,0.05);
          border-radius: 99px;
          overflow: hidden;
        }
        .pm-progress-fill {
          height: 100%;
          background: #2563eb;
          box-shadow: 0 0 10px rgba(37,99,235,0.5);
          transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .pm-missions {
          border-top: 1px solid rgba(255,255,255,0.08);
          padding-top: 16px;
        }
        .pm-mission-header {
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pm-mission-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pm-mission-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
        }
        .pm-mission-title {
          color: rgba(255,255,255,0.7);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }
        .pm-mission-xp {
          color: #60a5fa;
          font-weight: 900;
        }
        .pm-no-missions {
          font-size: 10px;
          color: rgba(255,255,255,0.2);
          font-style: italic;
        }

        .pm-footer {
          margin-top: 24px;
        }
        .pm-action-btn {
          width: 100%;
          padding: 8px 0;
          background: transparent;
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          color: #3b82f6;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pm-action-btn:hover {
          background: rgba(59, 130, 246, 0.05);
          color: #60a5fa;
          border-color: rgba(59, 130, 246, 0.4);
        }
      `}</style>
    </div>
  );
};
