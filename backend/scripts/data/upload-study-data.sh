#!/bin/bash

# Upload Study Data to S3 Script
# Organizes local study data files into the expected S3 structure
# Usage: ./upload-study-data.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-"dev"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../../../data/v2/final"
BUCKET_NAME="study-app-v3-${ENVIRONMENT}-question-data"

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

# Map exam codes to provider and exam info
get_provider_exam_info() {
    local filename="$1"
    local provider=""
    local exam_code=""
    local exam_name=""
    
    case "$filename" in
        clf-c02_*) 
            provider="aws"
            exam_code="clf-c02"
            exam_name="AWS Certified Cloud Practitioner"
            ;;
        sap-c02_*) 
            provider="aws"
            exam_code="sap-c02"
            exam_name="AWS Certified Solutions Architect Professional"
            ;;
        aif-c01_*) 
            provider="aws"
            exam_code="aif-c01"
            exam_name="AWS Certified AI Practitioner"
            ;;
        aws-sap-c02_*) 
            provider="aws"
            exam_code="sap-c02"
            exam_name="AWS Certified Solutions Architect Professional"
            ;;
        *) 
            log_error "Unknown exam format: $filename"
            return 1
            ;;
    esac
    
    echo "$provider,$exam_code,$exam_name"
}

# Upload a single study data file to proper S3 structure
upload_study_file() {
    local file_path="$1"
    local filename=$(basename "$file_path")
    
    # Skip non-study-data files
    if [[ ! "$filename" =~ _study_data\.json$ ]]; then
        log_warn "Skipping non-study-data file: $filename"
        return 0
    fi
    
    # Get provider and exam information
    local info=$(get_provider_exam_info "$filename")
    if [[ $? -ne 0 ]]; then
        log_error "Failed to parse provider/exam info for $filename"
        return 1
    fi
    
    IFS=',' read -r provider exam_code exam_name <<< "$info"
    
    # Create S3 key based on expected structure
    local s3_key="questions/${provider}/${exam_code}/questions.json"
    
    log_info "Uploading $filename to $s3_key..."
    log_info "  Provider: $provider"
    log_info "  Exam: $exam_code ($exam_name)"
    
    # Upload to S3 with proper metadata
    if aws s3 cp "$file_path" "s3://$BUCKET_NAME/$s3_key" \
        --content-type "application/json" \
        --metadata-directive REPLACE \
        --metadata "provider=$provider,exam-code=$exam_code,exam-name=$exam_name,uploaded-by=upload-study-data-script,uploaded-at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"; then
        log_info "✅ Successfully uploaded $filename"
        return 0
    else
        log_error "❌ Failed to upload $filename"
        return 1
    fi
}

# Upload all study data files
upload_all_files() {
    local uploaded=0
    local errors=0
    
    log_info "Uploading study data to s3://$BUCKET_NAME/questions/"
    
    for file in "$DATA_DIR"/*_study_data.json; do
        if [[ -f "$file" ]]; then
            if upload_study_file "$file"; then
                uploaded=$((uploaded + 1))
            else
                errors=$((errors + 1))
            fi
        fi
    done
    
    echo
    log_info "Upload Summary:"
    log_info "Successfully uploaded: $uploaded files"
    
    if [[ $errors -gt 0 ]]; then
        log_error "Errors: $errors files"
        return 1
    else
        log_info "🎉 All files uploaded successfully!"
        return 0
    fi
}

# List uploaded files for verification
verify_uploads() {
    log_info "Verifying uploaded files..."
    
    if aws s3 ls "s3://$BUCKET_NAME/questions/" --recursive; then
        log_info "✅ Files verified in S3"
    else
        log_warn "Could not list files in S3 bucket"
    fi
}

# Main function
main() {
    log_info "Starting Study Data Upload"
    log_info "Environment: $ENVIRONMENT"
    log_info "Data Directory: $DATA_DIR"
    log_info "Target Bucket: $BUCKET_NAME"
    echo
    
    # Check prerequisites
    check_aws_cli
    check_bucket_exists
    
    # Check if data directory exists
    if [[ ! -d "$DATA_DIR" ]]; then
        log_error "Data directory does not exist: $DATA_DIR"
        exit 1
    fi
    
    # Count study data files
    local file_count=$(find "$DATA_DIR" -name "*_study_data.json" -type f | wc -l)
    if [[ $file_count -eq 0 ]]; then
        log_error "No study data files found in $DATA_DIR"
        exit 1
    fi
    
    log_info "Found $file_count study data files to upload"
    
    # Upload files
    if upload_all_files; then
        # Verify uploads
        verify_uploads
        log_info "Study data upload completed successfully!"
    else
        log_error "Study data upload failed!"
        exit 1
    fi
}

# Run main function
main "$@"