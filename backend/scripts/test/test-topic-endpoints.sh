#!/bin/bash

# Test Topic Endpoints Script
# Usage: ./test-topic-endpoints.sh [base-url]

set -e

# Configuration
BASE_URL=${1:-"https://t6pkkabhvi.execute-api.us-east-2.amazonaws.com/dev"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../../tests/fixtures/topics"
TEMP_DIR="/tmp/topic-test-$$"

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

# Validate topics list response
validate_topics_list() {
    local response_file=$1
    local min_topics=${2:-10}
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping detailed validation"
        return 0
    fi
    
    local topic_count=$(jq '.data.total' "$response_file" 2>/dev/null || echo "0")
    
    if [[ "$topic_count" -ge "$min_topics" ]]; then
        log_info "✅ Found $topic_count topics (minimum $min_topics)"
        return 0
    else
        log_error "❌ Found only $topic_count topics (minimum $min_topics required)"
        return 1
    fi
}

# Validate topic structure
validate_topic_structure() {
    local response_file=$1
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping topic structure validation"
        return 0
    fi
    
    # Check if first topic has required fields
    local has_id=$(jq '.data.topics[0] | has("id")' "$response_file" 2>/dev/null || echo "false")
    local has_name=$(jq '.data.topics[0] | has("name")' "$response_file" 2>/dev/null || echo "false")
    local has_provider=$(jq '.data.topics[0] | has("providerId")' "$response_file" 2>/dev/null || echo "false")
    local has_exam=$(jq '.data.topics[0] | has("examId")' "$response_file" 2>/dev/null || echo "false")
    
    if [[ "$has_id" == "true" && "$has_name" == "true" && "$has_provider" == "true" && "$has_exam" == "true" ]]; then
        log_info "✅ Topic structure validation passed"
        return 0
    else
        log_error "❌ Topic structure validation failed"
        return 1
    fi
}

# Validate filtered results
validate_filtered_topics() {
    local response_file=$1
    local filter_type=$2
    local filter_value=$3
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping filter validation"
        return 0
    fi
    
    local filter_field=""
    case "$filter_type" in
        "provider")
            filter_field=".providerId"
            ;;
        "exam")
            filter_field=".examId"
            ;;
        "level")
            filter_field=".level"
            ;;
        *)
            log_warn "Unknown filter type: $filter_type"
            return 0
            ;;
    esac
    
    # Check if all topics match the filter
    local mismatched_count=$(jq "[.data.topics[] | select($filter_field != \"$filter_value\")] | length" "$response_file" 2>/dev/null || echo "0")
    
    if [[ "$mismatched_count" -eq "0" ]]; then
        log_info "✅ All topics match filter: $filter_type=$filter_value"
        return 0
    else
        log_error "❌ Found $mismatched_count topics that don't match filter: $filter_type=$filter_value"
        return 1
    fi
}

# Validate search results contain keyword
validate_search_results() {
    local response_file=$1
    local search_keyword=$2
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping search validation"
        return 0
    fi
    
    # Check if topics contain the search keyword (case insensitive)
    local total_topics=$(jq '.data.total' "$response_file" 2>/dev/null || echo "0")
    
    if [[ "$total_topics" -gt "0" ]]; then
        log_info "✅ Search returned $total_topics results for keyword: $search_keyword"
        return 0
    else
        log_error "❌ Search returned no results for keyword: $search_keyword"
        return 1
    fi
}

# Main test sequence
main() {
    log_info "Starting Topic Endpoints Test Suite"
    log_info "Base URL: $BASE_URL"
    log_info "Fixtures Directory: $FIXTURES_DIR"
    log_info "Results Directory: $TEMP_DIR"
    echo
    
    local test_results=()
    local total_tests=0
    local passed_tests=0

    # Test 1: List all topics
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "" "List All Topics" 200; then
        validate_response "$TEMP_DIR/list_all_topics_response.json" "data"
        validate_topics_list "$TEMP_DIR/list_all_topics_response.json" 10
        validate_topic_structure "$TEMP_DIR/list_all_topics_response.json"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List All Topics")
    else
        test_results+=("❌ List All Topics")
    fi
    echo

    # Test 2: List topics filtered by provider (AWS)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "provider=aws" "List AWS Topics" 200; then
        validate_response "$TEMP_DIR/list_aws_topics_response.json" "data"
        validate_filtered_topics "$TEMP_DIR/list_aws_topics_response.json" "provider" "aws"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List AWS Topics")
    else
        test_results+=("❌ List AWS Topics")
    fi
    echo

    # Test 3: List topics filtered by level (foundational)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "level=foundational" "List Foundational Topics" 200; then
        validate_response "$TEMP_DIR/list_foundational_topics_response.json" "data"
        validate_filtered_topics "$TEMP_DIR/list_foundational_topics_response.json" "level" "foundational"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List Foundational Topics")
    else
        test_results+=("❌ List Foundational Topics")
    fi
    echo

    # Test 4: List topics filtered by exam
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "exam=aws-clf-c02" "List AWS CLF-C02 Topics" 200; then
        validate_response "$TEMP_DIR/list_aws_clf-c02_topics_response.json" "data"
        validate_filtered_topics "$TEMP_DIR/list_aws_clf-c02_topics_response.json" "exam" "aws-clf-c02"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List AWS CLF-C02 Topics")
    else
        test_results+=("❌ List AWS CLF-C02 Topics")
    fi
    echo

    # Test 5: List topics filtered by category (cloud)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "category=cloud" "List Cloud Topics" 200; then
        validate_response "$TEMP_DIR/list_cloud_topics_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List Cloud Topics")
    else
        test_results+=("❌ List Cloud Topics")
    fi
    echo

    # Test 6: Search topics by keyword (security)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "search=security" "Search Topics (security)" 200; then
        validate_response "$TEMP_DIR/search_topics_(security)_response.json" "data"
        validate_search_results "$TEMP_DIR/search_topics_(security)_response.json" "security"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Search Topics (security)")
    else
        test_results+=("❌ Search Topics (security)")
    fi
    echo

    # Test 7: Search topics by keyword (network)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "search=network" "Search Topics (network)" 200; then
        validate_response "$TEMP_DIR/search_topics_(network)_response.json" "data"
        validate_search_results "$TEMP_DIR/search_topics_(network)_response.json" "network"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Search Topics (network)")
    else
        test_results+=("❌ Search Topics (network)")
    fi
    echo

    # Test 8: Multiple filters (AWS + foundational)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "provider=aws&level=foundational" "List AWS Foundational Topics" 200; then
        validate_response "$TEMP_DIR/list_aws_foundational_topics_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List AWS Foundational Topics")
    else
        test_results+=("❌ List AWS Foundational Topics")
    fi
    echo

    # Test 9: Azure topics
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "provider=azure" "List Azure Topics" 200; then
        validate_response "$TEMP_DIR/list_azure_topics_response.json" "data"
        validate_filtered_topics "$TEMP_DIR/list_azure_topics_response.json" "provider" "azure"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List Azure Topics")
    else
        test_results+=("❌ List Azure Topics")
    fi
    echo

    # Test 10: GCP topics
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "provider=gcp" "List GCP Topics" 200; then
        validate_response "$TEMP_DIR/list_gcp_topics_response.json" "data"
        validate_filtered_topics "$TEMP_DIR/list_gcp_topics_response.json" "provider" "gcp"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List GCP Topics")
    else
        test_results+=("❌ List GCP Topics")
    fi
    echo

    # Test 11: CompTIA topics
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "provider=comptia" "List CompTIA Topics" 200; then
        validate_response "$TEMP_DIR/list_comptia_topics_response.json" "data"
        validate_filtered_topics "$TEMP_DIR/list_comptia_topics_response.json" "provider" "comptia"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List CompTIA Topics")
    else
        test_results+=("❌ List CompTIA Topics")
    fi
    echo

    # Test 12: Cisco topics
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "provider=cisco" "List Cisco Topics" 200; then
        validate_response "$TEMP_DIR/list_cisco_topics_response.json" "data"
        validate_filtered_topics "$TEMP_DIR/list_cisco_topics_response.json" "provider" "cisco"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List Cisco Topics")
    else
        test_results+=("❌ List Cisco Topics")
    fi
    echo

    # Test 13: Empty search results
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/topics" "search=nonexistentkewordxyz" "Search with No Results" 200; then
        validate_response "$TEMP_DIR/search_with_no_results_response.json" "data"
        # Should return 0 results but still be a valid response
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Search with No Results")
    else
        test_results+=("❌ Search with No Results")
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