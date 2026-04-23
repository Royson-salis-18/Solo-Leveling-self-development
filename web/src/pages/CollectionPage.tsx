import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import React from "react";
import { Button } from "../components/Button";
import { 
  Skull, Swords, Gem, Hammer,
  Sparkles, Zap, Package
} from "lucide-react";
import { AuraCard } from "../components/AuraCard";

/* ─────────────────────── types ─────────────────────── */
type Shadow = { 
  id?: string; name: string; rarity: string; bonus_value?: number; collected?: boolean; 
  effectType?: 'shadow'|'flame'|'smoke'|'lightning'; 
  col?: number[][]; 
  glow?: string; 
  icon?: React.ReactNode | string; 
  sub?: string; 
};
type InventoryItem = { 
  id?: string; name: string; description: string; 
  item_type: string; item_category: string; 
  rarity: string; quantity?: number; image_url?: string;
  collected?: boolean;
};

const TABS = ["Army", "Arsenal", "Vault"] as const;
type Tab = typeof TABS[number];

const RARITY_COLORS: Record<string, string> = {
  'COMMON': '#334155',
  'RARE': '#3b82f6',
  'EPIC': '#a8a8ff',      /* subtle monarch purple-blue (less electric) */
  'LEGENDARY': '#b45309', /* Dark Gold */
  'MYTHIC': '#991b1b',    /* Red Orc Crimson */
  'E-RANK': '#475569',
  'D-RANK': '#334155',
  'C-RANK': '#3b82f6',
  'B-RANK': '#c4b5fd',
  'A-RANK': '#991b1b',
  'S-RANK': '#b45309'
};

const CATEGORY_ICONS: Record<string, any> = {
  'Weapon': Swords,
  'Artifact': Gem,
  'Tool': Hammer,
  'Consumable': Zap,
};

/* ─────────────────────── catalog data ─────────────────────── */
const SHADOW_CATALOG: (Shadow & { effectType?: 'shadow'|'flame'|'smoke'|'lightning'; col?: number[][]; glow?: string; icon?: string; sub?: string })[] = [
  { name: "Shadow Infantry", rarity: "Common", effectType: "shadow", icon: "◆", sub: "Basic Extraction" },
  { name: "Shadow Mage", rarity: "Common", effectType: "flame", col: [[200, 50, 255], [150, 0, 200], [255, 100, 255]], glow: "180, 50, 255", icon: "◉", sub: "Magic Division" },
  { name: "Iron", rarity: "Rare", effectType: "smoke", col: [[110, 110, 115], [80, 80, 85], [130, 130, 135]], glow: "90,90,95", icon: "◫", sub: "Heavy Tank" },
  { name: "Tank", rarity: "Rare", effectType: "smoke", col: [[110, 110, 115], [80, 80, 85], [130, 130, 135]], glow: "90,90,95", icon: "◫", sub: "Ice Bear" },
  { name: "Igris", rarity: "Epic", effectType: "shadow", col: [[210, 0, 65], [180, 0, 45], [240, 20, 85]], glow: "200,0,60", icon: "◆", sub: "Blood Knight" },
  { name: "Tusk", rarity: "Epic", effectType: "flame", col: [[255, 50, 10], [220, 20, 0], [255, 100, 30]], glow: "240,40,0", icon: "◉", sub: "High Orc Shaman" },
  { name: "Beru", rarity: "Epic", effectType: "smoke", col: [[0, 180, 55], [0, 150, 35], [20, 210, 70]], glow: "0,170,45", icon: "◬", sub: "Ant King" },
  { name: "Baruka", rarity: "Epic", effectType: "smoke", col: [[160, 200, 255], [100, 150, 255], [200, 230, 255]], glow: "150,180,255", icon: "❄", sub: "Frost Elf King" },
  { name: "Kargalgan", rarity: "Epic", effectType: "flame", col: [[255, 0, 100], [200, 0, 80], [255, 50, 150]], glow: "250,0,100", icon: "◉", sub: "Disaster Orc Mage" },
  { name: "Bellion", rarity: "Legendary", effectType: "shadow", col: [[80, 20, 220], [60, 0, 180], [100, 40, 240]], glow: "70,10,200", icon: "◆", sub: "Grand Marshal" },
  { name: "Kamish", rarity: "Legendary", effectType: "flame", col: [[255, 160, 0], [230, 120, 0], [255, 200, 40]], glow: "240,140,0", icon: "⬡", sub: "Dragon's Wrath" },
  { name: "Kira", rarity: "Rare", effectType: "shadow", icon: "◆", sub: "Shadow Assassin" },
  { name: "Sid", rarity: "Rare", effectType: "shadow", icon: "◆", sub: "Shadow Assassin" },
  { name: "Min Byung-gu", rarity: "Epic", effectType: "lightning", col: [[255, 200, 50], [255, 150, 0], [255, 250, 100]], glow: "255,200,0", icon: "⬟", sub: "Holy Healer" },
  { name: "Gray", rarity: "Legendary", effectType: "smoke", icon: "◫", sub: "Beast Monarch" },
  { name: "Greed", rarity: "Epic", effectType: "shadow", col: [[50, 50, 50], [20, 20, 20], [80, 80, 80]], glow: "40,40,40", icon: "◆", sub: "General Rank" },
];

const ITEM_CATALOG: InventoryItem[] = [
  { name: "Starter Blade", description: "A basic hunter's blade.", item_type: "WEAPON", item_category: "Weapon", rarity: "E-Rank" },
  { name: "Slayer's Saber", description: "A sharp saber preferred by low-rank agility hunters.", item_type: "WEAPON", item_category: "Weapon", rarity: "D-Rank" },
  { name: "Kasaka's Venom Fang", description: "A dagger made from the tooth of a Great Kasaka. Deals poison damage.", item_type: "WEAPON", item_category: "Weapon", rarity: "C-Rank" },
  { name: "Knight Killer", description: "A heavy dagger designed to pierce thick armor.", item_type: "WEAPON", item_category: "Weapon", rarity: "B-Rank" },
  { name: "Baruka's Dagger", description: "The dagger of the Ice Elf King Baruka. Imbued with cold.", item_type: "WEAPON", item_category: "Weapon", rarity: "A-Rank" },
  { name: "Demon King's Longsword", description: "A sword imbued with lightning from the Demon King.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Demon King's Dagger", description: "A high-speed dagger set belonging to the Monarch of White Flames.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Kamish's Wrath", description: "The ultimate daggers made from the dragon's tooth.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Volcan's Horn", description: "A fiery axe dropped by the Lord of the Demon Realm.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Orb of Avarice", description: "A magic orb that doubles the power of fire magic.", item_type: "WEAPON", item_category: "Weapon", rarity: "A-Rank" },
  { name: "Su-ho's Twin Swords", description: "Dual blades passed down through the Shadow Monarch's bloodline.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Dragon's Breath", description: "A bow that fires arrows made of pure mana.", item_type: "WEAPON", item_category: "Weapon", rarity: "A-Rank" },
  { name: "Moonshadow", description: "A dark katana that thrives in the absence of light.", item_type: "WEAPON", item_category: "Weapon", rarity: "S-Rank" },
  { name: "Wind of the Steppe", description: "A cape that increases movement speed significantly.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Rare" },
  { name: "Red Knight's Helmet", description: "Part of the Red Knight's set. Increases physical defense.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Epic" },
  { name: "High Magician's Ring", description: "A ring that boosts mana capacity by 50%.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Epic" },
  { name: "Rulers' Authority", description: "A mysterious artifact that allows the user to manipulate gravity.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Gauntlet of the Monarch", description: "Resonates with divine power. Increases punch strength.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Epic" },
  { name: "Fragment of the Sea", description: "A crystal holding the power of the Sea of Afterlife.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Divine Bloodline", description: "A passive artifact that boosts all stats and XP gain.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Ring of the Monarch of Frost", description: "An ancient ring that grants immunity to freezing.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "S-Rank" },
  { name: "Boots of the Wind", description: "Enchanted boots that allow for brief bursts of flight.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Rare" },
  { name: "Belt of the Titan", description: "Increases carry capacity and health recovery speed.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Epic" },
  { name: "Shield of the First Monarch", description: "Indestructible shield forged in the beginning of time.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Earrings of the Sea", description: "Allows the user to breathe underwater and move freely.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "A-Rank" },
  { name: "Shadow Monarch's Cloak", description: "A cloak that hides the user's presence from lower-rank enemies.", item_type: "ARTIFACT", item_category: "Artifact", rarity: "Legendary" },
  { name: "Instance Dungeon Key", description: "A key that opens a portal to a special training dungeon.", item_type: "TOOL", item_category: "Tool", rarity: "Rare" },
  { name: "Revive Token", description: "A one-time use token that prevents XP loss upon failure.", item_type: "TOOL", item_category: "Tool", rarity: "Legendary" },
];

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
      <div className="bg-blob" style={{ width: '400px', height: '400px', background: 'rgba(168, 168, 255, 0.1)', top: '-80px', left: '-100px', position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }}></div>
      <div className="bg-blob" style={{ width: '350px', height: '350px', background: 'rgba(111, 60, 255, 0.08)', top: '200px', right: '-80px', position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }}></div>
      <div className="bg-blob" style={{ width: '300px', height: '300px', background: 'rgba(168, 168, 255, 0.05)', bottom: '0', left: '30%', position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }}></div>

      {/* SVG Definitions for Gradients */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="monarch-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-secondary)" />
            <stop offset="100%" stopColor="var(--accent-primary)" />
          </linearGradient>
        </defs>
      </svg>

      <div className="page-header">
        <div>
          <h2 className="page-title">Collection</h2>
          <p className="text-xs text-muted">Manage your Army of Shadows and the Arsenal</p>
        </div>
        <div className="flex gap-8">
          <Button variant="secondary" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show Collected Only" : "Show All Roster"}
          </Button>
          <Button variant="primary" size="sm" onClick={getSystemGift}>
            <Sparkles size={13} /> Claim Gift
          </Button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        {TABS.map(t => (
          <div key={t} className={`tab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)}>
            {t === "Army" ? <Skull size={14} /> : t === "Arsenal" ? <Swords size={14} /> : <Gem size={14} />}
            {t} 
            <span className="badge-counter">
              {t === "Army" ? shadows.filter(s => s.collected).length : items.filter(i => i.collected && (activeTab === "Arsenal" ? i.item_category === "Weapon" : i.item_category !== "Weapon")).length}
              / {t === "Army" ? SHADOW_CATALOG.length : ITEM_CATALOG.filter(i => t === "Arsenal" ? i.item_category === "Weapon" : i.item_category !== "Weapon").length}
            </span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="panel panel-empty">Synchronizing data…</div>
      ) : (
        <div className="collection-grid-v2">
          {activeTab === "Army" && (
            <div className="army-grid">
              {filteredShadows.map((s) => {
                const isCollected = s.collected;
                const color = RARITY_COLORS[s.rarity.toUpperCase() as keyof typeof RARITY_COLORS] || '#475569';
                const rankLabel = s.rarity === 'Legendary' ? 'GRAND MARSHAL' : 
                                  s.rarity === 'Epic' ? 'COMMANDER' : 
                                  s.rarity === 'Rare' ? 'KNIGHT' : 'ELITE';
                const bonus = s.rarity === 'Legendary' ? 10 : 
                              s.rarity === 'Epic' ? 5 : 
                              s.rarity === 'Rare' ? 3 : 1;
                return (
                  <AuraCard
                    key={s.name}
                    name={s.name}
                    rankLabel={rankLabel}
                    rarityColor={color}
                    isCollected={!!isCollected}
                    effectType={s.effectType}
                    col={s.col}
                    glow={s.glow}
                    icon={s.icon}
                    sub={s.sub}
                    bonus={bonus}
                    label="SHADOW"
                  />
                );
              })}
            </div>
          )}

          {(activeTab === "Arsenal" || activeTab === "Vault") && (
            <div className="arsenal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
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
              <Sparkles size={16} color="var(--accent-primary)" />
              <span>{alertInfo.title}</span>
            </div>
            <div className="custom-alert-body">
              {alertInfo.message}
            </div>
            <Button variant="primary" onClick={() => setAlertInfo({ ...alertInfo, show: false })} style={{ width: '100%', marginTop: '16px' }}>
              Confirm
            </Button>
          </div>
        </div>
      )}

      
      <style>{`
        /* ── Collection Container ── */
        .collection-grid-v2 {
          position: relative; padding: 28px; border-radius: 20px;
          background: rgba(10, 10, 14, 0.60);
          backdrop-filter: blur(22px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background-image: var(--bg-noise);
        }
        .collection-grid-v2::before{
          content:'';
          position:absolute;
          inset:0;
          border-radius: 20px;
          pointer-events:none;
          background:
            radial-gradient(1200px 600px at 20% 10%, rgba(168,168,255,0.06), transparent 60%),
            radial-gradient(900px 500px at 85% 90%, rgba(111,60,255,0.035), transparent 62%);
          opacity: 0.9;
        }
        .army-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
          gap: 20px;
          position: relative;
          z-index: 1;
        }
        .arsenal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
          position: relative;
          z-index: 1;
        }

        /* ── Aura Card from HTML file ── */
        .aura-card.locked { opacity: 0.42; filter: grayscale(0.6); }

        /* ── Custom Alert Modal ── */
        .custom-alert-overlay {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }
        .custom-alert-box {
          background: rgba(17, 24, 39, 0.85);
          border: 1px solid var(--accent-border-soft);
          border-radius: 16px;
          padding: 24px;
          max-width: 400px; width: 90%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(168, 168, 255, 0.1) inset;
          backdrop-filter: blur(20px);
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .custom-alert-header {
          display: flex; align-items: center; gap: 8px;
          font-weight: 800; font-size: 1.1rem;
          color: var(--t1);
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          padding-bottom: 12px;
        }
        .custom-alert-body {
          color: var(--t2); font-size: 0.95rem; line-height: 1.5;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </section>
  );
}
