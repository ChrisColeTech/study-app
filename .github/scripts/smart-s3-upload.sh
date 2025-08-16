#!/bin/bash

# Smart S3 Upload Script
# Only uploads files when they have changed (git diff + hash validation)
# Usage: Called from GitHub Actions workflow

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

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

# Validate required environment variables
validate_environment() {
    if [ -z "$BUCKET_NAME" ]; then
        log_error "BUCKET_NAME environment variable is required"
        exit 1
    fi
    
    log_info "Using S3 bucket: $BUCKET_NAME"
}

# Check if git changes exist for a file pattern
check_git_changes() {
    local file_pattern="$1"
    
    # Check if this is the first commit
    if ! git rev-parse HEAD~1 >/dev/null 2>&1; then
        log_info "First commit detected - will upload all files"
        return 0
    fi
    
    # Check if files matching pattern changed
    if git diff --name-only HEAD~1 HEAD | grep -q "$file_pattern"; then
        return 0  # Changes found
    else
        return 1  # No changes
    fi
}

# Smart upload function with git + hash validation
smart_upload() {
    local local_file="$1"
    local s3_key="$2"
    local file_name="$3"
    local git_pattern="$4"
    
    log_section "Processing $file_name"
    
    # Check if local file exists
    if [ ! -f "$local_file" ]; then
        log_error "Local file not found: $local_file"
        return 1
    fi
    
    # Step 1: Git-based quick check
    if ! check_git_changes "$git_pattern"; then
        log_info "⏭️  Skipping $file_name (no git changes in $git_pattern)"
        return 1
    fi
    
    log_info "📁 Git changes detected for $file_name"
    
    # Step 2: Calculate local file hash
    local_hash=$(sha256sum "$local_file" | cut -d' ' -f1)
    log_info "📋 Local hash: $local_hash"
    
    # Step 3: Get S3 file hash from metadata
    s3_hash=$(aws s3api head-object \
        --bucket "$BUCKET_NAME" \
        --key "$s3_key" \
        --query 'Metadata.sha256' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$s3_hash" ] && [ "$s3_hash" != "None" ]; then
        log_info "📋 S3 hash: $s3_hash"
    else
        log_info "📋 S3 hash: (not found - new file or missing metadata)"
        s3_hash=""
    fi
    
    # Step 4: Compare hashes
    if [ "$local_hash" != "$s3_hash" ]; then
        log_info "🔄 Uploading $file_name (hash changed or new file)"
        
        # Get file size for logging
        file_size=$(stat -c%s "$local_file")
        file_size_mb=$(echo "scale=2; $file_size / 1024 / 1024" | bc -l)
        
        log_info "📊 File size: ${file_size_mb}MB"
        
        # Upload with metadata
        upload_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        
        if aws s3 cp "$local_file" "s3://$BUCKET_NAME/$s3_key" \
            --metadata sha256="$local_hash",upload-time="$upload_time",file-size="$file_size" \
            --no-progress; then
            
            log_info "✅ Successfully uploaded $file_name"
            
            # Verify upload
            verify_hash=$(aws s3api head-object \
                --bucket "$BUCKET_NAME" \
                --key "$s3_key" \
                --query 'Metadata.sha256' \
                --output text 2>/dev/null || echo "")
            
            if [ "$verify_hash" = "$local_hash" ]; then
                log_info "✅ Upload verification successful"
            else
                log_warn "⚠️  Upload verification failed - metadata may not be set correctly"
            fi
            
            return 0
        else
            log_error "❌ Failed to upload $file_name"
            return 1
        fi
    else
        log_info "⏭️  Skipping $file_name (hash unchanged)"
        return 1
    fi
}

# Get question count from JSON file
get_question_count() {
    local file_path="$1"
    
    if [ -f "$file_path" ]; then
        jq -r '.metadata.total_questions // (.study_data | length) // 0' "$file_path" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Main upload process
main() {
    log_section "==============================================="
    log_section "Smart S3 Upload - AWS Certification Exam Data"
    log_section "==============================================="
    
    validate_environment
    
    cd "$PROJECT_ROOT"
    
    # Verify git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    log_info "Working directory: $(pwd)"
    log_info "Git commit: $(git rev-parse HEAD)"
    
    # Track upload statistics
    local uploads=0
    local skipped=0
    local total_questions=0
    
    # Upload each exam dataset
    log_section "Processing exam datasets..."
    
    # AIF-C01 (AI Fundamentals)
    set +e  # Temporarily disable exit on error
    smart_upload \
        "data/v2/consolidated/aif-c01-consolidated_study_data.json" \
        "questions/aws/aif-c01/questions.json" \
        "AIF-C01" \
        "data/v2/consolidated/aif-c01"
    if [ $? -eq 0 ]; then
        ((uploads++))
        count=$(get_question_count "data/v2/consolidated/aif-c01-consolidated_study_data.json")
        total_questions=$((total_questions + count))
        log_info "📊 AIF-C01: $count questions"
    else
        ((skipped++))
    fi
    set -e  # Re-enable exit on error
    
    echo ""
    
    # CLF-C02 (Cloud Practitioner)
    set +e  # Temporarily disable exit on error
    smart_upload \
        "data/v2/consolidated/clf-c02-consolidated_study_data.json" \
        "questions/aws/clf-c02/questions.json" \
        "CLF-C02" \
        "data/v2/consolidated/clf-c02"
    if [ $? -eq 0 ]; then
        ((uploads++))
        count=$(get_question_count "data/v2/consolidated/clf-c02-consolidated_study_data.json")
        total_questions=$((total_questions + count))
        log_info "📊 CLF-C02: $count questions"
    else
        ((skipped++))
    fi
    set -e  # Re-enable exit on error
    
    echo ""
    
    # SAP-C02 (Solutions Architect Professional)
    set +e  # Temporarily disable exit on error
    smart_upload \
        "data/v2/consolidated/sap-c02-consolidated_study_data.json" \
        "questions/aws/sap-c02/questions.json" \
        "SAP-C02" \
        "data/v2/consolidated/sap-c02"
    if [ $? -eq 0 ]; then
        ((uploads++))
        count=$(get_question_count "data/v2/consolidated/sap-c02-consolidated_study_data.json")
        total_questions=$((total_questions + count))
        log_info "📊 SAP-C02: $count questions"
    else
        ((skipped++))
    fi
    set -e  # Re-enable exit on error
    
    echo ""
    
    # SAA-C03 (Solutions Architect Associate)
    set +e  # Temporarily disable exit on error
    smart_upload \
        "data/study_data_final.json" \
        "questions/aws/saa-c03/questions.json" \
        "SAA-C03" \
        "data/study_data_final.json"
    if [ $? -eq 0 ]; then
        ((uploads++))
        count=$(get_question_count "data/study_data_final.json")
        total_questions=$((total_questions + count))
        log_info "📊 SAA-C03: $count questions"
    else
        ((skipped++))
    fi
    set -e  # Re-enable exit on error
    
    echo ""
    
    # Summary report
    log_section "==============================================="
    log_section "Upload Summary"
    log_section "==============================================="
    
    log_info "📊 Files uploaded: $uploads"
    log_info "📊 Files skipped: $skipped"
    log_info "📊 Total files: $((uploads + skipped))"
    log_info "📊 Total questions: $total_questions"
    
    if [ $uploads -gt 0 ]; then
        log_info "🚀 Deployment optimized: $(echo "scale=1; $skipped * 100 / ($uploads + $skipped)" | bc -l)% of files skipped"
    else
        log_info "🚀 Deployment fully optimized: All files were up to date"
    fi
    
    # Set GitHub Actions output
    if [ -n "$GITHUB_OUTPUT" ]; then
        echo "files_uploaded=$uploads" >> "$GITHUB_OUTPUT"
        echo "files_skipped=$skipped" >> "$GITHUB_OUTPUT"
        echo "total_questions=$total_questions" >> "$GITHUB_OUTPUT"
    fi
    
    log_section "✅ Smart upload completed successfully"
    
    return 0
}

# Error handling
trap 'log_error "Script failed at line $LINENO"' ERR

# Run main function
main "$@"