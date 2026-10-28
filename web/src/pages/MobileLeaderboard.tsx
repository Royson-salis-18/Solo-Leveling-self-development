import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Search, Shield, UserPlus, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { DOMAINS } from "../lib/domains";
import { podium, standingLine, standingOf } from "../lib/leaderboardRules";
import { haptic } from "../lib/feedback";
import "../components/mobile/mobile.css";
import "../components/mobile/sheets.css";
import "./mobile-leaderboard.css";

type Hunter = {
  user_id: string; name: string; level: number; total_points: number; player_class: string; player_rank: string; player_title: string;
  status?: string; domain_physical?: number; domain_mind?: number; domain_soul?: number; domain_execution?: number; domain_builder?: number;
};
type Team = { id: string; name: string; total_xp: number; member_count: number };
type Scope = "Hunters" | "Guilds" | "Clans";
const SCOPES: Scope[] = ["Hunters", "Guilds", "Clans"];
const PAGE = 25;
const PLACE_COLOR: Record<number, string> = { 1: "var(--m-gold)", 2: "#cbd5e1", 3: "#d08a4e" };
const initial = (n: string) => (n || "H").trim().charAt(0).toUpperCase();

function HunterSheet({ h, rank, isSelf, onClose }: { h: Hunter; rank: number; isSelf: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friend, setFriend] = useState<"none" | "pending" | "accepted" | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || isSelf || !user) { setFriend("none"); return; }
    void supabase.from("friendship").select("status")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`).or(`requester_id.eq.${h.user_id},receiver_id.eq.${h.user_id}`)
      .maybeSingle().then(({ data }) => setFriend((data?.status as "pending" | "accepted") ?? "none"));
  }, [h.user_id, isSelf, user]);

  const add = async () => {
    if (!supabase || !user || busy) return;
    setBusy(true);
    await supabase.from("friendship").insert({ requester_id: user.id, receiver_id: h.user_id, status: "pending" });
    setFriend("pending"); setBusy(false); haptic("success");
  };
  const stats = DOMAINS.map((d) => ({ name: d.name, color: d.color, v: Math.min(100, (h[d.key] as number | undefined) ?? 10) }));

  return createPortal(
    <div className="sh-bg" onClick={onClose}>
      <div className="sh" role="dialog" aria-modal="true" aria-label={`${h.name}'s profile`} onClick={(e) => e.stopPropagation()}>
        <div className="sh-grab" />
        <header className="sh-head"><span /><button className="m-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
        <div className="lbs-id">
          <span className="lbs-av">{initial(h.name)}</span>
          <h2>{isSelf ? `${h.name} (you)` : h.name}</h2>
          <p>{h.player_title || "Hunter"} · {h.player_class}</p>
          <div className="lbs-chips"><span>#{rank}</span><span>{h.player_rank}-Rank</span><span>Level {h.level}</span></div>
        </div>
        <dl className="lbs-facts"><div><dt>Standing XP</dt><dd>{h.total_points.toLocaleString()}</dd></div><div><dt>Status</dt><dd>{h.status === "DECEASED" ? "Fallen" : "Active"}</dd></div></dl>
        <div className="lbs-doms" aria-label="Domains">
          {stats.map((s) => (
            <div key={s.name} style={{ ["--dc" as string]: s.color }}>
              <span>{s.name}</span><div className="lbs-bar"><u style={{ width: `${s.v}%` }} /></div><b>{s.v}</b>
            </div>
          ))}
        </div>
        {!isSelf && (
          <div className="lbs-actions">
            <button className="sh-act" onClick={() => { navigate(`/social?whisper=${h.user_id}`); onClose(); }}><MessageSquare size={17} /> Whisper</button>
            <button className="sh-act hot" disabled={friend !== "none" || busy} onClick={add}><UserPlus size={17} /> {friend === "accepted" ? "Friends" : friend === "pending" ? "Request sent" : "Add friend"}</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function MobileLeaderboard() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("Hunters");
  const [hunters, setHunters] = useState<Hunter[]>([]);
  const [guilds, setGuilds] = useState<Team[]>([]);
  const [clans, setClans] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [count, setCount] = useState(PAGE);
  const [sel, setSel] = useState<Hunter | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        // Ranked by STANDING (balance + spent), so buying a reward never drops you down the board.
        const h = await supabase.from("public_profiles")
          .select("user_id, name, level, total_points:standing_xp, player_class, player_rank, player_title, domain_physical, domain_mind, domain_soul, domain_execution, domain_builder, status")
          .order("standing_xp", { ascending: false }).limit(100);
        if (h.error) throw h.error;
        const [g, c] = await Promise.all([
          supabase.from("guild_leaderboard").select("id, name, total_xp, member_count").order("total_xp", { ascending: false }).limit(50),
          supabase.from("clan_leaderboard").select("id, name, total_xp, member_count").order("total_xp", { ascending: false }).limit(50),
        ]);
        if (!alive) return;
        setHunters(((h.data ?? []) as unknown as Hunter[]).map((x) => ({ ...x, total_points: Number(x.total_points) })));
        setGuilds(((g.data ?? []) as Team[]).map((x) => ({ ...x, total_xp: Number(x.total_xp) })));
        setClans(((c.data ?? []) as Team[]).map((x) => ({ ...x, total_xp: Number(x.total_xp) })));
      } catch { if (alive) setFailed(true); } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    const base = scope === "Hunters"
      ? hunters.map((h) => ({ id: h.user_id, name: h.name || "Unknown", xp: h.total_points, hunter: h }))
      : (scope === "Guilds" ? guilds : clans).map((t) => ({ id: t.id, name: t.name, xp: t.total_xp, hunter: null as Hunter | null, members: t.member_count }));
    return base.map((r, i) => ({ ...r, place: i + 1 }));
  }, [scope, hunters, guilds, clans]);

  const me = scope === "Hunters" ? standingOf(rows, user?.id) : null;
  const searching = q.trim().length > 0;
  const filtered = searching ? rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())) : rows;
  const top = !searching ? podium(rows.slice(0, 3)) : [];
  const list = searching ? filtered : filtered.slice(top.length ? 3 : 0);
  const visible = list.slice(0, count);

  const open = (r: (typeof rows)[number]) => { if (r.hunter) { haptic("tap"); setSel(r.hunter); } };
  const unit = scope === "Hunters" ? "" : "members";

  return (
    <div className="mlb">
      <header className="mlb-head"><h1>Leaderboard</h1></header>

      <div className="mlb-seg" role="tablist" aria-label="Scope">
        {SCOPES.map((s) => <button key={s} role="tab" aria-selected={scope === s} className={scope === s ? "on" : ""} onClick={() => { setScope(s); setCount(PAGE); setQ(""); haptic("tap"); }}>{s}</button>)}
      </div>

      {me && (
        <section className="mlb-me" aria-label="Your standing">
          <div className="mlb-me-rank"><small>Your rank</small><b>#{me.rank}</b></div>
          <div className="mlb-me-body">
            <div className="mlb-me-top"><span>Top {me.topPct}%</span><em>{me.xp.toLocaleString()} XP</em></div>
            <p>{standingLine(me)}</p>
          </div>
        </section>
      )}

      {loading && <div className="mlb-skel" aria-hidden="true" />}
      {failed && !loading && <div className="ux-retry"><span>Couldn’t load the board.</span><button onClick={() => window.location.reload()}>Retry</button></div>}

      {!loading && !failed && rows.length > 0 && (
        <>
          <label className="mlb-search"><Search size={15} /><input value={q} onChange={(e) => { setQ(e.target.value); setCount(PAGE); }} placeholder={`Find a ${scope === "Hunters" ? "hunter" : scope === "Guilds" ? "guild" : "clan"}`} aria-label="Search" /></label>

          {top.length > 0 && (
            <div className="mlb-podium" role="list" aria-label="Top three">
              {top.map(({ item, place }) => (
                <button key={item.id} role="listitem" className={`mlb-pod p${place}${item.id === user?.id ? " me" : ""}`} style={{ ["--pc" as string]: PLACE_COLOR[place] }} onClick={() => open(item)} disabled={scope !== "Hunters"} aria-label={`${place === 1 ? "First" : place === 2 ? "Second" : "Third"}: ${item.name}, ${item.xp} XP`}>
                  <span className="mlb-pod-place">{place}</span>
                  <span className="mlb-av">{scope === "Hunters" ? initial(item.name) : <Shield size={18} />}</span>
                  <span className="mlb-pod-name">{item.id === user?.id ? "You" : item.name}</span>
                  <b>{item.xp.toLocaleString()}</b>
                  <small>{scope === "Hunters" ? item.hunter?.player_class : `${(item as { members?: number }).members} ${unit}`}</small>
                </button>
              ))}
            </div>
          )}

          {(visible.length > 0 || searching) && <div className="mlb-list" role="list">
            {searching && visible.length === 0 && <p className="mlb-empty">No one matches “{q}”.</p>}
            {visible.map((r) => (
              <button key={r.id} role="listitem" className={`mlb-row${r.id === user?.id ? " me" : ""}`} onClick={() => open(r)} disabled={scope !== "Hunters"} aria-label={`${r.place}. ${r.name}, ${r.xp} XP`}>
                <span className="mlb-pos">{r.place}</span>
                <span className="mlb-av sm">{scope === "Hunters" ? initial(r.name) : <Shield size={15} />}</span>
                <span className="mlb-who">
                  <span className="mlb-name">{r.id === user?.id ? "You" : r.name}{r.hunter && <i>{r.hunter.player_rank}</i>}</span>
                  <small>{r.hunter ? (r.hunter.status === "DECEASED" ? "Fallen" : `${r.hunter.player_class} · Lv ${r.hunter.level}`) : `${(r as { members?: number }).members} ${unit}`}</small>
                </span>
                <span className="mlb-xp">{r.xp.toLocaleString()}<small>XP</small></span>
              </button>
            ))}
          </div>}
          {list.length > count && <button className="mlb-more" onClick={() => setCount(count + PAGE)}>Show {Math.min(PAGE, list.length - count)} more</button>}
        </>
      )}

      {!loading && !failed && rows.length === 0 && (
        <div className="mlb-none"><h3>No {scope.toLowerCase()} yet</h3><p>{scope === "Hunters" ? "Be the first on the board: conquer a gate." : `Create or join a ${scope === "Guilds" ? "guild" : "clan"} from Friends & guilds.`}</p></div>
      )}

      {sel && <HunterSheet h={sel} rank={(rows.find((r) => r.id === sel.user_id)?.place) ?? 0} isSelf={sel.user_id === user?.id} onClose={() => setSel(null)} />}
    </div>
  );
}
