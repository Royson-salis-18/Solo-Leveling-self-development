import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";

type LBUser = {
  user_id: string; name: string; level: number; total_points: number;
  player_class: string; player_rank: string; player_title: string;
  guild_id: string | null; clan_id_via_members?: string;
};

type GuildLB = { id: string; name: string; total_xp: number; member_count: number };
type ClanLB  = { id: string; name: string; total_xp: number; member_count: number };

type LBTab = "Hunters" | "Guilds" | "Clans";

const MEDALLION = ["🥇", "🥈", "🥉"];

export function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab]           = useState<LBTab>("Hunters");
  const [hunters, setHunters]   = useState<LBUser[]>([]);
  const [guilds,  setGuilds]    = useState<GuildLB[]>([]);
  const [clans,   setClans]     = useState<ClanLB[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      const [hRes, gRes, cRes] = await Promise.all([
        supabase.from("user_profiles")
          .select("user_id, name, level, total_points, player_class, player_rank, player_title, guild_id")
          .order("total_points", { ascending: false })
          .limit(50),

        supabase.from("guilds").select("id, name, member_count"),
        supabase.from("clans").select("id, name"),
      ]);

      setHunters(hRes.data ?? []);

      // For guild XP: sum via guild_members join user_profiles
      if (gRes.data?.length) {
        const { data: guildMemberRows } = await supabase
          .from("guild_members").select("guild_id, user_id");
        const { data: allProfs } = await supabase
          .from("user_profiles").select("user_id, total_points");

        const guildXP = new Map<string, { xp: number; count: number }>();
        (guildMemberRows ?? []).forEach((gm: any) => {
          const prof = allProfs?.find((p: any) => p.user_id === gm.user_id);
          const cur  = guildXP.get(gm.guild_id) ?? { xp: 0, count: 0 };
          guildXP.set(gm.guild_id, { xp: cur.xp + (prof?.total_points ?? 0), count: cur.count + 1 });
        });
        const gbData = (gRes.data ?? []).map(g => ({
          id: g.id, name: g.name,
          total_xp: guildXP.get(g.id)?.xp ?? 0,
          member_count: guildXP.get(g.id)?.count ?? 0,
        }))
          .sort((a, b) => b.total_xp - a.total_xp);
        setGuilds(gbData);
      }

      // For clan XP: sum via clan_members join user_profiles
      if (cRes.data?.length) {
        const { data: clanMemberRows } = await supabase
          .from("clan_members").select("clan_id, user_id");
        const { data: allProfs } = await supabase
          .from("user_profiles").select("user_id, total_points");

        const clanXP = new Map<string, { xp: number; count: number }>();
        (clanMemberRows ?? []).forEach((cm: any) => {
          const prof = allProfs?.find((p: any) => p.user_id === cm.user_id);
          const cur  = clanXP.get(cm.clan_id) ?? { xp: 0, count: 0 };
          clanXP.set(cm.clan_id, { xp: cur.xp + (prof?.total_points ?? 0), count: cur.count + 1 });
        });

        const clData = (cRes.data ?? []).map(c => ({
          id: c.id, name: c.name,
          total_xp: clanXP.get(c.id)?.xp ?? 0,
          member_count: clanXP.get(c.id)?.count ?? 0,
        })).filter(c => c.member_count >= 3)
          .sort((a, b) => b.total_xp - a.total_xp);
        setClans(clData);
      }

      setLoading(false);
    })();
  }, []);

  const isMe = (id: string) => id === user?.id;

  const podiumOrder = hunters.length >= 3
    ? [hunters[1], hunters[0], hunters[2]]
    : hunters.slice(0, 3);
  const podiumRealIdx = (pos: number) => [1, 0, 2][pos] ?? pos;

  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Leaderboard</h2>
        <div className="text-xs text-muted">{hunters.length} hunters ranked</div>
      </div>

      {/* Tab bar */}
      <div className="arena-tabs" style={{ marginBottom: 24 }}>
        {(["Hunters", "Guilds", "Clans"] as LBTab[]).map(t => (
          <button key={t} className={`arena-tab${tab === t ? " arena-tab--active" : ""}`} onClick={() => setTab(t)}>
            {t === "Hunters" ? "⚔️" : t === "Guilds" ? "🏛️" : "🛡️"} {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="panel panel-empty text-muted text-sm">Querying ranked data…</div>
      ) : (
        <>
          {/* ── HUNTERS ── */}
          {tab === "Hunters" && (
            <>
              {/* Podium */}
              {podiumOrder.length === 3 && (
                <div className="lb-podium-shell">
                  <div className="lb-podium">
                    {podiumOrder.map((u, pos) => {
                      const ri    = podiumRealIdx(pos);
                      const isTop = ri === 0;
                      const heights = ["220px", "262px", "204px"];
                      return (
                        <div
                          key={u.user_id}
                          className={`lb-podium-card${isTop ? " lb-podium-card--top" : ""} ds-glass ds-aura`}
                          style={{ height: heights[ri] }}
                        >
                          <div className="lb-podium-avatar" style={{ width: isTop ? 74 : 58, height: isTop ? 74 : 58, marginTop: isTop ? "-62px" : "-42px", border: isTop ? "2px solid rgba(255,204,0,0.8)" : "1px solid rgba(168,168,255, 0.45)" }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="lb-podium-medal" style={{ marginTop: 12 }}>{MEDALLION[ri]}</div>
                          <div className="lb-podium-name">{isMe(u.user_id) ? "You" : u.name}</div>
                          <div className="lb-podium-class">{u.player_class}</div>
                          <div className="lb-podium-xp" style={{ marginTop: 'auto' }}>{u.total_points.toLocaleString()} <span className="text-xs text-muted" style={{textShadow: 'none'}}>XP</span></div>
                          <span className={`rank-badge rank-${u.player_rank}`} style={{ marginTop: 8 }}>{u.player_rank}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full list */}
              <article className="panel lb-list-shell">
                <div className="lb-list-stack">
                  {hunters.map((u, i) => (
                    <div key={u.user_id} className={`lb-row${isMe(u.user_id) ? " lb-row--me" : ""}`}>
                      <div className="lb-row-rank">{i < 3 ? MEDALLION[i] : `#${i + 1}`}</div>
                      <div className="lb-row-avatar">{u.name.charAt(0).toUpperCase()}</div>
                      <div className="lb-row-info">
                        <div className="lb-row-name">
                          {isMe(u.user_id) ? "You" : u.name}
                          <span className="rank-badge rank-sm" style={{ marginLeft: 6 }}>{u.player_rank}</span>
                        </div>
                        <div className="lb-row-sub">{u.player_class} · Lv.{u.level} · <em>{u.player_title}</em> · <span style={{ fontFamily: 'monospace', color: 'rgba(168,168,255,0.5)', fontSize: '0.58rem' }}>#{u.user_id.slice(0,8).toUpperCase()}</span></div>
                      </div>
                      <div className="lb-row-xp">{u.total_points.toLocaleString()} <span className="text-xs text-muted">XP</span></div>
                    </div>
                  ))}
                </div>
              </article>
            </>
          )}

          {/* ── GUILDS ── */}
          {tab === "Guilds" && (
            <div className="flex-col gap-14">
              {guilds.length === 0 ? (
                <div className="panel panel-empty"><p className="text-muted text-sm">No guilds ranked yet.</p></div>
              ) : guilds.map((g, i) => (
                <div key={g.id} className={`lb-group-card${i === 0 ? " lb-group-card--top" : ""}`}>
                  <div className="lb-group-rank">{i < 3 ? MEDALLION[i] : `#${i + 1}`}</div>
                  <div className="lb-group-icon" style={{ color: "#ffcc00" }}>🏛️</div>
                  <div className="lb-group-info">
                    <div className="lb-group-name">{g.name}</div>
                    <div className="lb-group-meta">{g.member_count} members</div>
                  </div>
                  <div className="lb-group-xp">
                    <div className="lb-group-xp-val">{g.total_xp.toLocaleString()}</div>
                    <div className="text-xs text-muted">Total XP</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── CLANS ── */}
          {tab === "Clans" && (
            <div className="flex-col gap-14">
              {clans.length === 0 ? (
                <div className="panel panel-empty"><p className="text-muted text-sm">No clans with 3+ members yet.</p></div>
              ) : clans.map((c, i) => (
                <div key={c.id} className={`lb-group-card${i === 0 ? " lb-group-card--top" : ""}`}>
                  <div className="lb-group-rank">{i < 3 ? MEDALLION[i] : `#${i + 1}`}</div>
                  <div className="lb-group-icon">🛡️</div>
                  <div className="lb-group-info">
                    <div className="lb-group-name">{c.name}</div>
                    <div className="lb-group-meta">{c.member_count} / 5 members</div>
                  </div>
                  <div className="lb-group-xp">
                    <div className="lb-group-xp-val">{c.total_xp.toLocaleString()}</div>
                    <div className="text-xs text-muted">Total XP</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
