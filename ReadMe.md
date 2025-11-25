# 🎮 Life RPG Tracker - Multiplayer Edition

Transform your daily tasks into epic quests! Life RPG Tracker gamifies your productivity with XP, levels, streaks, and multiplayer features. Compete with friends, track your progress, and build discipline through an immersive RPG experience.

![Life RPG Tracker](https://img.shields.io/badge/version-2.0-red?style=for-the-badge)
![Python](https://img.shields.io/badge/python-3.8+-blue?style=for-the-badge)
![Streamlit](https://img.shields.io/badge/streamlit-1.28+-red?style=for-the-badge)

## 🌐 Live Demo

**[🚀 Try it now!](https://solo-leveling-self-development-by-royson.streamlit.app/)**

No installation required - jump right into the action!

## ✨ Features

### 🎯 Core Gameplay
- **Quest System**: Convert tasks into XP-rewarding quests
- **Level Progression**: Gain levels based on total XP earned
- **Category Stats**: Track progress across Fitness, Study, Work, Health, and Skills
- **Repeating Quests**: Set up daily/weekly recurring tasks
- **Deadline Management**: Time-based challenges with overdue consequences
- **Discipline Score**: Real-time tracking of your completion rate

### 👥 Multiplayer Features
- **User Authentication**: Secure login and registration system
- **Global Leaderboard**: Compete with other players worldwide
- **Activity Feed**: See what other warriors are accomplishing
- **Player Comparison**: Compare stats with friends
- **Active Warriors**: See who's online in the last 24 hours
- **Custom Avatars**: Choose your warrior icon (⚔️, 🛡️, 🏹, 🔱, etc.)

### 📊 Analytics & Progress
- **Radar Chart**: Visualize skill distribution across categories
- **XP Timeline**: Track daily XP earnings over time
- **Battle History**: Complete quest log with timestamps
- **Streak Tracking**: Monitor consistency per category

### 🎨 Design
- **Minimal Red Theme**: Sleek dark UI with red accents
- **Custom Background**: Support for local background images
- **Glassmorphism**: Transparent cards with blur effects
- **Responsive Layout**: Works on desktop and mobile

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- pip package manager

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd life-rpg-tracker
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

3. **Run the application**
```bash
streamlit run main.py
```

4. **Access the app**
Open your browser and navigate to `http://localhost:8501`

## 📁 Project Structure

```
life-rpg-tracker/
├── main.py              # Main application code
├── background.png       # Custom background (optional)
├── life_rpg.db         # SQLite database (auto-created)
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## 🎮 How to Play

### 1. Create Your Account
- Choose "REGISTER" tab
- Pick a unique warrior name and avatar
- Set up secure credentials

### 2. Create Quests
- Navigate to "NEW QUEST" tab
- Choose a category (Fitness, Study, Work, etc.)
- Set XP value based on difficulty
- Add deadline and optional description
- Enable repeating for recurring tasks

### 3. Complete Quests
- View active quests in "ACTIVE QUESTS" tab
- Complete before deadline to earn XP
- Overdue quests require consequence acceptance
- Watch your level and stats grow!

### 4. Track Progress
- Check "PROGRESS" for visual analytics
- Review "HISTORY" for completed quests
- Monitor "MULTIPLAYER" for leaderboard rankings
- View "ACTIVITY FEED" for community updates

## 🎯 XP & Leveling System

- **XP to Level**: 100 XP per level (Level 1 = 0-99 XP, Level 2 = 100-199 XP)
- **Stat Growth**: Category stats increase by XP/10 per quest
- **Quest Values**: Range from 15 XP (easy) to 200+ XP (legendary)

### Default Quest Templates

| Category | Activity | XP Value |
|----------|----------|----------|
| Fitness | Workout (30min) | 30 XP |
| Fitness | Gym Session | 50 XP |
| Fitness | Run 5K | 40 XP |
| Study | Study Session (1hr) | 35 XP |
| Study | Complete Assignment | 50 XP |
| Work | Complete Project | 60 XP |
| Work | Deep Work (2hr) | 45 XP |
| Health | Healthy Meal | 15 XP |
| Health | 8hrs Sleep | 25 XP |
| Skills | Practice Skill | 30 XP |
| Skills | Online Course | 40 XP |

## 🗄️ Database Schema

### Tables
- **users**: Authentication data (username, password_hash, player_name)
- **players**: Player profiles (level, XP, stats, streaks, avatar)
- **tasks**: Quest data (name, category, XP, deadline, status)
- **categories**: Default quest templates
- **activity_feed**: Global activity log

## 🔒 Security Features

- SHA-256 password hashing
- Session-based authentication
- No plaintext password storage
- User isolation (each player sees only their data)

## 🎨 Customization

### Change Background
Replace `background.png` with your own image (recommended: 1920x1080 or higher)

### Modify Categories
Edit default categories in `DataManager.init_database()` method

### Adjust Theme Colors
Modify CSS in `load_css()` function:
- Primary color: `#ff1744` (red)
- Background opacity: `rgba(0,0,0,0.4)`

## 📊 Discipline Score Calculation

```python
Discipline = ((Completed / Total) × 70) - (Overdue × 5)
Range: 0-100%
```

## 🐛 Troubleshooting

### Database Issues
- Delete `life_rpg.db` to reset (loses all data)
- Check write permissions in app directory

### Background Not Loading
- Ensure `background.png` is in the same folder as `main.py`
- Check file format (PNG, JPG supported)
- Falls back to online image if missing

### Port Already in Use
```bash
streamlit run main.py --server.port 8502
```

## 🚀 Deployment

### Streamlit Cloud
1. Push code to GitHub
2. Connect repository on [share.streamlit.io](https://share.streamlit.io)
3. Deploy!

### Heroku/Railway
- Use `/tmp` directory for SQLite (already configured)
- Add `requirements.txt` to project root

## 🤝 Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Share feedback

## 📝 License

This project is open source and available under the MIT License.

## 🎖️ Credits

Built with:
- [Streamlit](https://streamlit.io/) - Web framework
- [Plotly](https://plotly.com/) - Interactive charts
- [SQLite](https://www.sqlite.org/) - Database
- [Pandas](https://pandas.pydata.org/) - Data manipulation

## 📧 Support

Having issues? Create an issue on GitHub or reach out to the community!

---

**⚔️ Start your journey today and transform productivity into an epic adventure! ⚔️**
