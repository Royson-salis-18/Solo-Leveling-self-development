import { useNavigate } from "react-router-dom";
import { Award, BookOpen, ChevronRight, Gauge, Gift, LogOut, Share2, Settings, Swords, Trophy, User, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { useEngagement } from "../lib/engagementContext";
import { referralLink } from "../lib/referral";
import { XP_PER_LEVEL } from "../lib/levelEngine";
import { haptic } from "../lib/feedback";
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
  const standing = profile?.standing_xp ?? 0;
  const level = profile?.level ?? 1;
  const into = Math.max(standing, 0) % XP_PER_LEVEL;
  const st = STATUS[profile?.status ?? "ACTIVE"] ?? STATUS.ACTIVE;

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
      <section className="me-card me-id">
        <div className="me-avatar" style={{ ["--p" as string]: `${(into / XP_PER_LEVEL) * 100}%` }}><span>{(profile?.name ?? "H").slice(0, 1).toUpperCase()}</span></div>
        <div className="me-who">
          <h1>{profile?.name ?? "Hunter"}</h1>
          <p>{profile?.player_title ?? "Newcomer"} · {profile?.player_class ?? "Warrior"}</p>
          <div className="me-chips"><span>{profile?.player_rank ?? "E"}-Rank</span><span>Level {level}</span><span className={`tone-${st.tone}`}>{st.label}</span></div>
        </div>
      </section>
      {st.tone !== "ok" && <p className="me-hint">{st.hint}</p>}

      <div className="me-tiles">
        <div className="me-tile"><small>Total XP</small><b>{(profile?.total_points ?? 0).toLocaleString()}</b></div>
        <div className="me-tile"><small>Streak</small><b>{e?.streak.count ?? profile?.streak_count ?? 0}<i>days</i></b></div>
        <div className="me-tile"><small>Dark Mana</small><b className={(profile?.dark_mana ?? 0) > 0 ? "bad" : ""}>{profile?.dark_mana ?? 0}</b></div>
      </div>

      <h2 className="me-h">Progress</h2>
      <div className="me-group">
        <Row icon={<Award size={18} />} label="Hall of Feats" value={e ? `${e.achievements.unlocked}/${e.achievements.total}` : undefined} onClick={() => navigate("/achievements")} />
        <Row icon={<Gift size={18} />} label="Rewards" onClick={() => navigate("/rewards")} />
        <Row icon={<Gauge size={18} />} label="Full overview" onClick={() => navigate("/overview")} />
        <Row icon={<User size={18} />} label="Hunter licence" onClick={() => navigate("/profile")} />
      </div>

      <h2 className="me-h">Community</h2>
      <div className="me-group">
        <Row icon={<Trophy size={18} />} label="Leaderboard" onClick={() => navigate("/leaderboard")} />
        <Row icon={<Swords size={18} />} label="Arena" onClick={() => navigate("/arena")} />
        <Row icon={<Users size={18} />} label="Friends & guilds" onClick={() => navigate("/social")} />
        {e && <Row icon={<Share2 size={18} />} label="Invite a friend" value={e.referral.recruited ? `${e.referral.active}/${e.referral.recruited} active` : "Earn Surge Crystals"} onClick={invite} />}
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
