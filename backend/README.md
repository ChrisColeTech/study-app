# Study App V3 Backend

A comprehensive AWS certification study platform backend built with AWS CDK, TypeScript, and serverless Lambda functions.

## 🏗️ Architecture & System Flow

The backend follows a clean architecture pattern with clear separation of concerns:

**Data Flow**: S3 (Questions) → API Gateway → Lambda → DynamoDB ← Analytics

### Core Question Flow
1. **Question Storage**: 1,082+ AWS certification questions stored in S3 as structured JSON, organized by provider/exam/topic
2. **Session Management**: User requests study session → Session Service orchestrates question selection → Session stored in DynamoDB  
3. **Question Delivery**: API serves questions from active session → User answers → Real-time progress tracking
4. **Analytics Processing**: Each answer updates statistics → Analytics Service calculates performance insights

### Key Components
- **Service Factory**: Singleton dependency injection managing all services and AWS clients
- **Session Service**: Core orchestration - creates adaptive sessions, manages lifecycle
- **Question Repository**: Reads structured question data from S3, filters by criteria
- **Analytics Service**: Processes session data for progress insights and performance trends
- **BaseHandler Pattern**: All requests flow through standardized parsing, validation, and response formatting

## 🚀 Implementation Status: 90% Complete (27/30 Phases)

✅ **Production Ready:**
- Complete CDK infrastructure with all AWS constructs  
- ServiceFactory dependency injection pattern
- Comprehensive session lifecycle management
- Question delivery system with adaptive difficulty
- Real-time analytics and progress tracking
- Goals management with milestone tracking
- Health monitoring with detailed diagnostics
- Profile management with achievements system
- Clean architecture with strict TypeScript

🔄 **Remaining (3 phases):**
- Phase 28: Reserved feature
- Phase 29: Detailed health diagnostics  
- Phase 30: JWT authentication system

## 📁 Project Structure

```
backend/
├── cdk-v3/                     # AWS CDK Infrastructure
│   ├── src/
│   │   ├── constructs/         # Reusable CDK constructs
│   │   ├── shared/             # CDK shared utilities
│   │   └── types/              # CDK type definitions
│   └── test/                   # CDK unit tests
├── src/                        # Lambda source code
│   ├── handlers/               # Lambda function handlers
│   ├── services/               # Business logic layer
│   ├── repositories/           # Data access layer
│   └── shared/                 # Shared utilities and patterns
├── tests/                      # Test suite
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   ├── mocks/                  # Mock implementations
│   └── fixtures/               # Test data
└── data/                       # Question data structure
```

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ 
- npm 8+
- AWS CLI configured
- AWS CDK CLI installed

### Installation

```bash
# Install backend dependencies
cd backend
npm install

# Install CDK dependencies
cd cdk-v3
npm install
```

### Build & Test

```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### CDK Deployment

```bash
cd cdk-v3

# Synthesize CloudFormation templates
npm run synth

# Deploy to development environment
npm run deploy:dev

# Deploy to production environment
npm run deploy:prod
```

## 🏥 Health Monitoring

The health endpoint provides comprehensive system monitoring:

### Basic Health Check
```
GET /health
```

Returns basic health status with dependency checks.

### Detailed System Status
```
GET /health/status
```

Returns comprehensive system information including:
- Environment details
- System metrics (memory, uptime)
- AWS Lambda information
- Database and storage health
- Configuration status

## 🧪 Testing

The project includes comprehensive testing:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions
- **Mocks**: AWS service mocks for testing
- **Fixtures**: Test data and scenarios

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode for development
npm run test:watch
```

## 📦 Build & Deployment

### Local Development

```bash
# Build and watch for changes
npm run build:watch

# Start local development server (if using SAM)
npm run local:start
```

### Production Build

```bash
# Clean and build
npm run clean && npm run build

# Bundle for deployment
npm run bundle
```

## 🔧 Configuration

Environment variables are managed through:

- CDK context values (`cdk.json`)
- Lambda environment variables (set by CDK)
- Runtime configuration (environment-specific)

### Key Environment Variables

- `NODE_ENV`: Environment (dev/staging/prod)
- `AWS_REGION`: AWS region
- `*_TABLE_NAME`: DynamoDB table names
- `*_BUCKET_NAME`: S3 bucket names
- `LOG_LEVEL`: Logging level

## 🏛️ Infrastructure Components

### DynamoDB Tables
- **Users**: User account information
- **StudySessions**: Active and historical study sessions
- **UserProgress**: Learning progress by topic/exam
- **Goals**: User-defined learning goals

### S3 Buckets
- **QuestionData**: Exam questions organized by provider
- **Assets**: Static assets and media

### Lambda Functions  
- **Health**: System monitoring and comprehensive health checks ✅
- **Auth**: User authentication and management (Phase 30)
- **User**: User profile and account management ✅
- **Provider**: AWS certification provider data ✅
- **Exam**: Certification exam metadata ✅  
- **Topic**: Subject topic organization ✅
- **Question**: Question delivery and management ✅
- **Session**: Study session lifecycle management ✅
- **Analytics**: Progress analytics and insights ✅
- **Goals**: Goal tracking and milestones ✅
- **Profile**: User profiles with achievements ✅

### API Gateway
- RESTful API with CORS support
- Token-based authorization
- Request/response validation
- Rate limiting and throttling

### CloudWatch
- Structured logging
- Performance metrics
- Health monitoring dashboards
- Automated alerting

## 📈 Monitoring & Observability

- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Metrics**: CloudWatch metrics for all components
- **Health Checks**: Automated health monitoring
- **Dashboards**: CloudWatch dashboards for system overview
- **Alerts**: Automated alerting for critical issues

## 🔒 Security

- **IAM**: Least privilege access policies
- **VPC**: Network isolation (when required)
- **Encryption**: At-rest and in-transit encryption
- **CORS**: Proper cross-origin resource sharing
- **Input Validation**: Request validation and sanitization

## 🚀 Production Capabilities

### Study Session Workflow
1. **Session Creation**: User selects provider/exam/topic → Questions retrieved from S3 → Session stored in DynamoDB
2. **Adaptive Learning**: System adjusts difficulty based on performance → Real-time progress tracking  
3. **Analytics Processing**: Answer patterns analyzed → Performance insights generated
4. **Goal Integration**: Session results update goal progress → Achievement calculations triggered

### Data Management
- **Question Database**: 1,082+ structured AWS certification questions with metadata
- **User Progress**: Comprehensive tracking across all topics and difficulty levels
- **Achievement System**: Multi-tier achievement calculation with rarity levels
- **Session Analytics**: Detailed performance insights and learning patterns

### Next Steps (Phase 30)
- **JWT Authentication**: Complete the authentication layer for production deployment

## 📚 Documentation

- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Project Structure](docs/PROJECT_STRUCTURE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Architecture Guide](docs/ARCHITECTURE.md)

## 🤝 Contributing

1. Follow TypeScript and ESLint rules
2. Write comprehensive tests for new features
3. Update documentation for API changes
4. Follow the established patterns and conventions
5. Ensure all health checks pass

## 📄 License

MIT License - see LICENSE file for details