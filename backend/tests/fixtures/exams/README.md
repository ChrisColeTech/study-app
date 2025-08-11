# Exam Test Fixtures

This directory contains JSON fixtures for testing exam-related endpoints in Phase 8: Exam Listing Feature. These files eliminate JSON encoding issues when testing from the command line.

## Usage

### Manual Testing with curl
```bash
# Test listing all exams
curl -X GET "https://your-api-url/v1/exams"

# Test listing exams with filters
curl -X GET "https://your-api-url/v1/exams?category=cloud&level=associate&sortBy=difficulty"

# Test getting specific exam
curl -X GET "https://your-api-url/v1/exams/aws-aws-saa-c03"

# Test searching exams
curl -X GET "https://your-api-url/v1/exams/search?q=cloud&fuzzy=true"

# Test comparing exams
curl -X POST "https://your-api-url/v1/exams/compare" \
  -H "Content-Type: application/json" \
  -d @compare-exams.json

# Test getting provider-specific exams
curl -X GET "https://your-api-url/v1/providers/aws/exams"

# Test refreshing cache
curl -X POST "https://your-api-url/v1/exams/cache/refresh"
```

### Automated Testing
```bash
# Run the complete test suite
npm run test:endpoints

# Or run the exam test script directly
./scripts/test/test-exam-endpoints.sh
```

## Available Fixtures

### Valid Test Cases - Listing & Filtering
- `list-exams.json` - List all exams without filters
- `list-exams-filtered-category.json` - Filter exams by category (cloud)
- `list-exams-filtered-level.json` - Filter exams by certification level (associate)
- `list-exams-filtered-provider.json` - Filter exams by provider (AWS)
- `list-exams-filtered-difficulty.json` - Filter exams by difficulty range
- `list-exams-filtered-cost.json` - Filter exams by cost range
- `list-exams-filtered-duration.json` - Filter exams by duration range
- `list-exams-sorted.json` - List exams with sorting (by difficulty, ascending)
- `list-exams-paginated.json` - List exams with pagination
- `list-exams-comprehensive-filters.json` - Multiple filters combined

### Valid Test Cases - Individual Exams
- `get-exam-aws-saa.json` - Get AWS Solutions Architect Associate exam
- `get-exam-azure-az900.json` - Get Azure Fundamentals exam
- `get-exam-with-questions.json` - Get exam with question statistics
- `get-exam-with-resources.json` - Get exam with study resources

### Valid Test Cases - Search
- `search-exams-basic.json` - Basic text search for "cloud"
- `search-exams-fuzzy.json` - Fuzzy search with typos
- `search-exams-filtered.json` - Search with additional filters
- `search-exams-advanced.json` - Advanced multi-term search

### Valid Test Cases - Comparison
- `compare-exams-two.json` - Compare two exams (minimum case)
- `compare-exams-multiple.json` - Compare five exams
- `compare-exams-same-provider.json` - Compare exams from same provider
- `compare-exams-different-levels.json` - Compare exams of different levels

### Valid Test Cases - Provider-specific
- `get-provider-exams-aws.json` - Get all AWS exams
- `get-provider-exams-filtered.json` - Get provider exams with filters
- `get-provider-exams-azure.json` - Get all Azure exams

### Valid Test Cases - Cache Management
- `refresh-exam-cache.json` - Refresh exam cache

### Invalid Test Cases - Validation Errors
- `get-exam-invalid-id.json` - Non-existent exam ID (404 error)
- `get-exam-bad-format.json` - Invalid exam ID format (400 error)
- `list-exams-invalid-category.json` - Invalid category filter (400 error)
- `list-exams-invalid-level.json` - Invalid certification level (400 error)
- `list-exams-invalid-difficulty.json` - Invalid difficulty range (400 error)
- `list-exams-invalid-pagination.json` - Invalid pagination parameters (400 error)
- `search-exams-missing-query.json` - Search without query parameter (400 error)
- `compare-exams-insufficient.json` - Compare with only one exam (400 error)
- `compare-exams-too-many.json` - Compare with more than 10 exams (400 error)
- `compare-exams-invalid-ids.json` - Compare with non-existent exam IDs (404 error)
- `get-provider-exams-invalid-provider.json` - Non-existent provider (404 error)

## Endpoints Tested

### Primary Exam Endpoints
- `GET /v1/exams` - List all exams with comprehensive filtering
- `GET /v1/exams/{id}` - Get detailed exam information
- `GET /v1/exams/search` - Advanced exam search functionality
- `POST /v1/exams/compare` - Multi-exam comparison
- `GET /v1/providers/{providerId}/exams` - Provider-specific exams
- `POST /v1/exams/cache/refresh` - Refresh exam cache

### Filter Parameters Supported
- **Text Search**: `search` - Search in exam names, descriptions, topics
- **Provider**: `providerId` - Filter by specific provider
- **Category**: `category` - cloud, security, networking, etc.
- **Level**: `level` - foundational, associate, professional, expert
- **Difficulty**: `difficultyMin`, `difficultyMax` - 1-5 scale
- **Cost**: `costMin`, `costMax` - Price range filtering
- **Duration**: `durationMin`, `durationMax` - Exam duration in minutes
- **Languages**: `languages` - Comma-separated language list
- **Format**: `format` - multiple_choice, simulation, etc.
- **Market Demand**: `marketDemand` - high, medium, low
- **Status**: `status` - active, inactive, retired

### Sorting Options
- `sortBy` - name, provider, difficulty, cost, duration, popularity
- `sortOrder` - asc, desc

### Pagination
- `limit` - Number of results (1-100)
- `offset` - Starting position

## Benefits

1. **Comprehensive Coverage** - Tests all filtering, sorting, and search capabilities
2. **No JSON escaping issues** - Avoid shell quoting problems with special characters
3. **Reusable test data** - Same fixtures work across different testing tools
4. **Version controlled** - Test data is tracked in git
5. **Easy maintenance** - Update test cases by editing JSON files
6. **Consistent testing** - Same data used in manual testing, CI/CD, and automated tests
7. **Error case coverage** - Tests both success and failure scenarios

## Test Data Management

The test script automatically:
- Validates response structure and data types for all exam endpoints
- Checks for required fields in exam objects
- Verifies filtering functionality works correctly across all supported parameters
- Tests search functionality including fuzzy matching and relevance scoring
- Validates exam comparison logic and recommendations
- Tests error cases and appropriate HTTP status codes
- Provides colored output for easy result interpretation
- Measures response times for performance validation

## Implementation Status

🚧 **In Progress** - Phase 8: Exam Listing Feature

### Completed Features
- ✅ Comprehensive exam types and interfaces
- ✅ ExamService with S3 integration and caching
- ✅ ExamHandler with all endpoints
- ✅ ServiceFactory integration
- ✅ Advanced filtering and sorting capabilities
- ✅ Text search with relevance scoring
- ✅ Multi-exam comparison functionality
- ✅ Provider-specific exam listing
- ✅ Test fixtures for all scenarios

### In Progress
- 🔄 Test scripts and automation
- 🔄 Integration testing
- 🔄 Performance optimization
- 🔄 Documentation updates

### Future Enhancements
- 📋 Question-level statistics integration
- 📋 AI-powered exam recommendations
- 📋 Study plan generation
- 📋 Progress tracking integration