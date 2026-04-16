# NLP Schedule Import Guide

## Overview

The NLP Schedule Import feature allows you to paste text from ChatGPT, Claude, your calendar, or any schedule format and automatically convert it into tasks with XP points, deadlines, and subtasks.

## Features

### Smart Parsing
- Extracts task titles from various text formats
- Recognizes task ordering (numbered lists, bullet points, checkboxes)
- Detects subtasks through indentation or secondary bullets
- Handles multiple text sources and formats

### Activity Categories
Automatically assigns tasks to categories based on keywords:

- **Work**: Meeting, project, code, development, deploy, review, email, report
- **Health**: Exercise, gym, run, walk, yoga, meditation, sleep, eat, fitness
- **Learning**: Read, learn, study, course, tutorial, book, programming languages
- **Personal**: Home, hobby, shopping, clean, organize, call, relax

### XP Point Assignment
Points are automatically calculated based on:

**Explicit Values:**
- `80 XP` or `100 points` in the text

**Keyword-Based (Default):**
- **High (80-100 XP)**: "urgent", "critical", "important", "priority", meetings, deployments
- **Medium (40-60 XP)**: Code reviews, bug fixes, regular work tasks
- **Medium (30-50 XP)**: Exercise, learning activities
- **Low (10-30 XP)**: Emails, breaks, minor tasks

### Timing Detection

The parser recognizes:

| Pattern | Result | Example |
|---------|--------|---------|
| "today", "this morning" | Today's date | Today's meeting |
| "tomorrow", "next morning" | Tomorrow's date | Tomorrow workout |
| "this week", "by Friday" | 3 days from now | Finish by Friday |
| "next week" | 7 days from now | Next week project |
| Specific dates | Extracted as-is | 4/20 (April 20) |

### Priority Levels

Tasks are flagged as:
- **High**: urgent, asap, priority, important, critical, must, high priority
- **Medium**: (default)
- **Low**: optional, nice-to-have, whenever

## Usage Examples

### Example 1: Simple Daily Schedule

**Input:**
```
Monday April 15:
- Sprint planning meeting (10am, urgent)
- Code review 2 PRs
- Lunch break
- Work on feature X
- Evening yoga (30 mins)
- Read documentation
```

**Output:**
```
✓ Sprint planning meeting
   Category: Work | 100 XP | Today | Priority: High

✓ Code review 2 PRs
   Category: Work | 60 XP | Today
   Subtask: PR 1 review
   Subtask: PR 2 review

✓ Work on feature X
   Category: Work | 80 XP | Today

✓ Evening yoga (30 mins)
   Category: Health | 50 XP | Today

✓ Read documentation
   Category: Learning | 40 XP | Today
```

### Example 2: ChatGPT Weekly Plan

**Input:**
```
GPT-Generated Weekly Plan:

Week Overview:
1. [IMPORTANT] Complete React course module 3 - high priority
   - Watch 2 hours of videos
   - Complete coding exercises
   - Review notes

2. Gym routine - 3x this week
   - Monday 6pm: 45min strength training
   - Wednesday 6pm: 45min cardio
   - Friday 6pm: Yoga session

3. Work deliverables (by friday)
   - Feature API endpoint
   - Write unit tests
   - Prepare demo

4. Personal wellness
   - Meditate daily (10 mins)
   - Sleep before 11pm
   - Hydrate (8 glasses water)
```

**Output:**
```
✓ Complete React course module 3
   Category: Learning | 100 XP | This Week | Priority: High
   Subtask: Watch 2 hours of videos
   Subtask: Complete coding exercises
   Subtask: Review notes

✓ Monday 6pm: 45min strength training
   Category: Health | 50 XP | Today

✓ Wednesday 6pm: 45min cardio
   Category: Health | 50 XP | This Week

✓ Friday 6pm: Yoga session
   Category: Health | 45 XP | This Week

✓ Feature API endpoint
   Category: Work | 80 XP | Friday | Priority: High
   Subtask: Write unit tests
   Subtask: Prepare demo

✓ Meditate daily (10 mins)
   Category: Health | 25 XP | Today

✓ Sleep before 11pm
   Category: Health | 10 XP | Daily

✓ Hydrate (8 glasses water)
   Category: Health | 10 XP | Daily
```

### Example 3: Claude-Formatted Schedule

**Input:**
```
Daily Agenda - April 15, 2026

WORK BLOCK 1 (9:00 AM - 12:00 PM)
- Check and respond to emails [routine]
- Attend standup meeting (urgent)
- Debug login issue (critical bug fix)

BREAK (12:00 PM - 1:00 PM)
- Lunch, walk outside

WORK BLOCK 2 (1:00 PM - 5:00 PM)  
- Implement cache layer (high priority)
  → Write caching logic
  → Add unit tests
  → Performance testing
- Code review (medium priority)

PERSONAL (5:00 PM+)
- Hit the gym (45 mins, strength)
- Dinner
- Read book [learning, Next.js Guide]
- Relax and wind down
```

**Output:**
```
✓ Check and respond to emails
   Category: Work | 20 XP | Today

✓ Attend standup meeting
   Category: Work | 80 XP | Today | Priority: High

✓ Debug login issue
   Category: Work | 100 XP | Today | Priority: Critical

✓ Lunch, walk outside
   Category: Personal | 15 XP | Today

✓ Implement cache layer
   Category: Work | 90 XP | Today | Priority: High
   Subtask: Write caching logic
   Subtask: Add unit tests
   Subtask: Performance testing

✓ Code review
   Category: Work | 60 XP | Today

✓ Hit the gym (45 mins, strength)
   Category: Health | 50 XP | Today

✓ Read book [Next.js Guide]
   Category: Learning | 40 XP | Today

✓ Relax and wind down
   Category: Personal | 10 XP | Today
```

## Advanced Features

### Subtask Detection

Subtasks are recognized through:
- **Indentation**: Lines indented 2+ spaces or starting with arrows (→)
- **Secondary bullets**: Lines with →, -, *, or indices under a main task
- **Numbering**: Sub-points like 1.1, 1.2, etc.

Example:
```
Complete project report
  - Research market trends
  - Compile data
  - Write analysis
  → Review with team
  → Get approval
```

Creates:
```
Complete project report (80 XP)
  ✓ Research market trends
  ✓ Compile data
  ✓ Write analysis
  ✓ Review with team
  ✓ Get approval
```

### Reward Suggestions

Based on content keywords, the system suggests rewards:
- Contains "coffee/break" → Suggest "Coffee break"
- Contains "movie/netflix/entertainment" → Suggest "Movie/Entertainment"
- Contains "workout/gym" → Suggest "Gym session"
- Contains "meal/food" → Suggest "Favorite meal"
- Contains "rest/relaxation" → Suggest "Rest day"
- Contains "gaming/fun" → Suggest "Gaming session"
- Contains "nature/walk" → Suggest "Nature walk"

## Tips for Best Results

1. **Use Structure**: Numbered/bulleted lists work best
2. **Include Timing**: Add "today", "tomorrow", "this week", or specific dates
3. **Mention Priority**: Use keywords like "urgent", "important", "asap"
4. **Add Details**: Include category hints in task descriptions
5. **Indent Subtasks**: Use clear indentation for multi-step tasks
6. **Copy Directly**: Paste directly from ChatGPT/Claude without editing

## Supported Formats

✓ Numbered lists (1. 2. 3. or 1) 2) 3))
✓ Bullet points (-, *, •)
✓ Checkboxes ([ ], ( ))
✓ Markdown headers (# ## ###)
✓ Indented text
✓ Mixed formatting
✓ Plain text with dates

## Limitations

- Parsing is rule-based (not ML), so complex natural language has limits
- Recurring tasks (like "every Monday") create single tasks (future: expand)
- Time extraction only for timing, not duration (captured in description)
- Custom XP weights not yet editable in UI (future feature)

## Future Enhancements

- [ ] ML-based parsing with spaCy or transformers
- [ ] OpenAI API integration for perfect parsing
- [ ] Custom category and XP weights
- [ ] Recurring task detection and creation
- [ ] Time/duration extraction as task properties
- [ ] Calendar integration (Google Calendar, Outlook)
- [ ] Multi-language support
