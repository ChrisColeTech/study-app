#!/bin/bash
# Test Goals Endpoints Script - Phase 18
# Usage: ./test-goals-endpoints.sh [base-url]

set -e

# Configuration
BASE_URL=${1:-"https://api-dev.study-app.com"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../../tests/fixtures/goals"
TEMP_DIR="/tmp/goals-test-$$"

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

# Extract token from response
extract_token() {
    local response_file=$1
    local token_type=$2
    
    if [[ -f "$response_file" ]]; then
        jq -r ".data.${token_type} // empty" "$response_file" 2>/dev/null || echo ""
    fi
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
log_info "Starting Goals Management Tests"
log_info "Base URL: $BASE_URL"
log_info "Fixtures: $FIXTURES_DIR"

# Test variables for tracking
TOTAL_TESTS=0
PASSED_TESTS=0
GOAL_ID=""

# Test 1: Create Goal
log_info "\n=== Test 1: Create Goal ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "POST" "/v1/goals" "$FIXTURES_DIR/create-goal.json" "Create new study goal"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    # Extract goal ID for subsequent tests
    GOAL_ID=$(jq -r '.data.goal.goalId // empty' "$TEMP_DIR/goals_response.json" 2>/dev/null)
    log_info "Created Goal ID: $GOAL_ID"
fi

# Test 2: Create Goal - Invalid Data
log_info "\n=== Test 2: Create Goal - Invalid Data ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "POST" "/v1/goals" "$FIXTURES_DIR/create-goal-invalid.json" "Create goal with invalid data (should fail)"; then
    # This should actually fail, so if it passes, that's unexpected
    log_warn "Expected this test to fail, but it passed"
else
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_info "Test correctly failed as expected"
fi

# Test 3: List Goals
log_info "\n=== Test 3: List All Goals ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "GET" "/v1/goals" "" "List all goals"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

# Test 4: List Goals with Filters
log_info "\n=== Test 4: List Goals with Filters ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "GET" "/v1/goals?status=active&type=exam_preparation&providerId=aws&priority=high&limit=10" "" "List goals with filters"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

# Test 5: Get Goal Details (if we have a goal ID)
if [[ -n "$GOAL_ID" ]]; then
    log_info "\n=== Test 5: Get Goal Details ==="
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if test_endpoint "GET" "/v1/goals/$GOAL_ID" "" "Get specific goal details"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
fi

# Test 6: Update Goal (if we have a goal ID)
if [[ -n "$GOAL_ID" ]]; then
    log_info "\n=== Test 6: Update Goal Progress ==="
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if test_endpoint "PUT" "/v1/goals/$GOAL_ID" "$FIXTURES_DIR/update-goal.json" "Update goal progress"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
fi

# Test 7: Get Goal Stats
log_info "\n=== Test 7: Get Goal Statistics ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "GET" "/v1/goals/stats" "" "Get goal statistics summary"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

# Test 8: Delete Goal (if we have a goal ID)
if [[ -n "$GOAL_ID" ]]; then
    log_info "\n=== Test 8: Delete Goal ==="
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if test_endpoint "DELETE" "/v1/goals/$GOAL_ID" "" "Delete goal (soft delete)"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
fi

# Test 9: Get Non-existent Goal
log_info "\n=== Test 9: Get Non-existent Goal ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "GET" "/v1/goals/00000000-0000-0000-0000-000000000000" "" "Get non-existent goal (should fail)"; then
    log_warn "Expected this test to fail, but it passed"
else
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_info "Test correctly failed as expected"
fi

# Summary
log_info "\n=== Goals Management Test Results ==="
log_info "Total Tests: $TOTAL_TESTS"
log_info "Passed: $PASSED_TESTS"
log_info "Failed: $((TOTAL_TESTS - PASSED_TESTS))"

if [[ $PASSED_TESTS -eq $TOTAL_TESTS ]]; then
    log_info "🎉 All Goals Management tests passed!"
    exit 0
else
    log_error "❌ Some Goals Management tests failed"
    exit 1
fi