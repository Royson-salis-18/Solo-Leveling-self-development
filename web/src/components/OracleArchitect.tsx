import { useState, useEffect, useRef } from 'react';
import { Shield, X, Send, Sparkles, Activity, Zap, Terminal } from 'lucide-react';
import { SystemAPI } from '../services/SystemAPI';
import { useAuth } from '../lib/authContext';

export function OracleArchitect() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'system', content: string }>>([
    { role: 'system', content: 'System Auditor online. Analyzing hunter resonance... How can I assist in your evaluation?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      // Phase 1: Call SystemAPI for AI Guidance
      const response = await SystemAPI.consultArchitect(userMsg, user?.id || '', 'short');
      
      setMessages(prev => [...prev, { role: 'system', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', content: 'SYSTEM ERROR: Connection to Architect lost. Check your mana link.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Trigger */}
      <button 
        className={`oracle-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Consult Auditor"
      >
        <div className="trigger-aura"></div>
        {isOpen ? <X size={24} /> : <Shield size={24} />}
      </button>

      {/* Holographic Interface */}
      <div className={`oracle-interface ${isOpen ? 'open' : ''}`}>
        <div className="oracle-header">
          <div className="oracle-title">
            <Sparkles size={16} className="text-blue-400" />
            <span>SYSTEM AUDITOR</span>
            <div className="status-dot"></div>
          </div>
          <div className="header-meta">
            <Activity size={12} />
            <span>Resonance: 98%</span>
          </div>
        </div>

        <div className="oracle-messages" ref={scrollRef}>
          {messages.map((msg, i) => (
            <div key={i} className={`msg-wrapper ${msg.role}`}>
              <div className="msg-icon">
                {msg.role === 'system' ? <Terminal size={14} /> : <Zap size={14} />}
              </div>
              <div className="msg-content">
                <div className="msg-sender">{msg.role === 'system' ? '[THE SYSTEM]' : '[HUNTER]'}</div>
                <div className="msg-text">{msg.content}</div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="msg-wrapper system">
              <div className="msg-icon animate-pulse"><Activity size={14} /></div>
              <div className="msg-content">
                <div className="msg-sender">[ANALYZING...]</div>
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="oracle-input-area">
          <input 
            type="text" 
            className="oracle-input" 
            placeholder="Ask for schedule optimization..." 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button className="oracle-send-btn" onClick={handleSend} disabled={!input.trim() || isTyping}>
            <Send size={18} />
          </button>
        </div>

        <style>{`
          .oracle-trigger {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #1a1a2e;
            border: 2px solid var(--accent-primary);
            color: var(--accent-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 1000;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 0 20px rgba(0, 150, 255, 0.3);
          }
          .oracle-trigger:hover {
            transform: scale(1.1);
            box-shadow: 0 0 30px rgba(0, 150, 255, 0.5);
          }
          .oracle-trigger.active {
            transform: rotate(90deg);
            background: #ff4444;
            border-color: #ff4444;
            color: #fff;
          }
          .trigger-aura {
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px solid var(--accent-primary);
            opacity: 0.3;
            animation: pulse-aura 2s infinite;
          }
          @keyframes pulse-aura {
            0% { transform: scale(1); opacity: 0.5; }
            100% { transform: scale(1.4); opacity: 0; }
          }

          .oracle-interface {
            position: fixed;
            bottom: 100px;
            right: 30px;
            width: 380px;
            height: 500px;
            background: rgba(10, 10, 26, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(0, 150, 255, 0.2);
            border-radius: 20px;
            display: flex;
            flex-direction: column;
            z-index: 999;
            transform: translateY(20px) scale(0.95);
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          }
          .oracle-interface.open {
            transform: translateY(0) scale(1);
            opacity: 1;
            pointer-events: auto;
          }

          .oracle-header {
            padding: 20px;
            background: rgba(0, 150, 255, 0.1);
            border-bottom: 1px solid rgba(0, 150, 255, 0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .oracle-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 900;
            letter-spacing: 2px;
            font-size: 0.8rem;
            color: var(--accent-primary);
          }
          .status-dot {
            width: 6px;
            height: 6px;
            background: #00ff88;
            border-radius: 50%;
            box-shadow: 0 0 10px #00ff88;
          }
          .header-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.6rem;
            opacity: 0.5;
            font-weight: 800;
          }

          .oracle-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 20px;
            scroll-behavior: smooth;
          }
          .msg-wrapper {
            display: flex;
            gap: 12px;
            max-width: 85%;
          }
          .msg-wrapper.user {
            align-self: flex-end;
            flex-direction: row-reverse;
          }
          .msg-icon {
            width: 30px;
            height: 30px;
            border-radius: 8px;
            background: rgba(255,255,255,0.05);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: var(--accent-primary);
            border: 1px solid rgba(0,150,255,0.2);
          }
          .msg-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .user .msg-content { align-items: flex-end; }
          .msg-sender {
            font-size: 0.6rem;
            font-weight: 900;
            opacity: 0.4;
            letter-spacing: 1px;
          }
          .msg-text {
            background: rgba(255,255,255,0.03);
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 0.9rem;
            line-height: 1.5;
            color: #fff;
            border: 1px solid rgba(255,255,255,0.05);
          }
          .system .msg-text {
            border-left: 3px solid var(--accent-primary);
            background: linear-gradient(90deg, rgba(0,150,255,0.05), transparent);
          }

          .oracle-input-area {
            padding: 20px;
            background: rgba(0,0,0,0.3);
            display: flex;
            gap: 12px;
          }
          .oracle-input {
            flex: 1;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 12px 16px;
            color: #fff;
            font-size: 0.9rem;
            outline: none;
            transition: all 0.3s;
          }
          .oracle-input:focus {
            border-color: var(--accent-primary);
            background: rgba(0,150,255,0.05);
          }
          .oracle-send-btn {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: var(--accent-primary);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border: none;
            transition: all 0.3s;
          }
          .oracle-send-btn:hover {
            transform: scale(1.05);
            filter: brightness(1.2);
          }
          .oracle-send-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
          }

          .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 8px 12px;
          }
          .typing-indicator span {
            width: 4px;
            height: 4px;
            background: var(--accent-primary);
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out;
          }
          .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
          .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
          }
        `}</style>
      </div>
    </>
  );
}
