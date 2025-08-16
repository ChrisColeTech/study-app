#!/bin/bash

# Master Endpoint Test Suite
# Usage: ./test-all-endpoints.sh [base-url] [environment]

set -e

# Configuration
ENVIRONMENT=${2:-"dev"}
BASE_URL=${1:-"https://l1dj6h3lie.execute-api.us-east-2.amazonaws.com/dev"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

log_section() {
    echo -e "${BLUE}[SECTION]${NC} $1"
}

# Main test execution
main() {
    log_section "==============================================="
    log_section "Study App V3 Backend - Comprehensive Test Suite"
    log_section "==============================================="
    log_info "Environment: $ENVIRONMENT"
    log_info "Base URL: $BASE_URL"
    echo

    # Test order matters - auth first to establish authentication patterns
    # Other domains can be tested independently since most are public endpoints for now
    DOMAINS=("auth" "provider" "exam" "topic" "question" "session" "analytics" "goals" "user")  # All available test scripts
    RESULTS=()
    PASSED=0
    FAILED=0

    # Check if test scripts exist
    for domain in "${DOMAINS[@]}"; do
        script_path="$SCRIPT_DIR/test-${domain}-endpoints.sh"
        if [[ ! -f "$script_path" ]]; then
            log_warn "Test script not found: $script_path (skipping $domain tests)"
            RESULTS+=("⚠️  $domain (script not found)")
            continue
        fi
        
        if [[ ! -x "$script_path" ]]; then
            chmod +x "$script_path"
        fi
    done

    # Run tests for each domain
    for domain in "${DOMAINS[@]}"; do
        script_path="$SCRIPT_DIR/test-${domain}-endpoints.sh"
        if [[ ! -f "$script_path" ]]; then
            continue
        fi

        log_section "Testing $domain endpoints..."
        if "$script_path" "$BASE_URL"; then
            RESULTS+=("✅ $domain")
            ((PASSED++))
        else
            RESULTS+=("❌ $domain")
            ((FAILED++))
        fi
        echo
    done

    # Summary Report
    log_section "==============================================="
    log_section "Test Suite Summary"
    log_section "==============================================="
    
    for result in "${RESULTS[@]}"; do
        if [[ "$result" == ✅* ]]; then
            echo -e "${GREEN}  $result${NC}"
        elif [[ "$result" == ❌* ]]; then
            echo -e "${RED}  $result${NC}"
        else
            echo -e "${YELLOW}  $result${NC}"
        fi
    done
    
    echo
    log_info "Total Domains: $((PASSED + FAILED))"
    log_info "Passed: $PASSED"
    
    if [[ $FAILED -gt 0 ]]; then
        log_error "Failed: $FAILED"
        echo
        log_error "Some tests failed. Check the output above for details."
        return 1
    else
        echo
        log_info "🎉 All tests passed successfully!"
        return 0
    fi
}

# Dependency checks
check_dependencies() {
    local missing=0
    
    if ! command -v curl >/dev/null 2>&1; then
        log_error "curl is required but not installed."
        ((missing++))
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq is not installed. JSON formatting will be limited."
    fi
    
    if [[ $missing -gt 0 ]]; then
        log_error "Missing required dependencies. Please install and try again."
        exit 1
    fi
}

# Help function
show_help() {
    echo "Study App V3 Backend - Comprehensive Test Suite"
    echo
    echo "Usage: $0 [base-url] [environment]"
    echo
    echo "Arguments:"
    echo "  base-url      API base URL (default: current deployed URL)"
    echo "  environment   Environment name (default: dev)"
    echo
    echo "Examples:"
    echo "  $0"
    echo "  $0 https://api-staging.example.com/v1 staging"
    echo "  $0 http://localhost:3000 local"
    echo
    echo "Available domain tests:"
    for domain in auth provider session question user; do
        script_path="$SCRIPT_DIR/test-${domain}-endpoints.sh"
        if [[ -f "$script_path" ]]; then
            echo "  ✅ $domain"
        else
            echo "  ⏳ $domain (not yet implemented)"
        fi
    done
    echo
    echo "Individual domain tests can be run with:"
    echo "  npm run test:endpoints:auth"
    echo "  npm run test:endpoints:provider"
    echo "  npm run test:endpoints:session"
    echo "  npm run test:endpoints:question"
    echo "  npm run test:endpoints:user"
}

# Handle help flag
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# Pre-flight checks
check_dependencies

# Run the test suite
main "$@"