#!/usr/bin/env bash
# Real concurrency: many simultaneous database sessions hammer the same row. These are the
# races the old client-side read-modify-write code lost (double-pay, over-spend, quota bypass).
set -euo pipefail
URL="${URL:?run via run.sh}"
q() { psql "$URL" -X -q -t -A -v ON_ERROR_STOP=1 "$@"; }
fail() { echo "   ✗ $*"; exit 1; }
pass() { echo "   ✔ $*"; }
N=12

mkuser() { q -c "select tests.mkuser('$1')"; }
login()  { echo "select tests.login('$1');"; }

# ── 1. N parallel conquests of the SAME gate pay exactly once ───────────────
U=$(mkuser "Race1")
q -c "$(login $U) select public.select_mode('Normal');" >/dev/null
G=$(q -c "$(login $U) select tests.gate('contested','Mid','Fitness',2);" | tail -1)
for i in $(seq $N); do
  q -c "$(login $U) select public.complete_gate('$G');" >/dev/null 2>&1 &
done; wait
EVENTS=$(q -c "select count(*) from public.xp_events where user_id='$U' and kind='complete'")
XP=$(q -c "select total_points from public.user_profiles where user_id='$U'")
# 18 XP for the gate + 10 XP for the "First Gate" trophy — each exactly once.
TROPHY=$(q -c "select count(*) from public.xp_events where user_id='$U' and kind='achievement'")
[[ "$EVENTS" == "1" && "$TROPHY" == "1" && "$XP" == "28" ]] || fail "double-pay: $EVENTS conquest rows, $TROPHY trophy rows, $XP XP (expected 1, 1 and 28)"
pass "$N parallel conquests of one gate paid exactly once (18 XP + one 10 XP trophy)"

# ── 2. N parallel claims against a balance that affords only one ────────────
U2=$(mkuser "Race2")
q -c "$(login $U2) select public.select_mode('Normal');" >/dev/null
q -c "update public.user_profiles set total_points = 60, streak_count = 5 where user_id='$U2'" >/dev/null
for i in $(seq $N); do
  q -c "$(login $U2) select public.claim_reward(p_system_key => 'sys-r1');" >/dev/null 2>&1 &
done; wait
CLAIMS=$(q -c "select count(*) from public.reward_claims where user_id='$U2'")
BAL=$(q -c "select total_points from public.user_profiles where user_id='$U2'")
[[ "$CLAIMS" == "1" && "$BAL" == "10" ]] || fail "overspend: $CLAIMS claims, balance $BAL (expected 1 and 10)"
pass "$N parallel claims on a 60 XP balance: exactly one succeeded, balance 10 (never negative)"

# ── 3. AI quota cannot be bypassed in parallel ──────────────────────────────
U3=$(mkuser "Race3")
q -c "$(login $U3) select public.select_mode('Normal');" >/dev/null
for i in $(seq 20); do
  q -c "$(login $U3) select (public.consume_ai_message() ->> 'allowed');" >> /tmp/sl_quota_$$ 2>/dev/null &
done; wait
ALLOWED=$(grep -c '^true$' /tmp/sl_quota_$$ || true); rm -f /tmp/sl_quota_$$
[[ "$ALLOWED" == "5" ]] || fail "quota bypass: $ALLOWED of 20 parallel calls allowed (expected 5)"
pass "20 parallel AI calls on the free plan: exactly 5 allowed"

# ── 4. parallel failures penalise once ──────────────────────────────────────
U4=$(mkuser "Race4")
q -c "$(login $U4) select public.select_mode('Normal');" >/dev/null
G4=$(q -c "$(login $U4) select tests.gate('doom','Mid','Fitness',2);" | tail -1)
for i in $(seq $N); do
  q -c "$(login $U4) select public.fail_gate('$G4');" >/dev/null 2>&1 &
done; wait
PEN=$(q -c "select count(*) from public.xp_events where user_id='$U4' and kind='fail'")
DM=$(q -c "select dark_mana from public.user_profiles where user_id='$U4'")
[[ "$PEN" == "1" && "$DM" == "7" ]] || fail "double-penalty: $PEN penalties, dark mana $DM (expected 1 and 7)"
pass "$N parallel failures of one gate: one penalty, Dark Mana 7"

# ── 5. a conquest racing a failure of the same gate resolves it exactly once ─
U5=$(mkuser "Race5")
q -c "$(login $U5) select public.select_mode('Normal');" >/dev/null
G5=$(q -c "$(login $U5) select tests.gate('coin flip','Mid','Fitness',2);" | tail -1)
for i in $(seq 6); do
  q -c "$(login $U5) select public.complete_gate('$G5');" >/dev/null 2>&1 &
  q -c "$(login $U5) select public.fail_gate('$G5');" >/dev/null 2>&1 &
done; wait
RES=$(q -c "select count(*) from public.xp_events where user_id='$U5' and kind in ('complete','fail')")
[[ "$RES" == "1" ]] || fail "gate resolved $RES times (expected exactly once)"
pass "conquest vs failure race: gate resolved exactly once"

# ── 6. the daily chest and the boss loot each pay exactly once under a stampede ─
U6=$(mkuser "Race6")
q -c "update public.user_profiles set mode_selected_at=now(), current_mode='Normal', last_active_date=(now() at time zone 'UTC')::date, last_tick_date=(now() at time zone 'UTC')::date where user_id='$U6'" >/dev/null
for t in "Mid:20:Fitness" "Mid:20:Learning" "Low:5:Fitness"; do
  IFS=: read tier raw cat <<<"$t"
  q -c "select tests.ev('$U6','$tier',$raw,'$cat')" >/dev/null
done
for i in $(seq $N); do
  q -c "$(login $U6) select public.claim_bounty_chest();" >/dev/null 2>&1 &
done; wait
CH=$(q -c "select count(*) from public.xp_events where user_id='$U6' and kind='bounty'")
[[ "$CH" == "1" ]] || fail "chest paid $CH times (expected exactly once)"
pass "$N parallel chest claims: paid exactly once"

WK=$(q -c "select private.boss_week()")
q -c "select private.boss_for('$WK'::date); insert into public.boss_damage (week_start,user_id,damage) values ('$WK','$U6',(select hp from public.world_bosses where week_start='$WK')) on conflict (week_start,user_id) do update set damage=excluded.damage" >/dev/null
for i in $(seq $N); do
  q -c "$(login $U6) select public.claim_boss_reward();" >/dev/null 2>&1 &
done; wait
BL=$(q -c "select count(*) from public.xp_events where user_id='$U6' and kind='boss'")
[[ "$BL" == "1" ]] || fail "boss loot paid $BL times (expected exactly once)"
pass "$N parallel boss-loot claims: paid exactly once"
