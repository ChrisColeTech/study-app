# Question Test Fixtures

This directory contains test fixtures for question endpoints in the Study App V3 Backend.

## Search Fixtures (Phase 14)

### Basic Search Tests
- `search-questions-basic.json` - Basic search with query only
- `search-questions-with-filters.json` - Search with comprehensive filters and options
- `search-questions-pagination.json` - Search with pagination parameters
- `search-questions-no-results.json` - Search that returns no results

### Error Cases
- `search-questions-missing-query.json` - Missing required query parameter
- `search-questions-empty-query.json` - Empty query string
- `search-questions-invalid-body.json` - Invalid JSON in request body
- `search-questions-invalid-filters.json` - Invalid filter values

## Existing Fixtures (Phases 12-13)

### List Questions
- `list-questions.json` - Basic question listing
- `list-questions-filtered.json` - Questions with filters applied
- `list-questions-pagination.json` - Questions with pagination
- `list-questions-search.json` - Questions with basic search (different from Phase 14 advanced search)
- `list-questions-provider-exam.json` - Questions filtered by provider and exam
- `list-questions-by-tags.json` - Questions filtered by tags

### Get Question
- `get-question-basic.json` - Get single question by ID
- `get-question-minimal.json` - Get question with minimal fields
- `get-question-no-explanation.json` - Question without explanation
- `get-question-no-metadata.json` - Question without metadata

### Error Cases
- `get-question-not-found.json` - Question ID not found
- `get-question-invalid-id.json` - Invalid question ID format
- `get-question-missing-id.json` - Missing question ID parameter
- `list-questions-invalid-difficulty.json` - Invalid difficulty filter
- `list-questions-invalid-type.json` - Invalid type filter
- `list-questions-invalid-pagination.json` - Invalid pagination parameters

## Usage

These fixtures are used by the test scripts in `/scripts/test/` to validate:
- API endpoint responses
- Request validation
- Error handling  
- Data structure compliance
- Business logic correctness

Each fixture contains:
- `description`: Human-readable test description
- `method`: HTTP method (GET/POST)
- `endpoint`: API endpoint path
- `requestBody`: Request body for POST requests
- `queryParams`: Query parameters for GET requests
- `expectedStatus`: Expected HTTP status code
- `expectedFields`: Required fields in successful responses
- `expectedError`: Expected error structure for failure cases
- `validation`: Additional validation rules specific to the test