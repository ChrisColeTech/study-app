# Testing Guide

This document outlines the testing patterns and standards for the Study App V3 Backend API.

## Overview

Our testing approach uses JSON fixtures and bash scripts to provide comprehensive endpoint testing without JSON encoding issues. Tests are organized by domain and can be run individually or as a complete suite.

## Testing Philosophy

1. **JSON Fixtures First** - All test data should be stored in JSON files to avoid shell escaping issues
2. **Domain-Grouped Tests** - Tests are organized by functional domain (auth, providers, sessions, etc.)
3. **Automated Token Management** - Test scripts automatically handle token extraction and chaining
4. **Individual and Suite Execution** - Each domain can be tested independently or as part of a full suite
5. **Clear Output** - Color-coded results with detailed response logging
6. **Version Controlled Test Data** - All fixtures are tracked in git for consistency

## Directory Structure

```
backend/
├── tests/
│   ├── fixtures/           # JSON test data organized by domain
│   │   ├── auth/          # Authentication test fixtures
│   │   │   ├── register.json
│   │   │   ├── login.json
│   │   │   ├── refresh.json
│   │   │   └── README.md
│   │   ├── providers/     # Provider management fixtures
│   │   ├── sessions/      # Study session fixtures
│   │   ├── questions/     # Question management fixtures
│   │   └── users/         # User management fixtures
│   └── ...
├── scripts/
│   └── test/              # Test execution scripts
│       ├── test-auth-endpoints.sh
│       ├── test-provider-endpoints.sh
│       ├── test-session-endpoints.sh
│       ├── test-question-endpoints.sh
│       ├── test-user-endpoints.sh
│       └── test-all-endpoints.sh
└── docs/
    └── TESTING.md         # This document
```

## NPM Scripts Convention

Each domain has its own test command, plus a master command to run all tests:

```json
{
  "scripts": {
    "test:endpoints": "./scripts/test/test-all-endpoints.sh",
    "test:endpoints:auth": "./scripts/test/test-auth-endpoints.sh",
    "test:endpoints:providers": "./scripts/test/test-provider-endpoints.sh",
    "test:endpoints:sessions": "./scripts/test/test-session-endpoints.sh",
    "test:endpoints:questions": "./scripts/test/test-question-endpoints.sh",
    "test:endpoints:users": "./scripts/test/test-user-endpoints.sh"
  }
}
```

## Usage Examples

### Run All Endpoint Tests
```bash
npm run test:endpoints
```

### Run Domain-Specific Tests
```bash
npm run test:endpoints:auth
npm run test:endpoints:providers
npm run test:endpoints:sessions
```

### Manual Testing with Fixtures
```bash
# Test with specific fixture
curl -X POST "https://api-url/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/auth/register.json

# Test with authentication
curl -X GET "https://api-url/v1/providers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"
```

## Test Script Standards

All test scripts should follow these patterns:

### 1. Script Header Template
```bash
#!/bin/bash
# Test [Domain] Endpoints Script
# Usage: ./test-[domain]-endpoints.sh [base-url]

set -e

# Configuration
BASE_URL=${1:-"https://default-api-url/dev"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../../tests/fixtures/[domain]"
TEMP_DIR="/tmp/[domain]-test-$$"

# Create temp directory for test results
mkdir -p "$TEMP_DIR"
```

### 2. Logging Functions
```bash
# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}
```

### 3. Test Function Template
```bash
# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data_file=$3
    local description=$4
    local auth_header=$5
    
    log_info "Testing: $description"
    echo "  URL: $method $BASE_URL$endpoint"
    
    local curl_cmd="curl -s -w '%{http_code}' -X $method '$BASE_URL$endpoint' -H 'Content-Type: application/json'"
    
    if [[ -n "$auth_header" ]]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $auth_header'"
    fi
    
    if [[ -n "$data_file" && -f "$data_file" ]]; then
        curl_cmd="$curl_cmd -d @'$data_file'"
        echo "  Data: $(cat "$data_file")"
    fi
    
    local response=$(eval $curl_cmd)
    local http_code="${response: -3}"
    local body="${response%???}"
    
    echo "  HTTP Code: $http_code"
    echo "  Response: $body" | jq . 2>/dev/null || echo "  Response: $body"
    
    # Save response for potential reuse
    local endpoint_name=$(basename "$endpoint")
    echo "$body" > "$TEMP_DIR/${endpoint_name}_response.json"
    
    if [[ "$http_code" =~ ^[23] ]]; then
        log_info "✅ Test passed"
        return 0
    else
        log_error "❌ Test failed"
        return 1
    fi
}
```

### 4. Token Extraction Helper
```bash
# Extract token from response
extract_token() {
    local response_file=$1
    local token_type=$2
    
    if [[ -f "$response_file" ]]; then
        jq -r ".data.${token_type} // empty" "$response_file" 2>/dev/null || echo ""
    fi
}
```

### 5. Cleanup and Dependencies
```bash
# Cleanup function
cleanup() {
    if [[ -d "$TEMP_DIR" ]]; then
        log_info "Cleaning up temporary files..."
        rm -rf "$TEMP_DIR"
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Check dependencies
command -v curl >/dev/null 2>&1 || { log_error "curl is required but not installed. Aborting."; exit 1; }
command -v jq >/dev/null 2>&1 || { log_warn "jq is not installed. JSON formatting will be disabled."; }
```

## Fixture Standards

### 1. File Naming Convention
- `[action].json` - Primary action (e.g., `register.json`, `login.json`)
- `[action]-[scenario].json` - Specific scenarios (e.g., `register-existing.json`, `login-invalid.json`)

### 2. Fixture Organization
Each domain fixture directory should contain:
- **Valid test cases** - Primary happy path scenarios
- **Invalid test cases** - Error conditions and edge cases
- **README.md** - Documentation for the fixtures

### 3. JSON Structure
```json
{
  "comment": "Optional comment explaining the test case",
  "field1": "value1",
  "field2": "value2"
}
```

## Domain Test Patterns

### Authentication Tests
- Registration (valid, existing email, weak password, invalid email)
- Login (valid, invalid credentials, non-existent user)
- Token refresh (valid token, expired token, invalid token)
- Logout (authenticated, unauthenticated)

### Provider Tests
- List providers (all, filtered)
- Get provider details (valid ID, invalid ID)
- Provider search functionality

### Session Tests
- Create session (valid, invalid parameters)
- Get session details (valid ID, invalid ID, unauthorized)
- Update session progress
- Complete session
- List user sessions

### Question Tests
- Get questions (by provider, by exam, filtered)
- Submit answers
- Get question explanations
- Question analytics

### User Tests
- Get user profile (authenticated, unauthenticated)
- Update user profile
- User preferences
- User analytics

## Master Test Suite

The master test script (`test-all-endpoints.sh`) should:

1. **Run all domain tests** in logical order (auth first, then others)
2. **Provide summary results** showing pass/fail counts by domain
3. **Handle authentication dependencies** by running auth tests first and sharing tokens
4. **Generate comprehensive reports** with timing and coverage information
5. **Support environment selection** (dev, staging, prod)

### Master Script Template
```bash
#!/bin/bash
# Master Endpoint Test Suite
# Usage: ./test-all-endpoints.sh [base-url] [environment]

set -e

ENVIRONMENT=${2:-"dev"}
BASE_URL=${1:-"https://api-${ENVIRONMENT}.example.com"}

log_info "Running comprehensive endpoint test suite"
log_info "Environment: $ENVIRONMENT"
log_info "Base URL: $BASE_URL"

# Test order matters - auth first to get tokens
DOMAINS=("auth" "providers" "sessions" "questions" "users")
RESULTS=()

for domain in "${DOMAINS[@]}"; do
    log_info "Testing $domain endpoints..."
    if ./scripts/test/test-${domain}-endpoints.sh "$BASE_URL"; then
        RESULTS+=("✅ $domain")
    else
        RESULTS+=("❌ $domain")
    fi
    echo
done

# Summary
log_info "Test Suite Results:"
for result in "${RESULTS[@]}"; do
    echo "  $result"
done
```

## CI/CD Integration

### GitHub Actions Integration
```yaml
- name: Run Endpoint Tests
  run: |
    npm run test:endpoints
  env:
    API_BASE_URL: ${{ env.API_URL }}
```

### Test Reporting
- Test results should be logged to files for CI consumption
- Failed tests should exit with non-zero codes
- Summary reports should be generated in machine-readable format

## Best Practices

1. **Keep fixtures minimal** - Only include required fields
2. **Use descriptive test names** - Clear intent for each test case
3. **Test both success and failure paths** - Comprehensive coverage
4. **Share authentication tokens** - Avoid redundant login calls
5. **Clean up test data** - Remove temporary files and test users
6. **Document test scenarios** - Clear README files in fixture directories
7. **Version control everything** - All fixtures and scripts in git
8. **Environment awareness** - Support different API environments
9. **Dependency checking** - Verify required tools are installed
10. **Error handling** - Graceful failures with clear error messages

## Future Enhancements

- **Performance testing** - Response time assertions
- **Load testing** - Concurrent request handling
- **Data validation** - Schema validation for responses
- **Test data factories** - Dynamic test data generation
- **Parallel execution** - Run domain tests concurrently
- **Test coverage reporting** - Endpoint coverage metrics
- **Mock data seeding** - Automated test data setup/teardown