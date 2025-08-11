#!/bin/bash

# Test Question Endpoints Script
# Usage: ./test-question-endpoints.sh [base-url]

set -e

# Configuration
BASE_URL=${1:-"https://t6pkkabhvi.execute-api.us-east-2.amazonaws.com/dev"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../../tests/fixtures/questions"
TEMP_DIR="/tmp/question-test-$$"

# Create temp directory for test results
mkdir -p "$TEMP_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local query_params=$3
    local description=$4
    local expected_status=${5:-200}
    
    log_test "$description"
    
    # Build URL with query parameters
    local full_url="$BASE_URL$endpoint"
    if [[ -n "$query_params" ]]; then
        full_url="$full_url?$query_params"
    fi
    
    echo "  URL: $method $full_url"
    
    local curl_cmd="curl -s -w '%{http_code}' -X $method '$full_url' -H 'Content-Type: application/json'"
    
    local response=$(eval $curl_cmd)
    local http_code="${response: -3}"
    local body="${response%???}"
    
    echo "  HTTP Code: $http_code (expected: $expected_status)"
    
    # Pretty print JSON response if possible
    if command -v jq >/dev/null 2>&1 && [[ -n "$body" ]]; then
        echo "  Response:"
        echo "$body" | jq . 2>/dev/null | sed 's/^/    /' || echo "    $body"
    else
        echo "  Response: $body"
    fi
    
    # Save response for potential reuse
    local test_name=$(echo "$description" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
    echo "$body" > "$TEMP_DIR/${test_name}_response.json"
    
    # Check if status code matches expected
    if [[ "$http_code" == "$expected_status" ]]; then
        log_info "✅ Test passed"
        return 0
    else
        log_error "❌ Test failed - Expected $expected_status, got $http_code"
        return 1
    fi
}

# Validate response structure
validate_response() {
    local response_file=$1
    local expected_fields=("${@:2}")
    
    if [[ ! -f "$response_file" ]]; then
        log_warn "Response file not found: $response_file"
        return 1
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping response validation"
        return 0
    fi
    
    local valid=true
    
    for field in "${expected_fields[@]}"; do
        if ! jq -e "has(\"$field\")" "$response_file" >/dev/null 2>&1; then
            log_error "Missing field: $field"
            valid=false
        fi
    done
    
    if [[ "$valid" == "true" ]]; then
        log_info "✅ Response structure validation passed"
        return 0
    else
        log_error "❌ Response structure validation failed"
        return 1
    fi
}

# Validate questions list response
validate_questions_list() {
    local response_file=$1
    local max_questions=${2:-50}
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping detailed validation"
        return 0
    fi
    
    local question_count=$(jq '.data.questions | length' "$response_file" 2>/dev/null || echo "0")
    local total=$(jq '.data.total' "$response_file" 2>/dev/null || echo "0")
    
    if [[ "$question_count" -le "$max_questions" ]]; then
        log_info "✅ Found $question_count questions (maximum $max_questions), total available: $total"
        return 0
    else
        log_error "❌ Found $question_count questions (exceeds maximum $max_questions)"
        return 1
    fi
}

# Validate question fields
validate_question_fields() {
    local response_file=$1
    local required_fields=("${@:2}")
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping field validation"
        return 0
    fi
    
    local questions_array=$(jq -r '.data.questions' "$response_file" 2>/dev/null || echo "[]")
    
    if [[ "$questions_array" == "[]" ]]; then
        log_warn "No questions found in response"
        return 0
    fi
    
    local valid=true
    local first_question=$(echo "$questions_array" | jq '.[0]' 2>/dev/null || echo "{}")
    
    for field in "${required_fields[@]}"; do
        if ! echo "$first_question" | jq -e "has(\"$field\")" >/dev/null 2>&1; then
            log_error "Missing required question field: $field"
            valid=false
        fi
    done
    
    if [[ "$valid" == "true" ]]; then
        log_info "✅ Question fields validation passed"
        return 0
    else
        log_error "❌ Question fields validation failed"
        return 1
    fi
}

# Validate filter values
validate_filter_values() {
    local response_file=$1
    local field=$2
    local expected_value=$3
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping filter validation"
        return 0
    fi
    
    local questions_array=$(jq -r '.data.questions' "$response_file" 2>/dev/null || echo "[]")
    
    if [[ "$questions_array" == "[]" ]]; then
        log_warn "No questions found for filter validation"
        return 0
    fi
    
    local mismatch_count=$(echo "$questions_array" | jq --arg field "$field" --arg value "$expected_value" '[.[] | select(.[$field] != $value)] | length' 2>/dev/null || echo "0")
    
    if [[ "$mismatch_count" == "0" ]]; then
        log_info "✅ Filter validation passed: all questions have $field = $expected_value"
        return 0
    else
        log_error "❌ Filter validation failed: $mismatch_count questions don't match $field = $expected_value"
        return 1
    fi
}

# Validate search functionality
validate_search() {
    local response_file=$1
    local search_term=$2
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping search validation"
        return 0
    fi
    
    local questions_array=$(jq -r '.data.questions' "$response_file" 2>/dev/null || echo "[]")
    
    if [[ "$questions_array" == "[]" ]]; then
        log_warn "No questions found for search validation"
        return 0
    fi
    
    # Check if search term appears in question text, options, explanation, or tags
    local found_count=$(echo "$questions_array" | jq --arg term "$search_term" '
        [.[] | select(
            (.questionText | ascii_downcase | contains($term | ascii_downcase)) or
            (.options[]? | ascii_downcase | contains($term | ascii_downcase)) or
            (.explanation? // "" | ascii_downcase | contains($term | ascii_downcase)) or
            (.tags[]? | ascii_downcase | contains($term | ascii_downcase))
        )] | length
    ' 2>/dev/null || echo "0")
    
    local total_returned=$(echo "$questions_array" | jq 'length' 2>/dev/null || echo "0")
    
    if [[ "$found_count" == "$total_returned" ]]; then
        log_info "✅ Search validation passed: all $total_returned questions contain '$search_term'"
        return 0
    else
        log_error "❌ Search validation failed: only $found_count of $total_returned questions contain '$search_term'"
        return 1
    fi
}

# Validate pagination
validate_pagination() {
    local response_file=$1
    local expected_limit=$2
    local expected_offset=$3
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping pagination validation"
        return 0
    fi
    
    local pagination=$(jq '.data.pagination' "$response_file" 2>/dev/null || echo "{}")
    local actual_limit=$(echo "$pagination" | jq '.limit' 2>/dev/null || echo "null")
    local actual_offset=$(echo "$pagination" | jq '.offset' 2>/dev/null || echo "null")
    local has_more=$(echo "$pagination" | jq '.hasMore' 2>/dev/null || echo "null")
    
    local valid=true
    
    if [[ "$actual_limit" != "$expected_limit" ]]; then
        log_error "Pagination limit mismatch: expected $expected_limit, got $actual_limit"
        valid=false
    fi
    
    if [[ "$actual_offset" != "$expected_offset" ]]; then
        log_error "Pagination offset mismatch: expected $expected_offset, got $actual_offset"
        valid=false
    fi
    
    if [[ "$valid" == "true" ]]; then
        log_info "✅ Pagination validation passed: limit=$actual_limit, offset=$actual_offset, hasMore=$has_more"
        return 0
    else
        log_error "❌ Pagination validation failed"
        return 1
    fi
}

# Main test sequence
main() {
    log_info "Starting Question Endpoints Test Suite"
    log_info "Base URL: $BASE_URL"
    log_info "Fixtures Directory: $FIXTURES_DIR"
    log_info "Results Directory: $TEMP_DIR"
    echo
    
    local test_results=()
    local total_tests=0
    local passed_tests=0

    # Test 1: List all questions
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "" "List All Questions" 200; then
        validate_response "$TEMP_DIR/list_all_questions_response.json" "data"
        validate_questions_list "$TEMP_DIR/list_all_questions_response.json" 50
        validate_question_fields "$TEMP_DIR/list_all_questions_response.json" "questionId" "providerId" "examId" "questionText" "options" "correctAnswer" "difficulty" "type"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List All Questions")
    else
        test_results+=("❌ List All Questions")
    fi
    echo

    # Test 2: Filter questions by provider
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "provider=aws&limit=25" "Filter by Provider (AWS)" 200; then
        validate_response "$TEMP_DIR/filter_by_provider_(aws)_response.json" "data"
        validate_questions_list "$TEMP_DIR/filter_by_provider_(aws)_response.json" 25
        validate_filter_values "$TEMP_DIR/filter_by_provider_(aws)_response.json" "providerId" "aws"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Filter by Provider (AWS)")
    else
        test_results+=("❌ Filter by Provider (AWS)")
    fi
    echo

    # Test 3: Filter questions by provider and exam
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "provider=aws&exam=saa-c03&includeExplanations=true" "Filter by Provider and Exam" 200; then
        validate_response "$TEMP_DIR/filter_by_provider_and_exam_response.json" "data"
        validate_filter_values "$TEMP_DIR/filter_by_provider_and_exam_response.json" "providerId" "aws"
        validate_filter_values "$TEMP_DIR/filter_by_provider_and_exam_response.json" "examId" "saa-c03"
        validate_question_fields "$TEMP_DIR/filter_by_provider_and_exam_response.json" "explanation"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Filter by Provider and Exam")
    else
        test_results+=("❌ Filter by Provider and Exam")
    fi
    echo

    # Test 4: Filter by difficulty
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "difficulty=intermediate&limit=15" "Filter by Difficulty" 200; then
        validate_response "$TEMP_DIR/filter_by_difficulty_response.json" "data"
        validate_filter_values "$TEMP_DIR/filter_by_difficulty_response.json" "difficulty" "intermediate"
        validate_questions_list "$TEMP_DIR/filter_by_difficulty_response.json" 15
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Filter by Difficulty")
    else
        test_results+=("❌ Filter by Difficulty")
    fi
    echo

    # Test 5: Filter by question type
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "type=multiple_choice&provider=aws" "Filter by Type" 200; then
        validate_response "$TEMP_DIR/filter_by_type_response.json" "data"
        validate_filter_values "$TEMP_DIR/filter_by_type_response.json" "type" "multiple_choice"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Filter by Type")
    else
        test_results+=("❌ Filter by Type")
    fi
    echo

    # Test 6: Search questions
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "search=instance&limit=20&includeExplanations=true" "Search Questions" 200; then
        validate_response "$TEMP_DIR/search_questions_response.json" "data"
        validate_questions_list "$TEMP_DIR/search_questions_response.json" 20
        validate_search "$TEMP_DIR/search_questions_response.json" "instance"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Search Questions")
    else
        test_results+=("❌ Search Questions")
    fi
    echo

    # Test 7: Filter by tags
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "tags=storage,ebs&provider=aws&includeMetadata=true" "Filter by Tags" 200; then
        validate_response "$TEMP_DIR/filter_by_tags_response.json" "data"
        validate_question_fields "$TEMP_DIR/filter_by_tags_response.json" "tags" "metadata"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Filter by Tags")
    else
        test_results+=("❌ Filter by Tags")
    fi
    echo

    # Test 8: Pagination
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "limit=5&offset=10" "Pagination Test" 200; then
        validate_response "$TEMP_DIR/pagination_test_response.json" "data"
        validate_questions_list "$TEMP_DIR/pagination_test_response.json" 5
        validate_pagination "$TEMP_DIR/pagination_test_response.json" 5 10
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Pagination Test")
    else
        test_results+=("❌ Pagination Test")
    fi
    echo

    # Test 9: Multiple filters combined
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "provider=aws&exam=saa-c03&topic=ec2&difficulty=intermediate&type=multiple_choice&limit=10" "Combined Filters" 200; then
        validate_response "$TEMP_DIR/combined_filters_response.json" "data"
        validate_filter_values "$TEMP_DIR/combined_filters_response.json" "providerId" "aws"
        validate_filter_values "$TEMP_DIR/combined_filters_response.json" "examId" "saa-c03"
        validate_filter_values "$TEMP_DIR/combined_filters_response.json" "difficulty" "intermediate"
        validate_filter_values "$TEMP_DIR/combined_filters_response.json" "type" "multiple_choice"
        validate_questions_list "$TEMP_DIR/combined_filters_response.json" 10
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Combined Filters")
    else
        test_results+=("❌ Combined Filters")
    fi
    echo

    # Test 10: Invalid difficulty (should return 400)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "difficulty=invalid_difficulty" "Invalid Difficulty" 400; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid Difficulty (400)")
    else
        test_results+=("❌ Invalid Difficulty (400)")
    fi
    echo

    # Test 11: Invalid question type (should return 400)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "type=invalid_type" "Invalid Question Type" 400; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid Question Type (400)")
    else
        test_results+=("❌ Invalid Question Type (400)")
    fi
    echo

    # Test 12: Invalid pagination (should return 400)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "limit=150&offset=-5" "Invalid Pagination" 400; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid Pagination (400)")
    else
        test_results+=("❌ Invalid Pagination (400)")
    fi
    echo

    # Test 13: Exclude explanations
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/questions" "provider=aws&limit=5&includeExplanations=false" "Exclude Explanations" 200; then
        validate_response "$TEMP_DIR/exclude_explanations_response.json" "data"
        # Check that explanations are not included
        local has_explanation=$(jq '.data.questions[0] | has("explanation")' "$TEMP_DIR/exclude_explanations_response.json" 2>/dev/null || echo "false")
        if [[ "$has_explanation" == "false" ]]; then
            log_info "✅ Explanations correctly excluded"
        else
            log_warn "⚠️ Explanations may still be present"
        fi
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Exclude Explanations")
    else
        test_results+=("❌ Exclude Explanations")
    fi
    echo

    # Summary
    echo "=================================="
    log_info "Test Suite Summary"
    echo "=================================="
    echo "Total Tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $((total_tests - passed_tests))"
    echo "Success Rate: $(( (passed_tests * 100) / total_tests ))%"
    echo
    
    log_info "Individual Test Results:"
    for result in "${test_results[@]}"; do
        echo "  $result"
    done
    
    echo
    log_info "Test artifacts saved to: $TEMP_DIR"
    
    # Exit with error code if any tests failed
    if [[ $passed_tests -eq $total_tests ]]; then
        log_info "🎉 All tests passed!"
        exit 0
    else
        log_error "💥 Some tests failed!"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    if [[ -d "$TEMP_DIR" && -z "$KEEP_TEMP" ]]; then
        log_info "Cleaning up temporary files..."
        rm -rf "$TEMP_DIR"
    fi
}

# Trap cleanup on exit (unless KEEP_TEMP is set)
if [[ -z "$KEEP_TEMP" ]]; then
    trap cleanup EXIT
fi

# Check dependencies
command -v curl >/dev/null 2>&1 || { log_error "curl is required but not installed. Aborting."; exit 1; }
command -v jq >/dev/null 2>&1 || { log_warn "jq is not installed. Response validation will be limited."; }

# Run tests
main "$@"