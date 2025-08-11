#!/bin/bash

# Test Provider Endpoints Script
# Usage: ./test-provider-endpoints.sh [base-url]

set -e

# Configuration
BASE_URL=${1:-"https://t6pkkabhvi.execute-api.us-east-2.amazonaws.com/dev"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../../tests/fixtures/providers"
TEMP_DIR="/tmp/provider-test-$$"

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

# Test function for GET requests
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

# Test function for POST requests with JSON body
test_endpoint_post() {
    local endpoint=$1
    local body_data=$2
    local description=$3
    local expected_status=${4:-200}
    
    log_test "$description"
    
    local full_url="$BASE_URL$endpoint"
    echo "  URL: POST $full_url"
    
    # Create temporary file for request body
    local body_file="$TEMP_DIR/request_body_$$.json"
    echo "$body_data" > "$body_file"
    
    if command -v jq >/dev/null 2>&1; then
        echo "  Request Body:"
        echo "$body_data" | jq . 2>/dev/null | sed 's/^/    /' || echo "    $body_data"
    else
        echo "  Request Body: $body_data"
    fi
    
    local response=$(curl -s -w '%{http_code}' -X POST "$full_url" \
        -H 'Content-Type: application/json' \
        -d "@$body_file")
    
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
    
    # Cleanup request body file
    rm -f "$body_file"
    
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

# Validate providers list response
validate_providers_list() {
    local response_file=$1
    local min_providers=${2:-5}
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping detailed validation"
        return 0
    fi
    
    local provider_count=$(jq '.data.total' "$response_file" 2>/dev/null || echo "0")
    
    if [[ "$provider_count" -ge "$min_providers" ]]; then
        log_info "✅ Found $provider_count providers (minimum $min_providers)"
        return 0
    else
        log_error "❌ Found only $provider_count providers (minimum $min_providers required)"
        return 1
    fi
}

# Validate provider details response
validate_provider_details() {
    local response_file=$1
    local expected_id=$2
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not available, skipping detailed validation"
        return 0
    fi
    
    local provider_id=$(jq -r '.data.provider.id' "$response_file" 2>/dev/null || echo "")
    
    if [[ "$provider_id" == "$expected_id" ]]; then
        log_info "✅ Provider ID matches: $provider_id"
        return 0
    else
        log_error "❌ Provider ID mismatch - Expected: $expected_id, Got: $provider_id"
        return 1
    fi
}

# Main test sequence
main() {
    log_info "Starting Provider Endpoints Test Suite"
    log_info "Base URL: $BASE_URL"
    log_info "Fixtures Directory: $FIXTURES_DIR"
    log_info "Results Directory: $TEMP_DIR"
    echo
    
    local test_results=()
    local total_tests=0
    local passed_tests=0

    # Test 1: List all providers
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers" "" "List All Providers" 200; then
        validate_response "$TEMP_DIR/list_all_providers_response.json" "data"
        validate_providers_list "$TEMP_DIR/list_all_providers_response.json" 5
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List All Providers")
    else
        test_results+=("❌ List All Providers")
    fi
    echo

    # Test 2: List providers with category filter
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers" "category=cloud" "List Cloud Providers" 200; then
        validate_response "$TEMP_DIR/list_cloud_providers_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List Cloud Providers")
    else
        test_results+=("❌ List Cloud Providers")
    fi
    echo

    # Test 3: List providers with status filter
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers" "status=active" "List Active Providers" 200; then
        validate_response "$TEMP_DIR/list_active_providers_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ List Active Providers")
    else
        test_results+=("❌ List Active Providers")
    fi
    echo

    # Test 4: Search providers
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers" "search=AWS" "Search Providers" 200; then
        validate_response "$TEMP_DIR/search_providers_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Search Providers")
    else
        test_results+=("❌ Search Providers")
    fi
    echo

    # Test 5: Get AWS provider with certifications
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/aws" "includeCertifications=true" "Get AWS Provider (with certs)" 200; then
        validate_response "$TEMP_DIR/get_aws_provider_(with_certs)_response.json" "data"
        validate_provider_details "$TEMP_DIR/get_aws_provider_(with_certs)_response.json" "aws"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get AWS Provider (with certs)")
    else
        test_results+=("❌ Get AWS Provider (with certs)")
    fi
    echo

    # Test 6: Get Azure provider without certifications
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/azure" "includeCertifications=false" "Get Azure Provider (no certs)" 200; then
        validate_response "$TEMP_DIR/get_azure_provider_(no_certs)_response.json" "data"
        validate_provider_details "$TEMP_DIR/get_azure_provider_(no_certs)_response.json" "azure"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get Azure Provider (no certs)")
    else
        test_results+=("❌ Get Azure Provider (no certs)")
    fi
    echo

    # Test 7: Get GCP provider (default with certifications)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/gcp" "" "Get GCP Provider (default)" 200; then
        validate_response "$TEMP_DIR/get_gcp_provider_(default)_response.json" "data"
        validate_provider_details "$TEMP_DIR/get_gcp_provider_(default)_response.json" "gcp"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get GCP Provider (default)")
    else
        test_results+=("❌ Get GCP Provider (default)")
    fi
    echo

    # Test 8: Get CompTIA provider
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/comptia" "" "Get CompTIA Provider" 200; then
        validate_response "$TEMP_DIR/get_comptia_provider_response.json" "data"
        validate_provider_details "$TEMP_DIR/get_comptia_provider_response.json" "comptia"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get CompTIA Provider")
    else
        test_results+=("❌ Get CompTIA Provider")
    fi
    echo

    # Test 9: Get Cisco provider
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/cisco" "" "Get Cisco Provider" 200; then
        validate_response "$TEMP_DIR/get_cisco_provider_response.json" "data"
        validate_provider_details "$TEMP_DIR/get_cisco_provider_response.json" "cisco"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get Cisco Provider")
    else
        test_results+=("❌ Get Cisco Provider")
    fi
    echo

    # Test 10: Refresh cache
    total_tests=$((total_tests + 1))
    if test_endpoint "POST" "/v1/providers/cache/refresh" "" "Refresh Provider Cache" 200; then
        validate_response "$TEMP_DIR/refresh_provider_cache_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Refresh Provider Cache")
    else
        test_results+=("❌ Refresh Provider Cache")
    fi
    echo

    # Test 11: Invalid provider ID (should return 404)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/invalid-provider-id" "" "Invalid Provider ID" 404; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid Provider ID (404)")
    else
        test_results+=("❌ Invalid Provider ID (404)")
    fi
    echo

    # Test 12: Invalid category filter (should return 400)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers" "category=invalid_category" "Invalid Category Filter" 400; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid Category Filter (400)")
    else
        test_results+=("❌ Invalid Category Filter (400)")
    fi
    echo

    # Test 13: Invalid status filter (should return 400)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers" "status=invalid_status" "Invalid Status Filter" 400; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid Status Filter (400)")
    else
        test_results+=("❌ Invalid Status Filter (400)")
    fi
    echo

    # Phase 7: Provider Details Tests

    # Test 14: Get AWS certification roadmaps
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/aws/roadmaps" "" "Get AWS Roadmaps" 200; then
        validate_response "$TEMP_DIR/get_aws_roadmaps_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get AWS Roadmaps")
    else
        test_results+=("❌ Get AWS Roadmaps")
    fi
    echo

    # Test 15: Get specific AWS roadmap
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/aws/roadmaps" "roadmapId=aws-foundational-path" "Get Specific AWS Roadmap" 200; then
        validate_response "$TEMP_DIR/get_specific_aws_roadmap_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get Specific AWS Roadmap")
    else
        test_results+=("❌ Get Specific AWS Roadmap")
    fi
    echo

    # Test 16: Get AWS provider resources
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/aws/resources" "" "Get AWS Resources" 200; then
        validate_response "$TEMP_DIR/get_aws_resources_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get AWS Resources")
    else
        test_results+=("❌ Get AWS Resources")
    fi
    echo

    # Test 17: Get filtered AWS provider resources
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/aws/resources" "isFree=true&limit=5" "Get Filtered AWS Resources" 200; then
        validate_response "$TEMP_DIR/get_filtered_aws_resources_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get Filtered AWS Resources")
    else
        test_results+=("❌ Get Filtered AWS Resources")
    fi
    echo

    # Test 18: Get study path recommendations for AWS (intermediate user)
    total_tests=$((total_tests + 1))
    local study_path_body='{
        "userPreferences": {
            "careerGoals": ["Cloud Architect", "Solutions Architect"],
            "experienceLevel": "intermediate",
            "timeCommitmentWeekly": 10,
            "budgetLimit": 1000,
            "preferredProviders": ["aws"],
            "avoidedProviders": [],
            "learningStyle": ["practical", "visual"],
            "industryFocus": ["technology", "finance"],
            "currentSkills": ["networking", "linux"],
            "targetSkills": ["aws", "cloud architecture", "serverless"],
            "timeframe": "6months"
        },
        "includeAlternativeProviders": false
    }'
    if test_endpoint_post "/v1/providers/aws/recommendations/study-paths" "$study_path_body" "Get AWS Study Path Recommendations" 200; then
        validate_response "$TEMP_DIR/get_aws_study_path_recommendations_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get AWS Study Path Recommendations")
    else
        test_results+=("❌ Get AWS Study Path Recommendations")
    fi
    echo

    # Test 19: Get study path recommendations with alternatives
    total_tests=$((total_tests + 1))
    local study_path_alt_body='{
        "userPreferences": {
            "careerGoals": ["Cloud Engineer"],
            "experienceLevel": "beginner",
            "timeCommitmentWeekly": 5,
            "preferredProviders": [],
            "avoidedProviders": [],
            "learningStyle": ["reading_writing"],
            "industryFocus": ["technology"],
            "currentSkills": [],
            "targetSkills": ["cloud computing"],
            "timeframe": "1year"
        },
        "includeAlternativeProviders": true
    }'
    if test_endpoint_post "/v1/providers/aws/recommendations/study-paths" "$study_path_alt_body" "Get AWS Study Path with Alternatives" 200; then
        validate_response "$TEMP_DIR/get_aws_study_path_with_alternatives_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get AWS Study Path with Alternatives")
    else
        test_results+=("❌ Get AWS Study Path with Alternatives")
    fi
    echo

    # Test 20: Get personalized recommendations across all providers
    total_tests=$((total_tests + 1))
    local personalized_body='{
        "userPreferences": {
            "careerGoals": ["DevOps Engineer", "Cloud Security Specialist"],
            "experienceLevel": "advanced",
            "timeCommitmentWeekly": 15,
            "budgetLimit": 2000,
            "preferredProviders": ["aws", "azure"],
            "avoidedProviders": [],
            "learningStyle": ["practical", "kinesthetic"],
            "industryFocus": ["technology", "healthcare"],
            "currentSkills": ["docker", "kubernetes", "terraform"],
            "targetSkills": ["cloud security", "devops automation", "serverless"],
            "timeframe": "6months"
        },
        "maxRecommendations": 5
    }'
    if test_endpoint_post "/v1/providers/recommendations/personalized" "$personalized_body" "Get Personalized Recommendations" 200; then
        validate_response "$TEMP_DIR/get_personalized_recommendations_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get Personalized Recommendations")
    else
        test_results+=("❌ Get Personalized Recommendations")
    fi
    echo

    # Test 21: Get personalized recommendations for specific provider
    total_tests=$((total_tests + 1))
    local personalized_aws_body='{
        "providerId": "aws",
        "userPreferences": {
            "careerGoals": ["Solutions Architect"],
            "experienceLevel": "intermediate",
            "timeCommitmentWeekly": 8,
            "budgetLimit": 500,
            "preferredProviders": ["aws"],
            "avoidedProviders": [],
            "learningStyle": ["visual", "reading_writing"],
            "industryFocus": ["technology"],
            "currentSkills": ["networking", "security"],
            "targetSkills": ["aws architecture", "cost optimization"],
            "timeframe": "3months"
        },
        "maxRecommendations": 3
    }'
    if test_endpoint_post "/v1/providers/recommendations/personalized" "$personalized_aws_body" "Get AWS Personalized Recommendations" 200; then
        validate_response "$TEMP_DIR/get_aws_personalized_recommendations_response.json" "data"
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Get AWS Personalized Recommendations")
    else
        test_results+=("❌ Get AWS Personalized Recommendations")
    fi
    echo

    # Test 22: Invalid user preferences (should return 400)
    total_tests=$((total_tests + 1))
    local invalid_prefs_body='{
        "userPreferences": {
            "careerGoals": "not an array",
            "experienceLevel": "invalid_level",
            "timeCommitmentWeekly": -5
        }
    }'
    if test_endpoint_post "/v1/providers/aws/recommendations/study-paths" "$invalid_prefs_body" "Invalid User Preferences" 400; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid User Preferences (400)")
    else
        test_results+=("❌ Invalid User Preferences (400)")
    fi
    echo

    # Test 23: Invalid provider resources parameters (should return 400)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/aws/resources" "limit=invalid&offset=-1&maxCost=not_a_number" "Invalid Resource Parameters" 400; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid Resource Parameters (400)")
    else
        test_results+=("❌ Invalid Resource Parameters (400)")
    fi
    echo

    # Test 24: Invalid provider ID for roadmaps (should return 404)
    total_tests=$((total_tests + 1))
    if test_endpoint "GET" "/v1/providers/invalid-provider/roadmaps" "" "Invalid Provider Roadmaps" 404; then
        passed_tests=$((passed_tests + 1))
        test_results+=("✅ Invalid Provider Roadmaps (404)")
    else
        test_results+=("❌ Invalid Provider Roadmaps (404)")
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