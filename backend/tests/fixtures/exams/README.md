# Exam Test Fixtures

This directory contains JSON fixtures for testing exam-related endpoints. These files eliminate JSON encoding issues when testing from the command line.

## Usage

### Manual Testing with curl
```bash
# Test listing all exams
curl -X GET "https://your-api-url/v1/exams"

# Test listing exams with filters
curl -X GET "https://your-api-url/v1/exams?provider=aws&level=associate"

# Test searching exams
curl -X GET "https://your-api-url/v1/exams?search=solutions"

# Test with pagination
curl -X GET "https://your-api-url/v1/exams?limit=10&offset=0"
```

### Automated Testing
```bash
# Run the complete test suite
npm run test:endpoints

# Or run the exam test script directly
./scripts/test/test-exam-endpoints.sh
```

## Available Fixtures

### Valid Test Cases
- `list-exams.json` - List all exams without filters
- `list-exams-filtered.json` - List exams with provider/level filters
- `list-exams-search.json` - Search exams by name/description
- `list-exams-pagination.json` - Test pagination with limits/offsets

### Invalid Test Cases
- `list-exams-invalid-level.json` - Invalid level filter (400 error)
- `list-exams-invalid-pagination.json` - Invalid pagination parameters (400 error)

## Endpoints Tested

- `GET /v1/exams` - List all available exams across providers

## Benefits

1. **No JSON escaping issues** - Avoid shell quoting problems with special characters
2. **Reusable test data** - Same fixtures work across different testing tools
3. **Version controlled** - Test data is tracked in git
4. **Easy maintenance** - Update test cases by editing JSON files
5. **Consistent testing** - Same data used in manual testing, CI/CD, and automated tests

## Test Data Management

The test script automatically:
- Validates response structure and data types
- Checks for required fields in responses
- Verifies filter functionality works correctly
- Tests error cases and status codes
- Provides colored output for easy result interpretation

## Implementation Status

✅ **Implemented** - Phase 8: Exam Listing Feature completed