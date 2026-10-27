import { Skull, Sparkles } from "lucide-react";
import "./transmission.css";

export const TRANSMISSIONS = [
  { tag: "RAGNAROK", title: "Divine Bloodline: Su-ho's Era", text: "The power of the Monarch flows through his son. The new age has arrived." },
  { tag: "SYSTEM", title: "Absolute Authority", text: "Survival is the only law. Your strength is the only currency." },
  { tag: "ASHBORN", title: "Eternal Rest", text: "The shadows do not fear death. They are death. Arise." },
  { tag: "MONARCH", title: "The World is a Game", text: "Play it by your own rules. Every level gained is a reality conquered." },
  { tag: "SYSTEM", title: "Absolute Will", text: "A Monarch's will is absolute. Let your discipline be the hammer that shapes it." },
  { tag: "ASHBORN", title: "Limitless Potential", text: "The only limit is the one you set yourself. Break the chains of mediocrity." },
  { tag: "SYSTEM", title: "The Hunt Evolved", text: "The hunt never ends. It only evolves. Your shadows are waiting for your command." },
  { tag: "MONARCH", title: "Taken, Not Given", text: "Strength is not granted. It is taken through the cold fire of daily discipline." },
  { tag: "SYSTEM", title: "The Sovereign's Path", text: "The system chose you for a reason. Every task completed proves it right." },
  { tag: "ASHBORN", title: "Shadow Birth", text: "Shadows are born from the intense light of your focus. Shine brighter." },
  { tag: "MONARCH", title: "Evolution or Extinction", text: "Stagnation is death. Each dawn is a mission to surpass the version of you that slept." },
  { tag: "SYSTEM", title: "Critical Resonance", text: "Your momentum is creating a rift in the mundane. Maintain absolute focus." },
  { tag: "ASHBORN", title: "Kingdom of Shadows", text: "You do not build a kingdom with wishes. You build it with the souls of conquered fears." }
];

/** One stable message per day, so it doesn't change on every refresh. */
export function todaysTransmission(now = new Date()) {
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  return TRANSMISSIONS[dayOfYear % TRANSMISSIONS.length];
}

/** The page-opening banner. Desktop keeps the full pill; `compact` is the phone version. */
export function Transmission({ compact = false }: { compact?: boolean }) {
  const msg = todaysTransmission();
  return (
    <section className={`tx${compact ? " tx-compact" : ""} monarch-transmission`} aria-label="System transmission">
      <span className="tx-ico"><Sparkles size={compact ? 18 : 24} /></span>
      <div className="tx-meta">
        <div className="tx-label">{msg.tag} transmission</div>
        <div className="tx-title">{msg.title}</div>
        <div className="tx-text">{msg.text}</div>
      </div>
      <span className="tx-skull" aria-hidden="true"><Skull size={compact ? 84 : 110} strokeWidth={1.8} /></span>
    </section>
  );
}
