import { useState, useRef, useEffect } from 'react';
import { Send, Activity, Zap, Shield, Cpu, Target, Layers, ArrowLeft } from 'lucide-react';
import { SystemAPI } from '../services/SystemAPI';
import { useAuth } from '../lib/authContext';

interface ArchitectChamberProps {
  onClose: () => void;
}

export function ArchitectChamber({ onClose }: ArchitectChamberProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'system', content: string }>>([
    { role: 'system', content: '### [SYSTEM ARCHITECT: CHAMBER INITIALIZED]\n\nHunter, you have entered the core processing unit. I have detected your resonance clusters. \n\nHow shall we proceed with your optimization today?' }
  ]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isAnalyzing]);

  const handleConsult = async () => {
    if (!input.trim() || isAnalyzing) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsAnalyzing(true);

    try {
      const response = await SystemAPI.consultArchitect(userMsg, user?.id || '', 'long');
      setMessages(prev => [...prev, { role: 'system', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', content: '### [CRITICAL ERROR]\n\nMana resonance link severed.' }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, i) => {
      let processed = line.trim();
      if (!processed) return <div key={i} className="chamber-spacer" />;
      
      // Aggressively handle Headers
      if (processed.startsWith('###') || (processed.toUpperCase() === processed && processed.length > 10 && !processed.includes('.'))) {
        return <h3 key={i} className="chamber-h3">{processed.replace(/^###\s*/, '').replace(/\*\*/g, '')}</h3>;
      }

      // Handle Bold / Highlights
      const parts = processed.split(/(\*\*.*?\*\*)/g);
      const renderedLine = parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="chamber-strong">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      // Handle Bullets
      if (processed.startsWith('*') || processed.startsWith('-')) {
        return <li key={i} className="chamber-li">{renderedLine.slice(1)}</li>;
      }

      // Handle Dividers
      if (processed.startsWith('---')) {
        return <div key={i} className="chamber-divider" />;
      }

      return <p key={i} className="chamber-p">{renderedLine}</p>;
    });
  };

  return (
    <div className="architect-full-overlay">
      <div className="chamber-glow-overlay" />
      
      <div className="chamber-sidebar">
        <button className="back-btn" onClick={onClose}>
          <ArrowLeft size={18} />
          <span>BACK TO TEMPLE</span>
        </button>

        <div className="sidebar-module mt-8">
          <div className="module-header">
            <Activity size={14} /> <span>SYSTEM HEALTH</span>
          </div>
          <div className="health-stat">
            <div className="stat-label">RESONANCE</div>
            <div className="stat-value">98.4%</div>
            <div className="stat-bar"><div className="fill" style={{ width: '98%' }} /></div>
          </div>
        </div>

        <div className="sidebar-module">
          <div className="module-header">
            <Layers size={14} /> <span>ACTIVE CLUSTERS</span>
          </div>
          <div className="cluster-list">
            <div className="cluster-item"><Target size={12} /> Foundation</div>
            <div className="cluster-item"><Zap size={12} /> Engineering</div>
          </div>
        </div>
      </div>

      <div className="chamber-main">
        <div className="chamber-header">
          <div className="header-logo">
            <div className="logo-icon"><Cpu size={24} /></div>
            <div className="logo-text">
              <h1>ARCHITECT v4.2</h1>
              <span>QUANTUM PROCESSING UNIT</span>
            </div>
          </div>
          <div className="header-status">
            <div className="pulse-dot" />
            <span>LINK: ESTABLISHED</span>
          </div>
        </div>

        <div className="chamber-chat" ref={scrollRef}>
          {messages.map((msg, i) => (
            <div key={i} className={`chamber-bubble ${msg.role}`}>
              <div className="bubble-meta">
                {msg.role === 'system' ? <Shield size={12} /> : <Zap size={12} />}
                <span>{msg.role === 'system' ? 'SYSTEM_ARCHITECT' : 'HUNTER_SOVEREIGN'}</span>
              </div>
              <div className="bubble-content">
                {formatMessage(msg.content)}
              </div>
            </div>
          ))}
          {isAnalyzing && (
            <div className="chamber-bubble system analyzing">
              <div className="bubble-content">
                <div className="typing-loader">
                  <div className="dot" />
                  <div className="dot" />
                  <div className="dot" />
                </div>
                <p>DECODING SYSTEM MANA...</p>
              </div>
            </div>
          )}
        </div>

        <div className="chamber-input-container">
          <input 
            type="text" 
            placeholder="INPUT COMMAND..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConsult()}
          />
          <button onClick={handleConsult} disabled={isAnalyzing}>
            {isAnalyzing ? <Activity className="animate-spin" /> : <Send size={18} />}
            <span>EXECUTE</span>
          </button>
        </div>
      </div>

      <style>{`
        .architect-full-overlay {
          position: fixed;
          inset: 0;
          display: grid;
          grid-template-columns: 280px 1fr;
          background: #020204;
          z-index: 1000;
          color: #b0b0cf;
          font-family: 'Inter', sans-serif;
          animation: overlayFadeIn 0.4s ease-out;
        }

        .chamber-glow-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, rgba(88, 80, 236, 0.05) 0%, transparent 70%);
          pointer-events: none;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          padding: 12px 20px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 0.7rem;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 1px;
        }

        .back-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: #5850ec;
        }

        .chamber-sidebar {
          background: #050508;
          border-right: 1px solid rgba(88, 80, 236, 0.1);
          padding: 40px 32px;
          display: flex;
          flex-direction: column;
          gap: 32px;
          z-index: 5;
        }

        .module-header {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.65rem;
          font-weight: 900;
          letter-spacing: 2px;
          color: #5850ec;
          margin-bottom: 20px;
          opacity: 0.8;
        }

        .health-stat { margin-bottom: 16px; }
        .stat-label { font-size: 0.55rem; letter-spacing: 1px; margin-bottom: 6px; opacity: 0.5; }
        .stat-value { font-size: 1rem; font-weight: 800; margin-bottom: 8px; color: #fff; }
        .stat-bar { height: 3px; background: rgba(255,255,255,0.03); border-radius: 2px; overflow: hidden; }
        .stat-bar .fill { height: 100%; background: #5850ec; box-shadow: 0 0 10px #5850ec; }

        .cluster-item {
          font-size: 0.75rem;
          background: rgba(255,255,255,0.02);
          padding: 10px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(255,255,255,0.05);
          color: #9090af;
        }

        .chamber-main {
          display: flex;
          flex-direction: column;
          padding: 60px;
          min-width: 0;
          background: transparent;
          height: 100vh;
        }

        .chamber-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 48px;
          flex-shrink: 0;
        }

        .header-logo { display: flex; align-items: center; gap: 20px; }
        .logo-icon {
          width: 54px; height: 54px;
          background: rgba(88, 80, 236, 0.05);
          border: 1px solid rgba(88, 80, 236, 0.2);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center; color: #5850ec;
        }
        .logo-text h1 { font-size: 1.4rem; font-weight: 900; letter-spacing: 4px; margin: 0; color: #fff; }
        .logo-text span { font-size: 0.65rem; opacity: 0.4; letter-spacing: 2px; }

        .header-status {
          display: flex; align-items: center; gap: 10px; font-size: 0.65rem; font-weight: 800;
          background: rgba(255, 255, 255, 0.02); padding: 10px 20px; border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .pulse-dot { width: 8px; height: 8px; background: #00ffaa; border-radius: 50%; animation: pulse 2s infinite; }

        .chamber-chat {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 40px;
          padding-right: 20px;
          margin-bottom: 40px;
        }

        .bubble-content {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          padding: 32px;
          border-radius: 20px;
        }

        .chamber-bubble.system .bubble-content {
          border-left: 4px solid #5850ec;
          background: linear-gradient(90deg, rgba(88, 80, 236, 0.03), transparent);
        }

        .chamber-h3 { 
          font-size: 1.2rem; 
          font-weight: 900; 
          color: #5850ec; 
          margin: 40px 0 24px; 
          letter-spacing: 2px; 
          text-transform: uppercase;
          text-shadow: 0 0 15px rgba(88, 80, 236, 0.4);
          border-left: 4px solid #5850ec;
          padding-left: 20px;
        }

        .chamber-spacer {
          height: 16px;
        }

        .chamber-strong {
          color: #fff;
          font-weight: 900;
          text-shadow: 0 0 10px rgba(88, 80, 236, 0.3);
          background: rgba(88, 80, 236, 0.1);
          padding: 2px 4px;
          border-radius: 4px;
        }

        .chamber-bold {
          font-weight: 800;
          color: #fff;
          margin-bottom: 14px;
        }
        
        .chamber-p { font-size: 0.95rem; line-height: 1.8; margin-bottom: 24px; color: #9090af; }
        
        .chamber-divider { 
          height: 1px; 
          background: linear-gradient(90deg, transparent, rgba(88, 80, 236, 0.4), transparent); 
          margin: 48px 0; 
        }

        .chamber-li {
          font-size: 0.95rem;
          line-height: 1.8;
          margin-bottom: 16px;
          padding-left: 32px;
          position: relative;
          color: #9090af;
        }

        .chamber-input-container {
          display: flex; gap: 16px; background: #0a0a0f; padding: 16px; border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.05); flex-shrink: 0;
        }

        .chamber-input-container input { flex: 1; background: transparent; border: none; color: #fff; padding: 12px 24px; font-size: 1rem; outline: none; }
        .chamber-input-container button { background: #5850ec; color: #fff; border: none; padding: 0 32px; border-radius: 14px; font-weight: 900; display: flex; align-items: center; gap: 12px; cursor: pointer; }

        @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        .mt-8 { margin-top: 32px; }
      `}</style>
    </div>
  );
}
