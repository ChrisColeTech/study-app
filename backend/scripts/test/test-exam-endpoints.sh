#!/bin/bash

# Test Exam Endpoints Script
# Usage: ./test-exam-endpoints.sh [base-url]

set -e

# Configuration
BASE_URL=${1:-"https://t6pkkabhvi.execute-api.us-east-2.amazonaws.com/dev"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../../tests/fixtures/exams"
TEMP_DIR="/tmp/exam-test-$$"

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

# Validate exams list response
validate_exams_list() {
    local response_file=$1
    local min_exams=${2:-10}
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping detailed validation"
        return 0
    fi
    
    local exam_count=$(jq '.data.total' "$response_file" 2>/dev/null || echo "0")
    
    if [[ "$exam_count" -ge "$min_exams" ]]; then
        log_info "✅ Found $exam_count exams (minimum $min_exams)"
        return 0
    else
        log_error "❌ Found only $exam_count exams (minimum $min_exams required)"
        return 1
    fi
}

# Validate exam structure
validate_exam_structure() {
    local response_file=$1
    local required_fields=("examId" "examName" "examCode" "providerId" "providerName" "description" "level" "questionCount" "topics" "isActive" "metadata")
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping detailed validation"
        return 0
    fi
    
    local exam_count=$(jq '.data.exams | length' "$response_file" 2>/dev/null || echo "0")
    
    if [[ "$exam_count" -eq 0 ]]; then
        log_warn "No exams found in response"
        return 0
    fi
    
    # Check first exam structure
    local valid=true
    for field in "${required_fields[@]}"; do
        if ! jq -e ".data.exams[0] | has(\"$field\")" "$response_file" >/dev/null 2>&1; then
            log_error "Missing exam field: $field"
            valid=false
        fi
    done
    
    if [[ "$valid" == "true" ]]; then
        log_info "✅ Exam structure validation passed"
        return 0
    else
        log_error "❌ Exam structure validation failed"
        return 1
    fi
}

# Validate filter response
validate_filtered_response() {
    local response_file=$1
    local filter_field=$2
    local filter_value=$3
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping filter validation"
        return 0
    fi
    
    local valid=true
    local exam_count=$(jq '.data.exams | length' "$response_file" 2>/dev/null || echo "0")
    
    if [[ "$exam_count" -eq 0 ]]; then
        log_warn "No exams found to validate filter"
        return 0
    fi
    
    # Check if all returned exams match the filter
    for ((i=0; i<exam_count; i++)); do
        local field_value
        if [[ "$filter_field" == "level" ]]; then
            field_value=$(jq -r ".data.exams[$i].level" "$response_file" 2>/dev/null || echo "")
        elif [[ "$filter_field" == "provider" ]]; then
            field_value=$(jq -r ".data.exams[$i].providerId" "$response_file" 2>/dev/null || echo "")
        fi
        
        if [[ "$field_value" != "$filter_value" ]]; then
            log_error "Filter mismatch in exam $i: Expected $filter_value, got $field_value"
            valid=false
        fi
    done
    
    if [[ "$valid" == "true" ]]; then
        log_info "✅ Filter validation passed"
        return 0
    else
        log_error "❌ Filter validation failed"
        return 1
    fi
}

# Validate pagination response
validate_pagination() {
    local response_file=$1
    local expected_limit=$2
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping pagination validation"
        return 0
    fi
    
    local returned_count=$(jq '.data.exams | length' "$response_file" 2>/dev/null || echo "0")
    local pagination_limit=$(jq '.data.pagination.limit' "$response_file" 2>/dev/null || echo "0")
    
    if [[ "$pagination_limit" -eq "$expected_limit" ]]; then
        log_info "✅ Pagination limit matches: $pagination_limit"
    else
        log_error "❌ Pagination limit mismatch - Expected: $expected_limit, Got: $pagination_limit"
        return 1
    fi
    
    if [[ "$returned_count" -le "$expected_limit" ]]; then
        log_info "✅ Returned count within limit: $returned_count"
        return 0
    else
        log_error "❌ Returned too many exams - Limit: $expected_limit, Got: $returned_count"
        return 1
    fi
}

# Main test sequence
main() {
    log_info "Starting Exam Endpoints Test Suite"
    log_info "Base URL: $BASE_URL"
    log_info "Fixtures Directory: $FIXTURES_DIR"
    log_info "Results Directory: $TEMP_DIR"
    echo
    
    local test_results=()
    local total_tests=0
    local passed_tests=0

    # Test 1: List all exams
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/exams" "" "List All Exams" 200; then
        validate_response "$TEMP_DIR/list_all_exams_response.json" "data"
        validate_exams_list "$TEMP_DIR/list_all_exams_response.json" 10
        validate_exam_structure "$TEMP_DIR/list_all_exams_response.json"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List All Exams")
    else
        test_results+=("❌ List All Exams")
    fi
    echo

    # Test 2: List exams with provider filter
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/exams" "provider=aws" "List AWS Exams" 200; then
        validate_response "$TEMP_DIR/list_aws_exams_response.json" "data"
        validate_exam_structure "$TEMP_DIR/list_aws_exams_response.json"
        validate_filtered_response "$TEMP_DIR/list_aws_exams_response.json" "provider" "aws"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List AWS Exams")
    else
        test_results+=("❌ List AWS Exams")
    fi
    echo

    # Test 3: List exams with level filter
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/exams" "level=associate" "List Associate Exams" 200; then
        validate_response "$TEMP_DIR/list_associate_exams_response.json" "data"
        validate_exam_structure "$TEMP_DIR/list_associate_exams_response.json"
        validate_filtered_response "$TEMP_DIR/list_associate_exams_response.json" "level" "associate"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List Associate Exams")
    else
        test_results+=("❌ List Associate Exams")
    fi
    echo

    # Test 4: List exams with multiple filters
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/exams" "provider=aws&level=associate" "List AWS Associate Exams" 200; then
        validate_response "$TEMP_DIR/list_aws_associate_exams_response.json" "data"
        validate_exam_structure "$TEMP_DIR/list_aws_associate_exams_response.json"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List AWS Associate Exams")
    else
        test_results+=("❌ List AWS Associate Exams")
    fi
    echo

    # Test 5: Search exams
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/exams" "search=solutions" "Search Exams" 200; then
        validate_response "$TEMP_DIR/search_exams_response.json" "data"
        validate_exam_structure "$TEMP_DIR/search_exams_response.json"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Search Exams")
    else
        test_results+=("❌ Search Exams")
    fi
    echo

    # Test 6: Test pagination
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/exams" "limit=5&offset=0" "Test Pagination" 200; then
        validate_response "$TEMP_DIR/test_pagination_response.json" "data"
        validate_exam_structure "$TEMP_DIR/test_pagination_response.json"
        validate_pagination "$TEMP_DIR/test_pagination_response.json" 5
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Test Pagination")
    else
        test_results+=("❌ Test Pagination")
    fi
    echo

    # Test 7: Include inactive exams
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/exams" "includeInactive=true" "Include Inactive Exams" 200; then
        validate_response "$TEMP_DIR/include_inactive_exams_response.json" "data"
        validate_exam_structure "$TEMP_DIR/include_inactive_exams_response.json"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Include Inactive Exams")
    else
        test_results+=("❌ Include Inactive Exams")
    fi
    echo

    # Test 8: Invalid level filter (should return 400)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/exams" "level=invalid_level" "Invalid Level Filter" 400; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid Level Filter (400)")
    else
        test_results+=("❌ Invalid Level Filter (400)")
    fi
    echo

    # Test 9: Invalid limit parameter (should return 400)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/exams" "limit=-5" "Invalid Limit Parameter" 400; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid Limit Parameter (400)")
    else
        test_results+=("❌ Invalid Limit Parameter (400)")
    fi
    echo

    # Test 10: Invalid offset parameter (should return 400)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/exams" "offset=-1" "Invalid Offset Parameter" 400; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid Offset Parameter (400)")
    else
        test_results+=("❌ Invalid Offset Parameter (400)")
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