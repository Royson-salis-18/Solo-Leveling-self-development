import streamlit as st
import pandas as pd
import json
from datetime import datetime, timedelta
import plotly.graph_objects as go
import plotly.express as px
from typing import Dict, List, Optional
from backend import (
    parse_iso_naive, register_user, verify_login, update_user_activity,
    create_task, get_tasks, complete_task, delete_task, get_leaderboard,
    update_user_profile, get_user_by_email, get_user_points_history,
    get_today_points, get_recent_activity
)

# Page config
st.set_page_config(
    page_title="Life RPG Tracker",
    page_icon=None,            # removed emojis — keep professional
    layout="wide",
    initial_sidebar_state="expanded"
)

# Improve CSS for full-page modern card layout
def load_css():
    st.markdown("""
    <style>
    :root {
      --bg:#07101a;
      --card:#0b1a26;
      --muted:#97a6b6;
      --accent:#7c3aed;
      --glass: rgba(255,255,255,0.03);
    }
    body { background: linear-gradient(90deg, #07101a 0%, #061726 100%); color: #e6eef6; }
    .stApp { padding: 8px 24px; max-width: 1600px; margin: 0 auto; }
    header, footer, [data-testid="stSidebar"] .css-1d391kg { visibility: visible; }
    #MainMenu, footer, header { visibility: hidden; height: 0px; }
    .card { background: linear-gradient(180deg,var(--card), rgba(6,23,38,0.6)); padding: 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03); box-shadow: 0 6px 28px rgba(0,0,0,0.6); color: #e6eef6; margin-bottom: 18px; }
    .top-cards { display:flex; gap: 16px; width:100%; margin-bottom: 12px; }
    .top-card { flex:1; padding:12px; border-radius:10px; background: linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.03); }
    .card-title { font-weight:700; color:#dbeafe; font-size:1rem; margin-bottom:8px; }
    .card-value { font-weight:800; color:var(--accent); font-size:1.6rem; }
    .muted { color:var(--muted); font-size:0.9rem; }
    /* extra space between stacked cards on narrow view */
    @media (max-width: 1000px) {
        .top-cards { flex-direction: column; }
    }
    </style>
    """, unsafe_allow_html=True)

# Initialize session state
if 'logged_in' not in st.session_state:
    st.session_state['logged_in'] = False
if 'user_email' not in st.session_state:
    st.session_state['user_email'] = None
if 'user_data' not in st.session_state:
    st.session_state['user_data'] = None

# debug slots to capture DB responses for troubleshooting
if 'last_db_error' not in st.session_state:
    st.session_state['last_db_error'] = None
if 'last_db_response' not in st.session_state:
    st.session_state['last_db_response'] = None

load_css()

# Initialize UI override helper (persist local XP override between reruns)
if 'ui_override' not in st.session_state:
    st.session_state['ui_override'] = None

# LOGIN PAGE
if not st.session_state['logged_in']:
    st.markdown("<h1 style='text-align: center;'>LIFE RPG TRACKER</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: #cbd5e1;'>Level up your life — complete tasks to gain XP</p>", unsafe_allow_html=True)
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### LOGIN")
        login_email = st.text_input("Email", key="login_email")
        login_password = st.text_input("Password", type="password", key="login_password")
        
        if st.button("LOGIN", use_container_width=True):
            if login_email and login_password:
                user = verify_login(login_email, login_password)
                if user:
                    # remove any previous override on fresh login
                    st.session_state['ui_override'] = None
                    st.session_state['logged_in'] = True
                    st.session_state['user_email'] = (user.get('email') or login_email).strip().lower()
                    st.session_state['user_data'] = user
                    update_user_activity(st.session_state['user_email'])
                    st.success(f"Welcome back, {user['name']}!")
                    # refresh local task lists rather than forcing a rerun
                    active_tasks = get_tasks(st.session_state['user_email'], completed=False)
                    completed_tasks = get_tasks(st.session_state['user_email'], completed=True)
                else:
                    st.error("Invalid credentials!")
            else:
                st.error("Please enter email and password!")
    
    with col2:
        st.markdown("### REGISTER")
        reg_name = st.text_input("Name", key="reg_name")
        reg_email = st.text_input("Email", key="reg_email")
        reg_password = st.text_input("Password", type="password", key="reg_password")
        # replaced emoji choices with professional labels
        reg_avatar = st.selectbox("Profile style", ["Swordsman", "Guardian", "Archer", "Runner", "Mage", "Strategist"])
        
        if st.button("CREATE ACCOUNT", use_container_width=True):
            if reg_name and reg_email and reg_password:
                if len(reg_password) < 6:
                    st.error("Password must be at least 6 characters!")
                else:
                    if register_user(reg_email, reg_password, reg_name, reg_avatar):
                        st.success("Account created! Please login.")
                    else:
                        st.error("Email already exists!")
            else:
                st.error("All fields required!")
    
    # Show leaderboard on login page
    st.markdown("---")
    st.markdown("### GLOBAL LEADERBOARD")
    leaderboard = get_leaderboard(5)
    if leaderboard:
        for idx, player in enumerate(leaderboard, 1):
            st.markdown(f"""
            <div style='background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 8px; margin: 0.5rem 0; border: 1px solid rgba(167, 139, 250, 0.3);'>
                <span style='font-size: 1.5rem; font-weight: 700; color: #94a3b8;'>#{idx}</span>
                <span style='font-size: 1.2rem;'>{player['avatar_url']} {player['name']}</span>
                <span style='float: right; color: #a78bfa;'>Level {player['level']} | {player['total_points']} XP</span>
            </div>
            """, unsafe_allow_html=True)
    
    st.stop()

# MAIN APPLICATION
user_data = st.session_state['user_data']
user_email = st.session_state['user_email']

# load points + recent activity for current user (define before user_row checks)
user_points_hist = get_user_points_history(user_email, days=30) if user_email else []
today_points_info = get_today_points(user_email) if user_email else {"daily_points":0, "cumulative_points":0}
recent_activity = get_recent_activity(user_email, limit=10) if user_email else []

# ensure task lists are defined early so top header and other UI can reference them safely
active_tasks = get_tasks(user_email, completed=False) if user_email else []
completed_tasks = get_tasks(user_email, completed=True) if user_email else []

# Refresh user data via backend helper
user_row = get_user_by_email(user_email)
if user_row:
    # if DB matches saved override, clear override; otherwise overlay override onto displayed data
    override = st.session_state.get('ui_override')
    # use a copy to avoid mutating the DB-sourced record directly
    display_row = dict(user_row)

    # determine fallback cumulative from user_points_hist
    latest_cum = None
    if user_points_hist:
        try:
            latest_cum = int(user_points_hist[-1].get('cumulative_points', 0) or 0)
        except Exception:
            latest_cum = None

    # ui_override highest priority
    override = st.session_state.get('ui_override')
    if override and override.get('email') == (user_email or ""):
        if int(display_row.get('total_points', 0) or 0) == int(override.get('total_points', 0)) \
           and int(display_row.get('level', 0) or 0) == int(override.get('level', 0)):
            st.session_state['ui_override'] = None
        else:
            display_row['total_points'] = int(override.get('total_points', display_row.get('total_points', 0)))
            display_row['level'] = int(override.get('level', display_row.get('level', 0)))
    else:
        # no override — if DB total_points is lower than cumulative value, prefer cumulative
        db_pts = int(display_row.get('total_points', 0) or 0)
        if latest_cum is not None and latest_cum > db_pts:
            # prefer the user_points cumulative as authoritative for displayed total XP
            display_row['total_points'] = latest_cum
            # compute level from cumulative XP if DB didn't update level
            display_row['level'] = (latest_cum // 100) + 1

    user_data = display_row
    st.session_state['user_data'] = user_data

# --- New: canonical displayed values used across UI ---
displayed_total_xp = int(user_data.get('total_points', 0) or 0)
displayed_level = int(user_data.get('level', 0) or 0)

# Top header: replace simple metrics with full-width cards and remove streamlit chrome for full-screen feel
st.markdown("<div class='card'>", unsafe_allow_html=True)
st.markdown("<div class='top-cards'>", unsafe_allow_html=True)
st.markdown(f"<div class='top-card'><div class='card-title'>Profile</div><div class='card-value'>{user_data.get('name','')}</div><div class='muted'>Level {displayed_level} • {displayed_total_xp} XP</div></div>", unsafe_allow_html=True)
st.markdown(f"<div class='top-card'><div class='card-title'>Active Quests</div><div class='card-value'>{len(active_tasks)}</div><div class='muted'>{len(completed_tasks)} completed</div></div>", unsafe_allow_html=True)
# show today's points and cumulative points (from user_points table)
st.markdown(f"<div class='top-card'><div class='card-title'>Today's Points</div><div class='card-value'>{today_points_info['daily_points']} XP</div><div class='muted'>Cumulative today: {today_points_info['cumulative_points']} XP</div></div>", unsafe_allow_html=True)
st.markdown(f"<div class='top-card'><div class='card-title'>Recent activity</div><div class='card-value'>{recent_activity[0]['action'] if recent_activity else '—'}</div><div class='muted'>Last active: {user_row.get('last_active','Unknown')}</div></div>", unsafe_allow_html=True)
st.markdown("</div></div>", unsafe_allow_html=True)

# Progress bar
current_xp = displayed_total_xp
xp_in_level = current_xp % 100
xp_to_next = 100 - xp_in_level
st.markdown(f"**Progress to Level {displayed_level + 1}**: {xp_to_next} XP needed")
st.progress(xp_in_level / 100)

# Tabs
tab1, tab2, tab3, tab4, tab5 = st.tabs(["DASHBOARD", "ACTIVE QUESTS", "NEW QUEST", "LEADERBOARD", "PROFILE"])

# Tab 1: DASHBOARD — core graphs, two-column layout, radar chart included
with tab1:
    st.markdown("<div class='card'><div class='card-header'>DASHBOARD</div>", unsafe_allow_html=True)
    # quick metrics row
    c1, c2, c3, c4 = st.columns([1,1,1,1])
    c1.metric("Level", displayed_level, delta=None)
    c2.metric("Total XP", displayed_total_xp, delta=None)
    active_count = len(active_tasks) if isinstance(active_tasks, list) else 0
    completed_count = len(completed_tasks) if isinstance(completed_tasks, list) else 0
    c3.metric("Active Quests", active_count)
    c4.metric("Completed", completed_count)
    
    st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)
    # Two-column core graphs
    left, right = st.columns([1,1], gap="large")
    # gather data safely
    df_completed = pd.DataFrame([{
            'Date': parse_iso_naive(t.get('completed_at')).date() if parse_iso_naive(t.get('completed_at')) else None,
            'XP': int(t.get('points', 0) or 0),
            'Category': t.get('category', 'General'),
            'Task': t.get('title', 'Untitled')
        } for t in completed_tasks if t.get('completed_at')]) if completed_tasks else pd.DataFrame()
    
    with left:
        st.markdown("<div class='card'>", unsafe_allow_html=True)
        st.markdown("<div class='card-header'>Daily XP (last activity)</div>", unsafe_allow_html=True)
        # use user_points_hist (from user_points table) for daily series so it's reliable when users.total_points isn't persisted
        if user_points_hist:
            df_points = pd.DataFrame(user_points_hist)
            df_points['date'] = pd.to_datetime(df_points['date']).dt.date
            fig_daily = px.line(df_points, x='date', y='daily_points', labels={'daily_points':'XP','date':'Date'}, title='Daily XP (DB)')
            fig_daily.update_layout(showlegend=False, paper_bgcolor='rgba(0,0,0,0)')
            st.plotly_chart(fig_daily, use_container_width=True)
        else:
            st.info("Complete tasks to populate these graphs.")
        st.markdown("</div>", unsafe_allow_html=True)
        
        st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)
        st.markdown("<div class='card'>", unsafe_allow_html=True)
        st.markdown("<div class='card-header'>Category Radar</div>", unsafe_allow_html=True)
        if not df_completed.empty:
            cat_stats = df_completed.groupby('Category')['XP'].sum().reset_index()
            # prepare radar-friendly normalized values
            cat_stats['Normalized'] = cat_stats['XP'] / max(cat_stats['XP'].max(), 1) * 100
            fig_radar = go.Figure()
            fig_radar.add_trace(go.Scatterpolar(
                r=cat_stats['Normalized'].tolist() + [cat_stats['Normalized'].tolist()[0]],
                theta=cat_stats['Category'].tolist() + [cat_stats['Category'].tolist()[0]],
                fill='toself',
                name='XP by Category'
            ))
            fig_radar.update_layout(
                polar=dict(
                    bgcolor='rgba(0,0,0,0)',
                    radialaxis=dict(visible=True, range=[0,100], gridcolor='rgba(255,255,255,0.06)', tickfont=dict(color='rgba(255,255,255,0.7)')),
                    angularaxis=dict(tickfont=dict(color='rgba(255,255,255,0.9)'), gridcolor='rgba(255,255,255,0.03)')
                ),
                showlegend=False,
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)'
            )
            # use a softer fill color suitable for dark theme
            fig_radar.data[0].line.color = 'rgba(124,58,237,0.9)'
            fig_radar.data[0].fillcolor = 'rgba(124,58,237,0.25)'
            st.plotly_chart(fig_radar, use_container_width=True)
        else:
            st.info("No category data yet.")
        st.markdown("</div>", unsafe_allow_html=True)
    
    with right:
        st.markdown("<div class='card'>", unsafe_allow_html=True)
        st.markdown("<div class='card-header'>Cumulative XP</div>", unsafe_allow_html=True)
        if user_points_hist:
            df_points = pd.DataFrame(user_points_hist)
            df_points['date'] = pd.to_datetime(df_points['date']).dt.date
            # cumulative curve from DB user_points
            fig_cum = px.area(df_points, x='date', y='cumulative_points', labels={'cumulative_points':'Cumulative XP','date':'Date'}, title='Cumulative XP (DB)')
            fig_cum.update_layout(showlegend=False, paper_bgcolor='rgba(0,0,0,0)')
            st.plotly_chart(fig_cum, use_container_width=True)
        else:
            st.info("No cumulative data yet.")
        st.markdown("<div class='card-header'>Weekly XP Totals</div>", unsafe_allow_html=True)
        if not df_completed.empty:
            df_completed['Week'] = df_completed['Date'].apply(lambda d: d - timedelta(days=d.weekday()))
            weekly = df_completed.groupby('Week')['XP'].sum().reset_index().sort_values('Week')
            fig_week = px.bar(weekly, x='Week', y='XP', title='', labels={'XP':'XP','Week':'Week'})
            fig_week.update_layout(showlegend=False, paper_bgcolor='rgba(0,0,0,0)')
            st.plotly_chart(fig_week, use_container_width=True)
        else:
            st.info("No weekly data yet.")
        st.markdown("</div>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

# Tab 2: ACTIVE QUESTS - handle complete/delete and update UI state from backend result
with tab2:
    st.markdown("### ACTIVE QUESTS")
    
    if active_tasks:
        for idx, task in enumerate(active_tasks):
            pk = task.get('task_id') or task.get('id') or task.get('taskId') or None
            # parse deadline into a naive datetime safely
            deadline = parse_iso_naive(task.get('deadline'))
            if deadline is None:
                st.warning(f"Task '{task.get('title')}' has invalid deadline.")
                deadline = datetime.now()
            is_overdue = deadline < datetime.now()
            time_left = deadline - datetime.now()
            # show a friendly readable time-left
            hours_left = int(abs(time_left.total_seconds()) // 3600)
            days_left = hours_left // 24
            hours_only = hours_left % 24
            time_left_summary = f"{days_left}d {hours_only}h" if days_left > 0 else f"{hours_only}h"
            
            with st.expander(f"{task.get('title','Untitled')} - {task.get('points', 0)} XP", expanded=False):
                col1, col2 = st.columns([3, 1])
                with col1:
                    st.markdown(f"**Category:** {task.get('category','General')}")
                    st.markdown(f"**Deadline:** {deadline.strftime('%Y-%m-%d %H:%M') if deadline else 'Unknown'}")
                    if is_overdue:
                        st.markdown("**Status:** OVERDUE")
                    else:
                        st.markdown(f"**Time Left:** {time_left_summary}")
                    if task.get('description'):
                        st.markdown(f"**Description:** {task.get('description')}")
                
                with col2:
                    if st.button("Complete", key=f"complete_{pk}_{idx}", disabled=(pk is None)):
                        if pk is None:
                            st.error("Task missing DB ID — cannot complete.")
                        else:
                            res = complete_task(pk, user_email, int(task.get('points', 0)))
                            if isinstance(res, dict) and res.get('ok'):
                                # store override so UI still shows updated values after rerun
                                st.session_state['ui_override'] = {
                                    "email": user_email,
                                    "total_points": res['new_points'],
                                    "level": res['new_level']
                                }
                                st.success(f"+{task.get('points',0)} XP!")
                                # force a full rerun so header, leaderboard and all charts reload from DB
                                st.rerun()

                    if st.button("Delete", key=f"delete_{pk}_{idx}", disabled=(pk is None)):
                        if pk is None:
                            st.error("Task missing DB ID — cannot delete.")
                        else:
                            ok = delete_task(pk)
                            if ok:
                                st.success("Task deleted.")
                                # clear UI override on delete (safe)
                                st.session_state['ui_override'] = st.session_state.get('ui_override')
                                st.rerun()
                            else:
                                st.error("Failed to delete task. See developer debug panel.")
    else:
        st.info("No active quests. Create your first quest!")

# Ensure controlled date/time session keys exist BEFORE widgets are created
if 'new_quest_deadline_date' not in st.session_state:
    st.session_state['new_quest_deadline_date'] = (datetime.now() + timedelta(days=1)).date()
if 'new_quest_deadline_time' not in st.session_state:
    st.session_state['new_quest_deadline_time'] = datetime.now().time().replace(second=0, microsecond=0)

# Tab 3: NEW QUEST — do NOT assign widget-backed session_state keys after widget instantiation
with tab3:
    st.markdown("### CREATE NEW QUEST")
    quest_title = st.text_input("Quest Title", key="new_quest_title")
    quest_category = st.selectbox("Category", ["Fitness", "Study", "Work", "Skills", "Personal"], key="new_quest_category")
    quest_points = st.number_input("XP Points", min_value=1, max_value=500, value=30, key="new_quest_points")
    quest_description = st.text_area("Description (optional)", key="new_quest_description")

    quest_date = st.date_input("Deadline Date", value=st.session_state['new_quest_deadline_date'], key="new_quest_deadline_date")
    quest_time = st.time_input("Deadline Time", value=st.session_state['new_quest_deadline_time'], key="new_quest_deadline_time")

    if st.button("CREATE QUEST", use_container_width=True):
        if not quest_title:
            st.error("Quest title is required!")
        else:
            selected_date = st.session_state['new_quest_deadline_date']
            selected_time = st.session_state['new_quest_deadline_time']
            deadline = datetime.combine(selected_date, selected_time)
            if deadline <= datetime.now():
                st.error("Deadline must be in the future.")
            else:
                success = create_task(user_email, quest_title, quest_category, int(quest_points), deadline, quest_description)
                if success:
                    st.success(f"Quest '{quest_title}' created! +{quest_points} XP on completion")
                    # creation succeeded — trigger full rerun so UI (lists/graphs) reload from DB
                    st.rerun()
                else:
                    st.error("Failed to create quest. See developer debug panel.")

# Tab 4: LEADERBOARD — prefer ui_override or user_points_hist for current user's XP if DB not updated yet
with tab4:
    st.markdown("### GLOBAL LEADERBOARD")
    
    leaderboard = get_leaderboard(10)
    if leaderboard:
        # get latest known cumulative for signed-in user (if present)
        my_override = st.session_state.get('ui_override') or {}
        my_points_cum = None
        if user_points_hist:
            my_points_cum = user_points_hist[-1]['cumulative_points']

        for idx, player in enumerate(leaderboard, 1):
            is_current = player['email'] == user_email
            highlight = "border: 2px solid #a78bfa;" if is_current else ""
            displayed_points = player.get('total_points', 0)

            # if this is current user prefer the override, then points table cumulative, then DB player value
            if is_current:
                if my_override and my_override.get('email') == user_email:
                    displayed_points = int(my_override.get('total_points', displayed_points))
                elif my_points_cum is not None:
                   
                    displayed_points = int(my_points_cum)

            st.markdown(f"""
            <div style='background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 8px; margin: 0.5rem 0; border: 1px solid rgba(167, 139, 250, 0.3); {highlight}'>
                <span style='font-size: 1.5rem; font-weight: 700; color: #94a3b8;'>#{idx}</span>
                <span style='font-size: 1.2rem;'>{player['avatar_url']} {player['name']}</span>
                <span style='float: right; color: #a78bfa;'>Level {player['level']} | {displayed_points} XP</span>
            </div>
            """, unsafe_allow_html=True)
    
    st.markdown("</div>", unsafe_allow_html=True)

# Tab 5: PROFILE - editable user details, preferred categories, bio
with tab5:
    st.markdown("### PROFILE")
    
    # try to parse preferred categories (if stored as JSON string)
    pref_raw = user_data.get('preferred_categories', None)
    try:
        pref_list = json.loads(pref_raw) if isinstance(pref_raw, str) else (pref_raw or [])
        if not isinstance(pref_list, list):
            pref_list = []
    except Exception:
        pref_list = []
    
    name_in = st.text_input("Full name", value=user_data.get('name', ''), key="profile_name")
    style_in = st.selectbox("Profile style", ["Swordsman","Guardian","Archer","Runner","Mage","Strategist"], index=0 if user_data.get('avatar_url', '') == "" else (["Swordsman","Guardian","Archer","Runner","Mage","Strategist"].index(user_data.get('avatar_url', '')) if user_data.get('avatar_url', '') in ["Swordsman","Guardian","Archer","Runner","Mage","Strategist"] else 0), key="profile_style")
    bio_in = st.text_area("Bio / summary", value=user_data.get('bio', ''), key="profile_bio")
    pref_cats = st.multiselect("Preferred categories", options=["Fitness","Study","Work","Skills","Personal"], default=pref_list, key="profile_pref")
    
    col_save, _ = st.columns([1,3])
    with col_save:
        if st.button("Save profile"):
            res = update_user_profile(user_email, name=name_in, avatar=style_in, bio=bio_in, preferred_categories=pref_cats)
            # res is now a dict: {"ok": bool, "not_saved": [fields]}
            if isinstance(res, dict) and res.get('ok'):
                # refresh local user_data from DB via backend helper
                user_row = get_user_by_email(user_email)
                if user_row:
                    st.session_state['user_data'] = user_row
                # report outcome: success and warn about any fields that couldn't be saved
                not_saved = res.get('not_saved', []) or []
                if not_saved:
                    st.warning(f"Profile saved, but the following fields were not persisted (missing columns): {', '.join(not_saved)}")
                else:
                    st.success("Profile updated.")
            else:
                # show db error details if present
                msg = st.session_state.get('last_db_error') or "Unknown error — check server logs or DB schema."
                st.error(f"Failed to save profile: {msg}")
    st.markdown("</div>", unsafe_allow_html=True)

# ...existing code continues (Active quests, Leaderboard, Progress) ...
# ensure previous 'Progress' logic remains intact and accessible where it was before or via Dashboard