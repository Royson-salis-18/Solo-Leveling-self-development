import { useState, useEffect } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, 
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { useAuth } from '../lib/authContext';
import { supabase } from '../lib/supabase';
import { 
  SYSTEM_CATEGORIES, 
  DOMAINS, 
  getCategoriesByDomain, 
  type DomainKey, 
  type CategoryDef
} from '../lib/categoryConfig';
import * as LucideIcons from 'lucide-react';

const renderIcon = (iconName: string, size = 16, color?: string) => {
  const Icon = (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
  return <Icon size={size} color={color} />;
};

interface DomainRadarProps {
  customCategories?: CategoryDef[];
}

interface CategoryScore {
  category: string;
  value: number; // 0-100 based on completion %
  xp: number;
  icon: string;
  color: string;
}

interface CategoryBreakdown {
  name: string;
  icon: string;
  color: string;
  completed: number;
  total: number;
  pct: number;
  xp: number;
}

interface DomainDetail {
  key: DomainKey;
  label: string;
  icon: string;
  color: string;
  desc: string;
  categories: CategoryBreakdown[];
  totalXp: number;
}

const RADAR_CATEGORIES = SYSTEM_CATEGORIES.map(c => c.name);


const DOMAIN_ORDER: DomainKey[] = ['Physical', 'Mind', 'Soul', 'Execution', 'Builder'];

export function DomainRadar({ customCategories = [] }: DomainRadarProps) {
  const { user } = useAuth();
  const [radarData, setRadarData] = useState<CategoryScore[]>([]);
  const [domainDetails, setDomainDetails] = useState<DomainDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDomain, setActiveDomain] = useState<DomainKey | null>(null);

  useEffect(() => {
    if (!user || !supabase) return;

    (async () => {
      setLoading(true);

      const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from('tasks')
        .select('category, is_completed, is_recurring, points')
        .eq('user_id', user.id)
        .gte('created_at', since);
      
      // EXCLUDE "Phantom Tasks": Uncompleted recurring tasks that have been reset for the future.
      // We only count completed tasks (including history records) and one-off active missions.
      const { data: tasks } = await query;
      
      if (!tasks) { setLoading(false); return; }

      // Filter locally for maximum accuracy: 
      // Keep if: (completed) OR (NOT recurring)
      const validTasks = tasks.filter(t => t.is_completed || !t.is_recurring);

      const allCategories = [...SYSTEM_CATEGORIES, ...customCategories];
      const byDomain = getCategoriesByDomain(customCategories);

      // Build per-category stats
      const catStats: Record<string, { completed: number; total: number; xp: number }> = {};
      allCategories.forEach(c => { catStats[c.name] = { completed: 0, total: 0, xp: 0 }; });

      validTasks.forEach(t => {
        if (catStats[t.category]) {
          catStats[t.category].total++;
          if (t.is_completed) {
            catStats[t.category].completed++;
            catStats[t.category].xp += t.points || 0;
          }
        }
      });

      // Build domain details
      const details: DomainDetail[] = DOMAIN_ORDER.map(key => {
        const cats = byDomain[key];
        const domainMeta = DOMAINS[key];

        const categoryBreakdowns: CategoryBreakdown[] = cats.map(c => {
          const s = catStats[c.name];
          return {
            name: c.name,
            icon: c.icon,
            color: c.color,
            completed: s.completed,
            total: s.total,
            pct: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
            xp: s.xp,
          };
        });

        const domainXp = categoryBreakdowns.reduce((sum, c) => sum + c.xp, 0);

        return {
          key,
          label: domainMeta.label,
          icon: domainMeta.icon,
          color: domainMeta.color,
          desc: domainMeta.desc,
          categories: categoryBreakdowns,
          totalXp: domainXp,
        };
      });

      // Build Radar Data based on Categories (The 10 core ones)
      const radar: CategoryScore[] = RADAR_CATEGORIES.map(name => {
        const cat = allCategories.find(c => c.name === name);
        const stats = catStats[name] || { completed: 0, total: 0, xp: 0 };
        return {
          category: name,
          icon: cat?.icon || '🔧',
          color: cat?.color || '#64748b',
          value: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
          xp: stats.xp
        };
      });

      setRadarData(radar);
      setDomainDetails(details);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, JSON.stringify(customCategories)]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, opacity: 0.4 }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>SCANNING CATEGORY PROFICIENCY...</span>
      </div>
    );
  }


  return (
    <div style={{ width: '100%' }}>

      {/* ── TOP SECTION: Radar + Domain Score Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 32, alignItems: 'center' }}>

        {/* Radar: Detailed Categories */}
        <div style={{ 
          position: 'relative', 
          background: 'radial-gradient(circle at center, rgba(16, 16, 32, 0.4) 0%, rgba(5, 5, 10, 0.8) 100%)',
          borderRadius: 24,
          padding: 20,
          border: '1px solid rgba(255,255,255,0.03)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
        }}>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <defs>
                <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.5} />
                </linearGradient>
                <filter id="radarGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <PolarGrid stroke="rgba(255,255,255,0.05)" gridType="polygon" />
              <PolarAngleAxis
                dataKey="category"
                tick={({ x, y, payload }) => {
                  return (
                    <g transform={`translate(${x},${y})`} style={{ cursor: 'help' }}>
                      <title>{payload.value}</title>
                      <circle cx={0} cy={0} r={3} fill="var(--accent-primary)" opacity={0.7} />
                      <circle cx={0} cy={0} r={10} fill="var(--accent-primary)" opacity={0.1} />
                      <text
                        x={0} y={14}
                        textAnchor="middle"
                        fill="rgba(168, 168, 255, 0.6)"
                        style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em' }}
                      >
                        {payload.value.substring(0, 3)}
                      </text>
                    </g>
                  );
                }}
              />
              <Radar
                name="Proficiency"
                dataKey="value"
                stroke="#6366f1"
                fill="url(#radarFill)"
                fillOpacity={0.7}
                strokeWidth={3}
                isAnimationActive={true}
                animationDuration={1500}
                filter="url(#radarGlow)"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as CategoryScore;
                    return (
                      <div style={{
                        background: 'rgba(10, 10, 20, 0.9)',
                        border: `1px solid rgba(255,255,255,0.1)`,
                        padding: '16px 20px',
                        borderRadius: 16,
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
                        color: '#fff'
                      }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 900, color: d.color, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>
                          <span style={{ display: 'flex', alignItems: 'center' }}>{renderIcon(d.icon, 20, d.color)}</span> {d.category}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                          <div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Completion</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>{d.value}%</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>XP Earned</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: d.color }}>+{d.xp}</div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ 
            position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            fontSize: '0.55rem', opacity: 0.3, letterSpacing: '0.1em', textTransform: 'uppercase'
          }}>
            Last 60 days activity
          </div>
        </div>

        {/* Domain Groups (Interactive List with Smooth Accordions) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {domainDetails.map(d => {
            const isActive = activeDomain === d.key;
            const score = Math.round(d.categories.reduce((a, b) => a + b.pct, 0) / Math.max(1, d.categories.length));
            const tier = score >= 80 ? 'SOVEREIGN' : score >= 55 ? 'AWAKENED' : score >= 30 ? 'INITIATED' : 'DORMANT';
            const tierColor = score >= 80 ? '#ffd700' : score >= 55 ? 'var(--accent-primary)' : score >= 30 ? '#34d399' : '#64748b';
            return (
              <div key={d.key} style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  onClick={() => setActiveDomain(isActive ? null : d.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', borderRadius: 14, cursor: 'pointer',
                    background: isActive ? `rgba(99, 102, 241, 0.15)` : 'rgba(5, 5, 10, 0.4)',
                    border: `1px solid ${isActive ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255,255,255,0.04)'}`,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                    zIndex: isActive ? 2 : 1,
                    boxShadow: isActive ? '0 10px 20px rgba(0,0,0,0.3)' : 'none'
                  }}
                >
                  <div style={{ color: d.color, display: 'flex', alignItems: 'center' }}>
                    {renderIcon(d.icon, 20)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{d.label}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.58rem', color: tierColor, fontWeight: 800 }}>{tier}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--accent-primary)' }}>{score}%</span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${score}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: 99, transition: 'width 1s ease', opacity: 0.8 }} />
                    </div>
                  </div>
                </div>

                {/* Smooth Accordion Content */}
                <div style={{
                  display: 'grid',
                  gridTemplateRows: isActive ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  marginTop: isActive ? 8 : 0,
                }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{
                      padding: '16px', borderRadius: 14,
                      background: `rgba(168, 168, 255, 0.08)`,
                      border: `1px solid rgba(168, 168, 255, 0.15)`,
                      opacity: isActive ? 1 : 0,
                      transition: 'opacity 0.3s ease 0.1s',
                      marginBottom: isActive ? 4 : 0,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ 
                          width: 42, height: 42, borderRadius: 12, 
                          background: `${d.color}15`, border: `1px solid ${d.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: d.color,
                          flexShrink: 0
                        }}>
                          <div style={{ margin: '0 auto' }}>{renderIcon(d.icon, 20)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {d.desc}
                            </div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--accent-primary)' }}>+{d.totalXp} XP</div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: 10, marginTop: 12 }}>
                        {d.categories.map(c => (
                          <div key={c.name} style={{ 
                            padding: '10px 12px', background: 'rgba(5, 5, 15, 0.4)', 
                            borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)',
                            display: 'flex', flexDirection: 'column', gap: 6
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                               <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                 {renderIcon(c.icon, 12, c.color)}
                                 <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', opacity: 0.9 }}>{c.name}</span>
                               </div>
                               <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-primary)' }}>{c.pct}%</span>
                            </div>
                            <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ width: `${c.pct}%`, height: '100%', background: c.color, borderRadius: 99, opacity: 0.8 }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.5rem', opacity: 0.3, letterSpacing: '0.05em' }}>{c.completed}/{c.total} GATES</span>
                              <span style={{ fontSize: '0.5rem', fontWeight: 800, color: c.color, opacity: 0.7 }}>+{c.xp} XP</span>
                            </div>
                          </div>
                        ))}
                      </div>


                      {d.categories.every(c => c.total === 0) && (
                        <div style={{ textAlign: 'center', padding: '12px 0', opacity: 0.35, fontSize: '0.65rem', fontStyle: 'italic' }}>
                          No data recorded for {d.label} in the current evaluation period.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
