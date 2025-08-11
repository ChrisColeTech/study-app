# Topic Test Fixtures

This directory contains test fixtures for the topic endpoints.

## Files

- `list-topics.json` - Basic list all topics
- `list-topics-filtered.json` - List topics with various filters
- `list-topics-search.json` - Search topics by keyword
- `list-topics-provider.json` - Filter by provider
- `list-topics-exam.json` - Filter by exam
- `list-topics-level.json` - Filter by certification level

## Test Data Structure

Each fixture follows this structure:

```json
{
  "description": "Test case description",
  "request": {
    "method": "GET",
    "path": "/v1/topics",
    "queryParams": {}
  },
  "expectedResponse": {
    "statusCode": 200,
    "body": {
      "success": true,
      "data": {
        "topics": [],
        "total": 0,
        "filters": {}
      }
    }
  }
}
```

## Usage

These fixtures are used by the test scripts in `/scripts/test/` to validate the topic endpoints.