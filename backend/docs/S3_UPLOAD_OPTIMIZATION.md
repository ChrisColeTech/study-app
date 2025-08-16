# S3 Upload Optimization - Only Upload Changed Files

**Date**: August 16, 2025  
**Context**: User request to optimize CI/CD workflow to only upload files when they change  
**Current Issue**: Every deployment uploads all 4 exam files to S3 regardless of changes  

---

## 🎯 CURRENT PROCESS ANALYSIS

### **Current Upload Behavior**
```bash
# Current workflow (uploads ALL files every deployment)
aws s3 cp data/v2/consolidated/aif-c01-consolidated_study_data.json s3://$BUCKET_NAME/questions/aws/aif-c01/questions.json
aws s3 cp data/v2/consolidated/clf-c02-consolidated_study_data.json s3://$BUCKET_NAME/questions/aws/clf-c02/questions.json
aws s3 cp data/v2/consolidated/sap-c02-consolidated_study_data.json s3://$BUCKET_NAME/questions/aws/sap-c02/questions.json
aws s3 cp data/study_data_final.json s3://$BUCKET_NAME/questions/aws/saa-c03/questions.json
```

### **Performance Impact**
- **File Sizes**: 132KB - 1.5MB per file (4 files total)
- **Upload Time**: ~30-60 seconds for all files
- **Frequency**: Every push to v3-implementation branch
- **Waste**: Uploads unchanged files unnecessarily

---

## 🚀 OPTIMIZATION STRATEGIES

### **Strategy 1: Hash-Based Change Detection**

**Implementation**:
```bash
# Enhanced upload script with hash checking
upload_if_changed() {
  local local_file="$1"
  local s3_path="$2"
  local file_name="$3"
  
  # Calculate local file hash
  local_hash=$(sha256sum "$local_file" | cut -d' ' -f1)
  
  # Get S3 file hash (stored as metadata)
  s3_hash=$(aws s3api head-object \
    --bucket "$BUCKET_NAME" \
    --key "${s3_path#s3://$BUCKET_NAME/}" \
    --query 'Metadata.sha256' \
    --output text 2>/dev/null || echo "")
  
  if [ "$local_hash" != "$s3_hash" ]; then
    echo "🔄 Uploading $file_name (hash changed: $local_hash)"
    aws s3 cp "$local_file" "$s3_path" \
      --metadata sha256="$local_hash"
    echo "✅ Uploaded $file_name"
    return 0
  else
    echo "⏭️  Skipping $file_name (unchanged)"
    return 1
  fi
}

# Usage in workflow
upload_if_changed "data/v2/consolidated/aif-c01-consolidated_study_data.json" \
  "s3://$BUCKET_NAME/questions/aws/aif-c01/questions.json" \
  "AIF-C01"
```

### **Strategy 2: Git-Based Change Detection**

**Implementation**:
```bash
# Check if exam data files changed in this commit
check_file_changes() {
  local file_pattern="$1"
  
  # Check if this is the first commit or if files changed
  if git rev-parse HEAD~1 >/dev/null 2>&1; then
    git diff --name-only HEAD~1 HEAD | grep -q "$file_pattern"
  else
    # First commit - upload everything
    return 0
  fi
}

# Usage in workflow
if check_file_changes "data/v2/consolidated/aif-c01"; then
  echo "🔄 AIF-C01 data changed, uploading..."
  aws s3 cp data/v2/consolidated/aif-c01-consolidated_study_data.json s3://$BUCKET_NAME/questions/aws/aif-c01/questions.json
else
  echo "⏭️  AIF-C01 data unchanged, skipping upload"
fi
```

### **Strategy 3: Timestamp-Based Detection**

**Implementation**:
```bash
# Compare file modification times
upload_if_newer() {
  local local_file="$1"
  local s3_path="$2"
  local file_name="$3"
  
  # Get local file modification time
  local_time=$(stat -c %Y "$local_file")
  
  # Get S3 file last modified time
  s3_time=$(aws s3api head-object \
    --bucket "$BUCKET_NAME" \
    --key "${s3_path#s3://$BUCKET_NAME/}" \
    --query 'LastModified' \
    --output text 2>/dev/null | xargs -I {} date -d {} +%s || echo "0")
  
  if [ "$local_time" -gt "$s3_time" ]; then
    echo "🔄 Uploading $file_name (newer: $(date -d @$local_time))"
    aws s3 cp "$local_file" "$s3_path"
    echo "✅ Uploaded $file_name"
    return 0
  else
    echo "⏭️  Skipping $file_name (not newer)"
    return 1
  fi
}
```

---

## 🏆 RECOMMENDED APPROACH

### **Hybrid Strategy: Git + Hash Validation**

**Why This Approach**:
1. **Git detection** provides fast initial filtering
2. **Hash validation** ensures data integrity
3. **Metadata storage** enables accurate comparison
4. **Rollback safety** preserves file history

**Implementation**:
```bash
# Enhanced upload function
smart_upload() {
  local local_file="$1"
  local s3_path="$2"
  local file_name="$3"
  local git_pattern="$4"
  
  # Step 1: Git-based quick check
  if git rev-parse HEAD~1 >/dev/null 2>&1; then
    if ! git diff --name-only HEAD~1 HEAD | grep -q "$git_pattern"; then
      echo "⏭️  Skipping $file_name (no git changes)"
      return 1
    fi
  fi
  
  # Step 2: Hash-based validation
  local_hash=$(sha256sum "$local_file" | cut -d' ' -f1)
  s3_hash=$(aws s3api head-object \
    --bucket "$BUCKET_NAME" \
    --key "${s3_path#s3://$BUCKET_NAME/}" \
    --query 'Metadata.sha256' \
    --output text 2>/dev/null || echo "")
  
  if [ "$local_hash" != "$s3_hash" ]; then
    echo "🔄 Uploading $file_name"
    echo "   Local:  $local_hash"
    echo "   S3:     $s3_hash"
    
    aws s3 cp "$local_file" "$s3_path" \
      --metadata sha256="$local_hash",upload-time="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    
    echo "✅ Uploaded $file_name"
    return 0
  else
    echo "⏭️  Skipping $file_name (hash unchanged)"
    return 1
  fi
}

# Usage in workflow
UPLOADS=0

smart_upload \
  "data/v2/consolidated/aif-c01-consolidated_study_data.json" \
  "s3://$BUCKET_NAME/questions/aws/aif-c01/questions.json" \
  "AIF-C01" \
  "data/v2/consolidated/aif-c01" && ((UPLOADS++))

smart_upload \
  "data/v2/consolidated/clf-c02-consolidated_study_data.json" \
  "s3://$BUCKET_NAME/questions/aws/clf-c02/questions.json" \
  "CLF-C02" \
  "data/v2/consolidated/clf-c02" && ((UPLOADS++))

smart_upload \
  "data/v2/consolidated/sap-c02-consolidated_study_data.json" \
  "s3://$BUCKET_NAME/questions/aws/sap-c02/questions.json" \
  "SAP-C02" \
  "data/v2/consolidated/sap-c02" && ((UPLOADS++))

smart_upload \
  "data/study_data_final.json" \
  "s3://$BUCKET_NAME/questions/aws/saa-c03/questions.json" \
  "SAA-C03" \
  "data/study_data_final.json" && ((UPLOADS++))

echo "📊 Upload Summary: $UPLOADS files uploaded out of 4 total"
```

---

## 📋 IMPLEMENTATION PLAN

### **Step 1: Create Enhanced Upload Script**
```bash
# Create: .github/scripts/smart-s3-upload.sh
chmod +x .github/scripts/smart-s3-upload.sh
```

### **Step 2: Update GitHub Actions Workflow**
Replace the current upload section in `.github/workflows/deploy-v3-stack.yml`:

```yaml
- name: Consolidate and upload exam data (Smart Upload)
  run: |
    STAGE=${{ github.event.inputs.stage || 'dev' }}
    export BUCKET_NAME="study-app-v3-$STAGE-question-data"
    
    echo "🔄 Smart uploading AWS Certification exam datasets..."
    
    # Run consolidation tool
    if [ -d "data/v2/final" ]; then
      echo "📊 Running consolidation tool..."
      python tools/consolidate_exam_datasets.py
    fi
    
    # Smart upload with change detection
    .github/scripts/smart-s3-upload.sh
```

### **Step 3: Benefits Validation**
- **Speed**: 70-90% faster when no data changes
- **Bandwidth**: Reduced S3 API calls and data transfer
- **Reliability**: Hash validation prevents corruption
- **Debugging**: Clear logging shows what changed

---

## 🔬 TESTING APPROACH

### **Test Scenarios**
1. **No Changes**: Deploy without data modifications → All uploads skipped
2. **Single File Change**: Modify one exam file → Only that file uploads  
3. **Multiple Changes**: Modify multiple files → Only changed files upload
4. **First Deploy**: Initial deployment → All files upload
5. **Hash Mismatch**: Corrupt S3 file → Re-upload detected

### **Validation Commands**
```bash
# Test git detection
git diff --name-only HEAD~1 HEAD | grep "data/v2/consolidated"

# Test hash comparison
sha256sum data/v2/consolidated/aif-c01-consolidated_study_data.json
aws s3api head-object --bucket study-app-v3-dev-question-data --key questions/aws/aif-c01/questions.json --query 'Metadata.sha256'

# Test S3 metadata
aws s3api head-object --bucket study-app-v3-dev-question-data --key questions/aws/aif-c01/questions.json
```

---

## 💡 ADDITIONAL OPTIMIZATIONS

### **Further Enhancements**
1. **Parallel Uploads**: Upload multiple files concurrently
2. **Progress Indicators**: Show upload progress for large files
3. **Retry Logic**: Handle transient S3 failures
4. **Compression**: Gzip files before upload (with detection)
5. **Cache Invalidation**: Clear CDN cache only for changed files

### **Monitoring Integration**
```bash
# Add CloudWatch metrics
aws cloudwatch put-metric-data \
  --namespace "StudyApp/Deployment" \
  --metric-data MetricName=FilesUploaded,Value=$UPLOADS,Unit=Count
```

This optimization will significantly reduce deployment time and AWS costs while maintaining data integrity and providing clear visibility into what changed.