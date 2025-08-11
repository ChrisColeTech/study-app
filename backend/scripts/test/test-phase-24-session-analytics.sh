#!/bin/bash
# Test Phase 24: Session Analytics - GET /analytics/sessions/{id}
# Usage: ./test-phase-24-session-analytics.sh [base-url]

set -e

# Configuration
BASE_URL=${1:-"https://t6pkkabhvi.execute-api.us-east-2.amazonaws.com/dev"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../../tests/fixtures/analytics"
TEMP_DIR="/tmp/session-analytics-test-$$"

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
    local endpoint_name=$(echo "$endpoint" | tr '/' '_')
    echo "$body" > "$TEMP_DIR/${endpoint_name}_response.json"
    
    if [[ "$http_code" =~ ^[23] ]]; then
        log_info "✅ Test passed"
        return 0
    else
        log_error "❌ Test failed"
        return 1
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
log_info "Starting Phase 24: Session Analytics Tests"
log_info "Base URL: $BASE_URL"
log_info "Fixtures: $FIXTURES_DIR"

# Test variables for tracking
TOTAL_TESTS=0
PASSED_TESTS=0

# Get session ID from fixture
VALID_SESSION_ID=$(jq -r '.sessionId // "550e8400-e29b-41d4-a716-446655440003"' "$FIXTURES_DIR/get-session-analytics.json" 2>/dev/null)
INVALID_SESSION_ID=$(jq -r '.sessionId // "00000000-0000-0000-0000-000000000000"' "$FIXTURES_DIR/get-session-analytics-not-found.json" 2>/dev/null)

# Test 1: Get Session Analytics - Valid Session
log_info "\n=== Test 1: Get Session Analytics - Valid Session ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "GET" "/v1/analytics/sessions/$VALID_SESSION_ID" "" "Get analytics for existing session"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    
    # Verify response structure
    TOTAL_ANSWERS=$(jq -r '.data.totalAnswers // "not-found"' "$TEMP_DIR/_v1_analytics_sessions_${VALID_SESSION_ID}_response.json" 2>/dev/null)
    CORRECT_ANSWERS=$(jq -r '.data.correctAnswers // "not-found"' "$TEMP_DIR/_v1_analytics_sessions_${VALID_SESSION_ID}_response.json" 2>/dev/null)
    
    if [[ "$TOTAL_ANSWERS" != "not-found" && "$CORRECT_ANSWERS" != "not-found" ]]; then
        log_info "✓ Session analytics structure verified"
        log_info "  Total Answers: $TOTAL_ANSWERS"
        log_info "  Correct Answers: $CORRECT_ANSWERS"
    else
        log_warn "⚠ Session analytics response structure unexpected"
    fi
fi

# Test 2: Get Session Analytics - Non-existent Session
log_info "\n=== Test 2: Get Session Analytics - Non-existent Session ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "GET" "/v1/analytics/sessions/$INVALID_SESSION_ID" "" "Get analytics for non-existent session (should fail)"; then
    log_warn "Expected this test to fail, but it passed"
else
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_info "Test correctly failed as expected"
fi

# Test 3: Get Session Analytics - Invalid Session ID Format
log_info "\n=== Test 3: Get Session Analytics - Invalid ID Format ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "GET" "/v1/analytics/sessions/invalid-id-format" "" "Get analytics with invalid session ID format (should fail)"; then
    log_warn "Expected this test to fail, but it passed"
else
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_info "Test correctly failed as expected"
fi

# Test 4: Session Analytics - Wrong HTTP Method
log_info "\n=== Test 4: Session Analytics - Wrong HTTP Method ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "POST" "/v1/analytics/sessions/$VALID_SESSION_ID" "" "POST request to session analytics (should fail)"; then
    log_warn "Expected this test to fail, but it passed"
else
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_info "Test correctly failed as expected - POST not allowed"
fi

# Test 5: Session Analytics - Missing Session ID
log_info "\n=== Test 5: Session Analytics - Missing Session ID ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "GET" "/v1/analytics/sessions/" "" "Request to session analytics without session ID (should fail)"; then
    log_warn "Expected this test to fail, but it passed"
else
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_info "Test correctly failed as expected - session ID required"
fi

# Test 6: Create a session first, then test its analytics (if session creation works)
log_info "\n=== Test 6: Integration Test - Create Session then Get Analytics ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Try to create a session first
SESSION_DATA='{"examId":"aws-clf-c02","providerId":"aws","sessionType":"practice"}'
echo "$SESSION_DATA" > "$TEMP_DIR/create_session.json"

CREATE_RESPONSE=$(curl -s -w '%{http_code}' -X POST "$BASE_URL/v1/sessions" \
    -H "Content-Type: application/json" \
    -d @"$TEMP_DIR/create_session.json" 2>/dev/null)

CREATE_HTTP_CODE="${CREATE_RESPONSE: -3}"
CREATE_BODY="${CREATE_RESPONSE%???}"

if [[ "$CREATE_HTTP_CODE" =~ ^[23] ]]; then
    NEW_SESSION_ID=$(echo "$CREATE_BODY" | jq -r '.data.session.sessionId // empty' 2>/dev/null)
    if [[ -n "$NEW_SESSION_ID" && "$NEW_SESSION_ID" != "null" ]]; then
        log_info "Created test session: $NEW_SESSION_ID"
        
        # Now try to get analytics for this session
        if test_endpoint "GET" "/v1/analytics/sessions/$NEW_SESSION_ID" "" "Get analytics for newly created session"; then
            PASSED_TESTS=$((PASSED_TESTS + 1))
        fi
    else
        log_warn "Could not extract session ID from create response"
    fi
else
    log_warn "Could not create test session for integration test"
fi

# Summary
log_info "\n=== Phase 24: Session Analytics Test Results ==="
log_info "Total Tests: $TOTAL_TESTS"
log_info "Passed: $PASSED_TESTS"
log_info "Failed: $((TOTAL_TESTS - PASSED_TESTS))"

if [[ $PASSED_TESTS -eq $TOTAL_TESTS ]]; then
    log_info "🎉 All Session Analytics tests passed!"
    log_info "Phase 24 implementation verified working"
    exit 0
else
    log_error "❌ Some Session Analytics tests failed"
    log_error "Phase 24 needs additional work"
    exit 1
fi