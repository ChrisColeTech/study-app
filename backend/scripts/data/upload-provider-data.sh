#!/bin/bash

# Upload Provider Data to S3 Script
# Usage: ./upload-provider-data.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-"dev"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../../data/providers"
BUCKET_NAME="study-app-v3-${ENVIRONMENT}-question-data"
S3_PREFIX="providers/"

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

# Check if AWS CLI is available
check_aws_cli() {
    if ! command -v aws >/dev/null 2>&1; then
        log_error "AWS CLI is required but not installed. Please install it first."
        exit 1
    fi
}

# Check if bucket exists
check_bucket_exists() {
    if ! aws s3 ls "s3://$BUCKET_NAME" >/dev/null 2>&1; then
        log_error "S3 bucket '$BUCKET_NAME' does not exist or is not accessible."
        log_info "Please ensure the bucket exists and you have the necessary permissions."
        exit 1
    fi
}

# Validate JSON files
validate_json_files() {
    local valid=true
    
    for file in "$DATA_DIR"/*.json; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            log_info "Validating $filename..."
            
            if ! python3 -m json.tool "$file" >/dev/null 2>&1; then
                log_error "Invalid JSON in $filename"
                valid=false
            else
                log_info "✅ $filename is valid JSON"
            fi
        fi
    done
    
    if [[ "$valid" != "true" ]]; then
        log_error "Some JSON files are invalid. Please fix them before uploading."
        exit 1
    fi
}

# Upload files to S3
upload_files() {
    local uploaded=0
    local errors=0
    
    log_info "Uploading provider data to s3://$BUCKET_NAME/$S3_PREFIX"
    
    for file in "$DATA_DIR"/*.json; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            local s3_key="${S3_PREFIX}${filename}"
            
            log_info "Uploading $filename to $s3_key..."
            
            if aws s3 cp "$file" "s3://$BUCKET_NAME/$s3_key" \
                --content-type "application/json" \
                --metadata-directive REPLACE \
                --metadata "uploaded-by=upload-provider-data-script,uploaded-at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"; then
                log_info "✅ Successfully uploaded $filename"
                uploaded=$((uploaded + 1))
            else
                log_error "❌ Failed to upload $filename"
                errors=$((errors + 1))
            fi
        fi
    done
    
    echo
    log_info "Upload Summary:"
    log_info "Successfully uploaded: $uploaded files"
    
    if [[ $errors -gt 0 ]]; then
        log_error "Errors: $errors files"
        exit 1
    else
        log_info "🎉 All files uploaded successfully!"
    fi
}

# List uploaded files for verification
verify_uploads() {
    log_info "Verifying uploaded files..."
    
    if aws s3 ls "s3://$BUCKET_NAME/$S3_PREFIX" --recursive; then
        log_info "✅ Files verified in S3"
    else
        log_warn "Could not list files in S3 bucket"
    fi
}

# Main function
main() {
    log_info "Starting Provider Data Upload"
    log_info "Environment: $ENVIRONMENT"
    log_info "Data Directory: $DATA_DIR"
    log_info "Target Bucket: $BUCKET_NAME"
    log_info "S3 Prefix: $S3_PREFIX"
    echo
    
    # Check prerequisites
    check_aws_cli
    check_bucket_exists
    
    # Check if data directory exists
    if [[ ! -d "$DATA_DIR" ]]; then
        log_error "Data directory does not exist: $DATA_DIR"
        exit 1
    fi
    
    # Count JSON files
    local json_count=$(find "$DATA_DIR" -name "*.json" -type f | wc -l)
    if [[ $json_count -eq 0 ]]; then
        log_error "No JSON files found in $DATA_DIR"
        exit 1
    fi
    
    log_info "Found $json_count JSON files to upload"
    
    # Validate JSON files
    validate_json_files
    
    # Upload files
    upload_files
    
    # Verify uploads
    verify_uploads
    
    log_info "Provider data upload completed successfully!"
}

# Run main function
main "$@"