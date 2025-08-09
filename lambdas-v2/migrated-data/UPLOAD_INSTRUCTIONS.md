# S3 Upload Instructions

## Directory Structure
The migrated data should be uploaded to S3 with the following structure:

```
your-bucket/
├── providers/
│   ├── providers.json          # All providers metadata
│   ├── aws.json               # AWS provider metadata
│   ├── azure.json             # Azure provider metadata
│   └── gcp.json               # GCP provider metadata
└── questions/
    └── aws/
        └── saa-c03/
            ├── questions.json  # Processed questions (681 questions)
            └── raw-data.json   # Raw data fallback
```

## AWS CLI Upload Commands
Assuming your S3 bucket is named 'study-app-data':

```bash
# Upload provider data
aws s3 cp providers/ s3://study-app-data/providers/ --recursive

# Upload question data
aws s3 cp questions/ s3://study-app-data/questions/ --recursive

# Verify upload
aws s3 ls s3://study-app-data/ --recursive
```

## Environment Variables
Make sure your Lambda functions have the following environment variable:
- S3_STUDY_DATA_BUCKET=study-app-data

## Statistics
- Total Questions: 681
- Questions with Explanations: 304
- Unique Topics: 7
- AWS Services Covered: 124
