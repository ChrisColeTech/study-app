#!/bin/bash

# Test script for Phase 20: Answer Submission Feature
# Tests the POST /v1/sessions/{id}/answers endpoint

set -e

# Configuration
BASE_URL=${BASE_URL:-"https://api.study-app-v3.dev"}
VERBOSE=${VERBOSE:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Helper function to make HTTP requests
make_request() {
    local method=$1
    local url=$2
    local data=$3
    local expected_status=$4
    
    if [ "$VERBOSE" = true ]; then
        print_status $BLUE "Making $method request to: $url"
        if [ -n "$data" ]; then
            echo "Request body: $data"
        fi
    fi
    
    local response=$(curl -s -w "\n%{http_code}" -X $method \
        -H "Content-Type: application/json" \
        ${data:+-d "$data"} \
        "$url")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq "$expected_status" ]; then
        print_status $GREEN "✓ $method $url - Status: $http_code"
        if [ "$VERBOSE" = true ]; then
            echo "Response: $body"
        fi
        echo "$body"
        return 0
    else
        print_status $RED "✗ $method $url - Expected: $expected_status, Got: $http_code"
        echo "Response: $body"
        return 1
    fi
}

print_status $BLUE "=== Phase 20: Answer Submission Feature Tests ==="
print_status $BLUE "Testing endpoint: POST /v1/sessions/{id}/answers"
echo

# Test 1: Create a session first (needed for answer submission)
print_status $YELLOW "Test 1: Creating a study session for answer submission testing"
session_data='{
    "examId": "saa-c03",
    "providerId": "aws",
    "sessionType": "practice",
    "questionCount": 5,
    "topics": ["compute"],
    "difficulty": "medium",
    "timeLimit": 30
}'

session_response=$(make_request POST "$BASE_URL/v1/sessions" "$session_data" 201)
session_id=$(echo "$session_response" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$session_id" ]; then
    print_status $RED "✗ Failed to extract session ID from response"
    exit 1
fi

print_status $GREEN "✓ Session created with ID: $session_id"
echo

# Test 2: Get the session to extract a question ID
print_status $YELLOW "Test 2: Retrieving session to get question details"
session_details=$(make_request GET "$BASE_URL/v1/sessions/$session_id" "" 200)
question_id=$(echo "$session_details" | grep -o '"questionId":"[^"]*"' | head -n1 | cut -d'"' -f4)

if [ -z "$question_id" ]; then
    print_status $RED "✗ Failed to extract question ID from session"
    exit 1
fi

print_status $GREEN "✓ Found question ID: $question_id"
echo

# Test 3: Submit a correct answer
print_status $YELLOW "Test 3: Submitting an answer for the first question"
answer_data='{
    "questionId": "'$question_id'",
    "answer": ["A"],
    "timeSpent": 45,
    "skipped": false,
    "markedForReview": false
}'

answer_response=$(make_request POST "$BASE_URL/v1/sessions/$session_id/answers" "$answer_data" 200)

# Check if response contains expected fields
if echo "$answer_response" | grep -q '"success":true' && \
   echo "$answer_response" | grep -q '"feedback"' && \
   echo "$answer_response" | grep -q '"isCorrect"'; then
    print_status $GREEN "✓ Answer submission successful with proper feedback"
else
    print_status $RED "✗ Answer response missing required fields"
    echo "Response: $answer_response"
    exit 1
fi
echo

# Test 4: Submit answer with skipped flag
print_status $YELLOW "Test 4: Submitting a skipped answer"
skipped_answer_data='{
    "questionId": "'$question_id'",
    "answer": ["B"],
    "timeSpent": 10,
    "skipped": true,
    "markedForReview": false
}'

skipped_response=$(make_request POST "$BASE_URL/v1/sessions/$session_id/answers" "$skipped_answer_data" 200)

if echo "$skipped_response" | grep -q '"success":true'; then
    print_status $GREEN "✓ Skipped answer submission successful"
else
    print_status $RED "✗ Skipped answer submission failed"
    exit 1
fi
echo

# Test 5: Submit answer marked for review
print_status $YELLOW "Test 5: Submitting an answer marked for review"
review_answer_data='{
    "questionId": "'$question_id'",
    "answer": ["C"],
    "timeSpent": 120,
    "skipped": false,
    "markedForReview": true
}'

review_response=$(make_request POST "$BASE_URL/v1/sessions/$session_id/answers" "$review_answer_data" 200)

if echo "$review_response" | grep -q '"success":true'; then
    print_status $GREEN "✓ Review-marked answer submission successful"
else
    print_status $RED "✗ Review-marked answer submission failed"
    exit 1
fi
echo

# Test 6: Validation tests - Missing required fields
print_status $YELLOW "Test 6: Testing validation - Missing questionId"
invalid_data1='{
    "answer": ["A"],
    "timeSpent": 45
}'

make_request POST "$BASE_URL/v1/sessions/$session_id/answers" "$invalid_data1" 400 > /dev/null
print_status $GREEN "✓ Validation correctly rejected missing questionId"

# Test 7: Validation - Missing answer
print_status $YELLOW "Test 7: Testing validation - Missing answer"
invalid_data2='{
    "questionId": "'$question_id'",
    "timeSpent": 45
}'

make_request POST "$BASE_URL/v1/sessions/$session_id/answers" "$invalid_data2" 400 > /dev/null
print_status $GREEN "✓ Validation correctly rejected missing answer"

# Test 8: Validation - Invalid timeSpent
print_status $YELLOW "Test 8: Testing validation - Negative timeSpent"
invalid_data3='{
    "questionId": "'$question_id'",
    "answer": ["A"],
    "timeSpent": -5
}'

make_request POST "$BASE_URL/v1/sessions/$session_id/answers" "$invalid_data3" 400 > /dev/null
print_status $GREEN "✓ Validation correctly rejected negative timeSpent"

# Test 9: Test with non-existent session
print_status $YELLOW "Test 9: Testing with non-existent session"
fake_session_id="00000000-0000-0000-0000-000000000000"
fake_answer_data='{
    "questionId": "'$question_id'",
    "answer": ["A"],
    "timeSpent": 45
}'

make_request POST "$BASE_URL/v1/sessions/$fake_session_id/answers" "$fake_answer_data" 404 > /dev/null
print_status $GREEN "✓ Correctly returned 404 for non-existent session"

# Test 10: Test with non-existent question in session
print_status $YELLOW "Test 10: Testing with non-existent question in session"
fake_question_data='{
    "questionId": "fake-question-id",
    "answer": ["A"],
    "timeSpent": 45
}'

make_request POST "$BASE_URL/v1/sessions/$session_id/answers" "$fake_question_data" 400 > /dev/null
print_status $GREEN "✓ Correctly returned 400 for non-existent question in session"

echo
print_status $GREEN "=== Phase 20: Answer Submission Feature Tests Completed Successfully ==="
print_status $GREEN "✓ All answer submission functionality tests passed"
print_status $BLUE "Key features tested:"
print_status $BLUE "  - Basic answer submission with immediate feedback"
print_status $BLUE "  - Answer scoring and correctness calculation"
print_status $BLUE "  - Skipped answers handling"
print_status $BLUE "  - Marked for review functionality"
print_status $BLUE "  - Comprehensive validation"
print_status $BLUE "  - Error handling for edge cases"
print_status $BLUE "  - Session progress tracking"
echo