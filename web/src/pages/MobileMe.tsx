import { useNavigate } from "react-router-dom";
import { Award, BookOpen, Bot, ChevronRight, Gauge, Gift, LogOut, Map as MapIcon, Share2, Settings, Swords, Trophy, User, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { useEngagement } from "../lib/engagementContext";
import { referralLink } from "../lib/referral";
import { XP_PER_LEVEL } from "../lib/levelEngine";
import { haptic } from "../lib/feedback";
import { AURAS, isUnlocked } from "../lib/theme";
import { useAuraState } from "../components/mobile/ThemeContext";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { SystemAPI } from "../services/SystemAPI";
import type { Activity } from "../lib/gameTypes";
import { nextRankInfo } from "../lib/levelEngine";
import { ActivityHeatmap } from "../components/visuals";
import { fetchCollection, resonance, shadowBonus, type CatalogShadow } from "../lib/collection";
import "../components/mobile/mobile.css";
import "./mobile-me.css";

const STATUS: Record<string, { label: string; tone: string; hint: string }> = {
  ACTIVE: { label: "Active", tone: "ok", hint: "You're in good standing." },
  STAGNANT: { label: "Stagnant", tone: "warn", hint: "Not enough C-rank+ XP this week." },
  PENALTY: { label: "In debt", tone: "bad", hint: "Your XP is below zero. Conquer gates to recover." },
  DECEASED: { label: "Fallen", tone: "bad", hint: "Conquer a B-rank+ gate to arise." },
};

function Row({ icon, label, value, onClick, danger }: { icon: ReactNode; label: string; value?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`me-row${danger ? " danger" : ""}`} onClick={() => { haptic("tap"); onClick(); }}>
      <span className="me-ico">{icon}</span><b>{label}</b>{value && <em>{value}</em>}<ChevronRight size={16} />
    </button>
  );
}

export function MobileMe() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile, signOut } = useAuth();
  const { data: e } = useEngagement();
  const { aura, choose, unseen, markSeen } = useAuraState();
  const rankNow = profile?.player_rank ?? "E";
  useEffect(() => { if (unseen.length) { const t = window.setTimeout(markSeen, 4000); return () => window.clearTimeout(t); } }, [unseen.length, markSeen]);
  const standing = profile?.standing_xp ?? 0;
  const level = profile?.level ?? 1;
  const into = Math.max(standing, 0) % XP_PER_LEVEL;
  const st = STATUS[profile?.status ?? "ACTIVE"] ?? STATUS.ACTIVE;
  const nr = nextRankInfo(rankNow);
  const [act, setAct] = useState<Activity | null>(null);
  const [army, setArmy] = useState<CatalogShadow[]>([]);
  useEffect(() => {
    SystemAPI.getActivity(84).then(setAct).catch(() => undefined);
    if (profile?.user_id) fetchCollection(profile.user_id).then((c) => setArmy(c.shadows.filter((x) => x.collected))).catch(() => undefined);
  }, [profile?.user_id]);
  const topArmy = [...army].sort((a, b) => shadowBonus(b.rarity) - shadowBonus(a.rarity)).slice(0, 5);

  const invite = async () => {
    if (!e) return;
    const url = referralLink(e.referral.code);
    haptic("tap");
    try {
      if (navigator.share) await navigator.share({ title: "Join me", text: "Level up your real life with me.", url });
      else { await navigator.clipboard.writeText(url); toast.success("Invite link copied", "Send it to a friend."); }
    } catch { /* share sheet dismissed */ }
  };

  return (
    <div className="me">
      <section className="me-hero" aria-label="Hunter identity">
        <div className="me-emblem" aria-label={`${rankNow}-Rank`}>
          <svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 92,27 92,73 50,96 8,73 8,27" /></svg>
          <span>{rankNow}</span>
        </div>
        <div className="me-who">
          <h1>{profile?.name ?? "Hunter"}</h1>
          <p>{profile?.player_title ?? "Newcomer"} · {profile?.player_class ?? "Warrior"}</p>
          <div className="me-chips"><span className={`tone-${st.tone}`}>{st.label}</span><span>{profile?.current_mode ?? "Normal"} mode</span></div>
        </div>
      </section>
      {st.tone !== "ok" && <p className="me-hint">{st.hint}</p>}

      <section className="me-level" aria-label="Level progress">
        <div className="me-level-top"><b>Level {level}</b><span>{into.toLocaleString()} / {XP_PER_LEVEL.toLocaleString()} XP</span></div>
        <div className="me-level-bar" role="progressbar" aria-valuenow={Math.round((into / XP_PER_LEVEL) * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${(into / XP_PER_LEVEL) * 100}%` }} /></div>
        <small>{nr ? `${nr.rank}-Rank unlocks at level ${nr.minLevel} · ${Math.max(0, nr.minLevel - level)} to go` : "Highest rank reached."}</small>
      </section>

      <div className="me-tiles">
        <div className="me-tile"><small>Total XP</small><b>{(profile?.total_points ?? 0).toLocaleString()}</b></div>
        <div className="me-tile"><small>Streak</small><b>{e?.streak.count ?? profile?.streak_count ?? 0}<i>days</i></b></div>
        <div className="me-tile"><small>Best streak</small><b>{act?.totals.best_streak ?? e?.streak.best ?? profile?.best_streak ?? 0}<i>days</i></b></div>
      </div>
      {(profile?.dark_mana ?? 0) > 0 && <p className="me-hint">{profile?.dark_mana} Dark Mana is absorbing your XP. Redeem it in Rewards.</p>}

      <h2 className="me-h">Record</h2>
      <section className="me-record" aria-label="Lifetime record">
        <div className="me-rec"><b>{act ? (act.totals.conquests ?? 0).toLocaleString() : "–"}</b><small>Gates conquered</small></div>
        <div className="me-rec"><b>{act ? act.totals.active_days : "–"}</b><small>Active days</small></div>
        <div className="me-rec"><b>{act ? act.totals.avg_xp_active_day : "–"}</b><small>XP per active day</small></div>
        <button className="me-rec" onClick={() => navigate("/achievements")}><b>{e ? `${e.achievements.unlocked}/${e.achievements.total}` : "–"}</b><small>Feats earned</small></button>
      </section>

      <section className="me-act" aria-label="Activity, last 12 weeks">
        <div className="me-act-top"><span>Last 12 weeks</span>{act?.totals.since && <em>Since {new Date(`${act.totals.since}T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" })}</em>}</div>
        {act ? <ActivityHeatmap days={act.days} weeks={12} /> : <div className="me-act-skel" />}
      </section>

      <button className="me-army" onClick={() => navigate("/collection")} aria-label={`Your army: ${army.length} shadows, plus ${resonance(army)} percent XP`}>
        <div className="me-army-top"><span>Your army</span><em>+{resonance(army)}% XP<ChevronRight size={15} /></em></div>
        <div className="me-army-row">
          {topArmy.map((s) => <i key={s.name} style={{ ["--gc" as string]: s.glow ? `rgb(${s.glow})` : "var(--m-accent)" }} title={s.name}>{s.name.slice(0, 1)}</i>)}
          {army.length > topArmy.length && <i className="more">+{army.length - topArmy.length}</i>}
          {army.length === 0 && <small>Conquer B-rank+ gates to extract shadows.</small>}
        </div>
      </button>

      <h2 className="me-h">Progress</h2>
      <div className="me-group">
        <Row icon={<Award size={18} />} label="Hall of Feats" value={e ? `${e.achievements.unlocked}/${e.achievements.total}` : undefined} onClick={() => navigate("/achievements")} />
        <Row icon={<Gift size={18} />} label="Rewards" onClick={() => navigate("/rewards")} />
        <Row icon={<Gauge size={18} />} label="Full overview" onClick={() => navigate("/overview")} />
        <Row icon={<User size={18} />} label="Hunter licence" onClick={() => navigate("/profile")} />
        <Row icon={<Bot size={18} />} label="Ask the Oracle" value="AI coach" onClick={() => document.querySelector<HTMLButtonElement>(".oracle-trigger")?.click()} />
      </div>

      <h2 className="me-h">Community</h2>
      <div className="me-group">
        <Row icon={<Trophy size={18} />} label="Leaderboard" onClick={() => navigate("/leaderboard")} />
        <Row icon={<Swords size={18} />} label="Arena & duels" onClick={() => navigate("/arena")} />
        <Row icon={<MapIcon size={18} />} label="War Room" onClick={() => navigate("/war-room")} />
        <Row icon={<Users size={18} />} label="Friends & guilds" onClick={() => navigate("/social")} />
        {e && <Row icon={<Share2 size={18} />} label="Invite a friend" value={e.referral.recruited ? `${e.referral.active}/${e.referral.recruited} active` : "Earn Surge Crystals"} onClick={invite} />}
      </div>

      <h2 className="me-h">Monarch aura</h2>
      <div className="me-auras" role="radiogroup" aria-label="Monarch aura">
        {AURAS.map((a) => {
          const open = isUnlocked(a, rankNow);
          return (
            <button key={a.id} role="radio" aria-checked={aura === a.id} disabled={!open} className={`me-aura${aura === a.id ? " on" : ""}${open ? "" : " locked"}`}
              style={{ ["--sw" as string]: a.swatch[0], ["--sb" as string]: a.swatch[1] }}
              onClick={() => { if (open) { choose(a.id); haptic("tap"); } }}>
              <i>{open ? null : <Lock size={13} />}</i>
              <b>{a.name}{unseen.includes(a.id) && <em>New</em>}</b>
              <span>{open ? a.lore : `Unlocks at ${a.rank}-Rank`}</span>
            </button>
          );
        })}
      </div>

      <h2 className="me-h">Account</h2>
      <div className="me-group">
        <Row icon={<Gauge size={18} />} label="Difficulty mode" value={profile?.current_mode ?? "Normal"} onClick={() => navigate("/mode-selection")} />
        <Row icon={<Settings size={18} />} label="Settings & plan" onClick={() => navigate("/settings")} />
        <Row icon={<BookOpen size={18} />} label="How it works" onClick={() => navigate("/guide")} />
        <Row icon={<LogOut size={18} />} label="Sign out" danger onClick={() => void signOut()} />
      </div>
    </div>
  );
}
