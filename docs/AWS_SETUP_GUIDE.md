# AWS Account Setup and Deployment Guide

This guide walks you through setting up your AWS account and configuring the necessary credentials for automated deployment of the Study App infrastructure.

## 🚀 Quick Setup Checklist

- [ ] Create AWS account
- [ ] Configure AWS CLI
- [ ] Create IAM user for deployments
- [ ] Setup GitHub repository secrets
- [ ] Deploy the infrastructure

## 📋 Step 1: AWS Account Setup

### 1.1 Create AWS Account
1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Follow the registration process
4. **Important**: Set up billing alerts to avoid unexpected charges

### 1.2 Initial Security Setup
1. **Enable MFA on root account**:
   - Go to IAM → Security Credentials
   - Enable Multi-Factor Authentication
   - Use authenticator app (Google Authenticator, Authy, etc.)

2. **Create billing alert** (optional but recommended):
   - Go to CloudWatch → Billing
   - Create alarm for $10, $25, $50 thresholds

## 🔧 Step 2: AWS CLI Configuration

### 2.1 Install AWS CLI
```bash
# Windows (using winget)
winget install Amazon.AWSCLI

# macOS (using Homebrew)
brew install awscli

# Linux (using pip)
pip install awscli
```

### 2.2 Verify Installation
```bash
aws --version
# Should output: aws-cli/2.x.x Python/3.x.x ...
```

## 👤 Step 3: Create IAM User for Deployments

### 3.1 Create IAM User
1. Go to **IAM** in AWS Console
2. Click **Users** → **Create user**
3. Username: `study-app-deployer`
4. Select **Programmatic access** (Access Key & Secret)

### 3.2 Attach Policies
For the deployment user, attach these AWS managed policies:

**Required Policies:**
- `PowerUserAccess` (recommended for full deployment capabilities)

**OR for minimal permissions, attach these specific policies:**
- `AmazonS3FullAccess`
- `AmazonDynamoDBFullAccess`
- `AWSLambda_FullAccess`
- `AmazonAPIGatewayAdministrator`
- `CloudFrontFullAccess`
- `SecretsManagerReadWrite`
- `CloudFormationFullAccess`
- `IAMFullAccess`

### 3.3 Create Access Keys
1. Go to **Users** → `study-app-deployer` → **Security credentials**
2. Click **Create access key**
3. Select **Application running outside AWS**
4. **⚠️ IMPORTANT**: Save these credentials securely:
   - **Access Key ID**: `AKIA...`
   - **Secret Access Key**: `...`

## 🔐 Step 4: GitHub Secrets Configuration

In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions**

### 4.1 Required Repository Secrets
Click **New repository secret** and add each of these:

| Secret Name | Value | Where to Find |
|-------------|-------|---------------|
| `AWS_ACCESS_KEY_ID` | `AKIA...` | From Step 3.3 |
| `AWS_SECRET_ACCESS_KEY` | `...` | From Step 3.3 |
| `AWS_ACCOUNT_ID` | `123456789012` | AWS Console → Top right account menu |

### 4.2 How to Find Your AWS Account ID
1. **AWS Console Method**:
   - Click your username in top-right corner
   - Your 12-digit Account ID is displayed

2. **CLI Method**:
   ```bash
   aws sts get-caller-identity --query Account --output text
   ```

## ⚙️ Step 5: Configure AWS CLI Locally (Optional)

If you want to deploy from your local machine:

```bash
# Configure AWS CLI with your credentials
aws configure

# Enter when prompted:
AWS Access Key ID [None]: AKIA...
AWS Secret Access Key [None]: ...
Default region name [None]: us-east-1
Default output format [None]: json
```

### 5.1 Test AWS CLI Configuration
```bash
# Test connectivity
aws sts get-caller-identity

# Should output your user ARN and Account ID
```

## 🚀 Step 6: Deploy the Infrastructure

### 6.1 Automatic Deployment (Recommended)
1. **Push to GitHub**: Any push to `main` or `develop` branch will trigger deployment
2. **Manual Deployment**: Go to **Actions** → **Deploy Backend Infrastructure** → **Run workflow**

### 6.2 Manual Local Deployment
```bash
# Install CDK globally
npm install -g aws-cdk@2.167.0

# Navigate to CDK folder
cd cdk

# Install dependencies
npm install

# Bootstrap CDK (first time only)
npm run bootstrap

# Deploy the stack
STAGE=dev npm run deploy
```

## 📊 Step 7: Verify Deployment

### 7.1 Check AWS Resources
After deployment, verify these resources exist:

1. **CloudFormation**: Stack `StudyAppStack-dev` exists
2. **S3**: Two buckets created (`study-app-data-dev-*` and `study-app-frontend-dev-*`)
3. **DynamoDB**: Two tables created (`study-app-main-dev` and `study-app-cache-dev`)
4. **Lambda**: Multiple functions with names like `study-app-*-dev`
5. **API Gateway**: REST API named `study-app-api-dev`
6. **CloudFront**: Distribution for frontend hosting

### 7.2 Get API Gateway URL
```bash
# Using AWS CLI
aws cloudformation describe-stacks \
  --stack-name StudyAppStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

### 7.3 Test API Endpoint
```bash
# Test the API (should return CORS headers even with 401/403)
curl -X GET https://your-api-gateway-url/api/v1/providers
```

## 🎯 Step 8: Next Steps

### 8.1 Upload Question Data
```bash
# Upload your question JSON files to the data bucket
aws s3 cp data/study_data_final.json s3://study-app-data-dev-YOUR_ACCOUNT_ID/providers/aws/saa-c03/questions.json
```

### 8.2 Frontend Deployment
The frontend will deploy automatically when you push to the `frontend/` folder, or you can trigger it manually from GitHub Actions.

### 8.3 Access Your Application
- **Backend API**: Available at the API Gateway URL
- **Frontend**: Available at the CloudFront distribution URL

## 🛠 Troubleshooting

### Common Issues:

**1. Permission Denied Errors**
- Verify your IAM user has the correct policies attached
- Check that AWS credentials in GitHub secrets are correct

**2. Stack Deployment Fails**
- Check CloudFormation events in AWS Console for specific error
- Ensure you have sufficient service limits (Lambda functions, DynamoDB tables, etc.)

**3. Lambda Function Errors**
- Check CloudWatch Logs for the specific Lambda function
- Verify environment variables are set correctly

**4. API Gateway 403 Errors**
- Check that the custom authorizer Lambda is working
- Verify JWT secret exists in Secrets Manager

### Getting Help:
1. Check CloudFormation stack events for detailed error messages
2. Review Lambda function logs in CloudWatch
3. Use AWS Support if you have a support plan

## 💰 Cost Estimation

### Free Tier Resources (First 12 months):
- Lambda: 1M requests + 400,000 GB-seconds free
- DynamoDB: 25GB storage + 25 RCU/WCU free
- API Gateway: 1M requests free
- S3: 5GB storage + 20,000 GET/2,000 PUT requests free
- CloudFront: 1TB data transfer + 10M requests free

### Expected Monthly Cost (after free tier):
- **Low usage (1,000 users)**: $2-7/month
- **Medium usage (10,000 users)**: $15-30/month  
- **High usage (100,000 users)**: $100-200/month

## 🔒 Security Best Practices

1. **Never commit AWS credentials to Git**
2. **Use least-privilege IAM policies**
3. **Enable CloudTrail for audit logging**
4. **Set up billing alerts**
5. **Regularly rotate access keys**
6. **Monitor AWS Config for compliance**

---

**🎉 Congratulations!** Your AWS environment is now ready for the Study App deployment. The GitHub Actions workflows will handle automatic deployments when you push code changes.