#!/bin/bash

# Test script for session endpoints (Phase 15: Session Creation Feature)
# Usage: ./test-session-endpoints.sh [base-url]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:3000}"
FIXTURES_DIR="$(dirname "$0")/../../tests/fixtures/sessions"
TEMP_DIR="/tmp/session-tests"

# Test statistics
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Create temp directory
mkdir -p "$TEMP_DIR"

echo -e "${BLUE}=== Study App V3 - Session Endpoints Test Suite ===${NC}"
echo -e "${BLUE}Base URL: $BASE_URL${NC}"
echo -e "${BLUE}Fixtures: $FIXTURES_DIR${NC}"
echo ""

# Function to print colored output
print_status() {
  local status=$1
  local message=$2
  case $status in
    "PASS") echo -e "${GREEN}✓ PASS${NC} $message" ;;
    "FAIL") echo -e "${RED}✗ FAIL${NC} $message" ;;
    "SKIP") echo -e "${YELLOW}⊘ SKIP${NC} $message" ;;
    "INFO") echo -e "${BLUE}ℹ INFO${NC} $message" ;;
  esac
}

# Function to get JWT token for authentication
get_jwt_token() {
  local auth_fixture="$(dirname "$0")/../../tests/fixtures/auth/login.json"
  
  if [ ! -f "$auth_fixture" ]; then
    print_status "FAIL" "Auth fixture not found: $auth_fixture"
    return 1
  fi
  
  local response=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d @"$auth_fixture")
  
  local token=$(echo "$response" | jq -r '.data.tokens.access // empty')
  
  if [ -z "$token" ] || [ "$token" = "null" ]; then
    print_status "FAIL" "Failed to get JWT token. Response: $response"
    return 1
  fi
  
  echo "$token"
}

# Function to run a single test case
run_test() {
  local fixture_file=$1
  local test_name=$(basename "$fixture_file" .json)
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  print_status "INFO" "Running test: $test_name"
  
  if [ ! -f "$fixture_file" ]; then
    print_status "FAIL" "Fixture file not found: $fixture_file"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
  
  # Parse fixture
  local method=$(jq -r '.method' "$fixture_file")
  local path=$(jq -r '.path' "$fixture_file")
  local requires_auth=$(jq -r '.requiresAuth // false' "$fixture_file")
  local expected_status=$(jq -r '.expectedStatus' "$fixture_file")
  local body=$(jq -c '.body // {}' "$fixture_file")
  
  # Build curl command
  local curl_cmd="curl -s -w \"\n%{http_code}\" -X $method"
  
  # Add headers
  curl_cmd="$curl_cmd -H \"Content-Type: application/json\""
  
  # Add authentication if required
  if [ "$requires_auth" = "true" ]; then
    local jwt_token=$(get_jwt_token)
    if [ $? -ne 0 ]; then
      print_status "FAIL" "Could not obtain JWT token"
      FAILED_TESTS=$((FAILED_TESTS + 1))
      return 1
    fi
    curl_cmd="$curl_cmd -H \"Authorization: Bearer $jwt_token\""
  fi
  
  # Add body for POST/PUT requests
  if [ "$method" = "POST" ] || [ "$method" = "PUT" ]; then
    if [ "$body" != "{}" ]; then
      echo "$body" > "$TEMP_DIR/request_body.json"
      curl_cmd="$curl_cmd -d @\"$TEMP_DIR/request_body.json\""
    fi
  fi
  
  # Add URL
  curl_cmd="$curl_cmd \"$BASE_URL$path\""
  
  # Execute request
  local response_file="$TEMP_DIR/response_$test_name.txt"
  eval "$curl_cmd" > "$response_file" 2>/dev/null
  
  if [ $? -ne 0 ]; then
    print_status "FAIL" "Request failed for $test_name"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
  
  # Extract status code and response body
  local actual_status=$(tail -n 1 "$response_file")
  local response_body=$(head -n -1 "$response_file")
  
  # Save response for debugging
  echo "$response_body" > "$TEMP_DIR/response_body_$test_name.json"
  
  # Check status code
  if [ "$actual_status" != "$expected_status" ]; then
    print_status "FAIL" "$test_name - Expected status $expected_status, got $actual_status"
    echo "Response: $response_body"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
  
  # Validate JSON response
  if ! echo "$response_body" | jq . > /dev/null 2>&1; then
    print_status "FAIL" "$test_name - Invalid JSON response"
    echo "Response: $response_body"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
  
  # Check response structure for successful requests
  if [ "$expected_status" -ge 200 ] && [ "$expected_status" -lt 300 ]; then
    local success_field=$(echo "$response_body" | jq -r '.success // false')
    local data_field=$(echo "$response_body" | jq -r '.data // empty')
    
    if [ "$success_field" != "true" ]; then
      print_status "FAIL" "$test_name - Success field should be true"
      echo "Response: $response_body"
      FAILED_TESTS=$((FAILED_TESTS + 1))
      return 1
    fi
    
    if [ -z "$data_field" ] || [ "$data_field" = "null" ]; then
      print_status "FAIL" "$test_name - Data field should not be empty"
      echo "Response: $response_body"
      FAILED_TESTS=$((FAILED_TESTS + 1))
      return 1
    fi
  fi
  
  # Check response structure for error requests
  if [ "$expected_status" -ge 400 ]; then
    local success_field=$(echo "$response_body" | jq -r '.success // true')
    local error_field=$(echo "$response_body" | jq -r '.error // empty')
    
    if [ "$success_field" != "false" ]; then
      print_status "FAIL" "$test_name - Success field should be false for errors"
      echo "Response: $response_body"
      FAILED_TESTS=$((FAILED_TESTS + 1))
      return 1
    fi
    
    if [ -z "$error_field" ] || [ "$error_field" = "null" ]; then
      print_status "FAIL" "$test_name - Error field should not be empty"
      echo "Response: $response_body"
      FAILED_TESTS=$((FAILED_TESTS + 1))
      return 1
    fi
  fi
  
  print_status "PASS" "$test_name"
  PASSED_TESTS=$((PASSED_TESTS + 1))
}

# Main test execution
echo -e "${YELLOW}Starting session endpoint tests...${NC}"
echo ""

# Test 1: Valid session creation
run_test "$FIXTURES_DIR/create-session.json"

# Test 2: Minimal session creation
run_test "$FIXTURES_DIR/create-session-minimal.json"

# Test 3: Missing authentication
run_test "$FIXTURES_DIR/create-session-no-auth.json"

# Test 4: Invalid request body
run_test "$FIXTURES_DIR/create-session-invalid.json"

# Test 5: Invalid provider
run_test "$FIXTURES_DIR/create-session-invalid-provider.json"

# Test 6: Invalid exam
run_test "$FIXTURES_DIR/create-session-invalid-exam.json"

# Test 7: Invalid session type
run_test "$FIXTURES_DIR/create-session-invalid-session-type.json"

# Test 8: Excessive question count
run_test "$FIXTURES_DIR/create-session-excessive-questions.json"

# Test results
echo ""
echo -e "${BLUE}=== Test Results ===${NC}"
echo -e "Total tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}All tests passed! 🎉${NC}"
  cleanup_temp_files
  exit 0
else
  echo -e "${RED}Some tests failed! ❌${NC}"
  echo -e "${YELLOW}Check response files in: $TEMP_DIR${NC}"
  exit 1
fi

# Cleanup function
cleanup_temp_files() {
  if [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi
}