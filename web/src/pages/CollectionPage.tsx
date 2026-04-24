import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Button } from "../components/Button";
import { 
  Skull, Swords, Gem,
  Sparkles, Package, Flame, ShieldAlert
} from "lucide-react";
import { AuraCard } from "../components/AuraCard";

import { SHADOW_CATALOG, ITEM_CATALOG, TABS, RARITY_COLORS, CATEGORY_ICONS, type Shadow, type InventoryItem, type Tab } from "../lib/catalog";

/* ─────────────────────── component ─────────────────────── */
export function CollectionPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("Army");
  const [showAll, setShowAll] = useState(true);
  const [shadows, setShadows] = useState<Shadow[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Custom Alert State
  const [alertInfo, setAlertInfo] = useState<{show: boolean, title: string, message: string}>({show: false, title: "", message: ""});
  
  useEffect(() => {
    if (user) fetchCollection();
  }, [user]);

  const fetchCollection = async () => {
    if (!supabase) return;
    setLoading(true);
    const [sRes, iRes] = await Promise.all([
      supabase.from("shadows").select("*").eq("user_id", user?.id),
      supabase.from("inventory").select("*").eq("user_id", user?.id)
    ]);
    
    const mergedShadows = SHADOW_CATALOG.map(cat => {
      const found = sRes.data?.find(s => s.name === cat.name);
      return found ? { ...found, collected: true } : { ...cat, collected: false };
    });
    setShadows(mergedShadows);

    const mergedItems = ITEM_CATALOG.map(cat => {
      const found = iRes.data?.find(i => i.name === cat.name);
      return found ? { ...found, collected: true } : { ...cat, collected: false };
    });
    setItems(mergedItems);
    
    setLoading(false);
  };

  const getSystemGift = async () => {
    if (!user || !supabase) return;
    
    // Daily Cooldown Check
    const today = new Date().toDateString();
    const lastGiftDate = localStorage.getItem("lastGiftDate");
    if (lastGiftDate === today) {
      setAlertInfo({ show: true, title: "System Notice", message: "You have already claimed your daily gift. The System will prepare another tomorrow." });
      return;
    }

    const weapons = ITEM_CATALOG.filter(i => i.rarity !== 'Legendary' && i.rarity !== 'S-Rank');
    const picked = weapons[Math.floor(Math.random() * weapons.length)];
    
    await supabase.from("inventory").insert({
      user_id: user.id,
      name: picked.name,
      description: picked.description,
      item_type: picked.item_type,
      item_category: picked.item_category,
      rarity: picked.rarity,
      quantity: 1
    });
    
    localStorage.setItem("lastGiftDate", today);
    fetchCollection();
    setAlertInfo({ show: true, title: "Reward Acquired", message: `System Gift: You received [${picked.name}]!` });
  };

  const filteredShadows = showAll ? shadows : shadows.filter(s => s.collected);
  const filteredItems = items.filter(i => {
    const matchesTab = activeTab === "Arsenal" ? i.item_category === "Weapon" : i.item_category !== "Weapon";
    const matchesFilter = showAll || i.collected;
    return matchesTab && matchesFilter;
  });

  return (
    <section className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* ambient bg blobs */}
      <div className="bg-blob" style={{ width: '600px', height: '600px', background: 'rgba(168, 168, 255, 0.12)', top: '-100px', left: '-150px', position: 'absolute', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }}></div>
      <div className="bg-blob" style={{ width: '500px', height: '500px', background: 'rgba(111, 60, 255, 0.1)', top: '250px', right: '-120px', position: 'absolute', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }}></div>

      <div className="page-header" style={{ marginBottom: 40 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '2.8rem', letterSpacing: '-1px' }}>System Arsenal</h2>
          <p className="text-sm text-muted" style={{ letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 800, opacity: 0.5 }}>Leveling System • Inventory Management</p>
        </div>
        <div className="flex gap-12">
          <Button variant="secondary" size="md" onClick={() => setShowAll(!showAll)} style={{ borderRadius: '12px', fontWeight: 900 }}>
            {showAll ? "Show Collected Only" : "Show All Roster"}
          </Button>
          <Button variant="primary" size="md" onClick={getSystemGift} style={{ borderRadius: '12px', fontWeight: 900, boxShadow: '0 0 20px rgba(168,168,255,0.4)' }}>
            <Sparkles size={16} /> Claim Daily Gift
          </Button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 32 }}>
        {TABS.map(t => (
          <div key={t} className={`tab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)} style={{ padding: '12px 24px', borderRadius: '14px' }}>
            {t === "Army" ? <Skull size={16} /> : t === "Arsenal" ? <Swords size={16} /> : <Gem size={16} />}
            <span style={{ fontWeight: 900, fontSize: '0.9rem' }}>{t.toUpperCase()}</span>
            <span className="badge-counter" style={{ background: activeTab === t ? 'rgba(255,255,255,0.2)' : 'rgba(168,168,255,0.1)' }}>
              {t === "Army" ? shadows.filter(s => s.collected).length : items.filter(i => i.collected && (t === "Arsenal" ? i.item_category === "Weapon" : i.item_category !== "Weapon")).length}
            </span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="panel panel-empty" style={{ minHeight: 400 }}>
          <div className="loading-glitch" data-text="SYNCHRONIZING_SYSTEM_DATA...">SYNCHRONIZING_SYSTEM_DATA...</div>
        </div>
      ) : (
        <div className="collection-grid-v2">
          {activeTab === "Army" && (
            <div className="army-view-container">
              {/* ── MONARCH'S COMMAND (Hero Section) ── */}
              {shadows.filter(s => s.collected).length > 0 && (
                <div className="monarch-hero-section ds-glass">
                  <div className="mana-storm-overlay" />
                  <div className="hero-content">
                    <div className="hero-meta">
                      <div className="hero-tag-wrap">
                        <Flame size={14} className="animate-pulse" />
                        <span className="hero-tag">SUPREME COMMANDER</span>
                      </div>
                      <h2 className="hero-name">
                        {shadows.filter(s => s.collected).sort((a,b) => {
                          const order = { Mythic: 0, Legendary: 1, Epic: 2, Rare: 3, Elite: 4 };
                          return (order[a.rarity as keyof typeof order] || 99) - (order[b.rarity as keyof typeof order] || 99);
                        })[0]?.name}
                      </h2>
                      <p className="hero-desc">The strongest extractions are gathered here. A true Monarch's power is measured by the loyalty of his shadows.</p>
                      
                      <div className="hero-stats">
                        <div className="h-stat">
                          <span className="h-stat-lbl">ARMY_SIZE</span>
                          <span className="h-stat-val">{shadows.filter(s => s.collected).length} UNITS</span>
                        </div>
                        <div className="h-stat">
                          <span className="h-stat-lbl">RESONANCE</span>
                          <span className="h-stat-val" style={{ color: "var(--accent-primary)" }}>
                            +{shadows.filter(s => s.collected).reduce((acc, s) => acc + (
                              s.rarity === 'Mythic' ? 20 : s.rarity === 'Legendary' ? 10 : s.rarity === 'Epic' ? 5 : s.rarity === 'Rare' ? 3 : 1
                            ), 0)}% PASSIVE XP
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="hero-visual">
                      <div className="hero-aura-glow" />
                      {(() => {
                        const top = shadows.filter(s => s.collected).sort((a,b) => {
                          const order = { Mythic: 0, Legendary: 1, Epic: 2, Rare: 3, Elite: 4 };
                          return (order[a.rarity as keyof typeof order] || 99) - (order[b.rarity as keyof typeof order] || 99);
                        })[0];
                        const color = RARITY_COLORS[top.rarity.toUpperCase() as keyof typeof RARITY_COLORS] || '#a8a8ff';
                        return (
                          <div className="hero-card-wrapper">
                            <div className="card-fire-fx" />
                            <AuraCard
                              name={top.name}
                              rankLabel={top.rarity === 'Mythic' ? 'MONARCH' : 'GRAND MARSHAL'}
                              rarityColor={color}
                              isCollected={true}
                              effectType={top.effectType}
                              col={top.col}
                              glow={top.glow}
                              icon={top.icon}
                              sub="Absolute Loyalty"
                              bonus={top.rarity === 'Mythic' ? 20 : 10}
                              label="SUPREME"
                              style={{ width: 300, height: 420 }}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* ── RANKED SECTIONS ── */}
              {['Mythic', 'Legendary', 'Epic', 'Rare', 'Common'].map(rank => {
                const rankShadows = filteredShadows.filter(s => {
                  if (rank === 'Common') return s.rarity !== 'Mythic' && s.rarity !== 'Legendary' && s.rarity !== 'Epic' && s.rarity !== 'Rare';
                  return s.rarity === rank;
                });
                
                if (rankShadows.length === 0) return null;

                const title = rank === 'Mythic' ? 'The Sovereigns' :
                             rank === 'Legendary' ? 'Grand Marshals' :
                             rank === 'Epic' ? 'Shadow Commanders' :
                             rank === 'Rare' ? 'Elite Knights' : 'Shadow Infantry';
                
                const color = RARITY_COLORS[rank.toUpperCase() as keyof typeof RARITY_COLORS] || '#475569';

                return (
                  <div key={rank} className="army-rank-section">
                    <div className="rank-divider">
                      <h3 className="rank-title" style={{ color }}>{title.toUpperCase()}</h3>
                      <div className="divider-line" style={{ color }} />
                      <span className="rank-count">{rankShadows.filter(s => s.collected).length}/{rankShadows.length}</span>
                    </div>
                    
                    <div className="army-grid">
                      {rankShadows.map((s) => (
                        <div key={s.name} className="shadow-unit-wrap">
                          <AuraCard
                            name={s.name}
                            rankLabel={s.rarity === 'Mythic' ? 'MONARCH' : s.rarity === 'Legendary' ? 'GRAND MARSHAL' : s.rarity === 'Epic' ? 'COMMANDER' : s.rarity === 'Rare' ? 'KNIGHT' : 'ELITE'}
                            rarityColor={RARITY_COLORS[s.rarity.toUpperCase() as keyof typeof RARITY_COLORS] || '#475569'}
                            isCollected={!!s.collected}
                            effectType={s.effectType}
                            col={s.col}
                            glow={s.glow}
                            icon={s.icon}
                            sub={s.sub}
                            bonus={s.rarity === 'Mythic' ? 20 : s.rarity === 'Legendary' ? 10 : s.rarity === 'Epic' ? 5 : s.rarity === 'Rare' ? 3 : 1}
                            label="SHADOW"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(activeTab === "Arsenal" || activeTab === "Vault") && (
            <div className="arsenal-grid">
              {filteredItems.map((item) => {
                const color = RARITY_COLORS[item.rarity.toUpperCase() as keyof typeof RARITY_COLORS] || '#475569';
                const Icon = CATEGORY_ICONS[item.item_category] || Package;
                const isCollected = !!item.collected;
                
                let effType: 'shadow'|'flame'|'smoke'|'lightning' = 'shadow';
                let colArr = [[80, 20, 220], [60, 0, 180], [100, 40, 240]];
                let glowStr = '70,10,200';
                
                if (item.item_category === 'Weapon') {
                  effType = 'flame';
                  colArr = [[255, 50, 10], [220, 20, 0], [255, 100, 30]];
                  glowStr = '240,40,0';
                  if (item.name.includes("Demon King")) { effType = 'lightning'; colArr = [[40, 110, 255], [20, 80, 220], [60, 150, 255]]; glowStr = '30,100,255'; }
                  if (item.name.includes("Baruka")) { effType = 'smoke'; colArr = [[160, 200, 255], [100, 150, 255], [200, 230, 255]]; glowStr = '150,180,255'; }
                } else if (item.item_category === 'Artifact') {
                  effType = 'lightning';
                  colArr = [[255, 160, 0], [230, 120, 0], [255, 200, 40]];
                  glowStr = '240,140,0';
                } else {
                  effType = 'smoke';
                  colArr = [[0, 180, 55], [0, 150, 35], [20, 210, 70]];
                  glowStr = '0,170,45';
                }

                return (
                  <AuraCard
                    key={item.name}
                    name={item.name}
                    rankLabel={item.rarity}
                    rarityColor={color}
                    isCollected={isCollected}
                    effectType={effType}
                    col={colArr}
                    glow={glowStr}
                    icon={<Icon size={24} />}
                    sub={isCollected ? item.description : "Information encrypted by the System."}
                    label={item.item_category.toUpperCase()}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertInfo.show && (
        <div className="custom-alert-overlay" onClick={() => setAlertInfo({ ...alertInfo, show: false })}>
          <div className="custom-alert-box" onClick={e => e.stopPropagation()}>
            <div className="custom-alert-header">
              <ShieldAlert size={20} color="var(--accent-primary)" />
              <span>{alertInfo.title}</span>
            </div>
            <div className="custom-alert-body">
              {alertInfo.message}
            </div>
            <Button variant="primary" onClick={() => setAlertInfo({ ...alertInfo, show: false })} style={{ width: '100%', marginTop: '24px', borderRadius: '12px' }}>
              Acknowledge
            </Button>
          </div>
        </div>
      )}

      <style>{`
        .collection-grid-v2 {
          position: relative; padding: 32px; border-radius: var(--r-lg);
          background: rgba(10, 10, 16, 0.75);
          backdrop-filter: blur(30px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 40px 100px rgba(0,0,0,0.8), inset 0 0 20px rgba(168,168,255,0.05);
        }
        
        /* ── MONARCH FIRE ── */
        .monarch-hero-section {
          margin-bottom: 60px; border-radius: var(--r-2xl); padding: 60px;
          border: 1px solid rgba(168, 168, 255, 0.2);
          background: radial-gradient(circle at center, rgba(168, 168, 255, 0.1), rgba(0,0,0,0.9));
          position: relative; overflow: hidden;
          box-shadow: 0 0 80px rgba(88, 28, 135, 0.3);
        }
        .monarch-hero-section::after {
          content: ''; position: absolute; width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(168,168,255,0.15) 0%, transparent 70%);
          top: 50%; left: 80%; transform: translate(-50%, -50%);
          animation: portalSwirl 20s linear infinite;
          pointer-events: none;
        }
        @keyframes portalSwirl { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }

        .hero-content { display: flex; align-items: center; justify-content: space-between; gap: 60px; position: relative; z-index: 2; }
        .hero-meta { flex: 1; }
        .hero-tag-wrap { 
          display: flex; align-items: center; gap: 10px; color: var(--accent-primary); margin-bottom: 20px;
          background: rgba(168,168,255,0.15); width: fit-content; padding: 8px 16px; border-radius: var(--r-lg);
          border: 1px solid rgba(168,168,255,0.3);
        }
        .hero-tag { font-size: 0.8rem; font-weight: 950; letter-spacing: 5px; text-shadow: 0 0 10px var(--accent-primary); }
        .hero-name { 
          font-size: 5rem; font-weight: 950; margin: 0 0 24px; font-family: 'Outfit', sans-serif; letter-spacing: -2px; 
          background: linear-gradient(180deg, #fff 30%, var(--accent-primary) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 30px rgba(168,168,255,0.5));
        }
        .hero-desc { font-size: 1.3rem; color: #fff; line-height: 1.6; max-width: 550px; margin-bottom: 48px; opacity: 0.9; font-weight: 500; text-shadow: 0 2px 10px rgba(0,0,0,1); }
        
        .hero-stats { display: flex; gap: 60px; }
        .h-stat { display: flex; flex-direction: column; gap: 8px; }
        .h-stat-lbl { font-size: 0.7rem; font-weight: 950; letter-spacing: 3px; opacity: 0.6; color: var(--accent-primary); }
        .h-stat-val { font-size: 2.8rem; font-weight: 950; text-shadow: 0 4px 20px rgba(0,0,0,0.8); }
        
        .hero-visual { position: relative; display: flex; align-items: center; justify-content: center; width: 420px; }
        .hero-aura-glow {
          position: absolute; width: 500px; height: 500px; border-radius: 50%;
          background: radial-gradient(circle, var(--accent-primary) 0%, transparent 70%);
          opacity: 0.3; filter: blur(120px);
          animation: auraPulse 3s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes auraPulse { from { transform: scale(0.7); opacity: 0.2; } to { transform: scale(1.4); opacity: 0.45; } }

        .hero-card-wrapper {
          position: relative; z-index: 10;
          animation: heroFloat 5s ease-in-out infinite;
          filter: drop-shadow(0 30px 60px rgba(0,0,0,0.9));
        }
        @keyframes heroFloat { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-30px) rotate(3deg); } }

        .army-rank-section { margin-bottom: 64px; }
        .rank-divider { display: flex; align-items: center; gap: 24px; margin-bottom: 32px; }
        .rank-title { font-size: 0.9rem; font-weight: 950; letter-spacing: 5px; margin: 0; white-space: nowrap; text-shadow: 0 0 15px currentColor; }
        .divider-line { height: 3px; flex: 1; background: linear-gradient(90deg, currentColor 0%, transparent 100%); border-radius: 3px; opacity: 0.5; box-shadow: 0 0 10px currentColor; }
        .rank-count { font-size: 0.8rem; font-weight: 950; opacity: 0.6; color: #fff; }

        .army-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 32px; }
        .arsenal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
        
        .shadow-unit-wrap { transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .shadow-unit-wrap:hover { transform: translateY(-12px) scale(1.05); z-index: 5; }

        .custom-alert-overlay {
          position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(20px);
          display: flex; align-items: center; justify-content: center; z-index: 2000; animation: fadeIn 0.3s ease;
        }
        .custom-alert-box {
          background: rgba(10, 10, 20, 0.95); border: 2px solid var(--accent-primary);
          box-shadow: 0 0 50px rgba(168, 168, 255, 0.4); border-radius: var(--r-2xl); padding: 48px;
          max-width: 500px; width: 90%; animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .custom-alert-header { display: flex; align-items: center; gap: 12px; font-weight: 950; font-size: 1.4rem; color: #fff; margin-bottom: 20px; }
        .custom-alert-body { color: var(--t2); font-size: 1.1rem; line-height: 1.6; }
        
        .loading-glitch { font-size: 0.8rem; font-weight: 950; letter-spacing: 5px; color: var(--accent-primary); animation: glitch 1s infinite; }
        @keyframes glitch { 0% { opacity: 1; } 50% { opacity: 0.5; transform: translateX(-2px); } 100% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }

        .mana-storm-overlay {
          position: absolute; inset: 0;
          background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity: 0.05; mix-blend-mode: overlay; pointer-events: none; animation: storm 8s steps(5) infinite;
        }
        @keyframes storm { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(-1%, -1%); } }
      `}</style>
    </section>
  );
}
