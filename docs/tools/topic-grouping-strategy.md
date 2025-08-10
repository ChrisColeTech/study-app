# Topic Grouping Strategy

## Analysis Results

### PDF Structure Discovery
- **All questions marked as "Topic 1"** in the source PDF
- **681 total questions** in a single continuous sequence
- **No natural topic boundaries** in the PDF format
- **Questions numbered 1-681** sequentially

### Logical Grouping Approach

Since the PDF doesn't have topic divisions, we'll create **logical service-based topics** for better study organization:

## Proposed Topic Groups

### Topic 1: Storage Services (S3, EBS, EFS)
- Amazon S3 configuration, security, performance
- Storage classes, lifecycle policies
- Cross-region replication, versioning
- EBS volumes, snapshots
- EFS file systems

### Topic 2: Compute Services (EC2, Lambda, Auto Scaling)
- EC2 instance types, placement groups
- Lambda functions, event triggers
- Auto Scaling groups, policies
- Elastic Load Balancing

### Topic 3: Networking (VPC, Route 53, CloudFront)
- VPC configuration, subnets, routing
- Security groups, NACLs
- Route 53 DNS, health checks
- CloudFront distributions

### Topic 4: Databases (RDS, DynamoDB, ElastiCache)
- RDS instances, read replicas
- Database security, backup strategies
- DynamoDB tables, indexes
- ElastiCache clusters

### Topic 5: Security & Identity (IAM, KMS, CloudTrail)
- IAM users, roles, policies
- Key management, encryption
- CloudTrail logging, monitoring
- Security best practices

### Topic 6: Messaging & Integration (SQS, SNS, Kinesis)
- SQS queues, message handling
- SNS topics, subscriptions
- Kinesis streams, analytics
- API Gateway

### Topic 7: Monitoring & Management (CloudWatch, CloudFormation)
- CloudWatch metrics, alarms
- CloudFormation templates
- Systems Manager
- Trusted Advisor

## Implementation Strategy

### Phase 1: Service Detection
- Analyze question text for AWS service keywords
- Use regex patterns to identify primary services
- Secondary service detection for multi-service questions

### Phase 2: Automatic Grouping
- Assign questions to topics based on primary service
- Handle multi-service questions with priority logic
- Validate groupings with manual spot-checks

### Phase 3: Balanced Distribution
- Ensure each topic has reasonable number of questions (80-120)
- Redistribute if needed for balanced study sessions
- Maintain question difficulty distribution across topics

## Benefits of This Approach

### For Studying
- **Service-focused learning**: Students can master one AWS service area at a time
- **Logical progression**: Natural learning path from basic to advanced services
- **Targeted practice**: Focus on weak service areas
- **Real-world relevance**: Mirrors how AWS services are actually used

### For the App
- **Better randomization**: Meaningful question groups for practice sessions
- **Progress tracking**: Per-service performance analytics
- **Study planning**: Structured learning path through AWS services
- **Difficulty progression**: Can order topics from basic to advanced

## Technical Implementation

The parser will be enhanced to:
1. **Extract primary AWS service** from each question
2. **Assign topic number** based on service category (1-7)
3. **Handle edge cases** (multi-service, no clear service)
4. **Validate distribution** across topics
5. **Export mapping** for manual review

This approach transforms the flat question list into a structured, educationally meaningful topic system.