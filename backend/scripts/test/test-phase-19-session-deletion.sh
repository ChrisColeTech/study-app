#!/bin/bash

# Test Phase 19: Session Deletion Feature
# Tests the DELETE /sessions/{id} endpoint

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
FIXTURES_DIR="../../tests/fixtures/sessions"

echo -e "${BLUE}=== Phase 19: Session Deletion Test ===${NC}"
echo -e "${BLUE}Base URL: $BASE_URL${NC}"
echo -e "${BLUE}Fixtures: $FIXTURES_DIR${NC}"
echo

# Function to make HTTP requests and handle responses
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="$4"
    local test_name="$5"

    echo -e "${BLUE}ℹ INFO${NC} Running test: $test_name"

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" || echo -e "\n000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            "$BASE_URL$endpoint" || echo -e "\n000")
    fi

    # Split response body and status code
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} $test_name (Status: $status_code)"
        if [ -n "$body" ]; then
            echo -e "${GREEN}Response:${NC} $body" | jq '.' 2>/dev/null || echo "$body"
        fi
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} $test_name (Expected: $expected_status, Got: $status_code)"
        if [ -n "$body" ]; then
            echo -e "${RED}Response:${NC} $body"
        fi
        return 1
    fi
}

# Test Case 1: Create a session first to have something to delete
echo -e "${YELLOW}Test 1: Creating a session to delete${NC}"
create_data='{"examId":"saa-c03","providerId":"aws","sessionType":"practice","questionCount":10}'
create_response=$(make_request "POST" "/v1/sessions" "$create_data" "200" "create-session-for-deletion")

if [ $? -eq 0 ]; then
    # Extract session ID from response
    session_id=$(echo "$create_response" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4 || echo "")
    
    if [ -n "$session_id" ]; then
        echo -e "${GREEN}Session created with ID: $session_id${NC}"
        
        # Test Case 2: Delete the session
        echo -e "\n${YELLOW}Test 2: Deleting the session${NC}"
        make_request "DELETE" "/v1/sessions/$session_id" "" "200" "delete-session"
        
        # Test Case 3: Try to get the deleted session (should fail)
        echo -e "\n${YELLOW}Test 3: Verifying session is deleted${NC}"
        make_request "GET" "/v1/sessions/$session_id" "" "404" "get-deleted-session"
        
        # Test Case 4: Try to delete the same session again (should fail)
        echo -e "\n${YELLOW}Test 4: Deleting already deleted session${NC}"
        make_request "DELETE" "/v1/sessions/$session_id" "" "404" "delete-nonexistent-session"
        
    else
        echo -e "${RED}✗ FAIL${NC} Could not extract session ID from create response"
        exit 1
    fi
else
    echo -e "${RED}✗ FAIL${NC} Could not create session for testing"
    exit 1
fi

# Test Case 5: Delete with invalid session ID format
echo -e "\n${YELLOW}Test 5: Deleting with invalid session ID format${NC}"
make_request "DELETE" "/v1/sessions/invalid-id" "" "400" "delete-invalid-format"

# Test Case 6: Delete non-existent session
echo -e "\n${YELLOW}Test 6: Deleting non-existent session${NC}"
fake_uuid="550e8400-e29b-41d4-a716-446655440000"
make_request "DELETE" "/v1/sessions/$fake_uuid" "" "404" "delete-nonexistent-valid-uuid"

echo -e "\n${BLUE}=== Phase 19 Session Deletion Tests Complete ===${NC}"