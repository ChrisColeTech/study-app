# Backend Project Structure - Study App V3

## 🎯 Project Organization Overview

This document serves as the **centralized reference** for all backend file organization following clean architecture principles. The structure supports the 9 domain-based Lambda functions with proper separation of concerns and SOLID principle compliance.

## 📁 Complete Backend Structure

### Root Backend Organization
```
backend/
├── REQUIREMENTS.md                    # Project requirements and standards
├── docs/                             # Complete documentation (6 required documents)
│   ├── README.md                     # Comprehensive feature analysis
│   ├── IMPLEMENTATION_PLAN.md        # One feature per phase plan
│   ├── PROJECT_STRUCTURE.md          # This document
│   ├── ARCHITECTURE.md               # SOLID principles and patterns  
│   ├── API_REFERENCE.md              # Complete endpoint documentation
│   └── CODE_EXAMPLES.md              # Implementation pattern examples
├── scripts/                          # Build and deployment scripts
│   ├── init-app.sh                   # Application scaffolding script
│   ├── build.sh                      # CDK and Lambda build script
│   ├── deploy.sh                     # Deployment automation
│   └── test.sh                       # Testing automation
├── cdk-v3/                           # AWS CDK infrastructure
├── src/                              # Lambda function source code
├── shared/                           # Shared utilities and types
├── tests/                            # Test infrastructure
└── data/                             # Question data and test fixtures
```

## 🏗️ CDK Infrastructure Structure (cdk-v3/)

### CDK Project Organization
```
cdk-v3/
├── package.json                      # CDK dependencies and scripts
├── tsconfig.json                     # TypeScript configuration for CDK
├── cdk.json                          # CDK app configuration
├── jest.config.js                    # CDK testing configuration
├── src/
│   ├── study-app-v3.ts               # CDK app entry point
│   ├── study-app-stack-v3.ts         # Main stack definition
│   ├── constructs/                   # Reusable CDK constructs
│   │   ├── api-gateway-construct.ts  # API Gateway + TOKEN authorizer
│   │   ├── lambda-construct.ts       # Lambda function constructs
│   │   ├── database-construct.ts     # DynamoDB tables + GSIs
│   │   ├── storage-construct.ts      # S3 buckets + policies
│   │   ├── cache-construct.ts        # Redis/ElastiCache construct
│   │   ├── cloudfront-construct.ts   # CloudFront distribution
│   │   └── monitoring-construct.ts   # CloudWatch logs + metrics
│   ├── shared/                       # Shared CDK utilities
│   │   ├── stack-config.ts           # Environment configurations
│   │   ├── iam-policies.ts           # IAM policy templates
│   │   └── common-props.ts           # Common construct properties
│   └── types/
│       └── index.ts                  # CDK type definitions
├── test/                             # CDK unit tests
│   ├── constructs/                   # Construct testing
│   └── stacks/                       # Stack testing
└── cdk.out/                          # CDK build output (ignored)
```

### CDK Construct Relationships
```
StudyAppStackV3
├── DatabaseConstruct              # DynamoDB tables
│   ├── UsersTable (email-index GSI)
│   ├── StudySessionsTable (UserIdIndex GSI)  
│   ├── UserProgressTable
│   └── GoalsTable
├── StorageConstruct              # S3 buckets
│   ├── QuestionDataBucket (provider/exam organization)
│   └── AssetsBucket (static assets)
├── CacheConstruct                # Redis cluster
├── LambdaConstruct              # All 9 Lambda functions
│   ├── AuthLambda (auth.ts)
│   ├── ProvidersLambda (providers.ts)
│   ├── ExamsLambda (exams.ts)
│   ├── TopicsLambda (topics.ts)
│   ├── QuestionsLambda (questions.ts)
│   ├── SessionsLambda (sessions.ts)
│   ├── AnalyticsLambda (analytics.ts)
│   ├── GoalsLambda (goals.ts)
│   └── HealthLambda (health.ts)
├── ApiGatewayConstruct          # REST API + authorizer
└── MonitoringConstruct          # CloudWatch setup
```

## 🚀 Lambda Functions Structure (backend/src/)

### Lambda Organization by Domain
```
backend/
├── package.json                      # Lambda dependencies
├── tsconfig.json                     # TypeScript config for Lambdas
├── jest.config.js                    # Lambda testing configuration
├── src/
│   ├── handlers/                     # 9 domain-based Lambda handlers
│   │   ├── auth.ts                   # Authentication (4 endpoints)
│   │   ├── providers.ts              # Provider management (2 endpoints)
│   │   ├── exams.ts                  # Exam management (2 endpoints)
│   │   ├── topics.ts                 # Topic management (2 endpoints)
│   │   ├── questions.ts              # Question management (3 endpoints)
│   │   ├── sessions.ts               # Study sessions (7 endpoints)
│   │   ├── analytics.ts              # Analytics (3 endpoints)
│   │   ├── goals.ts                  # Goal management (4 endpoints)
│   │   └── health.ts                 # Health monitoring (2 endpoints)
│   ├── services/                     # Business logic layer
│   │   ├── auth.service.ts           # Authentication business logic
│   │   ├── user.service.ts           # User management logic
│   │   ├── question.service.ts       # Question processing logic
│   │   ├── session.service.ts        # Session lifecycle logic
│   │   ├── analytics.service.ts      # Analytics computation logic
│   │   ├── goals.service.ts          # Goal management logic
│   │   └── health.service.ts         # Health check logic
│   ├── repositories/                 # Data access layer
│   │   ├── user.repository.ts        # DynamoDB user operations
│   │   ├── session.repository.ts     # DynamoDB session operations
│   │   ├── question.repository.ts    # S3 question file operations
│   │   ├── progress.repository.ts    # DynamoDB progress operations
│   │   ├── goals.repository.ts       # DynamoDB goals operations
│   │   └── base.repository.ts        # Common repository patterns
│   └── shared/                       # Shared Lambda utilities
├── dist/                             # Compiled JavaScript output
└── node_modules/                     # Lambda dependencies (ignored)
```

### Shared Lambda Utilities Structure
```
backend/src/shared/
├── base-handler.ts                   # BaseHandler pattern (eliminates boilerplate)
├── crud-handler.ts                   # CrudHandler for standard CRUD operations
├── service-factory.ts                # Dependency injection factory
├── response-builder.ts               # Consistent API response formatting
├── logger.ts                         # Structured logging utility
├── validators/                       # Input validation schemas
│   ├── auth.validator.ts
│   ├── session.validator.ts
│   ├── question.validator.ts
│   └── base.validator.ts
├── middleware/                       # Express-like middleware
│   ├── auth.middleware.ts
│   ├── cors.middleware.ts
│   ├── error.middleware.ts
│   └── logging.middleware.ts
├── utils/                           # Utility functions
│   ├── crypto.util.ts
│   ├── date.util.ts
│   ├── pagination.util.ts
│   └── validation.util.ts
├── types/                           # TypeScript type definitions
│   ├── api.types.ts                 # API request/response types
│   ├── domain.types.ts              # Domain entity types
│   ├── auth.types.ts                # Authentication types
│   ├── session.types.ts             # Session types
│   └── index.ts                     # Type exports
├── constants/                       # Application constants
│   ├── api.constants.ts
│   ├── auth.constants.ts
│   └── error.constants.ts
└── config/                          # Runtime configuration
    ├── database.config.ts           # DynamoDB client config
    ├── storage.config.ts            # S3 client config
    ├── cache.config.ts              # Redis client config
    └── jwt.config.ts                # JWT configuration
```

## 🧪 Testing Infrastructure Structure (backend/tests/)

### Complete Test Organization
```
backend/tests/
├── jest.config.js                   # Main Jest configuration
├── setup/                          # Test setup and configuration
│   ├── jest.setup.ts               # Global test setup
│   ├── test-database.ts            # DynamoDB testing setup
│   └── test-environment.ts         # Environment variables for tests
├── unit/                           # Unit tests (90% coverage target)
│   ├── handlers/                   # Handler unit tests
│   │   ├── auth.handler.test.ts
│   │   ├── providers.handler.test.ts
│   │   ├── sessions.handler.test.ts
│   │   └── [all handlers].test.ts
│   ├── services/                   # Service layer unit tests
│   │   ├── auth.service.test.ts
│   │   ├── question.service.test.ts
│   │   ├── session.service.test.ts
│   │   └── [all services].test.ts
│   ├── repositories/               # Repository unit tests
│   │   ├── user.repository.test.ts
│   │   ├── session.repository.test.ts
│   │   └── [all repositories].test.ts
│   └── shared/                     # Shared utility tests
│       ├── base-handler.test.ts
│       ├── service-factory.test.ts
│       └── validators/
├── integration/                    # Integration tests
│   ├── api/                        # API endpoint integration tests
│   │   ├── auth.integration.test.ts
│   │   ├── sessions.integration.test.ts
│   │   └── [all endpoints].test.ts
│   ├── database/                   # Database integration tests
│   │   ├── dynamodb.integration.test.ts
│   │   └── s3.integration.test.ts
│   └── cache/                      # Cache integration tests
│       └── redis.integration.test.ts
├── e2e/                            # End-to-end tests
│   ├── user-journey.test.ts        # Complete user workflows
│   ├── study-session.test.ts       # Session lifecycle testing
│   └── cross-provider.test.ts      # Multi-provider functionality
├── performance/                    # Performance and load tests
│   ├── load-tests/
│   ├── stress-tests/
│   └── memory-tests/
├── mocks/                          # Mock implementations
│   ├── services/                   # Service mocks
│   │   ├── MockAuthService.ts
│   │   ├── MockQuestionService.ts
│   │   └── [all service mocks].ts
│   ├── repositories/               # Repository mocks
│   │   ├── MockUserRepository.ts
│   │   ├── MockSessionRepository.ts
│   │   └── [all repository mocks].ts
│   ├── aws/                        # AWS service mocks
│   │   ├── MockDynamoDB.ts
│   │   ├── MockS3.ts
│   │   └── MockRedis.ts
│   └── data/                       # Mock data
│       ├── users.mock.ts
│       ├── sessions.mock.ts
│       └── questions.mock.ts
├── fixtures/                       # Test data fixtures
│   ├── users/                      # User test data
│   ├── sessions/                   # Session test data
│   ├── questions/                  # Question test data
│   └── analytics/                  # Analytics test data
└── coverage/                       # Test coverage reports (ignored)
```

## 📊 Data Organization Structure

### Question Data Structure (S3)
```
data/questions/
├── aws/                            # AWS certification questions
│   ├── saa-c03/
│   │   ├── questions.json          # Main question file
│   │   ├── metadata.json           # Exam metadata
│   │   └── topics.json             # Topic organization
│   ├── dva-c01/
│   └── [other aws exams]/
├── azure/                          # Azure certification questions
│   ├── az-900/
│   ├── az-104/
│   └── [other azure exams]/
├── gcp/                            # Google Cloud certification questions
│   ├── ace/
│   ├── pca/
│   └── [other gcp exams]/
├── comptia/                        # CompTIA certification questions
│   ├── security-plus/
│   └── [other comptia exams]/
└── cisco/                          # Cisco certification questions
    ├── ccna/
    └── [other cisco exams]/
```

### Local Development Data
```
data/
├── questions/                      # Production question data (S3 sync)
├── test-data/                      # Test fixtures and mock data
│   ├── sample-questions.json
│   ├── test-users.json
│   └── sample-sessions.json
├── migrations/                     # Database migration scripts
│   ├── 001_initial_tables.sql
│   └── 002_add_gsi_indexes.sql
└── seeds/                          # Data seeding scripts
    ├── seed-questions.ts
    ├── seed-users.ts
    └── seed-test-data.ts
```

## 🔧 Build and Configuration Structure

### Build Scripts and Configuration
```
backend/scripts/
├── init-app.sh                     # Complete app scaffolding script
├── build/                          # Build automation
│   ├── build-cdk.sh               # CDK build script
│   ├── build-lambdas.sh           # Lambda compilation
│   ├── bundle-lambdas.sh          # Lambda bundling with esbuild
│   └── lint-and-format.sh         # Code quality checks
├── deploy/                         # Deployment scripts
│   ├── deploy-dev.sh              # Development environment
│   ├── deploy-staging.sh          # Staging environment
│   ├── deploy-prod.sh             # Production environment
│   └── rollback.sh                # Deployment rollback
├── test/                           # Testing scripts
│   ├── run-unit-tests.sh          # Unit test execution
│   ├── run-integration-tests.sh   # Integration test execution
│   ├── run-e2e-tests.sh           # End-to-end test execution
│   └── generate-coverage.sh       # Coverage report generation
└── data/                           # Data management scripts
    ├── sync-questions.sh           # S3 question data sync
    ├── backup-database.sh          # DynamoDB backup
    └── restore-database.sh         # DynamoDB restore
```

### Configuration Files
```
backend/app/
├── .env.example                    # Environment variables template
├── .env.development               # Development environment config
├── .env.staging                   # Staging environment config
├── .gitignore                     # Git ignore patterns
├── .eslintrc.js                   # ESLint configuration
├── .prettierrc                    # Prettier formatting rules
└── package.json                   # Root package.json with workspace config
```

## 🎯 Module Dependencies and Imports

### Import Structure Guidelines

#### Handler Layer Imports
```typescript
// handlers/*.ts
import { BaseHandler } from '../shared/base-handler';
import { CrudHandler } from '../shared/crud-handler';
import { ServiceFactory } from '../shared/service-factory';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
```

#### Service Layer Imports  
```typescript
// services/*.ts
import { UserRepository, SessionRepository } from '../repositories';
import { Logger } from '../shared/logger';
import { ValidationService } from '../shared/validators';
import { BusinessException } from '../shared/exceptions';
```

#### Repository Layer Imports
```typescript  
// repositories/*.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { BaseRepository } from './base.repository';
import { DatabaseConfig } from '../shared/config';
```

#### Shared Module Imports
```typescript
// shared/*.ts
import { ResponseBuilder } from './response-builder';
import { Logger } from './logger';
import { ValidationResult } from './types';
```

### Dependency Flow Rules
```
Handler Layer
    ↓ (can import)
Service Layer
    ↓ (can import)  
Repository Layer
    ↓ (can import)
Shared Utilities

❌ No upward imports allowed
❌ No cross-domain direct imports
✅ Shared utilities can be imported by all layers
```

## 🎖️ Component Relationships

### Clean Architecture Layer Interaction
```
┌─────────────────┐
│  Handler Layer  │ ← HTTP requests/responses only
├─────────────────┤
│  Service Layer  │ ← Business logic and domain rules
├─────────────────┤  
│Repository Layer │ ← Data access abstraction
├─────────────────┤
│ Infrastructure  │ ← AWS SDK clients and external
└─────────────────┘
```

### Domain Boundaries
```
Authentication Domain
├── AuthHandler
├── AuthService & UserService
├── UserRepository
└── JWT utilities

Question Domain  
├── QuestionsHandler, ProvidersHandler, ExamsHandler, TopicsHandler
├── QuestionService
├── QuestionRepository (S3)
└── Search utilities

Session Domain
├── SessionsHandler
├── SessionService
├── SessionRepository (DynamoDB)
└── Progress tracking

Analytics Domain
├── AnalyticsHandler
├── AnalyticsService
├── ProgressRepository
└── Computation utilities

Goals Domain
├── GoalsHandler (extends CrudHandler)
├── GoalsService  
├── GoalsRepository
└── Goal tracking utilities
```

## 📝 File Naming Conventions

### Consistent Naming Standards
- **Handlers**: `domain.ts` (e.g., `auth.ts`, `sessions.ts`)
- **Services**: `domain.service.ts` (e.g., `auth.service.ts`)
- **Repositories**: `domain.repository.ts` (e.g., `user.repository.ts`)
- **Types**: `domain.types.ts` (e.g., `auth.types.ts`)
- **Tests**: `filename.test.ts` (e.g., `auth.service.test.ts`)
- **Mocks**: `Mock{ClassName}.ts` (e.g., `MockUserService.ts`)
- **Constants**: `domain.constants.ts` (e.g., `api.constants.ts`)
- **Configs**: `domain.config.ts` (e.g., `database.config.ts`)

### Directory Naming Standards  
- **snake_case** for directory names (e.g., `test_data`, `build_scripts`)
- **camelCase** for TypeScript files (e.g., `authService.ts`)
- **PascalCase** for class names (e.g., `AuthService`, `BaseHandler`)
- **UPPER_CASE** for constants and environment variables

This project structure provides a complete, centralized reference for all backend file organization that supports clean architecture principles, comprehensive testing, and maintainable development practices.