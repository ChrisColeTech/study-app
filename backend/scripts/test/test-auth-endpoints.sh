#!/bin/bash

# Test Auth Endpoints Script
# Usage: ./test-auth-endpoints.sh [base-url]

set -e

# Configuration
BASE_URL=${1:-"https://l1dj6h3lie.execute-api.us-east-2.amazonaws.com/dev"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../../tests/fixtures/auth"
TEMP_DIR="/tmp/auth-test-$$"

# Create temp directory for test results
mkdir -p "$TEMP_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data_file=$3
    local description=$4
    local auth_header=$5
    
    log_info "Testing: $description"
    echo "  URL: $method $BASE_URL$endpoint"
    
    local curl_cmd="curl -s -w '%{http_code}' -X $method '$BASE_URL$endpoint' -H 'Content-Type: application/json'"
    
    if [[ -n "$auth_header" ]]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $auth_header'"
    fi
    
    if [[ -n "$data_file" && -f "$data_file" ]]; then
        curl_cmd="$curl_cmd -d @'$data_file'"
        echo "  Data: $(cat "$data_file")"
    fi
    
    local response=$(eval $curl_cmd)
    local http_code="${response: -3}"
    local body="${response%???}"
    
    echo "  HTTP Code: $http_code"
    echo "  Response: $body" | jq . 2>/dev/null || echo "  Response: $body"
    
    # Save response for potential reuse
    local endpoint_name=$(basename "$endpoint")
    echo "$body" > "$TEMP_DIR/${endpoint_name}_response.json"
    
    if [[ "$http_code" =~ ^[23] ]]; then
        log_info "✅ Test passed"
        return 0
    else
        log_error "❌ Test failed"
        return 1
    fi
}

# Extract token from response
extract_token() {
    local response_file=$1
    local token_type=$2
    
    if [[ -f "$response_file" ]]; then
        jq -r ".data.${token_type} // empty" "$response_file" 2>/dev/null || echo ""
    fi
}

# Main test sequence
main() {
    log_info "Starting Auth Endpoints Test Suite"
    log_info "Base URL: $BASE_URL"
    log_info "Fixtures Directory: $FIXTURES_DIR"
    echo

    # Test 1: Health Check
    test_endpoint "GET" "/v1/health" "" "Health Check"
    echo

    # Test 2: User Registration (with dynamic email to avoid conflicts)
    local temp_register_file="$TEMP_DIR/register_dynamic.json"
    local dynamic_email="test$(date +%s)@example.com"
    sed "s/testuser@example.com/$dynamic_email/g" "$FIXTURES_DIR/register.json" > "$temp_register_file"
    
    test_endpoint "POST" "/v1/auth/register" "$temp_register_file" "User Registration"
    local register_token=$(extract_token "$TEMP_DIR/register_response.json" "accessToken")
    echo

    # Test 3: User Login (with the dynamic user we just created)
    local temp_login_file="$TEMP_DIR/login_dynamic.json"
    sed "s/testuser@example.com/$dynamic_email/g" "$FIXTURES_DIR/login.json" > "$temp_login_file"
    
    test_endpoint "POST" "/v1/auth/login" "$temp_login_file" "User Login"
    local login_token=$(extract_token "$TEMP_DIR/login_response.json" "accessToken")
    local refresh_token=$(extract_token "$TEMP_DIR/login_response.json" "refreshToken")
    echo

    # Test 4: Token Refresh (update fixture with actual token)
    if [[ -n "$refresh_token" ]]; then
        local temp_refresh_file="$TEMP_DIR/refresh.json"
        echo "{\"refreshToken\": \"$refresh_token\"}" > "$temp_refresh_file"
        test_endpoint "POST" "/v1/auth/refresh" "$temp_refresh_file" "Token Refresh"
        local new_token=$(extract_token "$TEMP_DIR/refresh_response.json" "accessToken")
        echo
    else
        log_warn "No refresh token available, skipping refresh test"
    fi

    # Test 5: User Logout
    local logout_token=${new_token:-$login_token}
    if [[ -n "$logout_token" ]]; then
        test_endpoint "POST" "/v1/auth/logout" "" "User Logout" "$logout_token"
        echo
    else
        log_warn "No access token available, skipping logout test"
    fi

    log_info "Test suite completed"
    log_info "Test artifacts saved to: $TEMP_DIR"
}

# Cleanup function
cleanup() {
    if [[ -d "$TEMP_DIR" ]]; then
        log_info "Cleaning up temporary files..."
        rm -rf "$TEMP_DIR"
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Check dependencies
command -v curl >/dev/null 2>&1 || { log_error "curl is required but not installed. Aborting."; exit 1; }
command -v jq >/dev/null 2>&1 || { log_warn "jq is not installed. JSON formatting will be disabled."; }

# Run tests
main "$@"