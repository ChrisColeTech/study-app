# Provider Test Fixtures

This directory contains JSON fixtures for testing provider-related endpoints. These files eliminate JSON encoding issues when testing from the command line.

## Usage

### Manual Testing with curl
```bash
# Test listing all providers
curl -X GET "https://your-api-url/v1/providers"

# Test listing providers with filters
curl -X GET "https://your-api-url/v1/providers?category=cloud&status=active"

# Test getting specific provider
curl -X GET "https://your-api-url/v1/providers/aws"

# Test refreshing cache
curl -X POST "https://your-api-url/v1/providers/cache/refresh"
```

### Automated Testing
```bash
# Run the complete test suite
npm run test:endpoints

# Or run the provider test script directly
./scripts/test/test-provider-endpoints.sh
```

## Available Fixtures

### Valid Test Cases
- `list-providers.json` - List all providers without filters
- `list-providers-filtered.json` - List providers with category/status filters
- `list-providers-search.json` - Search providers by name
- `get-provider-aws.json` - Get AWS provider with certifications
- `get-provider-azure.json` - Get Azure provider without certifications
- `refresh-cache.json` - Refresh provider cache

### Invalid Test Cases
- `get-provider-invalid-id.json` - Non-existent provider (404 error)
- `get-provider-bad-format.json` - Invalid provider ID format (400 error)
- `list-providers-invalid-category.json` - Invalid category filter (400 error)

## Endpoints Tested

- `GET /v1/providers` - List all available exam providers
- `GET /v1/providers/{id}` - Get specific provider details
- `POST /v1/providers/cache/refresh` - Refresh provider cache (admin endpoint)

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

✅ **Implemented** - Phase 6: Provider Listing Feature completed