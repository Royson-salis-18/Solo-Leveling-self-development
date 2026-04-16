// Example schedules that work great with the NLP parser
// Copy and paste any of these into the "Import Schedule" modal on the Quests page

// ========================================
// EXAMPLE 1: Simple Daily Standup
// ========================================
/*
Daily Standup - April 15, 2026

Morning:
1. Check emails and respond (routine)
2. Team standup meeting (10am, urgent)
3. Review pull requests from team

Afternoon:
4. Work on dashboard component (high priority)
   - Design the layout
   - Implement in React
   - Add responsive styles
5. Testing and debugging

Evening:
6. Gym session (strength training, 1 hour)
7. Read technical documentation
8. Personal project work (optional)
*/

// ========================================
// EXAMPLE 2: ChatGPT-Style Weekly Plan
// ========================================
/*
WEEKLY PLAN - April 15-19, 2026

WORK (40 hrs)
- [Urgent] Deploy new feature to production by Friday
  → Code final fixes
  → Run full test suite
  → Deploy and monitor
- Code review feedback from team (3 PRs)
- Internal documentation update

HEALTH & FITNESS
- Monday: 1 hour gym session (strength training)
- Wednesday: 45 min cardio workout
- Friday: Yoga and stretching
- Daily: 10 minute meditation

LEARNING
- Complete TypeScript course module 4 (high priority)
  → Watch lectures (2 hours)
  → Complete exercises
  → Build sample project
- Read 50 pages of Clean Code book

PERSONAL
- Organize home office (low priority)
- Call parents (weekend)
- Relax and gaming break
*/

// ========================================
// EXAMPLE 3: Claude-Structured Format
// ========================================
/*
DAILY SCHEDULE - April 15, 2026

BLOCK 1: Morning (8:00 AM - 12:00 PM)
  9:00 AM - 9:30 AM: Daily standup (important)
  Throughout: Answer Slack messages
  Main task: [PRIORITY] Bug fix - authentication system
    - Identify root cause
    - Implement fix
    - Write test cases

BLOCK 2: Afternoon (1:00 PM - 5:00 PM)
  1:00 PM - 1:30 PM: Lunch break
  Main task: Code review of pull requests (3 reviews)
  Secondary: Documentation updates for new API

BLOCK 3: Evening (5:00 PM+)
  6:00 PM - 6:45 PM: Gym workout (cardio, 45 mins)
  7:00 PM - 8:00 PM: Dinner
  8:00 PM - 8:45 PM: Read technical documentation
  9:00 PM+: Relaxation and personal time
*/

// ========================================
// EXAMPLE 4: Calendar-Style Schedule
// ========================================
/*
Monday, April 15

08:00 - 09:00: Morning review and emails
09:00 - 10:00: Sprint planning (URGENT - 100 XP)
  Attendees: Team
  Topics:
    - Review completed items
    - Plan sprint tasks
    - Assign stories

10:00 - 12:00: Feature development (80 XP)
  - Implement user dashboard
  - Add sorting functionality
  - Fix responsive design

12:00 - 13:00: Lunch break + Walk

13:00 - 15:00: Code review (60 XP)
  PR #234: Auth system
  PR #235: Database optimization
  PR #236: UI components

15:00 - 17:00: Project work and testing
17:00 - 18:00: Gym session (strength training)

18:00 - 19:00: Dinner

19:00 - 20:00: Learning time
  - Complete React hooks module
  - 30 pages of programming book

20:00+: Personal time and relaxation
*/

// ========================================
// EXAMPLE 5: Mixed Format (Most Flexible)
// ========================================
/*
Weekly Overview - Week of April 15

MONDAY
1. [URGENT] Sprint planning - 100 XP
2. Code review - high priority
   - Review 3 PRs
   - Provide feedback
3. Afternoon gym session
4. Read documentation chapter 3

TUESDAY
- Email responses and catch-up
- Database migration work (critical)
  → Write migration scripts
  → Test on staging
  → Document changes
- Evening yoga
- Personal project time

WEDNESDAY
* Morning meetings x2
* Feature development: Search functionality
  * Build API endpoint
  * Create UI component  
  * Add filtering options
* Afternoon gym cardio
* Read 40 pages of book

THURSDAY  
[ ] Team standup
[ ] Code fixes and testing
[ ] Evening relaxation
[ ] Read article on Next.js

FRIDAY
1. Deploy to production (IMPORTANT)
   → Final testing
   → Deployment script
   → Monitoring and verification
2. Week retrospective
3. Weekend planning
4. Gaming/relaxation reward
*/

// ========================================
// TIPS FOR BEST PARSING
// ========================================
/*
✓ DO:
  - Use clear structure (numbers, bullets, checkboxes)
  - Include timing keywords (today, tomorrow, this week)
  - Mark priorities (urgent, important, critical, asap)
  - Indent subtasks for clarity
  - Name categories clearly (Work, Health, Learning)

✗ DON'T:
  - Use unclear abbreviations
  - Leave tasks completely unstructured
  - Mix too many formatting styles
  - Include unrelated text blocks
  - Use single-character bullets inconsistently

KEYWORDS THAT HELP:
  Priority: urgent, asap, critical, important, high priority, must-do
  Timing: today, tomorrow, morning, afternoon, evening, this week, next week
  Work: meeting, standup, code, develop, email, review, deploy, bug, feature
  Health: gym, exercise, workout, yoga, meditation, run, walk, cardio, strength
  Learning: read, study, learn, course, tutorial, documentation, book
  Personal: relax, break, coffee, gaming, hobby, personal, fun, rest
*/

// ========================================
// COPY AND PASTE DIRECTLY INTO MODAL
// ========================================
// The parser handles varied formatting, so paste whatever format your
// schedule is in - ChatGPT, Claude, Google Docs, Outlook calendar, etc.
