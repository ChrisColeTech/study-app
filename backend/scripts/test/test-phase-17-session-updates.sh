#!/bin/bash

# Test script for Phase 17: Session Update Feature
# Tests PUT /v1/sessions/{id} endpoint

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="https://api.studyapp.dev"
TEST_EMAIL="testuser@example.com"
TEST_PASSWORD="TestPassword123!"

echo -e "${BLUE}=== Phase 17: Session Update Feature Tests ===${NC}"
echo "Testing PUT /v1/sessions/{id} endpoint"
echo

# Function to make API calls with error handling
make_api_call() {
    local method=$1
    local endpoint=$2
    local headers=$3
    local data=$4
    local description=$5
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Method: $method"
    echo "Endpoint: $endpoint"
    
    if [ -n "$data" ]; then
        echo "Payload: $data"
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            $headers \
            -d "$data" \
            "$API_BASE_URL$endpoint")
    else
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            $headers \
            "$API_BASE_URL$endpoint")
    fi
    
    # Split response body and HTTP status
    http_body=$(echo "$response" | sed '$d')
    http_status=$(echo "$response" | tail -n1 | sed 's/HTTP_STATUS://')
    
    echo "Status: $http_status"
    echo "Response:"
    echo "$http_body" | jq . 2>/dev/null || echo "$http_body"
    echo
    
    # Return status for conditional logic
    return $http_status
}

# Step 1: Login to get authentication token
echo -e "${BLUE}Step 1: Authenticating user${NC}"
login_payload="{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}"
make_api_call "POST" "/v1/auth/login" "" "$login_payload" "User login"
token=$(echo "$http_body" | jq -r '.data.tokens.accessToken' 2>/dev/null)

if [ "$token" = "null" ] || [ -z "$token" ]; then
    echo -e "${RED}❌ Failed to get authentication token${NC}"
    exit 1
fi

auth_header="-H \"Authorization: Bearer $token\""
echo -e "${GREEN}✅ Authentication successful${NC}"
echo

# Step 2: Create a test session
echo -e "${BLUE}Step 2: Creating test session${NC}"
create_session_payload='{
    "examId": "saa-c03",
    "providerId": "aws",
    "sessionType": "practice",
    "questionCount": 5,
    "difficulty": "medium"
}'

make_api_call "POST" "/v1/sessions" "$auth_header" "$create_session_payload" "Create test session"
if [ $? -ne 201 ]; then
    echo -e "${RED}❌ Failed to create test session${NC}"
    exit 1
fi

session_id=$(echo "$http_body" | jq -r '.data.session.sessionId' 2>/dev/null)
if [ "$session_id" = "null" ] || [ -z "$session_id" ]; then
    echo -e "${RED}❌ Failed to get session ID from response${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Test session created: $session_id${NC}"
echo

# Step 3: Test pause session
echo -e "${BLUE}Step 3: Testing pause session${NC}"
pause_payload='{"action": "pause"}'
make_api_call "PUT" "/v1/sessions/$session_id" "$auth_header" "$pause_payload" "Pause active session"
if [ $? -ne 200 ]; then
    echo -e "${RED}❌ Failed to pause session${NC}"
else
    echo -e "${GREEN}✅ Session paused successfully${NC}"
fi
echo

# Step 4: Test resume session
echo -e "${BLUE}Step 4: Testing resume session${NC}"
resume_payload='{"action": "resume"}'
make_api_call "PUT" "/v1/sessions/$session_id" "$auth_header" "$resume_payload" "Resume paused session"
if [ $? -ne 200 ]; then
    echo -e "${RED}❌ Failed to resume session${NC}"
else
    echo -e "${GREEN}✅ Session resumed successfully${NC}"
fi
echo

# Step 5: Test navigation - next question
echo -e "${BLUE}Step 5: Testing next question navigation${NC}"
next_payload='{"action": "next"}'
make_api_call "PUT" "/v1/sessions/$session_id" "$auth_header" "$next_payload" "Navigate to next question"
if [ $? -ne 200 ]; then
    echo -e "${RED}❌ Failed to navigate to next question${NC}"
else
    echo -e "${GREEN}✅ Navigated to next question successfully${NC}"
fi
echo

# Step 6: Test navigation - previous question
echo -e "${BLUE}Step 6: Testing previous question navigation${NC}"
previous_payload='{"action": "previous"}'
make_api_call "PUT" "/v1/sessions/$session_id" "$auth_header" "$previous_payload" "Navigate to previous question"
if [ $? -ne 200 ]; then
    echo -e "${RED}❌ Failed to navigate to previous question${NC}"
else
    echo -e "${GREEN}✅ Navigated to previous question successfully${NC}"
fi
echo

# Step 7: Get first question ID for answer testing
echo -e "${BLUE}Step 7: Getting session details for question ID${NC}"
make_api_call "GET" "/v1/sessions/$session_id" "$auth_header" "" "Get session details"
if [ $? -ne 200 ]; then
    echo -e "${RED}❌ Failed to get session details${NC}"
    exit 1
fi

question_id=$(echo "$http_body" | jq -r '.data.questions[0].questionId' 2>/dev/null)
if [ "$question_id" = "null" ] || [ -z "$question_id" ]; then
    echo -e "${RED}❌ Failed to get question ID from session${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Got question ID: $question_id${NC}"
echo

# Step 8: Test submitting an answer
echo -e "${BLUE}Step 8: Testing submit answer${NC}"
answer_payload="{
    \"action\": \"answer\",
    \"questionId\": \"$question_id\",
    \"userAnswer\": [\"0\"],
    \"timeSpent\": 45,
    \"skipped\": false,
    \"markedForReview\": false
}"
make_api_call "PUT" "/v1/sessions/$session_id" "$auth_header" "$answer_payload" "Submit answer to question"
if [ $? -ne 200 ]; then
    echo -e "${RED}❌ Failed to submit answer${NC}"
else
    echo -e "${GREEN}✅ Answer submitted successfully${NC}"
fi
echo

# Step 9: Test marking question for review
echo -e "${BLUE}Step 9: Testing mark for review${NC}"
review_payload="{
    \"action\": \"mark_for_review\",
    \"questionId\": \"$question_id\",
    \"markedForReview\": true
}"
make_api_call "PUT" "/v1/sessions/$session_id" "$auth_header" "$review_payload" "Mark question for review"
if [ $? -ne 200 ]; then
    echo -e "${RED}❌ Failed to mark question for review${NC}"
else
    echo -e "${GREEN}✅ Question marked for review successfully${NC}"
fi
echo

# Step 10: Test complete session
echo -e "${BLUE}Step 10: Testing complete session${NC}"
complete_payload='{"action": "complete"}'
make_api_call "PUT" "/v1/sessions/$session_id" "$auth_header" "$complete_payload" "Complete session"
if [ $? -ne 200 ]; then
    echo -e "${RED}❌ Failed to complete session${NC}"
else
    echo -e "${GREEN}✅ Session completed successfully${NC}"
fi
echo

# Step 11: Test invalid operations on completed session
echo -e "${BLUE}Step 11: Testing invalid operations on completed session${NC}"
invalid_pause_payload='{"action": "pause"}'
make_api_call "PUT" "/v1/sessions/$session_id" "$auth_header" "$invalid_pause_payload" "Try to pause completed session (should fail)"
if [ $? -eq 400 ] || [ $? -eq 409 ]; then
    echo -e "${GREEN}✅ Correctly rejected operation on completed session${NC}"
else
    echo -e "${RED}❌ Should have rejected operation on completed session${NC}"
fi
echo

# Error condition tests
echo -e "${BLUE}=== Error Condition Tests ===${NC}"

# Test 12: Missing session ID
echo -e "${BLUE}Step 12: Testing missing session ID${NC}"
make_api_call "PUT" "/v1/sessions/" "$auth_header" "$pause_payload" "Update session without ID (should fail)"
if [ $? -eq 400 ] || [ $? -eq 404 ]; then
    echo -e "${GREEN}✅ Correctly rejected request with missing session ID${NC}"
else
    echo -e "${RED}❌ Should have rejected request with missing session ID${NC}"
fi
echo

# Test 13: Invalid session ID format
echo -e "${BLUE}Step 13: Testing invalid session ID format${NC}"
make_api_call "PUT" "/v1/sessions/invalid-id-format" "$auth_header" "$pause_payload" "Update session with invalid ID format (should fail)"
if [ $? -eq 400 ]; then
    echo -e "${GREEN}✅ Correctly rejected request with invalid session ID format${NC}"
else
    echo -e "${RED}❌ Should have rejected request with invalid session ID format${NC}"
fi
echo

# Test 14: Invalid action
echo -e "${BLUE}Step 14: Testing invalid action${NC}"
invalid_action_payload='{"action": "invalid_action"}'
make_api_call "PUT" "/v1/sessions/$session_id" "$auth_header" "$invalid_action_payload" "Update session with invalid action (should fail)"
if [ $? -eq 400 ]; then
    echo -e "${GREEN}✅ Correctly rejected request with invalid action${NC}"
else
    echo -e "${RED}❌ Should have rejected request with invalid action${NC}"
fi
echo

# Test 15: Missing required fields for answer action
echo -e "${BLUE}Step 15: Testing missing required fields for answer action${NC}"
incomplete_answer_payload='{"action": "answer"}'
make_api_call "PUT" "/v1/sessions/$session_id" "$auth_header" "$incomplete_answer_payload" "Submit incomplete answer (should fail)"
if [ $? -eq 400 ]; then
    echo -e "${GREEN}✅ Correctly rejected incomplete answer request${NC}"
else
    echo -e "${RED}❌ Should have rejected incomplete answer request${NC}"
fi
echo

# Test 16: Unauthorized access
echo -e "${BLUE}Step 16: Testing unauthorized access${NC}"
make_api_call "PUT" "/v1/sessions/$session_id" "" "$pause_payload" "Update session without auth token (should fail)"
if [ $? -eq 401 ]; then
    echo -e "${GREEN}✅ Correctly rejected unauthorized request${NC}"
else
    echo -e "${RED}❌ Should have rejected unauthorized request${NC}"
fi
echo

# Test 17: Non-existent session
echo -e "${BLUE}Step 17: Testing non-existent session${NC}"
fake_session_id="12345678-1234-5678-9abc-123456789012"
make_api_call "PUT" "/v1/sessions/$fake_session_id" "$auth_header" "$pause_payload" "Update non-existent session (should fail)"
if [ $? -eq 404 ]; then
    echo -e "${GREEN}✅ Correctly rejected request for non-existent session${NC}"
else
    echo -e "${RED}❌ Should have rejected request for non-existent session${NC}"
fi
echo

echo -e "${BLUE}=== Phase 17 Session Update Tests Complete ===${NC}"
echo -e "${GREEN}✅ All tests completed. Check individual test results above.${NC}"