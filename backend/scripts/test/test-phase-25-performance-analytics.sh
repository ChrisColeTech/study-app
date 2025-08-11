#!/bin/bash
# Test Phase 25: Performance Analytics - GET /analytics/performance
# Usage: ./test-phase-25-performance-analytics.sh [base-url]

set -e

# Configuration
BASE_URL=${1:-"https://t6pkkabhvi.execute-api.us-east-2.amazonaws.com/dev"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../../tests/fixtures/analytics"
TEMP_DIR="/tmp/performance-analytics-test-$$"

# Create temp directory for test results
mkdir -p "$TEMP_DIR"

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
    local endpoint_name=$(echo "$endpoint" | tr '/' '_' | tr '?' '_')
    echo "$body" > "$TEMP_DIR/${endpoint_name}_response.json"
    
    if [[ "$http_code" =~ ^[23] ]]; then
        log_info "✅ Test passed"
        return 0
    else
        log_error "❌ Test failed"
        return 1
    fi
}

# URL encode query parameters
url_encode() {
    local string="$1"
    echo "$string" | sed 's/ /%20/g; s/\[/%5B/g; s/\]/%5D/g; s/,/%2C/g'
}

# Build query string from JSON fixture
build_query_from_fixture() {
    local fixture_file=$1
    local query=""
    
    if [[ -f "$fixture_file" ]]; then
        local timeframe=$(jq -r '.timeframe // empty' "$fixture_file" 2>/dev/null)
        local providerId=$(jq -r '.providerId // empty' "$fixture_file" 2>/dev/null)
        local startDate=$(jq -r '.startDate // empty' "$fixture_file" 2>/dev/null)
        local endDate=$(jq -r '.endDate // empty' "$fixture_file" 2>/dev/null)
        local topics=$(jq -r '.topics[]? // empty' "$fixture_file" 2>/dev/null | paste -sd, -)
        
        [[ -n "$timeframe" ]] && query="timeframe=$timeframe"
        [[ -n "$providerId" ]] && query="${query:+$query&}providerId=$providerId"
        [[ -n "$startDate" ]] && query="${query:+$query&}startDate=$(url_encode "$startDate")"
        [[ -n "$endDate" ]] && query="${query:+$query&}endDate=$(url_encode "$endDate")"
        [[ -n "$topics" ]] && query="${query:+$query&}topics=$(url_encode "$topics")"
    fi
    
    echo "$query"
}

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

# Test execution
log_info "Starting Phase 25: Performance Analytics Tests"
log_info "Base URL: $BASE_URL"
log_info "Fixtures: $FIXTURES_DIR"

# Test variables for tracking
TOTAL_TESTS=0
PASSED_TESTS=0

# Test 1: Get Performance Analytics - Basic Request
log_info "\n=== Test 1: Get Performance Analytics - Basic Request ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "GET" "/v1/analytics/performance" "" "Get basic performance analytics"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    
    # Verify response structure
    ACCURACY=$(jq -r '.data.accuracy // "not-found"' "$TEMP_DIR/_v1_analytics_performance_response.json" 2>/dev/null)
    AVERAGE_TIME=$(jq -r '.data.averageTime // "not-found"' "$TEMP_DIR/_v1_analytics_performance_response.json" 2>/dev/null)
    
    if [[ "$ACCURACY" != "not-found" && "$AVERAGE_TIME" != "not-found" ]]; then
        log_info "✓ Performance analytics structure verified"
        log_info "  Accuracy: $ACCURACY"
        log_info "  Average Time: $AVERAGE_TIME"
    else
        log_warn "⚠ Performance analytics response structure unexpected"
    fi
fi

# Test 2: Get Performance Analytics - With Filters
log_info "\n=== Test 2: Get Performance Analytics - With Filters ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
QUERY_PARAMS=$(build_query_from_fixture "$FIXTURES_DIR/get-performance-analytics.json")
if [[ -n "$QUERY_PARAMS" ]]; then
    ENDPOINT="/v1/analytics/performance?$QUERY_PARAMS"
    if test_endpoint "GET" "$ENDPOINT" "" "Get performance analytics with filtering"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
else
    log_warn "Could not build query parameters from fixture"
fi

# Test 3: Get Performance Analytics - Invalid Timeframe
log_info "\n=== Test 3: Get Performance Analytics - Invalid Timeframe ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
INVALID_QUERY="timeframe=invalid-timeframe&providerId=aws"
if test_endpoint "GET" "/v1/analytics/performance?$INVALID_QUERY" "" "Get analytics with invalid timeframe (should fail)"; then
    log_warn "Expected this test to fail, but it passed"
else
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_info "Test correctly failed as expected"
fi

# Test 4: Performance Analytics - Wrong HTTP Method
log_info "\n=== Test 4: Performance Analytics - Wrong HTTP Method ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "POST" "/v1/analytics/performance" "$FIXTURES_DIR/get-performance-analytics.json" "POST request to performance analytics (should fail)"; then
    log_warn "Expected this test to fail, but it passed"
else
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_info "Test correctly failed as expected - POST not allowed"
fi

# Test 5: Performance Analytics - Date Range Query
log_info "\n=== Test 5: Performance Analytics - Date Range Query ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
DATE_QUERY="startDate=2025-07-01T00:00:00.000Z&endDate=2025-08-11T23:59:59.999Z&timeframe=month"
if test_endpoint "GET" "/v1/analytics/performance?$DATE_QUERY" "" "Get analytics with date range"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

# Test 6: Performance Analytics - Provider Specific
log_info "\n=== Test 6: Performance Analytics - Provider Specific ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
PROVIDER_QUERY="providerId=aws&timeframe=quarter"
if test_endpoint "GET" "/v1/analytics/performance?$PROVIDER_QUERY" "" "Get analytics for specific provider"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

# Test 7: Performance Analytics - Topics Filter
log_info "\n=== Test 7: Performance Analytics - Topics Filter ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
TOPICS_QUERY="topics=security,compute,storage&providerId=aws"
if test_endpoint "GET" "/v1/analytics/performance?$TOPICS_QUERY" "" "Get analytics filtered by topics"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

# Test 8: Performance Analytics - Invalid Date Format
log_info "\n=== Test 8: Performance Analytics - Invalid Date Format ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
INVALID_DATE_QUERY="startDate=invalid-date&endDate=also-invalid"
if test_endpoint "GET" "/v1/analytics/performance?$INVALID_DATE_QUERY" "" "Get analytics with invalid date format (should fail)"; then
    log_warn "Expected this test to fail, but it passed"
else
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_info "Test correctly failed as expected"
fi

# Summary
log_info "\n=== Phase 25: Performance Analytics Test Results ==="
log_info "Total Tests: $TOTAL_TESTS"
log_info "Passed: $PASSED_TESTS"
log_info "Failed: $((TOTAL_TESTS - PASSED_TESTS))"

if [[ $PASSED_TESTS -eq $TOTAL_TESTS ]]; then
    log_info "🎉 All Performance Analytics tests passed!"
    log_info "Phase 25 implementation verified working"
    exit 0
else
    log_error "❌ Some Performance Analytics tests failed"
    log_error "Phase 25 needs additional work"
    exit 1
fi