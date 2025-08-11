#!/bin/bash

# Test Exam Endpoints Script - Phase 8: Exam Listing Feature
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
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

log_section() {
    echo -e "${PURPLE}[SECTION]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_debug() {
    echo -e "${CYAN}[DEBUG]${NC} $1"
}

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test function for GET requests
test_get_endpoint() {
    local endpoint=$1
    local query_params=$2
    local description=$3
    local expected_status=${4:-200}
    local fixture_file=${5:-""}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log_test "$description"
    
    # Build URL
    local url="$BASE_URL$endpoint"
    if [ -n "$query_params" ]; then
        url="$url?$query_params"
    fi
    
    log_debug "URL: $url"
    
    # Make request and capture response
    local response_file="$TEMP_DIR/response_${TOTAL_TESTS}.json"
    local status_code
    
    set +e
    status_code=$(curl -s -w "%{http_code}" -o "$response_file" "$url")
    local curl_exit_code=$?
    set -e
    
    if [ $curl_exit_code -ne 0 ]; then
        log_error "curl failed with exit code $curl_exit_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
    
    log_debug "Status Code: $status_code"
    
    # Check status code
    if [ "$status_code" != "$expected_status" ]; then
        log_error "Expected status $expected_status, got $status_code"
        cat "$response_file" | jq . 2>/dev/null || cat "$response_file"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
    
    # Validate JSON response for 200 responses
    if [ "$status_code" = "200" ]; then
        if ! jq . "$response_file" >/dev/null 2>&1; then
            log_error "Response is not valid JSON"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
        
        # Additional validation based on fixture file
        if [ -n "$fixture_file" ] && [ -f "$FIXTURES_DIR/$fixture_file" ]; then
            validate_response "$response_file" "$FIXTURES_DIR/$fixture_file"
        fi
    fi
    
    log_success "✓ Test passed"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
}

# Test function for POST requests
test_post_endpoint() {
    local endpoint=$1
    local body_data=$2
    local description=$3
    local expected_status=${4:-200}
    local fixture_file=${5:-""}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log_test "$description"
    
    local url="$BASE_URL$endpoint"
    log_debug "URL: $url"
    
    # Create temporary file for request body
    local body_file="$TEMP_DIR/body_${TOTAL_TESTS}.json"
    echo "$body_data" > "$body_file"
    
    log_debug "Request Body: $body_data"
    
    # Make request and capture response
    local response_file="$TEMP_DIR/response_${TOTAL_TESTS}.json"
    local status_code
    
    set +e
    status_code=$(curl -s -w "%{http_code}" -o "$response_file" \
        -X POST \
        -H "Content-Type: application/json" \
        -d @"$body_file" \
        "$url")
    local curl_exit_code=$?
    set -e
    
    if [ $curl_exit_code -ne 0 ]; then
        log_error "curl failed with exit code $curl_exit_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
    
    log_debug "Status Code: $status_code"
    
    # Check status code
    if [ "$status_code" != "$expected_status" ]; then
        log_error "Expected status $expected_status, got $status_code"
        cat "$response_file" | jq . 2>/dev/null || cat "$response_file"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
    
    # Validate JSON response for 200 responses
    if [ "$status_code" = "200" ]; then
        if ! jq . "$response_file" >/dev/null 2>&1; then
            log_error "Response is not valid JSON"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
        
        # Additional validation based on fixture file
        if [ -n "$fixture_file" ] && [ -f "$FIXTURES_DIR/$fixture_file" ]; then
            validate_response "$response_file" "$FIXTURES_DIR/$fixture_file"
        fi
    fi
    
    log_success "✓ Test passed"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
}

# Validate response against fixture expectations
validate_response() {
    local response_file=$1
    local fixture_file=$2
    
    log_debug "Validating response against fixture: $(basename "$fixture_file")"
    
    # Check required fields exist
    local expected_fields=$(jq -r '.expectedFields[]?' "$fixture_file" 2>/dev/null)
    if [ -n "$expected_fields" ]; then
        while IFS= read -r field; do
            if [ -n "$field" ]; then
                if ! jq -e ".data.$field" "$response_file" >/dev/null 2>&1; then
                    log_error "Required field '$field' is missing from response"
                    return 1
                fi
            fi
        done <<< "$expected_fields"
    fi
    
    # Validate exam-specific fields for exam endpoints
    if jq -e '.data.exams[]?' "$response_file" >/dev/null 2>&1; then
        validate_exam_fields "$response_file" "$fixture_file"
    fi
    
    # Validate single exam response
    if jq -e '.data.exam' "$response_file" >/dev/null 2>&1; then
        validate_single_exam "$response_file" "$fixture_file"
    fi
    
    # Validate search response
    if jq -e '.data.searchMetadata' "$response_file" >/dev/null 2>&1; then
        validate_search_response "$response_file" "$fixture_file"
    fi
    
    # Validate comparison response
    if jq -e '.data.comparison' "$response_file" >/dev/null 2>&1; then
        validate_comparison_response "$response_file" "$fixture_file"
    fi
}

# Validate exam fields in array responses
validate_exam_fields() {
    local response_file=$1
    local fixture_file=$2
    
    local required_exam_fields=$(jq -r '.validation.requiredExamFields[]?' "$fixture_file" 2>/dev/null)
    if [ -n "$required_exam_fields" ]; then
        local first_exam=$(jq '.data.exams[0]' "$response_file" 2>/dev/null)
        if [ "$first_exam" = "null" ] || [ -z "$first_exam" ]; then
            log_error "No exams found in response"
            return 1
        fi
        
        while IFS= read -r field; do
            if [ -n "$field" ]; then
                if ! echo "$first_exam" | jq -e ".$field" >/dev/null 2>&1; then
                    log_error "Required exam field '$field' is missing"
                    return 1
                fi
            fi
        done <<< "$required_exam_fields"
    fi
}

# Validate single exam response
validate_single_exam() {
    local response_file=$1
    local fixture_file=$2
    
    local exam_id=$(jq -r '.validation.examId?' "$fixture_file" 2>/dev/null)
    if [ -n "$exam_id" ] && [ "$exam_id" != "null" ]; then
        local actual_id=$(jq -r '.data.exam.id' "$response_file" 2>/dev/null)
        if [ "$actual_id" != "$exam_id" ]; then
            log_error "Expected exam ID '$exam_id', got '$actual_id'"
            return 1
        fi
    fi
}

# Validate search response
validate_search_response() {
    local response_file=$1
    local fixture_file=$2
    
    local search_query=$(jq -r '.validation.searchQuery?' "$fixture_file" 2>/dev/null)
    if [ -n "$search_query" ] && [ "$search_query" != "null" ]; then
        local actual_query=$(jq -r '.data.searchMetadata.query' "$response_file" 2>/dev/null)
        if [ "$actual_query" != "$search_query" ]; then
            log_error "Expected search query '$search_query', got '$actual_query'"
            return 1
        fi
    fi
}

# Validate comparison response
validate_comparison_response() {
    local response_file=$1
    local fixture_file=$2
    
    local expected_exam_count=$(jq -r '.validation.examCount?' "$fixture_file" 2>/dev/null)
    if [ -n "$expected_exam_count" ] && [ "$expected_exam_count" != "null" ]; then
        local actual_count=$(jq '.data.comparison.exams | length' "$response_file" 2>/dev/null)
        if [ "$actual_count" != "$expected_exam_count" ]; then
            log_error "Expected $expected_exam_count exams in comparison, got $actual_count"
            return 1
        fi
    fi
}

# Cleanup function
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Print header
echo "================================================================="
echo "                 EXAM ENDPOINTS TEST SUITE"
echo "             Phase 8: Exam Listing Feature"
echo "================================================================="
echo
log_info "Base URL: $BASE_URL"
log_info "Fixtures Directory: $FIXTURES_DIR"
log_info "Starting exam endpoint tests..."
echo

# Test 1: List All Exams
log_section "1. LIST ALL EXAMS TESTS"
test_get_endpoint "/v1/exams" "" "List all exams without filters" 200 "list-exams.json"

# Test 2: List Exams with Category Filter
log_section "2. FILTERED LISTING TESTS"
test_get_endpoint "/v1/exams" "category=cloud" "List exams filtered by category (cloud)" 200 "list-exams-filtered-category.json"
test_get_endpoint "/v1/exams" "level=associate" "List exams filtered by level (associate)" 200 "list-exams-filtered-level.json"
test_get_endpoint "/v1/exams" "providerId=aws" "List exams filtered by provider (AWS)" 200 "list-exams-filtered-provider.json"

# Test 3: Comprehensive Filtering
test_get_endpoint "/v1/exams" "category=cloud&level=associate&difficultyMin=3&difficultyMax=4&costMin=100&costMax=200&sortBy=difficulty&sortOrder=asc&limit=10" "List exams with comprehensive filters" 200 "list-exams-comprehensive-filters.json"

# Test 4: Get Individual Exam
log_section "3. INDIVIDUAL EXAM TESTS"
test_get_endpoint "/v1/exams/aws-aws-saa-c03" "includeQuestions=true&includeResources=true" "Get AWS SAA exam with details" 200 "get-exam-aws-saa.json"

# Test 5: Search Exams
log_section "4. SEARCH FUNCTIONALITY TESTS"
test_get_endpoint "/v1/exams/search" "q=cloud" "Basic exam search for 'cloud'" 200 "search-exams-basic.json"
test_get_endpoint "/v1/exams/search" "q=cloud&fuzzy=true" "Fuzzy exam search for 'cloud'" 200
test_get_endpoint "/v1/exams/search" "q=aws&category=cloud&limit=5" "Search with additional filters" 200

# Test 6: Compare Exams
log_section "5. EXAM COMPARISON TESTS"
test_post_endpoint "/v1/exams/compare" '{"examIds":["aws-aws-clf-c02","aws-aws-saa-c03"]}' "Compare two exams (minimum case)" 200 "compare-exams-two.json"
test_post_endpoint "/v1/exams/compare" '{"examIds":["aws-aws-clf-c02","aws-aws-saa-c03","azure-az-900","comptia-security-plus"]}' "Compare multiple exams" 200

# Test 7: Provider-specific Exams
log_section "6. PROVIDER-SPECIFIC TESTS"
test_get_endpoint "/v1/providers/aws/exams" "" "Get all AWS exams" 200 "get-provider-exams-aws.json"
test_get_endpoint "/v1/providers/azure/exams" "level=foundational" "Get Azure foundational exams" 200
test_get_endpoint "/v1/providers/comptia/exams" "category=security" "Get CompTIA security exams" 200

# Test 8: Cache Management
log_section "7. CACHE MANAGEMENT TESTS"
test_post_endpoint "/v1/exams/cache/refresh" '{}' "Refresh exam cache" 200 "refresh-exam-cache.json"

# Test 9: Error Cases
log_section "8. ERROR HANDLING TESTS"
test_get_endpoint "/v1/exams/non-existent-exam-id" "" "Get non-existent exam (404)" 404 "get-exam-invalid-id.json"
test_get_endpoint "/v1/exams" "category=invalid_category" "Invalid category filter (400)" 400 "list-exams-invalid-category.json"
test_get_endpoint "/v1/exams/search" "" "Search without query parameter (400)" 400 "search-exams-missing-query.json"
test_post_endpoint "/v1/exams/compare" '{"examIds":["aws-aws-clf-c02"]}' "Compare with insufficient exams (400)" 400 "compare-exams-insufficient.json"
test_post_endpoint "/v1/exams/compare" '{"examIds":["exam1","exam2","exam3","exam4","exam5","exam6","exam7","exam8","exam9","exam10","exam11"]}' "Compare with too many exams (400)" 400

# Test 10: Edge Cases
log_section "9. EDGE CASE TESTS"
test_get_endpoint "/v1/exams" "limit=1&offset=0" "Pagination with limit=1" 200
test_get_endpoint "/v1/exams" "sortBy=cost&sortOrder=desc" "Sort by cost descending" 200
test_get_endpoint "/v1/exams" "difficultyMin=5&difficultyMax=5" "Filter by maximum difficulty" 200
test_get_endpoint "/v1/exams" "costMin=0&costMax=0" "Filter by free exams" 200

echo
echo "================================================================="
echo "                      TEST SUMMARY"
echo "================================================================="
log_info "Total Tests: $TOTAL_TESTS"
log_success "Passed: $PASSED_TESTS"
if [ $FAILED_TESTS -gt 0 ]; then
    log_error "Failed: $FAILED_TESTS"
else
    log_success "Failed: $FAILED_TESTS"
fi

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo
    if [ $SUCCESS_RATE -eq 100 ]; then
        log_success "Success Rate: ${SUCCESS_RATE}% - All tests passed! 🎉"
    elif [ $SUCCESS_RATE -ge 90 ]; then
        log_info "Success Rate: ${SUCCESS_RATE}% - Excellent!"
    elif [ $SUCCESS_RATE -ge 80 ]; then
        log_warn "Success Rate: ${SUCCESS_RATE}% - Good, but some issues to address"
    else
        log_error "Success Rate: ${SUCCESS_RATE}% - Needs attention"
    fi
fi

echo
log_info "Test artifacts saved in: $TEMP_DIR"
echo "================================================================="

# Exit with error code if any tests failed
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi