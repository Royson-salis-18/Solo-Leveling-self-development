import streamlit as st
import pandas as pd
import json
from datetime import datetime, timedelta
from pathlib import Path
import plotly.graph_objects as go
import plotly.express as px
from typing import Dict, List, Optional
import base64
import os
import sqlite3
import hashlib


# Function to load local background image
def get_base64_image(image_path):
    """Convert local image to base64 string"""
    try:
        with open(image_path, "rb") as img_file:
            return base64.b64encode(img_file.read()).decode()
    except FileNotFoundError:
        return None


# Page config
st.set_page_config(
    page_title="Life RPG Tracker - Multiplayer",
    page_icon="⚔️",
    layout="wide",
    initial_sidebar_state="expanded"
)


# Custom CSS for minimal red theme
def load_css():
    # Try to load local background image
    bg_image_path = "background.png"
    bg_base64 = get_base64_image(bg_image_path)

    # Create background CSS based on whether local image exists
    if bg_base64:
        background_style = f"background-image: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('data:image/jpeg;base64,{bg_base64}');"
    else:
        # Fallback to online image or gradient
        background_style = "background-image: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920');"

    st.markdown(f"""
    <style>
    /* Hide Streamlit branding and menu */
    #MainMenu {{visibility: hidden;}}
    footer {{visibility: hidden;}}

    .stApp {{
        {background_style}
        background-size: cover;
        background-attachment: fixed;
        background-position: center;
    }}

    .main .block-container {{
        padding-top: 2rem;
        padding-bottom: 2rem;
        background-color: transparent;
        border-radius: 10px;
    }}

    /* Red text with shadow for headers */
    h1, h2, h3, h4, h5, h6 {{
        color: #ff1744 !important;
        text-shadow: 2px 2px 8px rgba(255, 23, 68, 0.8);
        font-weight: 700 !important;
        letter-spacing: 0.5px;
    }}

    /* Metric styling - red text with shadow */
    [data-testid="stMetricValue"] {{
        color: #ff1744 !important;
        font-size: 2rem !important;
        font-weight: 700 !important;
        text-shadow: 2px 2px 8px rgba(255, 23, 68, 0.8);
    }}

    [data-testid="stMetricLabel"] {{
        color: #ffffff !important;
        font-weight: 500 !important;
        text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.8);
    }}

    /* Transparent expanders with subtle border */
    div[data-testid="stExpander"] {{
        background-color: rgba(0,0,0,0.2) !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important;
        border-radius: 8px !important;
    }}

    /* Expander header */
    div[data-testid="stExpander"] summary {{
        background-color: transparent !important;
    }}

    /* Transparent buttons with red text */
    .stButton>button {{
        background: rgba(0,0,0,0.4) !important;
        color: #ff1744 !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 6px !important;
        font-weight: 600 !important;
        text-shadow: 1px 1px 4px rgba(255, 23, 68, 0.6);
        backdrop-filter: blur(10px) !important;
        transition: all 0.3s ease !important;
    }}

    .stButton>button:hover {{
        background: rgba(255, 23, 68, 0.1) !important;
        border: 1px solid rgba(255, 23, 68, 0.3) !important;
        transform: translateY(-1px);
    }}

    /* Transparent inputs with red text */
    .stTextInput>div>div>input,
    .stNumberInput>div>div>input,
    .stSelectbox>div>div>select,
    .stTextArea>div>div>textarea,
    .stDateInput>div>div>input,
    .stTimeInput>div>div>input {{
        background-color: rgba(0,0,0,0.4) !important;
        color: #ff1744 !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 6px !important;
        text-shadow: 1px 1px 4px rgba(255, 23, 68, 0.4);
        backdrop-filter: blur(10px) !important;
    }}

    .stTextInput>div>div>input::placeholder,
    .stTextArea>div>div>textarea::placeholder {{
        color: rgba(255, 23, 68, 0.5) !important;
    }}

    /* Remove blue focus highlight */
    .stTextInput>div>div>input:focus,
    .stNumberInput>div>div>input:focus,
    .stSelectbox>div>div>select:focus,
    .stTextArea>div>div>textarea:focus {{
        border: 1px solid rgba(255, 23, 68, 0.4) !important;
        box-shadow: 0 0 0 1px rgba(255, 23, 68, 0.2) !important;
        outline: none !important;
    }}

    /* Transparent sidebar */
    section[data-testid="stSidebar"] {{
        background: rgba(0,0,0,0.4) !important;
        backdrop-filter: blur(10px) !important;
        border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
    }}

    /* Progress bar - red */
    .stProgress > div > div > div > div {{
        background-color: #ff1744 !important;
    }}

    /* Transparent navbar */
    header[data-testid="stHeader"] {{
        background: rgba(0, 0, 0, 0.3) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
    }}

    /* General text color with shadow */
    p, span, label, div {{
        color: #ffffff !important;
        text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);
    }}

    /* Dataframe styling */
    .dataframe {{
        background-color: rgba(0,0,0,0.3) !important;
        color: #ff1744 !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }}

    /* Tab styling - remove blue */
    .stTabs [data-baseweb="tab-list"] {{
        background-color: rgba(0,0,0,0.3);
        border-radius: 8px;
    }}

    .stTabs [data-baseweb="tab"] {{
        color: rgba(255, 255, 255, 0.6) !important;
        background-color: transparent;
        border: none;
    }}

    .stTabs [aria-selected="true"] {{
        color: #ff1744 !important;
        text-shadow: 1px 1px 4px rgba(255, 23, 68, 0.8);
        background-color: rgba(255, 23, 68, 0.1) !important;
    }}

    /* Remove blue border from tabs */
    .stTabs [data-baseweb="tab-highlight"] {{
        background-color: transparent !important;
    }}

    /* Info/Success/Error boxes - remove blue */
    .stAlert {{
        background-color: rgba(0,0,0,0.5) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        backdrop-filter: blur(10px) !important;
        color: #ffffff !important;
    }}

    [data-testid="stNotification"] {{
        background-color: rgba(0,0,0,0.5) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }}

    .stSuccess {{
        background-color: rgba(0,0,0,0.5) !important;
    }}

    .stInfo {{
        background-color: rgba(0,0,0,0.5) !important;
    }}

    /* Warning styling */
    .overdue-warning {{
        background: rgba(0,0,0,0.5);
        padding: 1rem;
        border-radius: 10px;
        border: 1px solid rgba(255, 23, 68, 0.3);
        margin: 1rem 0;
        backdrop-filter: blur(10px);
    }}

    .warning-text {{
        color: #ff1744;
        font-weight: 600;
        text-shadow: 1px 1px 6px rgba(255, 23, 68, 0.8);
    }}

    /* Select box dropdown */
    [data-baseweb="select"] {{
        background-color: rgba(0,0,0,0.4) !important;
    }}

    /* Remove all blue accents from selectbox */
    [data-baseweb="select"] > div {{
        background-color: rgba(0,0,0,0.4) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
    }}

    /* Leaderboard card styling */
    .leaderboard-card {{
        background: rgba(0,0,0,0.5);
        padding: 1rem;
        border-radius: 10px;
        border: 1px solid rgba(255, 23, 68, 0.3);
        margin: 0.5rem 0;
        backdrop-filter: blur(10px);
    }}

    .rank-gold {{
        color: #FFD700 !important;
        text-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
    }}

    .rank-silver {{
        color: #C0C0C0 !important;
        text-shadow: 0 0 10px rgba(192, 192, 192, 0.8);
    }}

    .rank-bronze {{
        color: #CD7F32 !important;
        text-shadow: 0 0 10px rgba(205, 127, 50, 0.8);
    }}

    /* Login box styling */
    .login-box {{
        background: rgba(0,0,0,0.6);
        padding: 2rem;
        border-radius: 15px;
        border: 2px solid rgba(255, 23, 68, 0.5);
        margin: 2rem auto;
        max-width: 400px;
        backdrop-filter: blur(15px);
    }}
    </style>
    """, unsafe_allow_html=True)


# Authentication Manager
class AuthManager:
    def __init__(self, db_path):
        self.db_path = db_path
        self.init_auth_table()

    def init_auth_table(self):
        """Initialize authentication table"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                created_date TEXT,
                player_name TEXT UNIQUE
            )
        ''')
        conn.commit()
        conn.close()

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using SHA-256"""
        return hashlib.sha256(password.encode()).hexdigest()

    def register_user(self, username: str, password: str, player_name: str) -> bool:
        """Register a new user"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            password_hash = self.hash_password(password)
            cursor.execute('''
                INSERT INTO users (username, password_hash, created_date, player_name)
                VALUES (?, ?, ?, ?)
            ''', (username, password_hash, datetime.now().isoformat(), player_name))
            conn.commit()
            conn.close()
            return True
        except sqlite3.IntegrityError:
            return False

    def verify_login(self, username: str, password: str) -> Optional[str]:
        """Verify login credentials and return player name"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        password_hash = self.hash_password(password)
        cursor.execute('''
            SELECT player_name FROM users 
            WHERE username = ? AND password_hash = ?
        ''', (username, password_hash))
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else None

    def get_player_by_username(self, username: str) -> Optional[str]:
        """Get player name from username"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT player_name FROM users WHERE username = ?', (username,))
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else None


# SQLite Database Manager - Multiplayer Edition
class DataManager:
    def __init__(self):
        # Use /tmp for writable storage on cloud platforms
        self.db_path = os.path.join('/tmp', 'life_rpg.db') if os.path.exists('/tmp') else 'life_rpg.db'
        self.init_database()
        self.auth = AuthManager(self.db_path)

    def init_database(self):
        """Initialize SQLite database with tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Players table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS players (
                name TEXT PRIMARY KEY,
                level INTEGER,
                total_xp INTEGER,
                stats TEXT,
                streaks TEXT,
                created_date TEXT,
                last_active TEXT,
                avatar TEXT
            )
        ''')

        # Check if avatar column exists, if not add it (for migration)
        cursor.execute("PRAGMA table_info(players)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'avatar' not in columns:
            cursor.execute('ALTER TABLE players ADD COLUMN avatar TEXT DEFAULT "⚔️"')

        # Tasks table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id REAL PRIMARY KEY,
                player_name TEXT,
                name TEXT,
                category TEXT,
                xp INTEGER,
                deadline TEXT,
                description TEXT,
                status TEXT,
                created TEXT,
                completed TEXT,
                repeat_days INTEGER,
                repeat_count INTEGER,
                FOREIGN KEY (player_name) REFERENCES players (name)
            )
        ''')

        # Categories table (default categories)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                category TEXT PRIMARY KEY,
                activities TEXT
            )
        ''')

        # Activity feed table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS activity_feed (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT,
                action TEXT,
                details TEXT,
                timestamp TEXT
            )
        ''')

        # Insert default categories if empty
        cursor.execute('SELECT COUNT(*) FROM categories')
        if cursor.fetchone()[0] == 0:
            default_categories = {
                "Fitness": {"Workout (30min)": 30, "Gym Session": 50, "Run 5K": 40},
                "Study": {"Study Session (1hr)": 35, "Complete Assignment": 50, "Read Chapter": 25},
                "Work": {"Complete Project": 60, "Deep Work (2hr)": 45, "Meeting Prep": 20},
                "Health": {"Healthy Meal": 15, "8hrs Sleep": 25, "Meditation": 20},
                "Skills": {"Practice Skill": 30, "Online Course": 40, "Side Project": 55}
            }
            for cat, acts in default_categories.items():
                cursor.execute('INSERT INTO categories VALUES (?, ?)',
                               (cat, json.dumps(acts)))

        conn.commit()
        conn.close()

    def load_data(self) -> Dict:
        """Load all data from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Load categories
        cursor.execute('SELECT category, activities FROM categories')
        categories = {row[0]: json.loads(row[1]) for row in cursor.fetchall()}

        # Load players
        cursor.execute('SELECT * FROM players')
        players = {}
        for row in cursor.fetchall():
            player_name = row[0]
            players[player_name] = {
                'name': row[0],
                'level': row[1],
                'total_xp': row[2],
                'stats': json.loads(row[3]),
                'streaks': json.loads(row[4]),
                'created_date': row[5],
                'last_active': row[6],
                'avatar': row[7] if len(row) > 7 else '⚔️',
                'tasks': []
            }

        # Load tasks for each player
        cursor.execute('SELECT * FROM tasks')
        for row in cursor.fetchall():
            task = {
                'id': row[0],
                'name': row[2],
                'category': row[3],
                'xp': row[4],
                'deadline': row[5],
                'description': row[6],
                'status': row[7],
                'created': row[8],
                'completed': row[9],
                'repeat_days': row[10],
                'repeat_count': row[11]
            }
            player_name = row[1]
            if player_name in players:
                players[player_name]['tasks'].append(task)

        conn.close()
        return {'players': players, 'categories': categories}

    def get_player(self, name: str) -> Optional[Dict]:
        data = self.load_data()
        return data['players'].get(name)

    def save_player(self, name: str, player_data: Dict):
        """Save player data to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Update or insert player
        cursor.execute('''
            INSERT OR REPLACE INTO players 
            (name, level, total_xp, stats, streaks, created_date, last_active, avatar)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            name,
            player_data['level'],
            player_data['total_xp'],
            json.dumps(player_data['stats']),
            json.dumps(player_data['streaks']),
            player_data['created_date'],
            datetime.now().isoformat(),
            player_data.get('avatar', '⚔️')
        ))

        # Delete old tasks for this player
        cursor.execute('DELETE FROM tasks WHERE player_name = ?', (name,))

        # Insert tasks
        for task in player_data.get('tasks', []):
            cursor.execute('''
                INSERT INTO tasks 
                (id, player_name, name, category, xp, deadline, description, 
                 status, created, completed, repeat_days, repeat_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                task['id'], name, task['name'], task['category'], task['xp'],
                task['deadline'], task['description'], task['status'],
                task['created'], task['completed'], task['repeat_days'],
                task['repeat_count']
            ))

        conn.commit()
        conn.close()

    def create_player(self, name: str, avatar: str = '⚔️') -> Dict:
        data = self.load_data()
        player = {
            "name": name,
            "level": 1,
            "total_xp": 0,
            "stats": {cat: 1 for cat in data['categories'].keys()},
            "tasks": [],
            "streaks": {cat: 0 for cat in data['categories'].keys()},
            "created_date": datetime.now().isoformat(),
            "last_active": datetime.now().isoformat(),
            "avatar": avatar
        }
        self.save_player(name, player)
        self.add_activity(name, "joined", "Joined the battle!")
        return player

    def get_leaderboard(self, limit: int = 10) -> List[Dict]:
        """Get top players by XP"""
        data = self.load_data()
        players = list(data['players'].values())
        players.sort(key=lambda x: x['total_xp'], reverse=True)
        return players[:limit]

    def get_active_players(self, hours: int = 24) -> List[Dict]:
        """Get players active in last X hours"""
        data = self.load_data()
        cutoff = datetime.now() - timedelta(hours=hours)
        active = []
        for player in data['players'].values():
            last_active = datetime.fromisoformat(player['last_active'])
            if last_active > cutoff:
                active.append(player)
        return active

    def add_activity(self, player_name: str, action: str, details: str):
        """Add activity to feed"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO activity_feed (player_name, action, details, timestamp)
            VALUES (?, ?, ?, ?)
        ''', (player_name, action, details, datetime.now().isoformat()))
        conn.commit()
        conn.close()

    def get_activity_feed(self, limit: int = 20) -> List[Dict]:
        """Get recent activity feed"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT player_name, action, details, timestamp 
            FROM activity_feed 
            ORDER BY timestamp DESC 
            LIMIT ?
        ''', (limit,))

        activities = []
        for row in cursor.fetchall():
            activities.append({
                'player': row[0],
                'action': row[1],
                'details': row[2],
                'timestamp': row[3]
            })

        conn.close()
        return activities


# Task management
class Task:
    @staticmethod
    def create(name: str, category: str, xp: int, deadline: datetime,
               description: str = "", repeat_days: int = 0) -> Dict:
        return {
            "id": datetime.now().timestamp(),
            "name": name,
            "category": category,
            "xp": xp,
            "deadline": deadline.isoformat(),
            "description": description,
            "status": "pending",
            "created": datetime.now().isoformat(),
            "completed": None,
            "repeat_days": repeat_days,
            "repeat_count": 0
        }

    @staticmethod
    def is_overdue(task: Dict) -> bool:
        if task['status'] != 'pending':
            return False
        deadline = datetime.fromisoformat(task['deadline'])
        return datetime.now() > deadline

    @staticmethod
    def get_consequence(xp: int) -> str:
        """Constructive consequences instead of harsh punishments"""
        if xp < 20:
            return "Write reflection: Why did I miss this?"
        elif xp <= 50:
            return "15min planning session for tomorrow"
        elif xp <= 100:
            return "Create action plan to prevent future misses"
        elif xp <= 200:
            return "Weekly review + adjust goals"
        else:
            return "Full system audit + restart protocol"


# Initialize
dm = DataManager()
load_css()

# Initialize session state
if 'logged_in' not in st.session_state:
    st.session_state['logged_in'] = False
if 'username' not in st.session_state:
    st.session_state['username'] = None

# LOGIN PAGE
if not st.session_state['logged_in']:
    st.markdown("<h1 style='text-align: center;'>LIFE RPG TRACKER</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: #ff1744; font-size: 1.2rem;'>Enter the Arena</p>",
                unsafe_allow_html=True)

    tab1, tab2 = st.tabs(["LOGIN", "REGISTER"])

    with tab1:
        st.markdown("### WARRIOR LOGIN")

        login_username = st.text_input("Username", key="login_user")
        login_password = st.text_input("Password", type="password", key="login_pass")

        if st.button("ENTER ARENA"):
            if login_username and login_password:
                player_name = dm.auth.verify_login(login_username, login_password)
                if player_name:
                    st.session_state['logged_in'] = True
                    st.session_state['username'] = login_username
                    st.session_state['current_player'] = player_name
                    st.success(f"Welcome back, {player_name}!")
                    st.rerun()
                else:
                    st.error("Invalid credentials!")
            else:
                st.error("Please enter username and password!")

    with tab2:
        st.markdown("### FORGE NEW ACCOUNT")

        reg_username = st.text_input("Username", key="reg_user")
        reg_password = st.text_input("Password", type="password", key="reg_pass")
        reg_password2 = st.text_input("Confirm Password", type="password", key="reg_pass2")
        reg_player_name = st.text_input("Warrior Name")
        reg_avatar = st.selectbox("Choose Avatar", ["⚔️", "🛡️", "🏹", "🔱", "⚡", "🔥", "❄️", "🌟", "💀", "👑"])

        if st.button("CREATE ACCOUNT"):
            if not reg_username or not reg_password or not reg_player_name:
                st.error("All fields required!")
            elif reg_password != reg_password2:
                st.error("Passwords don't match!")
            elif len(reg_password) < 6:
                st.error("Password must be at least 6 characters!")
            else:
                # Create player first
                try:
                    player = dm.create_player(reg_player_name, reg_avatar)
                    # Register user
                    if dm.auth.register_user(reg_username, reg_password, reg_player_name):
                        st.success("Account created! Please login.")
                    else:
                        st.error("Username or warrior name already exists!")
                except Exception as e:
                    st.error(f"Error creating account: {str(e)}")

    # Show leaderboard on login page
    st.markdown("---")
    st.markdown("### GLOBAL LEADERBOARD")
    leaderboard = dm.get_leaderboard(5)
    if leaderboard:
        for idx, p in enumerate(leaderboard, 1):
            rank_class = "rank-gold" if idx == 1 else "rank-silver" if idx == 2 else "rank-bronze" if idx == 3 else ""
            st.markdown(f"""
            <div class='leaderboard-card'>
                <span class='{rank_class}' style='font-size: 1.5rem; font-weight: 700;'>#{idx}</span>
                <span style='font-size: 1.2rem;'>{p.get('avatar', '⚔️')} {p['name']}</span>
                <span style='float: right; color: #ff1744;'>Level {p['level']} | {p['total_xp']} XP</span>
            </div>
            """, unsafe_allow_html=True)

    st.stop()

# LOGGED IN - Main Application
with st.sidebar:
    st.title("WARRIOR PROFILE")

    player = dm.get_player(st.session_state['current_player'])

    if player:
        st.markdown(f"### {player.get('avatar', '⚔️')} {player['name']}")
        st.metric("Level", player['level'])
        st.metric("Total XP", player['total_xp'])

        # Calculate discipline score
        total_tasks = len(player['tasks'])
        completed = len([t for t in player['tasks'] if t['status'] == 'completed'])
        overdue = len([t for t in player['tasks'] if Task.is_overdue(t)])

        if total_tasks > 0:
            discipline = int(((completed / total_tasks) * 70) - (overdue * 5))
            discipline = max(0, min(100, discipline))
            st.metric("Discipline", f"{discipline}%")
            st.progress(discipline / 100)

    st.markdown("---")

    if st.button("LOGOUT"):
        st.session_state['logged_in'] = False
        st.session_state['username'] = None
        st.session_state['current_player'] = None
        st.rerun()

    if st.button("REFRESH"):
        st.rerun()

# Main Content (rest of your original code remains the same)
# Header with player stats
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Level", player['level'])
with col2:
    st.metric("Total XP", player['total_xp'])
with col3:
    active_tasks = len([t for t in player['tasks'] if t['status'] == 'pending'])
    st.metric("Active Quests", active_tasks)
with col4:
    completed_today = len([t for t in player['tasks']
                           if t['status'] == 'completed' and
                           datetime.fromisoformat(t['completed']).date() == datetime.now().date()])
    st.metric("Today", completed_today)

# Tabs
data = dm.load_data()
tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "ACTIVE QUESTS", "NEW QUEST", "PROGRESS", "HISTORY", "MULTIPLAYER", "ACTIVITY FEED"
])

# Tab 1: Active Tasks
with tab1:
    st.markdown("### CURRENT BATTLES")

    pending_tasks = [t for t in player['tasks'] if t['status'] == 'pending']
    overdue_tasks = [t for t in pending_tasks if Task.is_overdue(t)]

    # Show overdue warnings
    if overdue_tasks:
        st.markdown("<div class='overdue-warning'>", unsafe_allow_html=True)
        st.markdown(f"### {len(overdue_tasks)} QUESTS FAILED")
        st.markdown("**CONSEQUENCES MUST BE FACED**")
        for task in overdue_tasks:
            with st.expander(f"{task['name']} - {task['xp']} XP", expanded=False):
                st.markdown(f"**Category:** {task['category']}")
                st.markdown(f"**Deadline:** {datetime.fromisoformat(task['deadline']).strftime('%Y-%m-%d %H:%M')}")
                st.markdown(f"**Consequence:** {Task.get_consequence(task['xp'])}")

                col1, col2 = st.columns(2)
                with col1:
                    if st.button(f"Accept & Complete", key=f"complete_overdue_{task['id']}"):
                        task['status'] = 'completed'
                        task['completed'] = datetime.now().isoformat()
                        player['total_xp'] += task['xp']
                        player['level'] = 1 + player['total_xp'] // 100
                        player['stats'][task['category']] += task['xp'] // 10
                        dm.save_player(player['name'], player)
                        dm.add_activity(player['name'], "completed_late",
                                        f"Completed {task['name']} (+{task['xp']} XP)")
                        st.success("Consequence accepted. Quest completed.")
                        st.rerun()
                with col2:
                    if st.button(f"Delete Quest", key=f"delete_overdue_{task['id']}"):
                        player['tasks'] = [t for t in player['tasks'] if t['id'] != task['id']]
                        dm.save_player(player['name'], player)
                        st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)

    # Show active tasks
    active_tasks = [t for t in pending_tasks if not Task.is_overdue(t)]
    if active_tasks:
        for task in sorted(active_tasks, key=lambda x: x['deadline']):
            deadline = datetime.fromisoformat(task['deadline'])
            time_left = deadline - datetime.now()
            hours_left = time_left.total_seconds() / 3600

            with st.expander(f"{task['name']} - {task['xp']} XP", expanded=False):
                col1, col2 = st.columns([3, 1])
                with col1:
                    st.markdown(f"**Category:** {task['category']}")
                    st.markdown(f"**Deadline:** {deadline.strftime('%Y-%m-%d %H:%M')}")
                    st.markdown(f"**Time Remaining:** {int(hours_left)}h {int((hours_left % 1) * 60)}m")
                    if task['description']:
                        st.markdown(f"**Details:** {task['description']}")
                    if task['repeat_days'] > 0:
                        st.markdown(
                            f"**Repeats:** Every {task['repeat_days']} days (Count: {task['repeat_count']})")

                with col2:
                    if st.button("Complete", key=f"complete_{task['id']}"):
                        task['status'] = 'completed'
                        task['completed'] = datetime.now().isoformat()
                        player['total_xp'] += task['xp']
                        old_level = player['level']
                        player['level'] = 1 + player['total_xp'] // 100
                        player['stats'][task['category']] += task['xp'] // 10

                        # Handle repeating tasks
                        if task['repeat_days'] > 0:
                            new_task = Task.create(
                                task['name'],
                                task['category'],
                                task['xp'],
                                deadline + timedelta(days=task['repeat_days']),
                                task['description'],
                                task['repeat_days']
                            )
                            new_task['repeat_count'] = task['repeat_count'] + 1
                            player['tasks'].append(new_task)

                        dm.save_player(player['name'], player)

                        # Add to activity feed
                        if player['level'] > old_level:
                            dm.add_activity(player['name'], "level_up", f"Reached Level {player['level']}!")
                        dm.add_activity(player['name'], "completed", f"Completed {task['name']} (+{task['xp']} XP)")

                        st.success(f"+{task['xp']} XP! Level {player['level']}")
                        st.rerun()

                    if st.button("Delete", key=f"delete_{task['id']}"):
                        player['tasks'] = [t for t in player['tasks'] if t['id'] != task['id']]
                        dm.save_player(player['name'], player)
                        st.rerun()
    else:
        st.info("No active quests. Create new challenges!")

# Tab 2: New Task
with tab2:
    st.markdown("### FORGE NEW QUEST")

    categories = list(data['categories'].keys())

    col1, col2 = st.columns(2)
    with col1:
        task_name = st.text_input("Quest Name")
        category = st.selectbox("Category", categories)

        if category:
            activities = list(data['categories'][category].keys())
            activity = st.selectbox("Activity (optional)", ["Custom"] + activities)

            if activity != "Custom":
                xp = data['categories'][category][activity]
                task_name = activity if not task_name else task_name
            else:
                xp = st.number_input("XP Value", min_value=1, max_value=500, value=30)

    with col2:
        deadline_date = st.date_input("Deadline Date", datetime.now().date() + timedelta(days=1))
        deadline_time = st.time_input("Deadline Time", datetime.now().time())
        repeat_days = st.number_input("Repeat Every X Days (0 = no repeat)", min_value=0, max_value=365, value=0)

    description = st.text_area("Quest Description (optional)")

    if st.button("CREATE QUEST"):
        if task_name and category:
            deadline = datetime.combine(deadline_date, deadline_time)
            new_task = Task.create(task_name, category, xp, deadline, description, repeat_days)
            player['tasks'].append(new_task)
            dm.save_player(player['name'], player)
            dm.add_activity(player['name'], "created_quest", f"Created quest: {task_name}")
            st.success(f"Quest '{task_name}' created! +{xp} XP on completion")
            st.rerun()
        else:
            st.error("Quest name and category required!")

# Tab 3: Progress
with tab3:
    st.markdown("### WARRIOR ANALYTICS")

    # Stats radar chart
    categories = list(player['stats'].keys())
    values = [player['stats'][cat] for cat in categories]

    fig = go.Figure(data=go.Scatterpolar(
        r=values,
        theta=categories,
        fill='toself',
        line=dict(color='#ff1744', width=2),
        fillcolor='rgba(255, 23, 68, 0.3)'
    ))

    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=True, range=[0, max(values) + 10]),
            bgcolor='rgba(0,0,0,0.5)'
        ),
        showlegend=False,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(color='white')
    )

    st.plotly_chart(fig, use_container_width=True)

    # Completion timeline
    completed = [t for t in player['tasks'] if t['status'] == 'completed']
    if completed:
        df = pd.DataFrame([{
            'Date': datetime.fromisoformat(t['completed']).date(),
            'XP': t['xp'],
            'Task': t['name']
        } for t in completed])

        daily_xp = df.groupby('Date')['XP'].sum().reset_index()

        fig2 = px.line(daily_xp, x='Date', y='XP',
                       title='XP Progress Over Time',
                       color_discrete_sequence=['#ff1744'])
        fig2.update_layout(
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0.5)',
            font=dict(color='white')
        )
        st.plotly_chart(fig2, use_container_width=True)

# Tab 4: History
with tab4:
    st.markdown("### BATTLE HISTORY")

    completed = [t for t in player['tasks'] if t['status'] == 'completed']
    if completed:
        df = pd.DataFrame([{
            'Quest': t['name'],
            'Category': t['category'],
            'XP': t['xp'],
            'Completed': datetime.fromisoformat(t['completed']).strftime('%Y-%m-%d %H:%M'),
            'Time Taken': str(datetime.fromisoformat(t['completed']) -
                              datetime.fromisoformat(t['created'])).split('.')[0]
        } for t in sorted(completed, key=lambda x: x['completed'], reverse=True)])

        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.info("No completed quests yet. Start your journey!")

# Tab 5: Multiplayer Features
with tab5:
    st.markdown("### MULTIPLAYER ARENA")

    # Leaderboard
    st.markdown("#### GLOBAL LEADERBOARD")
    leaderboard = dm.get_leaderboard(10)

    if leaderboard:
        for idx, p in enumerate(leaderboard, 1):
            is_current = p['name'] == player['name']
            rank_class = "rank-gold" if idx == 1 else "rank-silver" if idx == 2 else "rank-bronze" if idx == 3 else ""
            highlight = "border: 2px solid #ff1744;" if is_current else ""

            st.markdown(f"""
            <div class='leaderboard-card' style='{highlight}'>
                <span class='{rank_class}' style='font-size: 1.5rem; font-weight: 700;'>#{idx}</span>
                <span style='font-size: 1.2rem;'>{p.get('avatar', '⚔️')} {p['name']}</span>
                <span style='float: right; color: #ff1744;'>Level {p['level']} | {p['total_xp']} XP</span>
            </div>
            """, unsafe_allow_html=True)

    st.markdown("---")

    # Active Warriors
    st.markdown("#### WARRIORS ONLINE (Last 24h)")
    active = dm.get_active_players(24)

    if active:
        cols = st.columns(min(len(active), 5))
        for idx, p in enumerate(active):
            with cols[idx % 5]:
                st.markdown(f"""
                <div style='text-align: center; padding: 0.5rem;'>
                    <div style='font-size: 2rem;'>{p.get('avatar', '⚔️')}</div>
                    <div style='font-size: 0.9rem;'>{p['name']}</div>
                    <div style='font-size: 0.8rem; color: #ff1744;'>Lv {p['level']}</div>
                </div>
                """, unsafe_allow_html=True)
    else:
        st.info("No warriors active in the last 24 hours")

    st.markdown("---")

    # Comparison with others
    st.markdown("#### COMPARE WITH WARRIOR")
    all_players = [p['name'] for p in data['players'].values() if p['name'] != player['name']]
    if all_players:
        compare_with = st.selectbox("Select Warrior to Compare", all_players)
        if compare_with:
            other_player = dm.get_player(compare_with)

            col1, col2 = st.columns(2)
            with col1:
                st.markdown(f"### {player.get('avatar', '⚔️')} {player['name']}")
                st.metric("Level", player['level'])
                st.metric("Total XP", player['total_xp'])
                st.metric("Quests Completed", len([t for t in player['tasks'] if t['status'] == 'completed']))

            with col2:
                st.markdown(f"### {other_player.get('avatar', '⚔️')} {other_player['name']}")
                st.metric("Level", other_player['level'], delta=other_player['level'] - player['level'])
                st.metric("Total XP", other_player['total_xp'], delta=other_player['total_xp'] - player['total_xp'])
                st.metric("Quests Completed", len([t for t in other_player['tasks'] if t['status'] == 'completed']))
    else:
        st.info("No other warriors to compare with. Share the app with friends!")

# Tab 6: Activity Feed
with tab6:
    st.markdown("### RECENT ACTIVITY")

    activities = dm.get_activity_feed(30)

    if activities:
        for activity in activities:
            timestamp = datetime.fromisoformat(activity['timestamp'])
            time_ago = datetime.now() - timestamp

            if time_ago.days > 0:
                time_str = f"{time_ago.days}d ago"
            elif time_ago.seconds > 3600:
                time_str = f"{time_ago.seconds // 3600}h ago"
            elif time_ago.seconds > 60:
                time_str = f"{time_ago.seconds // 60}m ago"
            else:
                time_str = "just now"

            # Get player avatar
            activity_player = dm.get_player(activity['player'])
            avatar = activity_player.get('avatar', '⚔️') if activity_player else '⚔️'

            # Action icons
            action_icons = {
                'joined': '🎉',
                'completed': '✅',
                'completed_late': '⚠️',
                'level_up': '⬆️',
                'created_quest': '📝'
            }
            icon = action_icons.get(activity['action'], '📌')

            st.markdown(f"""
            <div class='leaderboard-card'>
                <span style='font-size: 1.2rem;'>{icon} {avatar} <strong>{activity['player']}</strong></span>
                <span style='color: #ffffff;'>{activity['details']}</span>
                <span style='float: right; font-size: 0.8rem; color: rgba(255,255,255,0.6);'>{time_str}</span>
            </div>
            """, unsafe_allow_html=True)
    else:
        st.info("No recent activity. Be the first to complete a quest!")