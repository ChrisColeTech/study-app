# Goals Fixtures

Test data for goals management system (Phase 18) covering goal creation, updates, listing, and deletion.

## Files Overview

### Goal Management
- `create-goal.json` - Valid goal creation request
- `create-goal-invalid.json` - Invalid goal with missing/invalid fields
- `update-goal.json` - Goal progress update
- `get-goals-filtered.json` - Goal listing with filters (used as query params)

## Goal Types
- `exam_preparation` - Study goals for certification exams
- `skill_building` - General skill improvement goals
- `topic_mastery` - Specific topic/domain mastery
- `streak_maintenance` - Study consistency goals

## Goal Status Values
- `active` - Currently being worked on
- `completed` - Goal achieved
- `paused` - Temporarily suspended
- `abandoned` - No longer pursuing

## Priority Levels
- `high` - Critical goals with near-term deadlines
- `medium` - Important goals with moderate urgency
- `low` - Nice-to-have goals with flexible timelines

## Usage Notes

1. **Target Values** - Typically percentage scores (0-100) or numeric milestones
2. **Current Values** - Progress tracking (starts at 0, updates as user studies)
3. **Dates** - Use ISO 8601 format with timezone
4. **Provider/Exam IDs** - Reference existing providers and exams
5. **Topics** - Use topic IDs that exist in question data

## Test Scenarios

### Valid Operations
- Create goals with all required fields
- Update progress incrementally
- Filter goals by status, type, provider
- Delete goals (soft delete preserves data)

### Error Cases
- Missing required fields (title, targetValue, targetDate)
- Invalid dates and numeric values
- Non-existent provider/exam references
- Invalid status/priority values