# Study App V3 Backend

This is the backend infrastructure for Study App V3, built with AWS CDK, TypeScript, and serverless Lambda functions.

## 🏗️ Architecture

The backend follows a clean architecture pattern with clear separation of concerns:

- **CDK Infrastructure** (`cdk-v3/`): AWS infrastructure as code
- **Lambda Functions** (`src/`): Business logic organized by domain
- **Shared Utilities** (`src/shared/`): Common patterns and utilities
- **Tests** (`tests/`): Comprehensive testing suite

## 🚀 Phase 1: Infrastructure Foundation

This implementation represents **Phase 1** of the project, which includes:

✅ **Completed:**
- Complete directory structure following clean architecture
- CDK infrastructure setup with all AWS constructs
- BaseHandler and CrudHandler patterns for eliminating boilerplate
- ServiceFactory for dependency injection
- Health monitoring endpoint with comprehensive health checks
- Testing infrastructure with Jest and mocks
- TypeScript configuration with strict typing
- ESLint and Prettier for code quality

🔄 **Phase 2+ Features (Placeholders):**
- Authentication and authorization (JWT-based)
- User management system
- Study session lifecycle management
- Question and exam data management
- Analytics and progress tracking
- Goals management system

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
- **Health**: System monitoring and health checks
- **Auth**: Authentication and user management (Phase 2+)
- **Sessions**: Study session management (Phase 2+)
- **Questions**: Question and exam data (Phase 2+)
- **Analytics**: Progress analytics (Phase 2+)
- **Goals**: Goal tracking (Phase 2+)

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

## 🚀 Next Steps (Phase 2+)

1. **Authentication System**: JWT-based auth with refresh tokens
2. **User Management**: Registration, profile management, preferences
3. **Study Sessions**: Full lifecycle management with real-time progress
4. **Question Management**: Dynamic question loading and caching
5. **Analytics Engine**: Advanced progress tracking and insights
6. **Goal System**: Comprehensive goal setting and tracking

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