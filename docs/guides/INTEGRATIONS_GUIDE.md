# PANaCEa Integrations Guide

Complete guide to all ecosystem integrations available in PANaCEa.

## Table of Contents

1. [Overview](#overview)
2. [Anki Export](#anki-export)
3. [Calendar Sync](#calendar-sync)
4. [Todoist Integration](#todoist-integration)
5. [Trello Boards](#trello-boards)
6. [Notion/Obsidian Widgets](#notionobsidian-widgets)
7. [Troubleshooting](#troubleshooting)

---

## Overview

PANaCEa integrates with your favorite productivity and study tools to create a comprehensive learning ecosystem. Export your study plan, track progress, and review questions across multiple platforms.

### Why Multiple Integrations?

- **Different tools for different needs**: Use Anki for spaced repetition, calendars for scheduling, task managers for tracking, and widgets for at-a-glance progress
- **Seamless workflow**: Study where you're most comfortable
- **Cross-platform**: Access your study materials on any device
- **No lock-in**: Export your data to any format

---

## Anki Export

Export missed or flagged questions to Anki for spaced repetition review.

### Features

- **Smart Filtering**: Export only missed questions, flagged questions, or both
- **APKG Format**: Direct import into Anki desktop or mobile
- **Pre-configured Decks**: Automatic deck naming and organization
- **Spaced Repetition**: Leverage Anki's proven SRS algorithm

### How to Use

1. Navigate to **Integrations** → **Anki Export**
2. Select which questions to export (missed, flagged, or both)
3. Choose deck name (default: "PANaCEa-PANCE-Review")
4. Click **Download Anki Package**
5. In Anki, go to **File** → **Import** and select the downloaded `.apkg` file

### Tips

- Export questions by organ system for focused review
- Create separate decks for different study phases
- Use Anki's custom study feature for targeted practice
- Sync with AnkiWeb for mobile access

---

## Calendar Sync

Generate a complete study schedule synced with Google Calendar, Outlook, or Apple Calendar.

### Features

- **Automated Scheduling**: Daily study blocks based on your exam date
- **Weekly Organization**: Topics distributed across available weeks
- **Smart Review Periods**: Final 2 weeks reserved for intensive review
- **iCalendar Format**: Universal compatibility with all calendar apps

### How to Use

1. Navigate to **Integrations** → **Calendar Sync**
2. Enter your PANCE exam date
3. Review the generated study plan
4. Click **Download Calendar File (.ics)**
5. Import into your calendar app:
   - **Google Calendar**: Settings → Import & Export → Import
   - **Outlook**: File → Open & Export → Import/Export
   - **Apple Calendar**: File → Import

### Schedule Structure

- **Morning Sessions (9-11 AM)**: 2-hour deep study blocks
- **Afternoon Practice (4-5 PM)**: 1-hour question practice (weekdays)
- **Weekly Milestones**: End-of-week review sessions
- **Final Phase**: Last 2 weeks for comprehensive review

### Tips

- Set calendar reminders 1 day before each study session
- Color-code by organ system for visual tracking
- Adjust times to fit your personal schedule
- Share with study partners for accountability

---

## Todoist Integration

Export your study plan and review tasks to Todoist for smart task management.

### Features

- **Priority Levels**: P4 (Critical) for exam day, P3 (High) for weekly goals, P2 (Medium) for daily sessions
- **Smart Labels**: Auto-tagged by activity type (@study, @practice, @review, @exam)
- **Topic Tags**: Organ system labels for filtering (@cardiology, @pulmonary, etc.)
- **CSV Import**: Easy import via Todoist's built-in feature

### How to Use

1. Navigate to **Integrations** → **Todoist**
2. Choose export mode:
   - **Study Plan Only**: Weekly schedule based on exam date
   - **Missed Questions Only**: Review tasks for wrong answers
   - **Complete Package**: Both study plan and reviews
3. Set your exam date (if exporting study plan)
4. Click **Download Todoist CSV**
5. In Todoist:
   - Go to Settings → Integrations → Import from template
   - Select "Import from CSV"
   - Upload the downloaded file

### Export Modes

#### Study Plan Mode
- Exam day task (P4 priority)
- Weekly overview tasks (P3 priority)
- Daily study sessions (P2 priority)
- Daily practice questions (P2 priority, weekdays only)

#### Missed Questions Mode
- Review tasks grouped by topic
- Spread across the week for manageable workload
- P3 priority for timely completion
- Includes question count for each topic

### Tips

- Use Todoist's natural language for quick editing ("tomorrow at 9am")
- Create filters by label to focus on specific systems
- Track karma points for motivation
- Enable calendar integration for dual visibility

---

## Trello Boards

Create a visual Kanban board to track your study progress through each phase.

### Features

- **6-List Structure**: Overview, To Do, In Progress, Weak Areas, Completed, Resources
- **Visual Progress**: Drag cards as you complete topics
- **Color Labels**: Categorize by priority, system, or activity type
- **Checklists**: Break down study sessions into actionable items

### How to Use

1. Navigate to **Integrations** → **Trello**
2. Enter your PANCE exam date
3. Review the board structure preview
4. Click **Download Board JSON**
5. Click **Create Board in Trello** to open Trello
6. Manually create the board using the JSON as a template

### Board Structure

#### 🎯 Exam Overview
- Exam date card with countdown
- Study plan summary
- Overall strategy

#### 📚 To Do
- Upcoming study weeks
- Future topics to cover
- Planned milestones

#### ⚡ In Progress
- Current week's focus
- Active study sessions
- Weekly goals checklist

#### 🔴 Weak Areas
- Topics requiring extra attention
- Missed question patterns
- Re-study priorities

#### ✅ Completed
- Finished topics
- Archived study modules
- Completed weeks

#### 📖 Resources
- Study materials links
- Reference guides
- Study technique reminders

### Tips

- Use checklists for daily study goals
- Add due dates for weekly milestones
- Use labels to filter by organ system
- Add comments to track insights and notes
- Invite study partners for collaboration
- Use mobile app for on-the-go updates

---

## Notion/Obsidian Widgets

Embed live widgets in your note-taking apps for at-a-glance progress tracking.

### Features

- **Streak Widget**: Current and longest study streaks
- **Question of Day**: Daily review question from missed topics
- **Stats Summary**: Total questions, accuracy, and correct answers
- **Theme Support**: Light and dark mode
- **Auto-refresh**: Updates automatically as you study

### How to Use

#### For Notion

1. Navigate to **Integrations** → **Widgets**
2. Select widget type (Streak, Question of Day, or Stats)
3. Choose theme (Light or Dark)
4. Select embed format: **HTML (Notion)**
5. Copy the embed code
6. In Notion:
   - Type `/embed` in your page
   - Paste the widget URL
   - Click "Embed link"

#### For Obsidian

1. Navigate to **Integrations** → **Widgets**
2. Select widget type
3. Choose theme
4. Select embed format: **Obsidian**
5. Copy the code block
6. Paste into your Obsidian note
7. Switch to preview mode to see the widget

### Widget Types

#### Streak Widget
- Current streak in days
- Longest streak achieved
- Last study date
- Visual fire emoji for motivation

#### Question of Day
- One missed question displayed daily
- Topic and system tags
- Multiple choice options
- Encouragement to review in PANaCEa

#### Stats Summary
- Total questions answered
- Overall accuracy percentage
- Total correct answers
- Color-coded metrics

### Server-Hosted Widgets

Widgets are now served from PANaCEa servers (not data URIs) for:
- ✅ Notion security compatibility
- ✅ Real-time data updates
- ✅ Better caching and performance
- ✅ Cross-origin resource sharing (CORS) support

### Widget URLs

```
Streak:         https://yourserver.com/widgets/streak/USER_ID?theme=light
Question:       https://yourserver.com/widgets/question-of-day/USER_ID?theme=dark
Stats:          https://yourserver.com/widgets/stats/USER_ID?theme=light
```

Replace `USER_ID` with your actual user ID and `yourserver.com` with your PANaCEa server URL.

### Tips

- Use widgets in your daily dashboard for quick motivation
- Switch to dark theme for late-night studying
- Refresh Notion page to update widget data
- Combine multiple widgets for comprehensive overview
- Add widgets to weekly note templates

---

## Troubleshooting

### Anki Import Issues

**Problem**: Anki won't import the deck
- **Solution**: Ensure you have Anki 2.1.49 or later
- **Solution**: Try "Import" instead of "Import from backup"

**Problem**: Questions appear empty
- **Solution**: Re-download the APKG file and try again
- **Solution**: Check that you have questions in the export filter

### Calendar Import Issues

**Problem**: Calendar events don't show up
- **Solution**: Check calendar date range (events may be in future)
- **Solution**: Verify .ics file downloaded completely
- **Solution**: Try importing to a new calendar first

**Problem**: Times are wrong
- **Solution**: Calendar uses UTC times - adjust to your timezone
- **Solution**: Edit individual events after import

### Todoist Import Issues

**Problem**: CSV import fails
- **Solution**: Ensure file is saved as `.csv` not `.txt`
- **Solution**: Use Todoist web version, not mobile app
- **Solution**: Check file wasn't corrupted during download

**Problem**: Tasks have wrong dates
- **Solution**: Todoist interprets dates relative to import time
- **Solution**: Manually adjust if needed after import

### Trello Import Issues

**Problem**: Can't import JSON directly
- **Solution**: Trello doesn't support direct JSON import
- **Solution**: Use JSON as template to manually create board
- **Solution**: Consider using Trello Power-Up for import

**Problem**: Board structure looks wrong
- **Solution**: Double-check you're using latest export version
- **Solution**: Manually reorganize lists after creation

### Widget Display Issues

**Problem**: Widget shows "Database not configured"
- **Solution**: Ensure server is running with DATABASE_URL set
- **Solution**: Verify you're using correct server URL
- **Solution**: Check CORS settings if accessing from Notion

**Problem**: Widget shows outdated data
- **Solution**: Refresh the Notion page
- **Solution**: Clear browser cache
- **Solution**: Check server widget endpoint is accessible

**Problem**: Widget doesn't display in Notion
- **Solution**: Use server-hosted widget URLs, not data URIs
- **Solution**: Verify URL is publicly accessible
- **Solution**: Check Notion hasn't blocked the domain

### General Issues

**Problem**: Features are grayed out
- **Solution**: Complete some questions first to generate data
- **Solution**: Set your exam date in settings
- **Solution**: Check internet connection

**Problem**: Export file is empty
- **Solution**: Ensure you have data to export (questions, exam date, etc.)
- **Solution**: Try a different export mode
- **Solution**: Check browser console for errors

---

## Best Practices

### Integration Strategy

1. **Start with Calendar**: Set your exam date and generate schedule first
2. **Daily Tracking**: Use Todoist or Trello for day-to-day task management
3. **Spaced Repetition**: Export to Anki weekly for long-term retention
4. **At-a-Glance**: Add widgets to your workspace dashboard
5. **Review Regularly**: Re-export as you progress through study phases

### Workflow Example

**Week Start:**
- Check Trello board for current week's topics
- Move current week card to "In Progress"
- Review Todoist tasks for the week

**Daily:**
- Check Notion widget for study streak
- Complete PANaCEa study session
- Mark off Todoist daily tasks
- Update Trello weak areas if needed

**Week End:**
- Export new missed questions to Anki
- Move completed week to "Completed" in Trello
- Review progress in calendar
- Adjust next week's schedule if needed

### Data Sync

- **Export frequency**: Weekly for Anki, after major changes for others
- **Calendar**: Re-export if exam date changes
- **Widgets**: Update automatically, no manual sync needed
- **Todoist/Trello**: One-time export at study start, manual updates after

---

## Future Integrations (Coming Soon)

- **Notion Database Sync**: Two-way sync with Notion databases
- **Quizlet Export**: Create flashcard sets from questions
- **Google Sheets**: Export performance data for analysis
- **Slack/Discord**: Study reminder bots
- **Apple Reminders**: Native iOS integration
- **Microsoft To Do**: Alternative to Todoist

---

## Support

For integration issues:
1. Check [Troubleshooting](#troubleshooting) section above
2. Review app documentation
3. Contact PANaCEa support
4. Join study community for peer help

---

**Last Updated**: December 2024  
**Version**: 1.0.0
