import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Button } from "../components/Button";
import { 
  Skull, Swords, Gem, Hammer,
  Sparkles, Zap, Package, 
  Lock
} from "lucide-react";

/* ─────────────────────── types ─────────────────────── */
type Shadow = { id?: string; name: string; rarity: string; bonus_value?: number; collected?: boolean };
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
  'RARE': '#3b82f6',      /* Brighter Blue */
  'EPIC': '#4e8eff',      /* Electric Blue */
  'LEGENDARY': '#b45309', /* Dark Gold */
  'MYTHIC': '#991b1b',    /* Red Orc Crimson */
  'E-RANK': '#475569',
  'D-RANK': '#334155',
  'C-RANK': '#3b82f6',
  'B-RANK': '#4e8eff',
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
const SHADOW_CATALOG: Shadow[] = [
  { name: "Shadow Infantry", rarity: "Common" },
  { name: "Shadow Mage", rarity: "Common" },
  { name: "Iron", rarity: "Rare" },
  { name: "Tank", rarity: "Rare" },
  { name: "Igris", rarity: "Epic" },
  { name: "Tusk", rarity: "Epic" },
  { name: "Beru", rarity: "Epic" },
  { name: "Bellion", rarity: "Legendary" },
  { name: "Kamish", rarity: "Legendary" },
  { name: "Kira", rarity: "Rare" },
  { name: "Sid", rarity: "Rare" },
  { name: "Min Byung-gu", rarity: "Epic" },
  { name: "Gray", rarity: "Legendary" },
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
    fetchCollection();
    alert(`🎁 System Gift: You received [${picked.name}]!`);
  };

  const filteredShadows = showAll ? shadows : shadows.filter(s => s.collected);
  const filteredItems = items.filter(i => {
    const matchesTab = activeTab === "Arsenal" ? i.item_category === "Weapon" : i.item_category !== "Weapon";
    const matchesFilter = showAll || i.collected;
    return matchesTab && matchesFilter;
  });

  return (
    <section className="page">
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
              {filteredShadows.map(s => {
                const isCollected = s.collected;
                const color = RARITY_COLORS[s.rarity.toUpperCase() as keyof typeof RARITY_COLORS] || '#475569';
                const rankLabel = s.rarity === 'Legendary' ? 'GRAND MARSHAL' : 
                                  s.rarity === 'Epic' ? 'COMMANDER' : 
                                  s.rarity === 'Rare' ? 'KNIGHT' : 'ELITE';
                const bonus = s.rarity === 'Legendary' ? 10 : 
                              s.rarity === 'Epic' ? 5 : 
                              s.rarity === 'Rare' ? 3 : 1;

                return (
                  <div key={s.name} className={`shadow-card-v2 ${!isCollected ? 'locked' : 'shadow-aura'}`} style={{ '--rarity-color': color } as any}>
                    {!isCollected && <Lock size={12} className="lock-icon" />}
                    <div className="shadow-avatar-v2" style={{ borderColor: isCollected ? color : '#334155' }}>
                      <Skull 
                        size={32} 
                        style={{ stroke: isCollected ? color : '#334155', fill: 'none' }} 
                      />
                    </div>
                    <div className="shadow-info">
                      <h3 className="shadow-name">{s.name}</h3>
                      <div className="rarity-tag-v2" style={{ color }}>{rankLabel}</div>
                      {isCollected && (
                        <div className="bonus-pill">
                          <Sparkles size={11} /> +{bonus}% XP
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(activeTab === "Arsenal" || activeTab === "Vault") && (
            <div className="arsenal-grid">
              {filteredItems.map(item => {
                const color = RARITY_COLORS[item.rarity.toUpperCase() as keyof typeof RARITY_COLORS] || '#475569';
                const Icon = CATEGORY_ICONS[item.item_category] || Package;
                const isCollected = item.collected;
                return (
                  <div key={item.name} className={`item-card-v2 ${!isCollected ? 'locked' : ''}`} style={{ '--rarity-color': color } as any}>
                    <div className="item-rarity-stripe" style={{ background: color }} />
                    <div className="item-icon-box" style={{ background: isCollected ? `${color}15` : 'rgba(15,23,42,0.5)' }}>
                      {isCollected ? <Icon size={24} color={color} /> : <Lock size={20} color="#334155" />}
                    </div>
                    <div className="item-details">
                      <div className="item-header-row">
                        <span className="item-name-v2">{item.name}</span>
                        <span className="rarity-label-v2" style={{ color, borderColor: `${color}44` }}>{item.rarity}</span>
                      </div>
                      <p className="item-desc-v2">
                        {isCollected ? item.description : "Information encrypted by the System."}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      
      <style>{`
        /* ── Collection Container ── */
        .collection-grid-v2 {
          position: relative; padding: 28px; border-radius: 20px;
          background: rgba(17, 24, 39, 0.65);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(148, 163, 184, 0.08);
          background-image: var(--bg-noise);
        }
        .army-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
          gap: 20px;
        }
        .arsenal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        /* ── Army Card — gray base, colored accent on top ── */
        .shadow-card-v2 {
          background: rgba(17, 24, 39, 0.88);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 20px;
          padding: 28px 20px 24px;
          text-align: center;
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          cursor: pointer;
        }
        .shadow-card-v2::before {
          content: '';
          position: absolute;
          top: 0; left: 16px; right: 16px; height: 2px;
          background: linear-gradient(90deg, transparent, var(--rarity-color, #5b9cf6), transparent);
          border-radius: 99px;
          opacity: 0.7;
        }
        .shadow-card-v2.locked::before { opacity: 0.15; }
        .shadow-card-v2:not(.locked):hover {
          transform: translateY(-5px);
          background: rgba(22, 32, 56, 0.95);
          border-color: var(--rarity-color, rgba(91, 156, 246, 0.4));
          box-shadow: 0 12px 28px rgba(0,0,0,0.45), 0 0 20px rgba(91,156,246,0.08);
        }

        /* Avatar circle */
        .shadow-avatar-v2 {
          width: 68px; height: 68px; border-radius: 50%; margin: 0 auto 18px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(10, 14, 26, 0.9);
          border: 1.5px solid var(--rarity-color, rgba(91,156,246,0.4));
          box-shadow: 0 0 12px rgba(0,0,0,0.6) inset, 0 0 8px var(--rarity-color, rgba(91,156,246,0.1));
          position: relative; z-index: 2;
        }
        .shadow-info { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .shadow-name { font-size: 1.1rem; font-weight: 800; color: #f1f5f9; margin-bottom: 4px; letter-spacing: -0.01em; }
        .rarity-tag-v2 { font-size: 0.62rem; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 12px; }
        .bonus-pill {
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(52, 211, 153, 0.08); color: #34d399;
          border: 1px solid rgba(52, 211, 153, 0.2);
          padding: 3px 10px; border-radius: 99px; font-size: 0.72rem; font-weight: 800;
        }

        /* ── Arsenal / Vault items — gray + rarity stripe ── */
        .item-card-v2 {
          background: rgba(17, 24, 39, 0.82);
          border: 1px solid rgba(148, 163, 184, 0.08);
          border-radius: 16px;
          padding: 18px; display: flex; gap: 16px; position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .item-card-v2:not(.locked):hover {
          border-color: var(--rarity-color);
          transform: translateX(4px);
          background: rgba(22, 32, 56, 0.92);
          box-shadow: 0 0 20px rgba(0,0,0,0.3);
        }
        .item-rarity-stripe {
          position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          border-radius: 4px 0 0 4px;
          background: var(--rarity-color, #5b9cf6);
          opacity: 0.85;
        }
        .item-icon-box {
          width: 52px; height: 52px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(10, 14, 26, 0.8); border: 1px solid rgba(148,163,184,0.1);
        }
        .item-details { flex: 1; min-width: 0; }
        .item-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .item-name-v2 { font-size: 1rem; font-weight: 800; color: #f1f5f9; }
        .rarity-label-v2 {
          font-size: 0.58rem; font-weight: 900; border: 1px solid;
          padding: 2px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.08em;
        }
        .item-desc-v2 { font-size: 0.8rem; color: #64748b; line-height: 1.5; }

        .locked { opacity: 0.42; filter: grayscale(0.6); }
        .lock-icon { position: absolute; top: 12px; right: 12px; color: #475569; }
        .shadow-aura { position: relative; }
      `}</style>
    </section>
  );
}
