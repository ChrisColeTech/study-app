#!/bin/bash

# Test script for Phase 21: Session Completion Feature
# Tests the POST /v1/sessions/{id}/complete endpoint

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-https://your-api-id.execute-api.region.amazonaws.com/dev}"
PROVIDER_ID="aws"
EXAM_ID="saa-c03"

echo "Testing Phase 21: Session Completion Feature"
echo "API Base URL: $API_BASE_URL"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success_count=0
total_tests=0

# Helper function to test API endpoints
test_endpoint() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    
    total_tests=$((total_tests + 1))
    echo -e "\n${YELLOW}Test $total_tests: $test_name${NC}"
    echo "Method: $method"
    echo "Endpoint: $endpoint"
    if [ -n "$data" ]; then
        echo "Data: $data"
    fi
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE_URL$endpoint")
    else
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            "$API_BASE_URL$endpoint")
    fi
    
    # Extract HTTP status and response body
    http_status=$(echo "$response" | tail -n1 | cut -d: -f2)
    response_body=$(echo "$response" | sed '$d')
    
    echo "HTTP Status: $http_status"
    echo "Response: $response_body"
    
    if [ "$http_status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        success_count=$((success_count + 1))
        
        # Parse session ID from response for subsequent tests
        if [[ "$endpoint" == *"/sessions" && "$method" == "POST" ]]; then
            SESSION_ID=$(echo "$response_body" | grep -o '"sessionId":"[^"]*' | cut -d'"' -f4)
            echo "Extracted Session ID: $SESSION_ID"
        fi
    else
        echo -e "${RED}✗ FAIL - Expected status $expected_status, got $http_status${NC}"
    fi
}

# Test 1: Create a session first
echo -e "\n${YELLOW}Setting up test session...${NC}"
test_endpoint \
    "Create Test Session" \
    "POST" \
    "/v1/sessions" \
    '{"examId":"'$EXAM_ID'","providerId":"'$PROVIDER_ID'","sessionType":"practice","questionCount":5}' \
    "200"

if [ -z "$SESSION_ID" ]; then
    echo -e "${RED}Failed to create test session. Exiting.${NC}"
    exit 1
fi

# Test 2: Submit answers to all questions to make session completable
echo -e "\n${YELLOW}Submitting answers to make session completable...${NC}"

# Get session to see questions
session_response=$(curl -s "$API_BASE_URL/v1/sessions/$SESSION_ID")
question_count=$(echo "$session_response" | grep -o '"questionId":"[^"]*' | wc -l)

echo "Session has $question_count questions"

# Submit answers for all questions
for i in $(seq 1 $question_count); do
    # Extract question ID for this question index
    question_id=$(echo "$session_response" | grep -o '"questionId":"[^"]*' | sed -n "${i}p" | cut -d'"' -f4)
    
    if [ -n "$question_id" ]; then
        echo "Submitting answer for question $i (ID: $question_id)"
        curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "{\"questionId\":\"$question_id\",\"answer\":[\"option-0\"],\"timeSpent\":30}" \
            "$API_BASE_URL/v1/sessions/$SESSION_ID/answers" > /dev/null
    fi
done

echo "All answers submitted"

# Test 3: Complete session - Success case
test_endpoint \
    "Complete Session - Success" \
    "POST" \
    "/v1/sessions/$SESSION_ID/complete" \
    "" \
    "200"

# Test 4: Try to complete already completed session
test_endpoint \
    "Complete Already Completed Session" \
    "POST" \
    "/v1/sessions/$SESSION_ID/complete" \
    "" \
    "409"

# Test 5: Try to complete non-existent session
test_endpoint \
    "Complete Non-existent Session" \
    "POST" \
    "/v1/sessions/non-existent-id/complete" \
    "" \
    "404"

# Test 6: Create another session but don't answer all questions
echo -e "\n${YELLOW}Creating session with incomplete answers...${NC}"
test_endpoint \
    "Create Another Test Session" \
    "POST" \
    "/v1/sessions" \
    '{"examId":"'$EXAM_ID'","providerId":"'$PROVIDER_ID'","sessionType":"practice","questionCount":3}' \
    "200"

INCOMPLETE_SESSION_ID=$(echo "$response_body" | grep -o '"sessionId":"[^"]*' | cut -d'"' -f4)

if [ -n "$INCOMPLETE_SESSION_ID" ]; then
    # Test 7: Try to complete session with unanswered questions
    test_endpoint \
        "Complete Session with Unanswered Questions" \
        "POST" \
        "/v1/sessions/$INCOMPLETE_SESSION_ID/complete" \
        "" \
        "400"
fi

# Test 8: Invalid session ID format
test_endpoint \
    "Complete Session - Invalid ID Format" \
    "POST" \
    "/v1/sessions/invalid-id-format/complete" \
    "" \
    "400"

# Summary
echo -e "\n======================================"
echo -e "Test Summary:"
echo -e "Passed: ${GREEN}$success_count${NC}/$total_tests"

if [ $success_count -eq $total_tests ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi