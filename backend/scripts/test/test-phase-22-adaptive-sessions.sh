#!/bin/bash
# Test Phase 22: Adaptive Sessions - POST /sessions/adaptive
# Usage: ./test-phase-22-adaptive-sessions.sh [base-url]

set -e

# Configuration
BASE_URL=${1:-"https://api-dev.study-app.com"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../../tests/fixtures/sessions"
TEMP_DIR="/tmp/adaptive-sessions-test-$$"

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
log_info "Starting Phase 22: Adaptive Sessions Tests"
log_info "Base URL: $BASE_URL"
log_info "Fixtures: $FIXTURES_DIR"

# Test variables for tracking
TOTAL_TESTS=0
PASSED_TESTS=0
SESSION_ID=""

# Test 1: Create Adaptive Session - Valid Request
log_info "\n=== Test 1: Create Adaptive Session - Valid Request ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "POST" "/v1/sessions/adaptive" "$FIXTURES_DIR/create-adaptive-session.json" "Create adaptive session with difficulty adjustment"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    # Extract session ID for potential follow-up tests
    SESSION_ID=$(jq -r '.data.session.sessionId // empty' "$TEMP_DIR/adaptive_response.json" 2>/dev/null)
    log_info "Created Adaptive Session ID: $SESSION_ID"
    
    # Verify adaptive flag is set
    IS_ADAPTIVE=$(jq -r '.data.session.isAdaptive // false' "$TEMP_DIR/adaptive_response.json" 2>/dev/null)
    if [[ "$IS_ADAPTIVE" == "true" ]]; then
        log_info "✓ Adaptive flag correctly set"
    else
        log_warn "⚠ Adaptive flag not set in response"
    fi
fi

# Test 2: Create Adaptive Session - Invalid Session Type
log_info "\n=== Test 2: Create Adaptive Session - Invalid Session Type ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "POST" "/v1/sessions/adaptive" "$FIXTURES_DIR/create-adaptive-session-invalid.json" "Create adaptive session with invalid session type (should fail)"; then
    log_warn "Expected this test to fail, but it passed"
else
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_info "Test correctly failed as expected"
fi

# Test 3: Create Adaptive Session - Minimal Request
log_info "\n=== Test 3: Create Adaptive Session - Minimal Request ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
# Create minimal adaptive session data inline
cat > "$TEMP_DIR/minimal-adaptive.json" << EOF
{
  "comment": "Minimal adaptive session request",
  "examId": "aws-clf-c02",
  "providerId": "aws", 
  "sessionType": "practice"
}
EOF
if test_endpoint "POST" "/v1/sessions/adaptive" "$TEMP_DIR/minimal-adaptive.json" "Create adaptive session with minimal data"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

# Test 4: Verify Adaptive Question Selection (if we have a session)
if [[ -n "$SESSION_ID" ]]; then
    log_info "\n=== Test 4: Verify Adaptive Session Details ==="
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if test_endpoint "GET" "/v1/sessions/$SESSION_ID" "" "Get adaptive session details to verify structure"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        
        # Check if session has adaptive-specific fields
        DIFFICULTY_DISTRIBUTION=$(jq -r '.data.session.adaptiveConfig.difficultyDistribution // "not-found"' "$TEMP_DIR/${SESSION_ID}_response.json" 2>/dev/null)
        if [[ "$DIFFICULTY_DISTRIBUTION" != "not-found" ]]; then
            log_info "✓ Adaptive configuration found in session"
        else
            log_warn "⚠ Adaptive configuration not found in session details"
        fi
    fi
fi

# Test 5: Compare Adaptive vs Regular Session Creation
log_info "\n=== Test 5: Compare with Regular Session Creation ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
# Create same request but to regular sessions endpoint
if test_endpoint "POST" "/v1/sessions" "$FIXTURES_DIR/create-adaptive-session.json" "Create regular session with same data for comparison"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    
    REGULAR_SESSION_ID=$(jq -r '.data.session.sessionId // empty' "$TEMP_DIR/sessions_response.json" 2>/dev/null)
    REGULAR_IS_ADAPTIVE=$(jq -r '.data.session.isAdaptive // false' "$TEMP_DIR/sessions_response.json" 2>/dev/null)
    
    log_info "Regular Session ID: $REGULAR_SESSION_ID"
    log_info "Regular Session isAdaptive: $REGULAR_IS_ADAPTIVE"
    
    if [[ "$REGULAR_IS_ADAPTIVE" == "false" ]]; then
        log_info "✓ Regular session correctly marked as non-adaptive"
    else
        log_warn "⚠ Regular session incorrectly marked as adaptive"
    fi
fi

# Test 6: Invalid HTTP Method
log_info "\n=== Test 6: Invalid HTTP Method ==="
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if test_endpoint "GET" "/v1/sessions/adaptive" "" "GET request to adaptive endpoint (should fail)"; then
    log_warn "Expected this test to fail, but it passed"
else
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_info "Test correctly failed as expected - GET not allowed"
fi

# Summary
log_info "\n=== Phase 22: Adaptive Sessions Test Results ==="
log_info "Total Tests: $TOTAL_TESTS"
log_info "Passed: $PASSED_TESTS"
log_info "Failed: $((TOTAL_TESTS - PASSED_TESTS))"

if [[ $PASSED_TESTS -eq $TOTAL_TESTS ]]; then
    log_info "🎉 All Adaptive Sessions tests passed!"
    log_info "Phase 22 implementation verified working"
    exit 0
else
    log_error "❌ Some Adaptive Sessions tests failed"
    log_error "Phase 22 needs additional work"
    exit 1
fi