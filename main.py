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
    page_title="Life RPG Tracker",
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
    </style>
    """, unsafe_allow_html=True)


# SQLite Database Manager - Persistent Storage
class DataManager:
    def __init__(self):
        # Use /tmp for writable storage on cloud platforms
        self.db_path = os.path.join('/tmp', 'life_rpg.db') if os.path.exists('/tmp') else 'life_rpg.db'
        self.init_database()

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
                last_active TEXT
            )
        ''')

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
            (name, level, total_xp, stats, streaks, created_date, last_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            name,
            player_data['level'],
            player_data['total_xp'],
            json.dumps(player_data['stats']),
            json.dumps(player_data['streaks']),
            player_data['created_date'],
            datetime.now().isoformat()
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

    def create_player(self, name: str) -> Dict:
        data = self.load_data()
        player = {
            "name": name,
            "level": 1,
            "total_xp": 0,
            "stats": {cat: 1 for cat in data['categories'].keys()},
            "tasks": [],
            "streaks": {cat: 0 for cat in data['categories'].keys()},
            "created_date": datetime.now().isoformat(),
            "last_active": datetime.now().isoformat()
        }
        self.save_player(name, player)
        return player

    def export_data(self) -> str:
        """Export data as JSON string for download"""
        return json.dumps(self.load_data(), indent=2)

    def import_data(self, json_str: str) -> bool:
        """Import data from JSON string"""
        try:
            data = json.loads(json_str)
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Clear existing data
            cursor.execute('DELETE FROM tasks')
            cursor.execute('DELETE FROM players')

            # Import players
            for player_name, player_data in data['players'].items():
                self.save_player(player_name, player_data)

            conn.commit()
            conn.close()
            return True
        except Exception as e:
            st.error(f"Import error: {str(e)}")
            return False


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

# Sidebar - Player Management
with st.sidebar:
    st.title("WARRIOR PROFILE")

    data = dm.load_data()
    players = list(data['players'].keys())

    if players:
        selected_player = st.selectbox("Select Warrior", [""] + players, key="player_select")
        if selected_player:
            st.session_state['current_player'] = selected_player
        elif 'current_player' in st.session_state and st.session_state['current_player'] not in players:
            # Clear invalid player from session state
            del st.session_state['current_player']

    new_player = st.text_input("Create New Warrior")
    if st.button("FORGE WARRIOR") and new_player:
        if new_player not in players:
            dm.create_player(new_player)
            st.session_state['current_player'] = new_player
            st.success(f"Warrior {new_player} forged!")
            st.rerun()
        else:
            st.error("Warrior already exists!")

    st.markdown("---")

    # Data backup/restore section
    st.markdown("### DATA BACKUP")

    # Export data
    if st.button("DOWNLOAD BACKUP"):
        backup_data = dm.export_data()
        st.download_button(
            label="SAVE JSON FILE",
            data=backup_data,
            file_name=f"life_rpg_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
            mime="application/json"
        )

    # Import data
    uploaded_file = st.file_uploader("RESTORE FROM BACKUP", type=['json'])
    if uploaded_file is not None:
        try:
            backup_data = uploaded_file.read().decode()
            if dm.import_data(backup_data):
                st.success("Data restored successfully!")
                st.rerun()
            else:
                st.error("Invalid backup file!")
        except Exception as e:
            st.error(f"Error restoring data: {str(e)}")

    st.markdown("---")
    st.markdown("### BATTLE STATS")
    if 'current_player' in st.session_state and st.session_state['current_player']:
        player = dm.get_player(st.session_state['current_player'])
        if player:
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
        else:
            st.warning("Please select a valid warrior")

# Main Content
if 'current_player' not in st.session_state or not st.session_state['current_player']:
    st.markdown("<h1 style='text-align: center;'>SELECT OR CREATE YOUR WARRIOR</h1>", unsafe_allow_html=True)
    st.markdown(
        "<p style='text-align: center; color: #ff1744; font-size: 1.2rem; text-shadow: 2px 2px 8px rgba(255, 23, 68, 0.8);'>The path to greatness begins with a single step...</p>",
        unsafe_allow_html=True)
else:
    player = dm.get_player(st.session_state['current_player'])

    # Check if player exists
    if not player:
        st.error("Player not found! Please select or create a warrior from the sidebar.")
        st.stop()

    # Header
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
    tab1, tab2, tab3, tab4 = st.tabs(["ACTIVE QUESTS", "NEW QUEST", "PROGRESS", "HISTORY"])

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