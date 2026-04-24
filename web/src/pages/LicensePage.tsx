import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Fingerprint, QrCode, RefreshCw } from "lucide-react";

export function LicensePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!supabase || !user) return;
      const { data } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
      setProfile(data);
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) return <div className="page text-muted">Authenticating Hunter Credentials...</div>;

  return (
    <section className="page license-page">
      <div className="page-header" style={{ marginBottom: 48 }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Hunter Identification</h2>
          <p className="page-subtitle" style={{ fontSize: '0.9rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '2px' }}>Official System License · Class S-01</p>
        </div>
      </div>

      <div className="license-container">
        <div className={`license-card-wrapper ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
          
          {/* ── FRONT OF CARD ── */}
          <div className="license-card front ds-glass">
            <div className="license-hologram" />
            <div className="license-content">
              <div className="license-top">
                <div className="license-chip" />
                <div className="license-issuer">GLOBAL HUNTERS ASSOCIATION</div>
              </div>

              <div className="license-main">
                <div className="license-photo-box">
                   <div className="license-photo-inner">
                      {profile?.name?.charAt(0).toUpperCase()}
                   </div>
                   <div className="license-rank-badge">{profile?.player_rank || 'E'}</div>
                </div>

                <div className="license-info">
                   <div className="license-field">
                      <label>NAME</label>
                      <div className="license-value">{profile?.name || 'UNKNOWN HUNTER'}</div>
                   </div>
                   <div className="license-field">
                      <label>CLASS</label>
                      <div className="license-value" style={{ color: 'var(--accent-primary)' }}>{profile?.player_class || 'UNAWAKENED'}</div>
                   </div>
                   <div className="license-field-row">
                      <div className="license-field">
                         <label>LEVEL</label>
                         <div className="license-value">{profile?.level || 1}</div>
                      </div>
                      <div className="license-field">
                         <label>ID NO.</label>
                         <div className="license-value" style={{ fontSize: '0.6rem' }}>{profile?.user_id?.slice(0,12).toUpperCase()}</div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="license-footer">
                 <div className="license-barcode" />
                 <Fingerprint size={24} className="license-fingerprint" />
              </div>
            </div>
          </div>

          {/* ── BACK OF CARD ── */}
          <div className="license-card back ds-glass">
             <div className="license-content back-content">
                <div className="license-mag-stripe" />
                <div className="license-back-main">
                   <div className="license-terms">
                      This license is issued by the Shadow System. 
                      Unauthorized use of mana extraction skills outside of designated Dungeon Gates is strictly prohibited.
                      In case of emergency, the Hunter must respond to all System Rallying calls.
                   </div>
                   
                   <div className="license-stats-mini">
                      <div className="l-stat"><span>STR:</span> {profile?.strength || 10}</div>
                      <div className="l-stat"><span>AGI:</span> {profile?.agility || 10}</div>
                      <div className="l-stat"><span>INT:</span> {profile?.intelligence || 10}</div>
                      <div className="l-stat"><span>VIT:</span> {profile?.vitality || 10}</div>
                   </div>

                   <div className="license-qr-row">
                      <div className="qr-box"><QrCode size={40} strokeWidth={1} /></div>
                      <div className="sig-box">
                         <div className="sig-line" />
                         <div className="sig-label">HUNTER SIGNATURE</div>
                      </div>
                   </div>
                </div>
                <div className="license-back-footer">
                   EXPIRES: NEVER · MANA FREQ: 142.8
                </div>
             </div>
          </div>

        </div>

        <div className="license-hint">
          <RefreshCw size={14} /> Click to flip the license
        </div>
      </div>

      <style>{`
        .license-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; perspective: 1000px; }
        .license-card-wrapper {
          width: 500px; height: 300px; position: relative;
          transform-style: preserve-3d; transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .license-card-wrapper.flipped { transform: rotateY(180deg); }

        .license-card {
          position: absolute; width: 100%; height: 100%; backface-visibility: hidden;
          border-radius: 20px; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .license-card.back { transform: rotateY(180deg); }

        .license-hologram {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, transparent 40%, rgba(168,168,255,0.1) 50%, transparent 60%);
          background-size: 200% 200%; animation: hologramMove 6s infinite;
          pointer-events: none;
        }
        @keyframes hologramMove { 0% { background-position: 100% 100%; } 100% { background-position: -100% -100%; } }

        .license-content { padding: 32px; display: flex; flex-direction: column; height: 100%; }
        .license-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .license-chip { width: 45px; height: 35px; background: linear-gradient(135deg, #ffd700, #b8860b); border-radius: 6px; position: relative; }
        .license-chip::after { content: ''; position: absolute; inset: 5px; border: 1px solid rgba(0,0,0,0.1); }
        .license-issuer { font-size: 0.6rem; font-weight: 800; color: var(--t4); letter-spacing: 2px; }

        .license-main { display: flex; gap: 32px; align-items: flex-start; }
        .license-photo-box {
          width: 100px; height: 130px; background: rgba(0,0,0,0.4); border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1); position: relative; display: flex; align-items: center; justify-content: center;
        }
        .license-photo-inner { font-size: 3rem; font-weight: 900; color: var(--accent-primary); opacity: 0.5; }
        .license-rank-badge {
          position: absolute; bottom: -10px; right: -10px; width: 40px; height: 40px;
          background: var(--accent-primary); color: #000; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2rem;
          box-shadow: 0 4px 10px rgba(168,168,255,0.4);
        }

        .license-info { flex: 1; display: flex; flex-direction: column; gap: 16px; }
        .license-field label { display: block; font-size: 0.5rem; color: var(--t4); font-weight: 800; letter-spacing: 1px; margin-bottom: 4px; }
        .license-value { font-size: 1.1rem; font-weight: 900; color: var(--t1); font-family: 'Outfit', sans-serif; text-transform: uppercase; }
        .license-field-row { display: flex; gap: 32px; }

        .license-footer { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; }
        .license-barcode { width: 140px; height: 30px; background: repeating-linear-gradient(90deg, var(--t1), var(--t1) 2px, transparent 2px, transparent 5px); opacity: 0.5; }
        .license-fingerprint { opacity: 0.3; color: var(--accent-primary); }

        /* BACK STYLES */
        .license-mag-stripe { height: 50px; background: #000; margin: 20px -32px 0; }
        .license-back-main { padding: 20px 0; flex: 1; }
        .license-terms { font-size: 0.55rem; color: var(--t4); line-height: 1.6; margin-bottom: 24px; font-family: monospace; }
        .license-stats-mini { display: flex; gap: 20px; margin-bottom: 24px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; }
        .l-stat { font-size: 0.7rem; font-weight: 800; color: var(--t2); }
        .l-stat span { color: var(--t4); }

        .license-qr-row { display: flex; gap: 24px; align-items: flex-end; }
        .qr-box { padding: 8px; background: #fff; border-radius: 8px; color: #000; }
        .sig-box { flex: 1; }
        .sig-line { border-bottom: 1px solid var(--t3); height: 30px; margin-bottom: 4px; }
        .sig-label { font-size: 0.5rem; color: var(--t4); font-weight: 800; letter-spacing: 1px; }

        .license-back-footer { font-size: 0.5rem; color: var(--t4); font-family: monospace; letter-spacing: 2px; text-align: center; margin-top: auto; }
        
        .license-hint { margin-top: 32px; font-size: 0.8rem; color: var(--t4); display: flex; align-items: center; gap: 8px; opacity: 0.6; }
      `}</style>
    </section>
  );
}
