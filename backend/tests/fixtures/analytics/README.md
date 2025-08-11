# Analytics Fixtures

Test data for analytics endpoints covering progress tracking, session analytics, and performance analytics.

## Files Overview

### Progress Analytics (Phase 23)
- `get-progress-analytics.json` - Valid progress analytics request with filtering
- `get-progress-analytics-minimal.json` - Minimal request with default parameters

### Session Analytics (Phase 24) 
- `get-session-analytics.json` - Valid session analytics request
- `get-session-analytics-not-found.json` - Non-existent session for error testing

### Performance Analytics (Phase 25)
- `get-performance-analytics.json` - Valid performance analytics with competency matrix
- `get-performance-analytics-invalid.json` - Invalid timeframe for error testing

## Usage Notes

1. **Session IDs** - Use valid UUIDs from existing session fixtures
2. **Date Ranges** - All dates use ISO 8601 format with timezone
3. **Timeframes** - Valid values: 'week', 'month', 'quarter', 'year', 'all'
4. **Provider/Exam IDs** - Use consistent IDs from providers/exams fixtures
5. **Topics** - Use topic IDs that exist in the question data

## Test Patterns

### Valid Requests
- Include realistic date ranges and filtering parameters
- Use existing provider/exam/topic IDs for referential integrity
- Test both minimal and fully-specified requests

### Error Cases
- Invalid timeframes and date formats
- Non-existent session/provider/exam IDs
- Invalid parameter combinations
- Missing required fields

## Integration Notes

These fixtures support the analytics endpoints that aggregate data from:
- Completed study sessions
- User progress records  
- Question performance history
- Topic competency calculations