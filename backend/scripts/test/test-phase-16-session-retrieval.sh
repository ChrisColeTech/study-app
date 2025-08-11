#!/bin/bash

# Test Phase 16: Session Retrieval - GET /v1/sessions/{id}
# Tests the getSession endpoint implementation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURES_DIR="$PROJECT_ROOT/tests/fixtures/sessions"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Default configuration
BASE_URL="${API_BASE_URL:-http://localhost:3000}"
TIMEOUT="${API_TIMEOUT:-30}"

echo -e "${YELLOW}Testing Phase 16: Session Retrieval (GET /v1/sessions/{id})${NC}"
echo "Base URL: $BASE_URL"
echo "Timeout: ${TIMEOUT}s"
echo "Fixtures: $FIXTURES_DIR"
echo

# Function to run a test
run_test() {
    local test_file="$1"
    local test_name=$(basename "$test_file" .json)
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    echo -n "Testing $test_name: "
    
    if [ ! -f "$test_file" ]; then
        echo -e "${RED}SKIP - Fixture file not found${NC}"
        return
    fi
    
    # Extract test data from JSON
    local method=$(jq -r '.method' "$test_file")
    local path=$(jq -r '.path' "$test_file") 
    local expected_status=$(jq -r '.expectedStatus' "$test_file")
    local url="${BASE_URL}${path}"
    
    # Build curl command
    local curl_cmd="curl -s -w '%{http_code}' -X $method"
    
    # Add headers if present
    if jq -e '.headers' "$test_file" > /dev/null 2>&1; then
        while IFS= read -r header; do
            curl_cmd="$curl_cmd -H '$header'"
        done < <(jq -r '.headers | to_entries[] | "\(.key): \(.value)"' "$test_file")
    fi
    
    # Add body if present (for POST/PUT)
    if jq -e '.body' "$test_file" > /dev/null 2>&1; then
        local body=$(jq -c '.body' "$test_file")
        curl_cmd="$curl_cmd -d '$body' -H 'Content-Type: application/json'"
    fi
    
    curl_cmd="$curl_cmd '$url'"
    
    # Execute request
    local response
    local http_code
    local full_response
    
    # Use timeout and capture both body and status code
    if ! full_response=$(timeout "$TIMEOUT" bash -c "$curl_cmd" 2>/dev/null); then
        echo -e "${RED}FAIL - Request timeout or error${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("$test_name")
        return
    fi
    
    # Split response and status code
    http_code="${full_response: -3}"
    response="${full_response%???}"
    
    # Check status code
    if [ "$http_code" != "$expected_status" ]; then
        echo -e "${RED}FAIL - Expected status $expected_status, got $http_code${NC}"
        echo "Response: $response"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("$test_name")
        return
    fi
    
    # Validate response structure if expected response is provided
    if jq -e '.expectedResponse' "$test_file" > /dev/null 2>&1; then
        # Check if response is valid JSON
        if ! echo "$response" | jq empty 2>/dev/null; then
            echo -e "${RED}FAIL - Invalid JSON response${NC}"
            echo "Response: $response"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            FAILED_TESTS+=("$test_name")
            return
        fi
        
        # Check success field
        local expected_success=$(jq -r '.expectedResponse.success' "$test_file")
        local actual_success=$(echo "$response" | jq -r '.success')
        
        if [ "$expected_success" != "null" ] && [ "$expected_success" != "$actual_success" ]; then
            echo -e "${RED}FAIL - Expected success=$expected_success, got $actual_success${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            FAILED_TESTS+=("$test_name")
            return
        fi
        
        # For successful responses, check data structure
        if [ "$expected_success" = "true" ]; then
            # Check if data field exists and has expected structure
            if ! echo "$response" | jq -e '.data.session.sessionId' >/dev/null 2>&1; then
                echo -e "${RED}FAIL - Missing session data structure${NC}"
                TESTS_FAILED=$((TESTS_FAILED + 1))
                FAILED_TESTS+=("$test_name")
                return
            fi
            
            if ! echo "$response" | jq -e '.data.progress.currentQuestion' >/dev/null 2>&1; then
                echo -e "${RED}FAIL - Missing progress data structure${NC}"
                TESTS_FAILED=$((TESTS_FAILED + 1))
                FAILED_TESTS+=("$test_name")
                return
            fi
        fi
        
        # For error responses, check error structure
        if [ "$expected_success" = "false" ]; then
            if ! echo "$response" | jq -e '.error.code' >/dev/null 2>&1; then
                echo -e "${RED}FAIL - Missing error structure${NC}"
                TESTS_FAILED=$((TESTS_FAILED + 1))
                FAILED_TESTS+=("$test_name")
                return
            fi
        fi
    fi
    
    echo -e "${GREEN}PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

# Check if server is running
echo "Checking if server is running..."
if ! curl -s -f "$BASE_URL/v1/health" >/dev/null 2>&1; then
    echo -e "${RED}ERROR: Server is not running at $BASE_URL${NC}"
    echo "Please start the server first with: npm run dev"
    exit 1
fi
echo -e "${GREEN}Server is running${NC}"
echo

# Run all session retrieval tests
echo "Running Phase 16 Session Retrieval Tests:"
echo "======================================="

# Test basic session retrieval
if [ -f "$FIXTURES_DIR/get-session-basic.json" ]; then
    run_test "$FIXTURES_DIR/get-session-basic.json"
fi

# Test completed session retrieval
if [ -f "$FIXTURES_DIR/get-session-completed.json" ]; then
    run_test "$FIXTURES_DIR/get-session-completed.json"
fi

# Test session not found
if [ -f "$FIXTURES_DIR/get-session-not-found.json" ]; then
    run_test "$FIXTURES_DIR/get-session-not-found.json"
fi

# Test invalid session ID format
if [ -f "$FIXTURES_DIR/get-session-invalid-id.json" ]; then
    run_test "$FIXTURES_DIR/get-session-invalid-id.json"
fi

# Test no authentication
if [ -f "$FIXTURES_DIR/get-session-no-auth.json" ]; then
    run_test "$FIXTURES_DIR/get-session-no-auth.json"
fi

# Test access denied (different user)
if [ -f "$FIXTURES_DIR/get-session-access-denied.json" ]; then
    run_test "$FIXTURES_DIR/get-session-access-denied.json"
fi

echo
echo "======================================="
echo "Phase 16 Test Summary:"
echo "Tests run: $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -gt 0 ]; then
    echo
    echo -e "${RED}Failed tests:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  - $test"
    done
    echo
    exit 1
fi

if [ $TESTS_RUN -eq 0 ]; then
    echo -e "${YELLOW}No tests found to run${NC}"
    exit 1
fi

echo
echo -e "${GREEN}All Phase 16 Session Retrieval tests passed!${NC}"
exit 0